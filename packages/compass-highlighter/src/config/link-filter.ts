import { ObjectId } from 'bson';
import type { MappingAs } from './mappings';

const HEX24 = /^[0-9a-fA-F]{24}$/;

function variants(value: unknown, as: MappingAs): unknown[] {
  if (as === 'objectId') {
    if (value instanceof ObjectId) return [value];
    if (typeof value === 'string' && HEX24.test(value)) {
      return [new ObjectId(value)];
    }
    return [value];
  }
  if (as === 'string') {
    return [value instanceof ObjectId ? value.toHexString() : value];
  }
  // auto: ids are stored as ObjectId in some collections and as their hex
  // string in others (the "ids as text" cases), so match both shapes.
  if (value instanceof ObjectId) {
    return [value, value.toHexString()];
  }
  if (typeof value === 'string' && HEX24.test(value)) {
    return [value, new ObjectId(value)];
  }
  return [value];
}

/**
 * Builds the filter that finds the documents a field value points at.
 * Arrays (e.g. a list of child ids) match any element.
 */
export function buildLinkFilter(
  targetPath: string,
  value: unknown,
  as: MappingAs = 'auto'
): Record<string, unknown> {
  const values = Array.isArray(value)
    ? value.flatMap((v) => variants(v, as))
    : variants(value, as);
  if (values.length === 1) {
    return { [targetPath]: values[0] };
  }
  return { [targetPath]: { $in: values } };
}
