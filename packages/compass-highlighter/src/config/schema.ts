import { z } from '@mongodb-js/compass-user-data';

export const LISTING_MODES = ['all', 'dim-others', 'only-interested'] as const;

export const ListingModeSchema = z.enum(LISTING_MODES);
export type ListingMode = z.output<typeof ListingModeSchema>;

// `.passthrough()` everywhere: the YAML is also a scratchpad for agents, so
// unknown keys must survive validation instead of failing it.
export const StyleSchema = z
  .object({
    color: z.string().optional(),
    background: z.string().optional(),
    icon: z.string().optional(),
    bold: z.boolean().optional(),
    strikethrough: z.boolean().optional(),
  })
  .passthrough();
export type HighlightStyle = z.output<typeof StyleSchema>;

// Named tags with colours, referenced from collections and fields by name.
export const TagDefinitionSchema = z
  .object({
    color: z.string().optional(),
    background: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough();
export type TagDefinition = z.output<typeof TagDefinitionSchema>;

export const DisplaySchema = z
  .object({
    listing: ListingModeSchema.optional(),
    highlightFields: z.boolean().optional(),
    showTooltips: z.boolean().optional(),
    showBadges: z.boolean().optional(),
  })
  .passthrough();
export type DisplayOptions = z.output<typeof DisplaySchema>;

export const ArtifactSchema = z
  .object({
    title: z.string(),
    url: z.string(),
    kind: z.string().optional(),
  })
  .passthrough();
export type HighlightArtifact = z.output<typeof ArtifactSchema>;

export const RelatedFieldSchema = z
  .object({
    namespace: z.string(),
    path: z.string(),
    notes: z.string().optional(),
  })
  .passthrough();
export type RelatedField = z.output<typeof RelatedFieldSchema>;

export const FieldSchema = z
  .object({
    path: z.string(),
    style: z.string().optional(),
    // short meaning shown as a chip next to the path, e.g. "family key"
    label: z.string().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
    relatedTo: z.array(RelatedFieldSchema).optional(),
  })
  .passthrough();
export type FieldConfig = z.output<typeof FieldSchema>;

// How a feature relates to a collection: it changes it, it only reads or
// links to it, or it is listed to say explicitly that it is not touched.
export const COLLECTION_ROLES = ['changes', 'linked', 'untouched'] as const;
export const CollectionRoleSchema = z.enum(COLLECTION_ROLES);
export type CollectionRole = z.output<typeof CollectionRoleSchema>;

export const QuerySchema = z
  .object({
    title: z.string(),
    // namespace + filter make the query runnable from the Highlighter tab
    namespace: z.string().optional(),
    filter: z.string().optional(),
    project: z.string().optional(),
    sort: z.string().optional(),
    // anything that is not a plain find, shown as code to copy
    shell: z.string().optional(),
    expect: z.string().optional(),
    notes: z.string().optional(),
  })
  .passthrough();
export type QueryConfig = z.output<typeof QuerySchema>;

export const CollectionSchema = z
  .object({
    namespace: z.string(),
    style: z.string().optional(),
    role: CollectionRoleSchema.optional(),
    alias: z.string().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
    fields: z.array(FieldSchema).optional(),
    // predefined queries for this collection: the Documents tab "Queries"
    // menu and the local AI's worked examples
    queries: z.array(QuerySchema).optional(),
  })
  .passthrough();
export type CollectionConfig = z.output<typeof CollectionSchema>;

export const CodeRefSchema = z
  .object({
    path: z.string(),
    line: z.number().int().positive().optional(),
    notes: z.string().optional(),
  })
  .passthrough();
export type CodeRef = z.output<typeof CodeRefSchema>;

export const CheckSchema = z
  .object({
    text: z.string(),
    done: z.boolean().optional(),
  })
  .passthrough();
export type CheckConfig = z.output<typeof CheckSchema>;

export const RelationSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    via: z.string().optional(),
    notes: z.string().optional(),
  })
  .passthrough();
export type RelationConfig = z.output<typeof RelationSchema>;

export const FeatureSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().optional(),
    description: z.string().optional(),
    // free-form state shown as a badge, e.g. "in session", "proposed"
    status: z.string().optional(),
    tags: z.array(z.string()).optional(),
    display: DisplaySchema.optional(),
    notes: z.string().optional(),
    artifacts: z.array(ArtifactSchema).optional(),
    collections: z.array(CollectionSchema).optional(),
    relations: z.array(RelationSchema).optional(),
    queries: z.array(QuerySchema).optional(),
    code: z.array(CodeRefSchema).optional(),
    checks: z.array(CheckSchema).optional(),
  })
  .passthrough();
export type FeatureConfig = z.output<typeof FeatureSchema>;

export const HighlighterConfigSchema = z
  .object({
    version: z.number().default(1),
    activeFeature: z.string().nullable().optional(),
    // Prefix for code references, e.g. https://github.com/org/repo/blob/<sha>/
    codeBaseUrl: z.string().optional(),
    display: DisplaySchema.optional(),
    styles: z.record(StyleSchema).optional(),
    tags: z.record(TagDefinitionSchema).optional(),
    features: z.array(FeatureSchema).default([]),
  })
  .passthrough();
export type HighlighterConfig = z.output<typeof HighlighterConfigSchema>;

export const DEFAULT_DISPLAY: Required<DisplayOptions> = {
  listing: 'dim-others',
  highlightFields: true,
  showTooltips: true,
  showBadges: true,
};

export function parseHighlighterConfig(input: unknown): HighlighterConfig {
  return HighlighterConfigSchema.parse(input ?? {});
}
