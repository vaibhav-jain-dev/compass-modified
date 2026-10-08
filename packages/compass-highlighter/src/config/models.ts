import { z } from '@mongodb-js/compass-user-data';
import { CollectionSchema } from './schema';

/**
 * Feature-independent knowledge about a database: what each collection and
 * field means, how it should be highlighted, which tags apply. Lives in
 * `<config dir>/models/<database>.yaml`, applies whatever feature is active
 * (also when none is), and features layer their own entries on top.
 */
export const ModelCollectionSchema = CollectionSchema.omit({ role: true });
export type ModelCollectionConfig = z.output<typeof ModelCollectionSchema>;

export const ModelsFileSchema = z
  .object({
    version: z.number().default(1),
    database: z.string().min(1),
    collections: z.array(ModelCollectionSchema).default([]),
  })
  .passthrough();
export type ModelsFile = z.output<typeof ModelsFileSchema>;

export function parseModelsFile(input: unknown): ModelsFile {
  return ModelsFileSchema.parse(input ?? {});
}
