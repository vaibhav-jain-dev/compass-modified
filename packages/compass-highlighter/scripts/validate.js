#!/usr/bin/env node
'use strict';
/**
 * Fast validator for highlighter.yaml. Usage:
 *   node packages/compass-highlighter/scripts/validate.js [path]
 * Defaults to ~/compass-highlighter/highlighter.yaml. Exit code 1 on errors.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseDocument, LineCounter } = require('yaml');

let schema;
try {
  schema = require('../dist/config/schema');
} catch {
  console.error(
    'Schema not compiled yet. Run: npm run compile -w @mongodb-js/compass-highlighter'
  );
  process.exit(2);
}

const BUILTIN_STYLES = ['primary', 'focus', 'relation', 'muted'];
const DEFAULT_PATH = path.join(
  os.homedir(),
  'compass-highlighter',
  'highlighter.yaml'
);
const file = path.resolve(process.argv[2] || DEFAULT_PATH);

const errors = [];
const warnings = [];
let config = null;

function report(list, where, message, hint) {
  list.push({ where, message, hint });
}

if (!fs.existsSync(file)) {
  console.error(`✖ ${file} does not exist.`);
  console.error(
    `  Create it from extra-features/highlighter.example.yaml, or pass a path as the first argument.`
  );
  process.exit(1);
}

const text = fs.readFileSync(file, 'utf8');
const lines = text.split('\n');
const lineCounter = new LineCounter();
const doc = parseDocument(text, { lineCounter, keepSourceTokens: true });

function lineOf(nodePath) {
  const node = doc.getIn(nodePath, true);
  const offset = node && node.range ? node.range[0] : null;
  if (offset == null) return null;
  return lineCounter.linePos(offset);
}

function fmtPath(p) {
  return p.length
    ? p
        .map((s) => (typeof s === 'number' ? `[${s}]` : s))
        .join('.')
        .replace(/\.\[/g, '[')
    : '(root)';
}

function excerpt(line, col) {
  if (!line) return '';
  const src = lines[line - 1] ?? '';
  const caret = ' '.repeat(Math.max(0, (col || 1) - 1)) + '^';
  return `\n      ${line} | ${src}\n      ${' '.repeat(
    String(line).length
  )} | ${caret}`;
}

// 1. YAML syntax
for (const err of doc.errors) {
  const pos = err.linePos && err.linePos[0];
  report(
    errors,
    pos ? `line ${pos.line}:${pos.col}` : 'yaml',
    err.message.split('\n')[0],
    excerpt(pos && pos.line, pos && pos.col) +
      '\n      Hint: values containing ": " or starting with special characters must be quoted, e.g. notes: \'Enum: a | b\'.'
  );
}
for (const warn of doc.warnings) {
  const pos = warn.linePos && warn.linePos[0];
  report(
    warnings,
    pos ? `line ${pos.line}` : 'yaml',
    warn.message.split('\n')[0]
  );
}

const data = doc.errors.length ? null : doc.toJS();

// 2. Schema
if (data !== null) {
  const result = schema.HighlighterConfigSchema.safeParse(data ?? {});
  if (!result.success) {
    for (const issue of result.error.issues) {
      const pos = lineOf(issue.path);
      report(
        errors,
        `${fmtPath(issue.path)}${pos ? ` (line ${pos.line})` : ''}`,
        issue.message,
        excerpt(pos && pos.line, pos && pos.col)
      );
    }
  } else {
    // 3. Semantic checks
    config = result.data;
    const ids = new Map();
    config.features.forEach((feature, fi) => {
      const fpath = ['features', fi];
      if (ids.has(feature.id)) {
        report(
          errors,
          `${fmtPath([...fpath, 'id'])} (line ${
            lineOf([...fpath, 'id'])?.line
          })`,
          `Duplicate feature id "${feature.id}" (also at features[${ids.get(
            feature.id
          )}])`
        );
      }
      ids.set(feature.id, fi);
      if (!/^[a-z0-9][a-z0-9-]*$/.test(feature.id)) {
        report(
          warnings,
          fmtPath([...fpath, 'id']),
          `Feature id "${feature.id}" should be lowercase kebab-case`
        );
      }
      const namespaces = new Set();
      (feature.collections ?? []).forEach((collection, ci) => {
        const cpath = [...fpath, 'collections', ci];
        if (!collection.namespace.includes('.')) {
          report(
            errors,
            `${fmtPath([...cpath, 'namespace'])} (line ${
              lineOf([...cpath, 'namespace'])?.line
            })`,
            `Namespace "${collection.namespace}" must be "database.collection"`
          );
        }
        if (namespaces.has(collection.namespace)) {
          report(
            errors,
            fmtPath([...cpath, 'namespace']),
            `Collection "${collection.namespace}" listed twice in feature "${feature.id}"`
          );
        }
        namespaces.add(collection.namespace);
        checkStyle(collection.style, [...cpath, 'style']);
        const fieldPaths = new Set();
        (collection.fields ?? []).forEach((field, fIdx) => {
          const fp = [...cpath, 'fields', fIdx];
          if (/\s/.test(field.path)) {
            report(
              errors,
              fmtPath([...fp, 'path']),
              `Field path "${field.path}" contains whitespace`
            );
          }
          if (fieldPaths.has(field.path)) {
            report(
              warnings,
              fmtPath([...fp, 'path']),
              `Field "${field.path}" listed twice in ${collection.namespace}`
            );
          }
          fieldPaths.add(field.path);
          checkStyle(field.style, [...fp, 'style']);
          (field.relatedTo ?? []).forEach((rel, ri) => {
            if (!rel.namespace.includes('.')) {
              report(
                errors,
                fmtPath([...fp, 'relatedTo', ri, 'namespace']),
                `Related namespace "${rel.namespace}" must be "database.collection"`
              );
            }
          });
        });
      });
      // Relations pointing at collections the feature does not list are legal
      // but usually a typo, so warn.
      (feature.collections ?? []).forEach((collection, ci) => {
        (collection.fields ?? []).forEach((field, fIdx) => {
          (field.relatedTo ?? []).forEach((rel, ri) => {
            if (!namespaces.has(rel.namespace)) {
              report(
                warnings,
                fmtPath([
                  ...fpath,
                  'collections',
                  ci,
                  'fields',
                  fIdx,
                  'relatedTo',
                  ri,
                ]),
                `"${rel.namespace}" is not listed under collections of feature "${feature.id}", so it will not be highlighted in the sidebar`
              );
            }
          });
        });
      });
      (feature.queries ?? []).forEach((query, qi) => {
        const qpath = [...fpath, 'queries', qi];
        if (query.namespace && !namespaces.has(query.namespace)) {
          report(
            warnings,
            fmtPath([...qpath, 'namespace']),
            `Query "${query.title}" targets "${query.namespace}", which the feature does not list under collections`
          );
        }
        if (query.filter) {
          let parsed = false;
          try {
            parsed = require('mongodb-query-parser').validate(
              'filter',
              query.filter
            );
          } catch {
            parsed = false;
          }
          if (!parsed || typeof parsed !== 'object') {
            report(
              errors,
              `${fmtPath([...qpath, 'filter'])} (line ${
                lineOf([...qpath, 'filter'])?.line
              })`,
              `Query "${query.title}": filter does not parse as a MongoDB filter (shell syntax or extended JSON)`
            );
          }
          if (!query.namespace) {
            report(
              warnings,
              fmtPath(qpath),
              `Query "${query.title}" has a filter but no namespace, so it cannot be opened from the tab`
            );
          }
        }
      });
      (feature.relations ?? []).forEach((rel, ri) => {
        for (const key of ['from', 'to']) {
          if (!rel[key].includes('.')) {
            report(
              errors,
              fmtPath([...fpath, 'relations', ri, key]),
              `Relation ${key} "${rel[key]}" must be "database.collection"`
            );
          }
        }
      });
    });
    if (config.activeFeature && !ids.has(config.activeFeature)) {
      report(
        errors,
        `activeFeature (line ${lineOf(['activeFeature'])?.line})`,
        `activeFeature "${config.activeFeature}" does not match any features[].id`,
        `\n      Known ids: ${[...ids.keys()].join(', ') || '(none)'}`
      );
    }
    if (config.features.length === 0) {
      report(
        warnings,
        'features',
        'No features defined; nothing will be highlighted'
      );
    }

    function checkStyle(name, where) {
      if (!name) return;
      const declared = Object.keys(config.styles ?? {});
      if (!declared.includes(name) && !BUILTIN_STYLES.includes(name)) {
        report(
          warnings,
          fmtPath(where),
          `Style "${name}" is not declared under styles: and is not a built-in (${BUILTIN_STYLES.join(
            ', '
          )}); the default style will be used`
        );
      }
    }

    if (errors.length === 0) {
      const collections = config.features.reduce(
        (n, f) => n + (f.collections?.length ?? 0),
        0
      );
      const fields = config.features.reduce(
        (n, f) =>
          n +
          (f.collections ?? []).reduce(
            (m, c) => m + (c.fields?.length ?? 0),
            0
          ),
        0
      );
      console.log(`✔ ${file}`);
      console.log(
        `  features: ${
          config.features.length
        }, collections: ${collections}, fields: ${fields}, active: ${
          config.activeFeature ?? '(none)'
        }`
      );
    }
  }
}

// 4. Sidecar files next to the config: mappings/<database>.yaml and
//    models/<database>.yaml
function validateSidecars(kind, schemaForKind, describe) {
  const dir = path.join(path.dirname(file), kind);
  if (!fs.existsSync(dir)) return;
  for (const entry of fs
    .readdirSync(dir)
    .filter((e) => /\.ya?ml$/i.test(e))
    .sort()) {
    const sPath = path.join(dir, entry);
    const sDoc = parseDocument(fs.readFileSync(sPath, 'utf8'));
    const where = `${kind}/${entry}`;
    if (sDoc.errors.length) {
      report(
        errors,
        `${where} line ${sDoc.errors[0].linePos?.[0]?.line ?? '?'}`,
        sDoc.errors[0].message.split('\n')[0]
      );
      continue;
    }
    const result = schemaForKind.safeParse(sDoc.toJS());
    if (!result.success) {
      for (const issue of result.error.issues) {
        report(errors, `${where}: ${fmtPath(issue.path)}`, issue.message);
      }
      continue;
    }
    const database = entry.replace(/\.ya?ml$/i, '');
    if (result.data.database !== database) {
      report(
        warnings,
        where,
        `database: "${result.data.database}" differs from the file name; the file name wins`
      );
    }
    describe(result.data, where);
    console.log(`✔ ${sPath}`);
  }
}

validateSidecars(
  'mappings',
  require('../dist/config/mappings').MappingsFileSchema,
  (data, where) => {
    data.mappings.forEach((m, i) => {
      for (const key of ['from', 'to']) {
        if (/\s/.test(m[key])) {
          report(
            errors,
            `${where}: mappings[${i}].${key}`,
            `"${m[key]}" contains whitespace`
          );
        }
      }
      if (!m.from.includes('.')) {
        report(
          errors,
          `${where}: mappings[${i}].from`,
          `"${m.from}" must be collection.path`
        );
      }
      if (m.use === 'key' && !/\*$/.test(m.from.replace(/\[\]$/, ''))) {
        report(
          warnings,
          `${where}: mappings[${i}]`,
          `use: key is meant for map entries (a path ending in *); "${m.from}" does not end in *`
        );
      }
    });
    console.log(
      `  database: ${data.database}, mappings: ${data.mappings.length}`
    );
  }
);

validateSidecars(
  'models',
  require('../dist/config/models').ModelsFileSchema,
  (data, where) => {
    const declaredStyles = Object.keys(data.styles ?? {}).concat(
      Object.keys((config && config.styles) || {}),
      BUILTIN_STYLES
    );
    let fields = 0;
    data.collections.forEach((c, ci) => {
      if (c.style && !declaredStyles.includes(c.style)) {
        report(
          warnings,
          `${where}: collections[${ci}].style`,
          `Style "${c.style}" is not declared in highlighter.yaml`
        );
      }
      (c.fields ?? []).forEach((f, fi) => {
        fields += 1;
        if (/\s/.test(f.path)) {
          report(
            errors,
            `${where}: collections[${ci}].fields[${fi}].path`,
            `"${f.path}" contains whitespace`
          );
        }
        if (f.style && !declaredStyles.includes(f.style)) {
          report(
            warnings,
            `${where}: collections[${ci}].fields[${fi}].style`,
            `Style "${f.style}" is not declared in highlighter.yaml`
          );
        }
      });
    });
    console.log(
      `  database: ${data.database}, collections: ${data.collections.length}, fields: ${fields}`
    );
  }
);

for (const w of warnings) {
  console.log(`⚠ ${w.where}: ${w.message}${w.hint ?? ''}`);
}
for (const e of errors) {
  console.error(`✖ ${e.where}: ${e.message}${e.hint ?? ''}`);
}
if (errors.length) {
  console.error(
    `\n${errors.length} error(s) in ${file}. Compass keeps the last valid config until this is fixed.`
  );
  process.exit(1);
}
