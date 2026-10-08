'use strict';
/* eslint-disable no-console */
// Fork extra feature: local AI query generation through Ollama, served by the
// sandbox dev server. See extra-features/local-ai.md.
const fs = require('fs');
const os = require('os');
const path = require('path');
const YAML = require('yaml');

const DEFAULTS = {
  provider: 'ollama',
  baseUrl: process.env.OLLAMA_HOST
    ? /^https?:/.test(process.env.OLLAMA_HOST)
      ? process.env.OLLAMA_HOST
      : `http://${process.env.OLLAMA_HOST}`
    : 'http://localhost:11434',
  model: 'qwen2.5-coder:7b',
  fallbackModels: ['llama3.1:8b', 'qwen2.5:7b', 'llama3.2:3b'],
  temperature: 0,
  numCtx: 8192,
  keepAlive: '30m',
  warmupOnStart: true,
  timeoutMs: 60000,
  context: {
    collectionNotes: true,
    fieldMeanings: true,
    relations: true,
    exampleQueries: true,
    maxFields: 60,
  },
};

function configDir() {
  return path.join(os.homedir(), 'compass-highlighter');
}

function loadConfig() {
  let fileConfig = {};
  const file = path.join(configDir(), 'ai.yaml');
  if (fs.existsSync(file)) {
    try {
      fileConfig = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
    } catch (err) {
      console.warn(`[local-ai] ${file} could not be parsed: ${err.message}`);
    }
  }
  const config = {
    ...DEFAULTS,
    ...fileConfig,
    context: { ...DEFAULTS.context, ...(fileConfig.context || {}) },
  };
  if (process.env.COMPASS_LOCAL_AI_MODEL) {
    config.model = process.env.COMPASS_LOCAL_AI_MODEL;
  }
  if (process.env.COMPASS_LOCAL_AI === '0') {
    config.disabled = true;
  }
  config.file = file;
  return config;
}

// ---------------------------------------------------------------- Ollama
async function ollamaJson(config, route, init) {
  const res = await fetch(`${config.baseUrl}${route}`, init);
  if (!res.ok) {
    throw new Error(`Ollama ${route} returned ${res.status}`);
  }
  return res.json();
}

async function installedModels(config) {
  const data = await ollamaJson(config, '/api/tags');
  return (data.models || []).map((m) => m.name);
}

async function loadedModels(config) {
  const data = await ollamaJson(config, '/api/ps');
  return (data.models || []).map((m) => m.name);
}

/** Picks the configured model, or the first installed fallback. */
async function resolveModel(config) {
  const installed = await installedModels(config);
  const candidates = [config.model, ...(config.fallbackModels || [])];
  const found = candidates.find((m) => installed.includes(m));
  return { model: found || null, installed, requested: config.model };
}

const state = {
  warming: false,
  lastError: null,
  lastModel: null,
};

async function warmup(config) {
  if (state.warming) return;
  state.warming = true;
  try {
    const { model } = await resolveModel(config);
    if (!model) {
      throw new Error(
        `none of ${[config.model, ...(config.fallbackModels || [])].join(
          ', '
        )} is installed; run "ollama pull ${config.model}"`
      );
    }
    state.lastModel = model;
    await ollamaJson(config, '/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt: '', keep_alive: config.keepAlive }),
    });
    state.lastError = null;
    console.log(`[local-ai] model ${model} ready on ${config.baseUrl}`);
  } catch (err) {
    state.lastError = err.message;
    console.warn(`[local-ai] warm-up failed: ${err.message}`);
  } finally {
    state.warming = false;
  }
}

async function status(config) {
  if (config.disabled) {
    return { enabled: false, reason: 'COMPASS_LOCAL_AI=0' };
  }
  try {
    const { model, installed, requested } = await resolveModel(config);
    const loaded = await loadedModels(config);
    return {
      enabled: true,
      baseUrl: config.baseUrl,
      requestedModel: requested,
      model,
      installed,
      loaded: model ? loaded.includes(model) : false,
      warming: state.warming,
      lastError: model
        ? state.lastError
        : `model ${requested} is not installed`,
      configFile: config.file,
    };
  } catch (err) {
    return {
      enabled: false,
      baseUrl: config.baseUrl,
      requestedModel: config.model,
      reason: `Ollama is not reachable at ${config.baseUrl}: ${err.message}`,
    };
  }
}

// ----------------------------------------------------- highlighter context
function readYaml(file) {
  try {
    return YAML.parse(fs.readFileSync(file, 'utf8')) || null;
  } catch {
    return null;
  }
}

function splitNs(namespace) {
  const dot = namespace.indexOf('.');
  return dot === -1
    ? { db: namespace, coll: '' }
    : { db: namespace.slice(0, dot), coll: namespace.slice(dot + 1) };
}

function describeQuery(q) {
  const parts = [];
  if (q.filter) parts.push(`filter ${q.filter}`);
  if (q.project) parts.push(`project ${q.project}`);
  if (q.sort) parts.push(`sort ${q.sort}`);
  if (q.limit) parts.push(`limit ${q.limit}`);
  return parts.join(' ; ');
}

/**
 * Builds the "what the team knows about this collection" block from the
 * highlighter files for one namespace. Everything is optional and capped.
 */
function buildHighlighterContext(config, namespace) {
  const { db, coll } = splitNs(namespace);
  const ctx = config.context || DEFAULTS.context;
  const lines = [];
  const fields = new Map(); // path -> {label, notes}
  const collectionNotes = [];
  const examples = [];

  const main = readYaml(path.join(configDir(), 'highlighter.yaml'));
  const model = readYaml(path.join(configDir(), 'models', `${db}.yaml`));
  const mappings = readYaml(path.join(configDir(), 'mappings', `${db}.yaml`));

  const takeCollection = (c, source) => {
    if (!c) return;
    const name = c.namespace.includes('.')
      ? c.namespace
      : `${db}.${c.namespace}`;
    if (name !== namespace) return;
    if (ctx.collectionNotes) {
      if (c.alias) collectionNotes.push(`known as "${c.alias}"`);
      if (c.notes) collectionNotes.push(String(c.notes).trim());
    }
    if (ctx.fieldMeanings) {
      for (const f of c.fields || []) {
        const prev = fields.get(f.path) || {};
        fields.set(f.path, {
          label: f.label || prev.label,
          notes: f.notes || prev.notes,
        });
      }
    }
    if (ctx.exampleQueries) {
      for (const q of c.queries || []) {
        if (q.filter)
          examples.push({ title: q.title, text: describeQuery(q), source });
      }
    }
  };

  for (const c of (model && model.collections) || [])
    takeCollection(c, 'model');
  if (main) {
    const active = (main.features || []).find(
      (f) => f.id === main.activeFeature
    );
    // Only the active feature contributes: notes from every ticket at once
    // would contradict each other and blow up the prompt.
    for (const feature of active ? [active] : []) {
      for (const c of feature.collections || []) takeCollection(c, feature.id);
      if (ctx.exampleQueries) {
        for (const q of feature.queries || []) {
          if (q.namespace === namespace && q.filter) {
            examples.push({
              title: q.title,
              text: describeQuery(q),
              source: feature.id,
            });
          }
        }
      }
    }
    if (active && ctx.collectionNotes) {
      const inFeature = (active.collections || []).some((c) => {
        const name = c.namespace.includes('.')
          ? c.namespace
          : `${db}.${c.namespace}`;
        return name === namespace;
      });
      if (inFeature && active.description) {
        collectionNotes.push(
          `current work (${active.label || active.id}): ${String(
            active.description
          ).trim()}`
        );
      }
    }
  }

  if (collectionNotes.length) {
    lines.push(`About the collection ${coll}: ${collectionNotes.join('. ')}`);
  }
  if (fields.size) {
    lines.push('Field meanings (path: meaning):');
    let n = 0;
    for (const [p, info] of fields) {
      if (n++ >= ctx.maxFields) break;
      const bits = [
        info.label,
        info.notes ? String(info.notes).trim().replace(/\s+/g, ' ') : null,
      ].filter(Boolean);
      if (bits.length) lines.push(`- ${p}: ${bits.join('; ')}`);
    }
  }
  if (ctx.relations && mappings) {
    const rel = (mappings.mappings || []).filter((m) =>
      m.from.startsWith(`${coll}.`)
    );
    if (rel.length) {
      lines.push(
        'Relations (ids stored in this collection and what they point at):'
      );
      for (const m of rel.slice(0, 40)) {
        const from = m.from.slice(coll.length + 1);
        lines.push(
          `- ${from} points at ${m.to}${m.label ? ` (${m.label})` : ''}${
            m.as === 'string'
              ? ', stored as a hex string'
              : m.as === 'auto' || !m.as
                ? ', may be stored as ObjectId or as its hex string'
                : ''
          }`
        );
      }
    }
  }
  if (examples.length) {
    lines.push(
      'Example queries the team uses on this collection (same conventions apply):'
    );
    for (const e of examples.slice(0, 8)) {
      lines.push(`- ${e.title}: ${e.text}`);
    }
  }
  return lines.join('\n');
}

// ----------------------------------------------------------- generation
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * Streams the model's answer as plain text. The client sends the exact
 * prompt and instructions upstream Compass would send to Atlas; the server
 * only appends the highlighter context and talks to Ollama.
 */
async function generate(config, req, res) {
  const body = JSON.parse((await readBody(req)) || '{}');
  const { instructions, prompt, namespace } = body;
  if (!prompt || !instructions) {
    res.status(400).json({ error: 'prompt and instructions are required' });
    return;
  }
  const { model } = await resolveModel(config);
  if (!model) {
    res.status(503).json({
      error: `No usable model installed. Run: ollama pull ${config.model}`,
    });
    return;
  }
  state.lastModel = model;
  const context = namespace ? buildHighlighterContext(config, namespace) : '';
  const system = [
    instructions,
    '- Output only the XML-delimited arguments, no explanation, no code fences.',
    '- Use MongoDB shell syntax inside the delimiters (ObjectId("..."), ISODate("..."), regular expressions allowed).',
    '- Leave an argument empty ({} or 0 or []) when it is not needed.',
    context ? `\nContext from the team's notes:\n${context}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const controller = new AbortController();
  req.on('close', () => controller.abort());
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  let upstream;
  try {
    upstream = await fetch(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: true,
        keep_alive: config.keepAlive,
        options: { temperature: config.temperature, num_ctx: config.numCtx },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    res.status(502).json({ error: `Ollama request failed: ${err.message}` });
    return;
  }
  if (!upstream.ok || !upstream.body) {
    clearTimeout(timer);
    res.status(502).json({ error: `Ollama returned ${upstream.status}` });
    return;
  }
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-local-ai-model', model);
  res.flushHeaders?.();
  let buffer = '';
  try {
    for await (const chunk of upstream.body) {
      buffer += Buffer.from(chunk).toString('utf8');
      let nl;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const json = JSON.parse(line);
          if (json.message && json.message.content) {
            res.write(json.message.content);
          }
          if (json.error) {
            res.write(`\n<error>${json.error}</error>`);
          }
        } catch {
          // partial line, keep buffering
        }
      }
    }
    state.lastError = null;
  } catch (err) {
    if (!controller.signal.aborted) {
      state.lastError = err.message;
      res.write(`\n<error>${err.message}</error>`);
    }
  } finally {
    clearTimeout(timer);
    res.end();
  }
}

/** Registers the /local-ai/* routes on the dev server's express app. */
function registerLocalAiRoutes(app) {
  const config = loadConfig();
  app.get('/local-ai/status', async (req, res) => {
    res.json(await status(loadConfig()));
  });
  app.post('/local-ai/warmup', async (req, res) => {
    const cfg = loadConfig();
    void warmup(cfg);
    res.json({ started: true, warming: state.warming });
  });
  app.get('/local-ai/context', (req, res) => {
    // Lets an agent or a curious user see exactly what the model is told.
    res
      .type('text/plain')
      .send(buildHighlighterContext(loadConfig(), String(req.query.ns || '')));
  });
  app.post('/local-ai/generate', (req, res) => {
    generate(loadConfig(), req, res).catch((err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      } else {
        res.end();
      }
    });
  });
  if (!config.disabled && config.warmupOnStart) {
    void warmup(config);
  } else if (config.disabled) {
    console.log('[local-ai] disabled by COMPASS_LOCAL_AI=0');
  }
  return config;
}

module.exports = {
  loadConfig,
  registerLocalAiRoutes,
  buildHighlighterContext,
  status,
};
