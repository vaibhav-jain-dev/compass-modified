import type { Reducer } from 'redux';
import type { HighlighterConfig, ListingMode } from '../config/schema';
import type { MappingsFile } from '../config/mappings';
import type { ModelsFile } from '../config/models';

export type MappingsState = {
  byDatabase: Record<string, MappingsFile>;
  errors: Record<string, string>;
};

export type ModelsState = {
  byDatabase: Record<string, ModelsFile>;
  errors: Record<string, string>;
};

export type ConfigStatus =
  'disabled' | 'loading' | 'ready' | 'missing' | 'error';

export type HighlighterState = {
  configPath: string;
  status: ConfigStatus;
  error: string | null;
  config: HighlighterConfig | null;
  // "Show all" in the sidebar is a temporary override and is deliberately
  // not written to the YAML.
  listingOverride: ListingMode | null;
  // Sidebar tag filter (session only): null or empty = no tag filtering
  tagFilter: string[];
  mappings: MappingsState;
  models: ModelsState;
  /** Where to read the local AI status from (web sandbox), if anywhere */
  aiStatusUrl: string | null;
  /** Documents tab marks (colours, chips, banner, links) shown? Session only. */
  decorationsVisible: boolean;
};

export const HighlighterActionTypes = {
  ConfigLoading: 'compass-highlighter/ConfigLoading',
  ConfigLoaded: 'compass-highlighter/ConfigLoaded',
  ConfigMissing: 'compass-highlighter/ConfigMissing',
  ConfigFailed: 'compass-highlighter/ConfigFailed',
  ListingOverrideChanged: 'compass-highlighter/ListingOverrideChanged',
  MappingsLoaded: 'compass-highlighter/MappingsLoaded',
  ModelsLoaded: 'compass-highlighter/ModelsLoaded',
  TagFilterChanged: 'compass-highlighter/TagFilterChanged',
  DecorationsToggled: 'compass-highlighter/DecorationsToggled',
} as const;

export type HighlighterAction =
  | { type: typeof HighlighterActionTypes.ConfigLoading }
  | {
      type: typeof HighlighterActionTypes.ConfigLoaded;
      configPath: string;
      config: HighlighterConfig;
    }
  | { type: typeof HighlighterActionTypes.ConfigMissing; configPath: string }
  | {
      type: typeof HighlighterActionTypes.ConfigFailed;
      configPath: string;
      error: string;
    }
  | {
      type: typeof HighlighterActionTypes.ListingOverrideChanged;
      listingOverride: ListingMode | null;
    }
  | {
      type: typeof HighlighterActionTypes.MappingsLoaded;
      mappings: MappingsState;
    }
  | {
      type: typeof HighlighterActionTypes.ModelsLoaded;
      models: ModelsState;
    }
  | {
      type: typeof HighlighterActionTypes.TagFilterChanged;
      tagFilter: string[];
    }
  | {
      type: typeof HighlighterActionTypes.DecorationsToggled;
      visible: boolean;
    };

export const INITIAL_STATE: HighlighterState = {
  configPath: '',
  status: 'disabled',
  error: null,
  config: null,
  listingOverride: null,
  tagFilter: [],
  mappings: { byDatabase: {}, errors: {} },
  models: { byDatabase: {}, errors: {} },
  aiStatusUrl: null,
  decorationsVisible: true,
};

export const reducer: Reducer<HighlighterState, HighlighterAction> = (
  state = INITIAL_STATE,
  action
) => {
  switch (action.type) {
    case HighlighterActionTypes.ConfigLoading:
      return { ...state, status: 'loading', error: null };
    case HighlighterActionTypes.ConfigLoaded:
      return {
        ...state,
        configPath: action.configPath,
        status: 'ready',
        error: null,
        config: action.config,
        listingOverride: null,
      };
    case HighlighterActionTypes.ConfigMissing:
      return {
        ...state,
        configPath: action.configPath,
        status: 'missing',
        error: null,
        config: null,
      };
    case HighlighterActionTypes.ConfigFailed:
      return {
        ...state,
        configPath: action.configPath,
        status: 'error',
        error: action.error,
      };
    case HighlighterActionTypes.ListingOverrideChanged:
      return { ...state, listingOverride: action.listingOverride };
    case HighlighterActionTypes.MappingsLoaded:
      return { ...state, mappings: action.mappings };
    case HighlighterActionTypes.ModelsLoaded:
      return { ...state, models: action.models };
    case HighlighterActionTypes.TagFilterChanged:
      return { ...state, tagFilter: action.tagFilter };
    case HighlighterActionTypes.DecorationsToggled:
      return { ...state, decorationsVisible: action.visible };
    default:
      return state;
  }
};
