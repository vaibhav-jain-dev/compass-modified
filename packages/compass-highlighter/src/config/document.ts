import { Document, parseDocument, isMap, isSeq, YAMLMap } from 'yaml';

export type YamlPathSegment = string | number;

export function parseConfigText(text: string): unknown {
  const doc = parseDocument(text);
  if (doc.errors.length) {
    throw doc.errors[0];
  }
  return doc.toJS() ?? {};
}

/**
 * Set a value at a path inside the YAML text and return the new text. Goes
 * through the Document API rather than parse/stringify so comments and key
 * order written by hand (or by an agent) survive every UI edit.
 */
export function setInConfigText(
  text: string,
  path: YamlPathSegment[],
  value: unknown
): string {
  const parsed = parseDocument(text);
  if (parsed.errors.length) {
    throw parsed.errors[0];
  }
  // An empty or scalar-only file has no map to write into; a fresh document
  // has no comments to lose, so replacing it is safe.
  const doc: Document = isMap(parsed.contents) ? parsed : new Document({});
  // yaml's setIn throws when a segment points into a collection that does not
  // exist yet, so walk the path and create missing maps explicitly.
  for (let i = 0; i < path.length - 1; i++) {
    const prefix = path.slice(0, i + 1);
    const node = doc.getIn(prefix, true);
    if (node === undefined) {
      doc.setIn(prefix, new YAMLMap());
    } else if (!isMap(node) && !isSeq(node)) {
      throw new Error(
        `Cannot set ${path.join('.')}: ${prefix.join('.')} is a scalar`
      );
    }
  }
  doc.setIn(path, value);
  return doc.toString();
}
