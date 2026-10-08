import React, { useCallback, useMemo } from 'react';
import {
  Badge,
  Banner,
  Body,
  Button,
  Checkbox,
  Code,
  InlineCode,
  Description,
  H3,
  Icon,
  KeylineCard,
  Link,
  Subtitle,
  css,
  cx,
  palette,
  spacing,
  useDarkMode,
} from '@mongodb-js/compass-components';
import { useOpenWorkspace } from '@mongodb-js/compass-workspaces/provider';
import {
  ConnectionStatus,
  useConnectionsWithStatus,
} from '@mongodb-js/compass-connections/provider';
import { useHighlighterDispatch } from '../stores/context';
import { useActiveFeature, useHighlighterState } from '../hooks';
import {
  createConfigFromExample,
  loadConfig,
  toggleCheck,
  updateCollectionNotes,
  updateFeatureNotes,
  updateFieldNotes,
} from '../stores';
import type {
  ResolvedCollection,
  ResolvedFeature,
  ResolvedField,
  ResolvedStyle,
} from '../config/resolve';
import type { CodeRef, QueryConfig, RelatedField } from '../config/schema';
import { parseQueryFilter } from '../config/queries';
import { HighlighterFeatureSelect } from './feature-select';
import { NotesEditor } from './notes-editor';

const pageStyles = css({
  height: '100%',
  overflow: 'auto',
  padding: spacing[600],
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[500],
});

const headerStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[300],
  flexWrap: 'wrap',
});

const headerActionsStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
  marginLeft: 'auto',
});

const sectionStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[200],
});

const cardStyles = css({
  padding: spacing[400],
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[300],
});

const rowStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
  flexWrap: 'wrap',
});

const fieldListStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[300],
  paddingLeft: spacing[400],
  borderLeft: `2px solid ${palette.gray.light2}`,
});

const fieldListDarkStyles = css({
  borderLeftColor: palette.gray.dark2,
});

const styleChipStyles = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: spacing[100],
  padding: `0 ${spacing[150]}px`,
  borderRadius: spacing[100],
  fontSize: '12px',
  lineHeight: '20px',
});

const linkButtonStyles = css({
  padding: 0,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: palette.blue.base,
  fontSize: 'inherit',
  '&:disabled': {
    cursor: 'default',
    color: palette.gray.base,
  },
});

const preStyles = css({
  whiteSpace: 'pre-wrap',
});

const StyleChip: React.FunctionComponent<{
  style: ResolvedStyle;
  label?: string;
}> = ({ style, label }) => {
  return (
    <span
      className={styleChipStyles}
      style={{
        color: style.color,
        backgroundColor: style.background,
        fontWeight: style.bold ? 600 : undefined,
      }}
      data-testid="highlighter-style-chip"
    >
      {style.icon && <Icon glyph={style.icon} size="small" />}
      {label ?? style.name}
    </span>
  );
};

function useOpenCollection() {
  const { openCollectionWorkspace } = useOpenWorkspace();
  const connections = useConnectionsWithStatus();
  const connectionId = useMemo(
    () =>
      connections.find(
        ({ connectionStatus }) =>
          connectionStatus === ConnectionStatus.Connected
      )?.connectionInfo.id ?? null,
    [connections]
  );
  const open = useCallback(
    (namespace: string, initialQuery?: Record<string, unknown>) => {
      if (connectionId) {
        openCollectionWorkspace(connectionId, namespace, {
          newTab: true,
          ...(initialQuery ? { initialQuery } : {}),
        });
      }
    },
    [connectionId, openCollectionWorkspace]
  );
  return { open, canOpen: connectionId !== null };
}

const RelatedFieldLink: React.FunctionComponent<{ related: RelatedField }> = ({
  related,
}) => {
  const { open, canOpen } = useOpenCollection();
  return (
    <button
      type="button"
      className={linkButtonStyles}
      disabled={!canOpen}
      title={canOpen ? 'Open collection' : 'Connect to open this collection'}
      onClick={() => open(related.namespace)}
    >
      {related.namespace}.{related.path}
    </button>
  );
};

const FieldRow: React.FunctionComponent<{
  featureId: string;
  namespace: string;
  field: ResolvedField;
}> = ({ featureId, namespace, field }) => {
  const dispatch = useHighlighterDispatch();
  const onSave = useCallback(
    (notes: string) =>
      dispatch(updateFieldNotes(featureId, namespace, field.path, notes)),
    [dispatch, featureId, namespace, field.path]
  );
  return (
    <div className={sectionStyles} data-testid="highlighter-field">
      <div className={rowStyles}>
        <InlineCode>{field.path}</InlineCode>
        {field.label && <Badge variant="lightgray">{field.label}</Badge>}
        <StyleChip style={field.style} />
        {field.relatedTo.map((related) => (
          <span key={`${related.namespace}.${related.path}`}>
            <Icon glyph="Link" size="small" />{' '}
            <RelatedFieldLink related={related} />
          </span>
        ))}
      </div>
      <NotesEditor
        label={`Notes for ${field.path}`}
        notes={field.notes}
        placeholder="No notes for this field."
        onSave={onSave}
      />
    </div>
  );
};

const CollectionCard: React.FunctionComponent<{
  featureId: string;
  collection: ResolvedCollection;
}> = ({ featureId, collection }) => {
  const darkMode = useDarkMode();
  const dispatch = useHighlighterDispatch();
  const { open, canOpen } = useOpenCollection();
  const onSave = useCallback(
    (notes: string) =>
      dispatch(updateCollectionNotes(featureId, collection.namespace, notes)),
    [dispatch, featureId, collection.namespace]
  );
  return (
    <KeylineCard className={cardStyles} data-testid="highlighter-collection">
      <div className={rowStyles}>
        <Subtitle>{collection.namespace}</Subtitle>
        {collection.role && (
          <Badge
            variant={
              collection.role === 'changes'
                ? 'green'
                : collection.role === 'linked'
                  ? 'blue'
                  : 'lightgray'
            }
          >
            {collection.role}
          </Badge>
        )}
        <StyleChip style={collection.style} label={collection.alias} />
        <Button
          size="xsmall"
          disabled={!canOpen}
          onClick={() => open(collection.namespace)}
        >
          Open
        </Button>
      </div>
      <NotesEditor
        label={`Notes for ${collection.namespace}`}
        notes={collection.notes}
        placeholder="No notes for this collection."
        onSave={onSave}
      />
      {collection.fields.length > 0 && (
        <div className={cx(fieldListStyles, darkMode && fieldListDarkStyles)}>
          {collection.fields.map((field) => (
            <FieldRow
              key={field.path}
              featureId={featureId}
              namespace={collection.namespace}
              field={field}
            />
          ))}
        </div>
      )}
    </KeylineCard>
  );
};

const QueryCard: React.FunctionComponent<{ query: QueryConfig }> = ({
  query,
}) => {
  const { open, canOpen } = useOpenCollection();
  const filter = useMemo(() => parseQueryFilter(query), [query]);
  const runnable = Boolean(query.namespace && filter);
  const code = [
    query.filter &&
      `db.${
        query.namespace?.split('.').slice(1).join('.') ?? '<collection>'
      }.find(${query.filter}${query.project ? `, ${query.project}` : ''})${
        query.sort ? `.sort(${query.sort})` : ''
      }`,
    query.shell,
  ]
    .filter(Boolean)
    .join('\n');
  return (
    <KeylineCard className={cardStyles} data-testid="highlighter-query">
      <div className={rowStyles}>
        <Subtitle>{query.title}</Subtitle>
        {query.namespace && <InlineCode>{query.namespace}</InlineCode>}
        {runnable && (
          <Button
            size="xsmall"
            variant="primary"
            disabled={!canOpen}
            title={
              canOpen ? 'Open the collection with this filter' : 'Connect first'
            }
            onClick={() =>
              open(query.namespace as string, filter as Record<string, unknown>)
            }
          >
            Open with filter
          </Button>
        )}
      </div>
      {query.notes && <Body className={preStyles}>{query.notes}</Body>}
      {code && <Code language="javascript">{code}</Code>}
      {query.expect && (
        <Description className={preStyles}>Expect: {query.expect}</Description>
      )}
    </KeylineCard>
  );
};

const CodeRefRow: React.FunctionComponent<{
  codeRef: CodeRef;
  baseUrl?: string;
}> = ({ codeRef, baseUrl }) => {
  const text = codeRef.line ? `${codeRef.path}:${codeRef.line}` : codeRef.path;
  const href = baseUrl
    ? `${baseUrl.replace(/\/?$/, '/')}${codeRef.path}${
        codeRef.line ? `#L${codeRef.line}` : ''
      }`
    : null;
  return (
    <div className={rowStyles}>
      {href ? (
        <Link href={href} target="_blank">
          {text}
        </Link>
      ) : (
        <InlineCode>{text}</InlineCode>
      )}
      {codeRef.notes && <Body>{codeRef.notes}</Body>}
    </div>
  );
};

const Checklist: React.FunctionComponent<{ feature: ResolvedFeature }> = ({
  feature,
}) => {
  const dispatch = useHighlighterDispatch();
  const done = feature.checks.filter((c) => c.done).length;
  return (
    <div className={sectionStyles} data-testid="highlighter-checks">
      <div className={rowStyles}>
        <Subtitle>Checks</Subtitle>
        <Badge variant={done === feature.checks.length ? 'green' : 'lightgray'}>
          {done}/{feature.checks.length}
        </Badge>
      </div>
      {feature.checks.map((check, idx) => (
        <Checkbox
          key={idx}
          label={check.text}
          checked={!!check.done}
          onChange={(evt) =>
            void dispatch(toggleCheck(feature.id, idx, evt.target.checked))
          }
        />
      ))}
    </div>
  );
};

const MappingsStatus: React.FunctionComponent = () => {
  const byDatabase = useHighlighterState((s) => s.mappings.byDatabase);
  const errors = useHighlighterState((s) => s.mappings.errors);
  const configPath = useHighlighterState((s) => s.configPath);
  const databases = Object.keys(byDatabase).sort();
  const failed = Object.keys(errors).sort();
  if (databases.length === 0 && failed.length === 0) {
    return (
      <div className={sectionStyles} data-testid="highlighter-mappings">
        <Subtitle>Mappings</Subtitle>
        <Description>
          No mapping files yet. Add{' '}
          <InlineCode>mappings/&lt;database&gt;.yaml</InlineCode> next to the
          config to make fields clickable (see
          extra-features/highlighter.mappings.example.yaml).
        </Description>
      </div>
    );
  }
  return (
    <div className={sectionStyles} data-testid="highlighter-mappings">
      <Subtitle>Mappings</Subtitle>
      {databases.map((database) => (
        <div key={database} className={rowStyles}>
          <InlineCode>{database}</InlineCode>
          <Badge variant="green">
            {byDatabase[database].mappings.length} mapping
            {byDatabase[database].mappings.length === 1 ? '' : 's'}
          </Badge>
          <Description title={configPath}>mappings/{database}.yaml</Description>
        </div>
      ))}
      {failed.map((database) => (
        <Banner key={database} variant="danger">
          mappings/{database}.yaml could not be parsed: {errors[database]}
        </Banner>
      ))}
    </div>
  );
};

const EmptyState: React.FunctionComponent = () => {
  const dispatch = useHighlighterDispatch();
  const status = useHighlighterState((s) => s.status);
  const error = useHighlighterState((s) => s.error);
  const configPath = useHighlighterState((s) => s.configPath);
  const hasFeatures = useHighlighterState(
    (s) => (s.config?.features.length ?? 0) > 0
  );

  if (status === 'disabled') {
    return (
      <Banner variant="warning">
        Highlighter has no config source in this environment.
      </Banner>
    );
  }
  if (status === 'missing') {
    return (
      <div className={sectionStyles}>
        <Banner variant="info">
          No highlighter config found at <InlineCode>{configPath}</InlineCode>.
          Create one from the example to get started, or point Settings &gt;
          Highlighter at an existing file.
        </Banner>
        <div>
          <Button
            variant="primary"
            onClick={() => void dispatch(createConfigFromExample())}
          >
            Create from example
          </Button>
        </div>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <Banner variant="danger">
        Could not load <InlineCode>{configPath}</InlineCode>: {error}
      </Banner>
    );
  }
  if (status === 'loading') {
    return <Body>Loading highlighter config…</Body>;
  }
  if (!hasFeatures) {
    return (
      <Banner variant="info">
        The config has no features yet. Add one under <code>features:</code> in{' '}
        <InlineCode>{configPath}</InlineCode>.
      </Banner>
    );
  }
  return (
    <Banner variant="info">
      Pick a feature from the dropdown to see its highlights.
    </Banner>
  );
};

export const HighlighterWorkspace: React.FunctionComponent = () => {
  const dispatch = useHighlighterDispatch();
  const feature = useActiveFeature();
  const configPath = useHighlighterState((s) => s.configPath);

  const onSaveFeatureNotes = useCallback(
    (notes: string) =>
      feature
        ? dispatch(updateFeatureNotes(feature.id, notes))
        : Promise.resolve(),
    [dispatch, feature]
  );

  return (
    <div className={pageStyles} data-testid="highlighter-workspace">
      <div className={headerStyles}>
        <H3>Highlighter</H3>
        <HighlighterFeatureSelect />
        <div className={headerActionsStyles}>
          <Description title={configPath}>
            Config: <InlineCode>{configPath}</InlineCode>
          </Description>
          <Button size="xsmall" onClick={() => void dispatch(loadConfig())}>
            Reload
          </Button>
        </div>
      </div>

      {!feature ? (
        <EmptyState />
      ) : (
        <>
          <div className={sectionStyles}>
            <div className={rowStyles}>
              <Subtitle>{feature.label}</Subtitle>
              {feature.status && (
                <Badge variant="yellow">{feature.status}</Badge>
              )}
              {feature.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
              <Badge variant="lightgray">
                listing: {feature.display.listing}
              </Badge>
            </div>
            {feature.description && (
              <Body className={preStyles}>{feature.description}</Body>
            )}
            <NotesEditor
              label="Feature notes"
              notes={feature.notes}
              placeholder="No notes for this feature."
              onSave={onSaveFeatureNotes}
            />
            {feature.artifacts.length > 0 && (
              <div className={rowStyles}>
                {feature.artifacts.map((artifact) => (
                  <Link
                    key={artifact.url}
                    href={artifact.url}
                    target="_blank"
                    hideExternalIcon={false}
                  >
                    {artifact.kind ? `${artifact.kind}: ` : ''}
                    {artifact.title}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {feature.checks.length > 0 && <Checklist feature={feature} />}

          <div className={sectionStyles}>
            <Subtitle>Collections</Subtitle>
            {feature.collections.length === 0 && (
              <Body>This feature has no collections yet.</Body>
            )}
            {feature.collections.map((collection) => (
              <CollectionCard
                key={collection.namespace}
                featureId={feature.id}
                collection={collection}
              />
            ))}
          </div>

          {feature.queries.length > 0 && (
            <div className={sectionStyles}>
              <Subtitle>Queries</Subtitle>
              {feature.queries.map((query, idx) => (
                <QueryCard key={idx} query={query} />
              ))}
            </div>
          )}

          {feature.code.length > 0 && (
            <div className={sectionStyles}>
              <Subtitle>Code</Subtitle>
              {feature.code.map((codeRef, idx) => (
                <CodeRefRow
                  key={idx}
                  codeRef={codeRef}
                  baseUrl={feature.codeBaseUrl}
                />
              ))}
            </div>
          )}

          <MappingsStatus />

          {feature.relations.length > 0 && (
            <div className={sectionStyles}>
              <Subtitle>Relations</Subtitle>
              {feature.relations.map((relation, idx) => (
                <div key={idx} className={rowStyles}>
                  <InlineCode>{relation.from}</InlineCode>
                  <Icon glyph="ArrowRight" size="small" />
                  <InlineCode>{relation.to}</InlineCode>
                  {relation.via && (
                    <Description>via {relation.via}</Description>
                  )}
                  {relation.notes && <Body>{relation.notes}</Body>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
