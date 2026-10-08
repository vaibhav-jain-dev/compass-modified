import React, { useMemo } from 'react';
import {
  Body,
  css,
  spacing,
  Description,
} from '@mongodb-js/compass-components';
import { DocumentList } from '@mongodb-js/compass-components';
import type { FieldDecoration } from '@mongodb-js/compass-components';
import type HadronDocument from 'hadron-document';
import {
  useActiveFeature,
  useEffectiveFields,
  useHighlighterConfig,
  useMappingLookup,
  useModelCollections,
} from '../hooks';
import type { ResolvedField, ResolvedTag } from '../config/resolve';
import { normalizeFieldPath } from '../config/paths';
import type { MappingTarget } from '../config/mappings';
import { buildLinkFilter } from '../config/link-filter';
import {
  RelatedDocumentCard,
  RelatedNavigationProvider,
  useRelatedNavigation,
  useRelatedNavigationFromPanel,
} from './related-navigation';
import type { RelatedFrame, RelatedOrigin } from './related-navigation';
import { ObjectId } from 'bson';

const tooltipStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[100],
  maxWidth: spacing[1600] * 4,
});

const notesStyles = css({
  whiteSpace: 'pre-wrap',
});

const tagRowStyles = css({
  display: 'flex',
  gap: spacing[100],
  flexWrap: 'wrap',
});

const tagChipStyles = css({
  display: 'inline-flex',
  padding: `0 ${spacing[150]}px`,
  borderRadius: spacing[100],
  fontSize: '12px',
  lineHeight: '20px',
});

export const TagChips: React.FunctionComponent<{ tags: ResolvedTag[] }> = ({
  tags,
}) => {
  if (tags.length === 0) {
    return null;
  }
  return (
    <div className={tagRowStyles}>
      {tags.map((tag) => (
        <span
          key={tag.name}
          className={tagChipStyles}
          style={{ color: tag.color, backgroundColor: tag.background }}
          title={tag.description}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
};

const FieldTooltip: React.FunctionComponent<{
  namespace: string;
  path: string;
  field: ResolvedField | undefined;
  targets: MappingTarget[];
}> = ({ namespace, path, field, targets }) => {
  return (
    <div className={tooltipStyles}>
      <Body weight="medium">
        {namespace}.{path}
        {field?.label ? ` — ${field.label}` : ''}
      </Body>
      {field && <TagChips tags={field.tags} />}
      {field?.notes && <Body className={notesStyles}>{field.notes}</Body>}
      {targets.length > 0 && (
        <Description>
          Click to open related:{' '}
          {targets
            .map(
              (t) => `${t.namespace}.${t.path}${t.label ? ` (${t.label})` : ''}`
            )
            .join(', ')}
        </Description>
      )}
    </div>
  );
};

const LINK_ICON = 'Link';

function subjectText(subject: unknown): string {
  if (subject instanceof ObjectId) {
    return subject.toHexString();
  }
  if (Array.isArray(subject)) {
    return `[${subject.length} values]`;
  }
  return String(subject);
}

function frameFor(
  target: MappingTarget,
  value: unknown,
  key: string | undefined
): Omit<RelatedFrame, 'alternatives' | 'origin'> {
  const subject = target.use === 'key' ? key : value;
  return {
    namespace: target.namespace,
    filter: buildLinkFilter(target.path, subject, target.as),
    title: target.label ?? target.namespace,
  };
}

function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Later entries (the feature's) win; tags and relations are unioned. */
function mergeFields(matches: ResolvedField[]): ResolvedField | undefined {
  if (matches.length === 0) {
    return undefined;
  }
  const last = matches[matches.length - 1];
  if (matches.length === 1) {
    return last;
  }
  const seenTags = new Set<string>();
  return {
    ...last,
    label: last.label ?? matches.find((m) => m.label)?.label,
    notes: last.notes ?? matches.find((m) => m.notes)?.notes,
    tags: matches
      .flatMap((m) => m.tags)
      .filter((tag) => !seenTags.has(tag.name) && seenTags.add(tag.name)),
    relatedTo: matches.flatMap((m) => m.relatedTo),
  };
}

const FieldDecorations: React.FunctionComponent<{
  namespace: string;
  children?: React.ReactNode;
}> = ({ namespace, children }) => {
  const feature = useActiveFeature();
  const config = useHighlighterConfig();
  const fields = useEffectiveFields(namespace);
  const models = useModelCollections();
  const lookup = useMappingLookup();
  const navigation = useRelatedNavigationFromPanel();

  const value = useMemo(() => {
    const featureCollection = feature?.collectionsByNamespace.get(namespace);
    const modelCollection = models.get(namespace);
    const headerSource = featureCollection ?? modelCollection;
    const collection = headerSource
      ? {
          title:
            headerSource.alias ??
            modelCollection?.alias ??
            headerSource.namespace.split('.').slice(1).join('.'),
          color: headerSource.style.color,
          background: headerSource.style.background,
          icon: headerSource.style.icon,
          notes: featureCollection?.notes ?? modelCollection?.notes,
        }
      : undefined;
    const display = feature?.display ?? {
      highlightFields: config?.display?.highlightFields ?? true,
      showTooltips: config?.display?.showTooltips ?? true,
    };
    const highlight = Boolean(display.highlightFields && fields.hasAny);
    const tooltips = display.showTooltips;
    const cache = new Map<string, FieldDecoration | undefined>();
    return {
      collection,
      getFieldDecoration(
        path: string,
        getValue: () => unknown,
        key?: string,
        fullPath?: string
      ): FieldDecoration | undefined {
        const normalized = normalizeFieldPath(path);
        const field = highlight
          ? mergeFields(fields.index.get(normalized))
          : undefined;
        // Feature-level relatedTo entries behave like mappings with `auto`.
        const targets: MappingTarget[] = [
          ...lookup(namespace, normalized),
          ...(field?.relatedTo ?? []).map((rel) => ({
            namespace: rel.namespace,
            path: rel.path,
            label: rel.notes,
            as: 'auto' as const,
            use: 'value' as const,
          })),
        ];
        if (!field && targets.length === 0) {
          return undefined;
        }
        // Decorations without a value dependency are cached per path; the
        // ones with links need the value at click time, so only the static
        // part is cached and onClick is rebuilt cheaply.
        let base = cache.get(normalized);
        if (!base) {
          base = {
            color: field?.style.color,
            background: field?.style.background,
            bold: field?.style.bold,
            strikethrough: field?.style.strikethrough,
            icon: field?.style.icon ?? (targets.length ? LINK_ICON : undefined),
            label: field?.label ?? field?.style.name ?? 'related',
            chip: field?.label,
            tooltip: tooltips ? (
              <FieldTooltip
                namespace={namespace}
                path={path}
                field={field}
                targets={targets}
              />
            ) : undefined,
          };
          cache.set(normalized, base);
        }
        if (targets.length === 0 || !navigation) {
          return base;
        }
        // Nothing to look up for an empty array or a missing value: keep the
        // icon as a plain marker rather than opening an empty popup.
        const current = getValue();
        const usable = targets.filter((t) =>
          t.use === 'key' ? Boolean(key) : !isEmptyValue(current)
        );
        if (usable.length === 0) {
          return base;
        }
        return {
          ...base,
          onClick: () => {
            const [first, ...rest] = usable;
            const origin: RelatedOrigin = {
              namespace,
              path: fullPath ?? path,
              subject: subjectText(first.use === 'key' ? key : current),
            };
            navigation.push({
              ...frameFor(first, current, key),
              origin,
              alternatives: rest.map((t) => frameFor(t, current, key)),
            });
          },
        };
      },
    };
  }, [feature, config, fields, models, namespace, lookup, navigation]);

  return (
    <DocumentList.FieldDecorationsProvider value={value}>
      {children}
    </DocumentList.FieldDecorationsProvider>
  );
};

const renderRelatedDocuments = (
  frame: RelatedFrame,
  docs: HadronDocument[]
): React.ReactNode => {
  return (
    // Nested provider: fields of the related documents are decorated and
    // linkable too, which is what lets panels open from panels.
    <FieldDecorations namespace={frame.namespace}>
      <DocumentList.DecoratedDocumentHeader />
      {docs.map((doc) => (
        <RelatedDocumentCard key={doc.uuid} doc={doc} />
      ))}
    </FieldDecorations>
  );
};

/**
 * Wrap any document view with this to have the fields of `namespace`
 * highlighted according to the active feature and linked according to the
 * mapping files. The first wrapper in a tab also owns the related-documents
 * popup; nested ones reuse it.
 */
export const HighlighterFieldDecorations: React.FunctionComponent<{
  namespace: string;
  children?: React.ReactNode;
}> = ({ namespace, children }) => {
  const existing = useRelatedNavigation();
  const inner = (
    <FieldDecorations namespace={namespace}>{children}</FieldDecorations>
  );
  if (existing) {
    return inner;
  }
  return (
    <RelatedNavigationProvider renderDocuments={renderRelatedDocuments}>
      {inner}
    </RelatedNavigationProvider>
  );
};
