import { createStore, applyMiddleware } from 'redux';
import type { AnyAction, Action } from 'redux';
import thunk from 'redux-thunk';
import type { ThunkAction } from 'redux-thunk';
import type { ActivateHelpers } from '@mongodb-js/compass-app-registry';
import type { Logger } from '@mongodb-js/compass-logging/provider';
import type { ConnectionsService } from '@mongodb-js/compass-connections/provider';
import type { Document } from 'bson';
import type { ConfigBackend } from '../config/backend';
import { NullConfigBackend } from '../config/backend';
import { parseConfigText, setInConfigText } from '../config/document';
import type { YamlPathSegment } from '../config/document';
import { parseHighlighterConfig } from '../config/schema';
import { parseMappingsFile } from '../config/mappings';
import { parseModelsFile } from '../config/models';
import type { MappingsState, ModelsState } from './reducer';
import type { ListingMode } from '../config/schema';
import { EXAMPLE_CONFIG_YAML } from '../config/example-config';
import { reducer, HighlighterActionTypes, INITIAL_STATE } from './reducer';
import type { HighlighterAction, HighlighterState } from './reducer';
import { HighlighterContext } from './context';

export type HighlighterServices = {
  logger: Logger;
  connections: ConnectionsService;
};

export const RELATED_DOCUMENTS_LIMIT = 10;

/**
 * Finds the documents a mapped field value points at. Lives in the store so
 * that components never touch the data service directly.
 */
export const fetchRelatedDocuments = (
  connectionId: string,
  namespace: string,
  filter: Record<string, unknown>
): HighlighterThunkAction<Promise<Document[]>> => {
  return (_dispatch, _getState, { connections }) => {
    const dataService = connections.getDataServiceForConnection(connectionId);
    return dataService.find(namespace, filter, {
      limit: RELATED_DOCUMENTS_LIMIT,
      maxTimeMS: 10_000,
    });
  };
};

type HighlighterExtraArgs = HighlighterServices & {
  backend: ConfigBackend;
};

export type HighlighterThunkAction<
  R,
  A extends Action = AnyAction,
> = ThunkAction<R, HighlighterState, HighlighterExtraArgs, A>;

export const loadMappings = (): HighlighterThunkAction<
  Promise<void>,
  HighlighterAction
> => {
  return async (dispatch, _getState, { backend, logger }) => {
    const mappings: MappingsState = { byDatabase: {}, errors: {} };
    let sources;
    try {
      sources = await backend.readMappings();
    } catch (err) {
      logger.log.warn(
        logger.mongoLogId(1_001_000_402),
        'Highlighter',
        'Failed to list mapping files',
        { error: (err as Error).message }
      );
      return;
    }
    for (const source of sources) {
      try {
        const file = parseMappingsFile(parseConfigText(source.text));
        // The file name wins over `database:` inside, so a copied file cannot
        // silently attach itself to the wrong database.
        mappings.byDatabase[source.database] = {
          ...file,
          database: source.database,
        };
      } catch (err) {
        mappings.errors[source.database] = (err as Error).message;
        logger.log.warn(
          logger.mongoLogId(1_001_000_403),
          'Highlighter',
          'Failed to parse mapping file',
          { path: source.path, error: (err as Error).message }
        );
      }
    }
    dispatch({ type: HighlighterActionTypes.MappingsLoaded, mappings });
  };
};

export const loadModels = (): HighlighterThunkAction<
  Promise<void>,
  HighlighterAction
> => {
  return async (dispatch, _getState, { backend, logger }) => {
    const models: ModelsState = { byDatabase: {}, errors: {} };
    let sources;
    try {
      sources = await backend.readModels();
    } catch (err) {
      logger.log.warn(
        logger.mongoLogId(1_001_000_404),
        'Highlighter',
        'Failed to list model files',
        { error: (err as Error).message }
      );
      return;
    }
    for (const source of sources) {
      try {
        const file = parseModelsFile(parseConfigText(source.text));
        models.byDatabase[source.database] = {
          ...file,
          database: source.database,
        };
      } catch (err) {
        models.errors[source.database] = (err as Error).message;
        logger.log.warn(
          logger.mongoLogId(1_001_000_405),
          'Highlighter',
          'Failed to parse model file',
          { path: source.path, error: (err as Error).message }
        );
      }
    }
    dispatch({ type: HighlighterActionTypes.ModelsLoaded, models });
  };
};

export const loadConfig = (): HighlighterThunkAction<
  Promise<void>,
  HighlighterAction
> => {
  return async (dispatch, _getState, { backend, logger }) => {
    if (backend instanceof NullConfigBackend) {
      return;
    }
    await dispatch(loadMappings());
    await dispatch(loadModels());
    const configPath = backend.path;
    try {
      if (!(await backend.exists())) {
        dispatch({ type: HighlighterActionTypes.ConfigMissing, configPath });
        return;
      }
      const config = parseHighlighterConfig(
        parseConfigText(await backend.readText())
      );
      dispatch({
        type: HighlighterActionTypes.ConfigLoaded,
        configPath: backend.path,
        config,
      });
    } catch (err) {
      const error = (err as Error).message;
      logger.log.warn(
        logger.mongoLogId(1_001_000_400),
        'Highlighter',
        'Failed to load highlighter config',
        { path: configPath, error }
      );
      dispatch({
        type: HighlighterActionTypes.ConfigFailed,
        configPath: backend.path,
        error,
      });
    }
  };
};

/**
 * All persistent edits go through the backend. The watcher then reloads the
 * store, so the YAML stays the single source of truth even for UI edits.
 */
const writeAndReload = (
  mutate: (text: string) => string
): HighlighterThunkAction<Promise<void>, HighlighterAction> => {
  return async (dispatch, _getState, { backend, logger }) => {
    try {
      const text = (await backend.exists()) ? await backend.readText() : '';
      await backend.writeText(mutate(text));
    } catch (err) {
      const error = (err as Error).message;
      logger.log.warn(
        logger.mongoLogId(1_001_000_401),
        'Highlighter',
        'Failed to write highlighter config',
        { path: backend.path, error }
      );
      dispatch({
        type: HighlighterActionTypes.ConfigFailed,
        configPath: backend.path,
        error,
      });
      return;
    }
    await dispatch(loadConfig());
  };
};

const setIn = (path: YamlPathSegment[], value: unknown) =>
  writeAndReload((text) => setInConfigText(text, path, value));

export const setActiveFeature = (featureId: string | null) =>
  setIn(['activeFeature'], featureId);

export const setTagFilter = (tagFilter: string[]): HighlighterAction => ({
  type: HighlighterActionTypes.TagFilterChanged,
  tagFilter,
});

export const setListingOverride = (
  listingOverride: ListingMode | null
): HighlighterAction => ({
  type: HighlighterActionTypes.ListingOverrideChanged,
  listingOverride,
});

const featureIndex = (state: HighlighterState, featureId: string): number => {
  const index =
    state.config?.features.findIndex((f) => f.id === featureId) ?? -1;
  if (index === -1) {
    throw new Error(`Feature "${featureId}" not found in highlighter config`);
  }
  return index;
};

const collectionIndex = (
  state: HighlighterState,
  fIndex: number,
  namespace: string
): number => {
  const index =
    state.config?.features[fIndex].collections?.findIndex(
      (c) => c.namespace === namespace
    ) ?? -1;
  if (index === -1) {
    throw new Error(`Collection "${namespace}" not found in feature`);
  }
  return index;
};

export const updateFeatureNotes = (
  featureId: string,
  notes: string
): HighlighterThunkAction<Promise<void>, HighlighterAction> => {
  return (dispatch, getState) => {
    const fIndex = featureIndex(getState(), featureId);
    return dispatch(setIn(['features', fIndex, 'notes'], notes));
  };
};

export const updateCollectionNotes = (
  featureId: string,
  namespace: string,
  notes: string
): HighlighterThunkAction<Promise<void>, HighlighterAction> => {
  return (dispatch, getState) => {
    const state = getState();
    const fIndex = featureIndex(state, featureId);
    const cIndex = collectionIndex(state, fIndex, namespace);
    return dispatch(
      setIn(['features', fIndex, 'collections', cIndex, 'notes'], notes)
    );
  };
};

export const updateFieldNotes = (
  featureId: string,
  namespace: string,
  fieldPath: string,
  notes: string
): HighlighterThunkAction<Promise<void>, HighlighterAction> => {
  return (dispatch, getState) => {
    const state = getState();
    const fIndex = featureIndex(state, featureId);
    const cIndex = collectionIndex(state, fIndex, namespace);
    const fieldIdx =
      state.config?.features[fIndex].collections?.[cIndex].fields?.findIndex(
        (f) => f.path === fieldPath
      ) ?? -1;
    if (fieldIdx === -1) {
      throw new Error(`Field "${fieldPath}" not found in ${namespace}`);
    }
    return dispatch(
      setIn(
        [
          'features',
          fIndex,
          'collections',
          cIndex,
          'fields',
          fieldIdx,
          'notes',
        ],
        notes
      )
    );
  };
};

export const toggleCheck = (
  featureId: string,
  checkIndex: number,
  done: boolean
): HighlighterThunkAction<Promise<void>, HighlighterAction> => {
  return (dispatch, getState) => {
    const fIndex = featureIndex(getState(), featureId);
    return dispatch(
      setIn(['features', fIndex, 'checks', checkIndex, 'done'], done)
    );
  };
};

export const createConfigFromExample =
  (): HighlighterThunkAction<Promise<void>, HighlighterAction> =>
  async (dispatch, _getState, { backend }) => {
    if (await backend.exists()) {
      throw new Error(`${backend.path} already exists`);
    }
    await dispatch(writeAndReload(() => EXAMPLE_CONFIG_YAML));
  };

export function configureStore(
  services: HighlighterServices,
  backend: ConfigBackend
) {
  return createStore(
    reducer,
    {
      ...INITIAL_STATE,
      configPath: backend.path,
      status: backend instanceof NullConfigBackend ? 'disabled' : 'loading',
    },
    applyMiddleware(
      thunk.withExtraArgument<HighlighterExtraArgs>({ ...services, backend })
    )
  );
}

export type HighlighterStore = ReturnType<typeof configureStore>;

export type HighlighterPluginProps = {
  /**
   * Where the YAML config comes from. Desktop passes a file backend, the
   * compass-web sandbox an HTTP backend. Without one the plugin is disabled.
   */
  backend?: ConfigBackend;
  children?: React.ReactNode;
};

export function activatePlugin(
  { backend = new NullConfigBackend() }: HighlighterPluginProps,
  services: HighlighterServices,
  { addCleanup, cleanup }: ActivateHelpers
) {
  const store = configureStore(services, backend);
  void store.dispatch(loadConfig());
  addCleanup(
    backend.watch(() => {
      void store.dispatch(loadConfig());
    })
  );
  return { store, deactivate: cleanup, context: HighlighterContext };
}
