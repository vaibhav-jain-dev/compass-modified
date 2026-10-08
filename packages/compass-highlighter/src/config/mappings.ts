import { z } from '@mongodb-js/compass-user-data';
import { PathIndex } from './paths';

/**
 * Mappings live in their own file per database
 * (`<config dir>/mappings/<database>.yaml`), separate from the feature
 * config, because they describe the data model rather than a piece of work.
 */
export const MappingAsSchema = z.enum(['auto', 'objectId', 'string']);
export type MappingAs = z.output<typeof MappingAsSchema>;

export const MappingSchema = z
  .object({
    // `collection.path`, path in the same syntax as feature fields
    from: z.string().min(1),
    // `collection.path` in the same database, or `db.collection.path`
    to: z.string().min(1),
    label: z.string().optional(),
    // how to compare the value: auto tries both ObjectId and its hex string
    as: MappingAsSchema.optional(),
    // `key`: the link uses the element's key instead of its value, for maps
    // keyed by an id (`from: occurrences.*` with `use: key`)
    use: z.enum(['value', 'key']).optional(),
    notes: z.string().optional(),
  })
  .passthrough();
export type MappingConfig = z.output<typeof MappingSchema>;

export const MappingsFileSchema = z
  .object({
    version: z.number().default(1),
    database: z.string().min(1),
    mappings: z.array(MappingSchema).default([]),
  })
  .passthrough();
export type MappingsFile = z.output<typeof MappingsFileSchema>;

export function parseMappingsFile(input: unknown): MappingsFile {
  return MappingsFileSchema.parse(input ?? {});
}

export type MappingTarget = {
  namespace: string;
  path: string;
  label?: string;
  as: MappingAs;
  use: 'value' | 'key';
  notes?: string;
};

/** Split `collection.a.b` into collection and field path. */
function splitRef(ref: string): { collection: string; path: string } {
  const dot = ref.indexOf('.');
  if (dot === -1) {
    return { collection: ref, path: '_id' };
  }
  return { collection: ref.slice(0, dot), path: ref.slice(dot + 1) };
}

/**
 * Index: namespace -> normalized field path -> targets. `to` may name a
 * collection in the same database (`products._id`) or another database
 * (`other.products._id`); three or more segments where the first two look
 * like `db.collection` are only treated as cross-database when the
 * collection does not exist in the file's own database.
 */
export function indexMappings(
  file: MappingsFile
): ReadonlyMap<string, PathIndex<MappingTarget>> {
  const index = new Map<string, PathIndex<MappingTarget>>();
  for (const mapping of file.mappings) {
    const from = splitRef(mapping.from);
    const to = splitRef(mapping.to);
    const namespace = `${file.database}.${from.collection}`;
    const byPath = index.get(namespace) ?? new PathIndex<MappingTarget>();
    byPath.add(from.path, {
      namespace: `${file.database}.${to.collection}`,
      path: to.path,
      label: mapping.label,
      as: mapping.as ?? 'auto',
      use: mapping.use ?? 'value',
      notes: mapping.notes,
    });
    index.set(namespace, byPath);
  }
  return index;
}
