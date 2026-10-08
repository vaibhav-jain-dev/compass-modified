import type {
  TagDefinition,
  CheckConfig,
  CodeRef,
  CollectionRole,
  DisplayOptions,
  FeatureConfig,
  HighlightArtifact,
  HighlightStyle,
  HighlighterConfig,
  QueryConfig,
  RelatedField,
  RelationConfig,
} from './schema';
import { DEFAULT_DISPLAY } from './schema';
import { namespaceToDatabase, normalizeFieldPath, PathIndex } from './paths';
import type { ModelCollectionConfig, ModelsFile } from './models';

export type ResolvedStyle = HighlightStyle & { name: string };

export type ResolvedTag = TagDefinition & { name: string };

const TAG_FALLBACK_COLORS = [
  '#0E7490',
  '#7C3AED',
  '#B45309',
  '#B91C1C',
  '#15803D',
  '#1D4ED8',
];

export function resolveTags(
  config: HighlighterConfig,
  names: string[] | undefined
): ResolvedTag[] {
  return (names ?? []).map((name) => {
    const def = config.tags?.[name];
    if (def) {
      return { ...def, name };
    }
    // Deterministic colour for tags that have no definition, so the same tag
    // looks the same everywhere.
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return {
      name,
      color: TAG_FALLBACK_COLORS[hash % TAG_FALLBACK_COLORS.length],
    };
  });
}

export type ResolvedField = {
  path: string;
  normalizedPath: string;
  style: ResolvedStyle;
  label?: string;
  tags: ResolvedTag[];
  notes?: string;
  relatedTo: RelatedField[];
};

export type ResolvedCollection = {
  namespace: string;
  database: string;
  alias?: string;
  role?: CollectionRole;
  style: ResolvedStyle;
  tags: ResolvedTag[];
  notes?: string;
  fields: ResolvedField[];
  /** Lookup by concrete path; patterns with wildcards are supported */
  fieldsByPath: PathIndex<ResolvedField>;
  queries: QueryConfig[];
};

export type ResolvedFeature = {
  id: string;
  label: string;
  description?: string;
  status?: string;
  tags: string[];
  notes?: string;
  artifacts: HighlightArtifact[];
  display: Required<DisplayOptions>;
  collections: ResolvedCollection[];
  collectionsByNamespace: ReadonlyMap<string, ResolvedCollection>;
  databases: ReadonlySet<string>;
  relations: RelationConfig[];
  queries: QueryConfig[];
  code: CodeRef[];
  codeBaseUrl?: string;
  checks: CheckConfig[];
};

// Fallback palette for style names that are not declared under `styles:`.
// Keeps a typo in the YAML from silently producing an unstyled highlight.
const BUILTIN_STYLES: Record<string, HighlightStyle> = {
  primary: { color: '#00684A', background: '#E3FCF7', bold: true },
  focus: { color: '#B45309', background: '#FEF3C7' },
  relation: { color: '#1D4ED8', background: '#DBEAFE' },
  muted: { color: '#6B7280' },
};
const DEFAULT_STYLE_NAME = 'primary';

// A collection with a role but no explicit style gets a style that reads
// like the chip styles of a ticket write-up: filled / outlined / dashed.
const ROLE_STYLE: Record<CollectionRole, string> = {
  changes: 'primary',
  linked: 'focus',
  untouched: 'muted',
};

export function resolveStyle(
  config: HighlighterConfig,
  name: string | undefined
): ResolvedStyle {
  const styleName = name ?? DEFAULT_STYLE_NAME;
  const style =
    config.styles?.[styleName] ??
    BUILTIN_STYLES[styleName] ??
    BUILTIN_STYLES[DEFAULT_STYLE_NAME];
  return { ...style, name: styleName };
}

export function getFeatureLabel(feature: Pick<FeatureConfig, 'id' | 'label'>) {
  return feature.label ?? feature.id;
}

function resolveCollectionEntry(
  config: HighlighterConfig,
  collection: ModelCollectionConfig & { role?: CollectionRole }
): ResolvedCollection {
  const collectionStyleName =
    collection.style ??
    (collection.role ? ROLE_STYLE[collection.role] : undefined);
  const fields: ResolvedField[] = (collection.fields ?? []).map((field) => ({
    path: field.path,
    normalizedPath: normalizeFieldPath(field.path),
    style: resolveStyle(config, field.style ?? collectionStyleName),
    label: field.label,
    tags: resolveTags(config, field.tags),
    notes: field.notes,
    relatedTo: field.relatedTo ?? [],
  }));
  const fieldsByPath = new PathIndex<ResolvedField>();
  for (const field of fields) {
    fieldsByPath.add(field.path, field);
  }
  return {
    namespace: collection.namespace,
    database: namespaceToDatabase(collection.namespace),
    alias: collection.alias,
    role: collection.role,
    style: resolveStyle(config, collectionStyleName),
    tags: resolveTags(config, collection.tags),
    notes: collection.notes,
    fields,
    fieldsByPath,
    queries: collection.queries ?? [],
  };
}

/**
 * Feature-independent collections from `models/<database>.yaml`, keyed by
 * namespace. Styles and tags are resolved against the main config.
 */
export function resolveModels(
  config: HighlighterConfig,
  models: ModelsFile[]
): ReadonlyMap<string, ResolvedCollection> {
  const byNamespace = new Map<string, ResolvedCollection>();
  for (const file of models) {
    for (const collection of file.collections) {
      const namespace = collection.namespace.includes('.')
        ? collection.namespace
        : `${file.database}.${collection.namespace}`;
      byNamespace.set(
        namespace,
        resolveCollectionEntry(config, { ...collection, namespace })
      );
    }
  }
  return byNamespace;
}

export function resolveFeature(
  config: HighlighterConfig,
  featureId: string | null | undefined
): ResolvedFeature | null {
  if (!featureId) {
    return null;
  }
  const feature = config.features.find((f) => f.id === featureId);
  if (!feature) {
    return null;
  }

  const collections: ResolvedCollection[] = (feature.collections ?? []).map(
    (collection) => resolveCollectionEntry(config, collection)
  );

  return {
    id: feature.id,
    label: getFeatureLabel(feature),
    description: feature.description,
    status: feature.status,
    tags: feature.tags ?? [],
    notes: feature.notes,
    artifacts: feature.artifacts ?? [],
    display: { ...DEFAULT_DISPLAY, ...config.display, ...feature.display },
    collections,
    collectionsByNamespace: new Map(collections.map((c) => [c.namespace, c])),
    databases: new Set(collections.map((c) => c.database)),
    relations: feature.relations ?? [],
    queries: feature.queries ?? [],
    code: feature.code ?? [],
    codeBaseUrl: config.codeBaseUrl,
    checks: feature.checks ?? [],
  };
}
