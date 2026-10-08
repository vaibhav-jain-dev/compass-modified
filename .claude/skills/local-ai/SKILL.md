---
name: local-ai
description: Configure, debug and improve the Compass fork's local AI query generation ("Generate query" running on the user's GPU through Ollama). Use when the user says "generate query does nothing", "AI is slow", "use a different model", "the AI got this query wrong", "teach the AI about this collection", or asks how the local model works. Also use when adding predefined queries for the Documents tab "Queries" menu.
---

# Local AI skill

"Generate query" in the Documents tab runs a local model through Ollama; the sandbox dev server
proxies to it and enriches the prompt with the highlighter files. Design and details:
`extra-features/local-ai.md`.

## Files and endpoints

- `~/compass-highlighter/ai.yaml` (optional): model, Ollama URL, context switches. Example:
  `extra-features/ai.example.yaml`. `COMPASS_LOCAL_AI_MODEL=<model>` overrides the model for one
  run; `COMPASS_LOCAL_AI=0` disables the feature.
- Sandbox endpoints (same port as the app): `GET /local-ai/status` (model installed? loaded?
  last error), `POST /local-ai/warmup`, `GET /local-ai/context?ns=<db.coll>` (the exact context
  the model receives for that collection), `POST /local-ai/generate`.
- Code: `packages/compass-web/scripts/local-ai.js` (server),
  `packages/compass-generative-ai/src/local-ai-service.ts` (client).

## Checklist when it "does nothing" or errors

1. `ollama list` shows a usable model (default `qwen2.5-coder:3b`); if not, `ollama pull` it.
   `curl localhost:11434/api/tags` answers. In WSL, `nvidia-smi` shows the GPU.
2. `curl localhost:<port>/local-ai/status`: `enabled: true`, `model` not null, `lastError`.
3. The first query, and the first one after 2 idle minutes, takes longer (the model loads into
   VRAM, a toast says so); the rest take a few seconds. If every call is slow, the model is too
   big for the card (14B on 8 GB spills to RAM): pick a 3B model in `ai.yaml`.
4. "Unexpected response" errors mean the model answered outside the required
   `<filter>…</filter>` format; simpler wording or an example query usually fixes it.
5. Nothing happens and no error: the prompt did not fit the context window and Ollama dropped
   the instructions. The sandbox log says `[local-ai] <ns>: prompt is ~N tokens, ...`; raise
   `maxNumCtx` in `ai.yaml` or trim notes for that collection. The dev server already widens
   the window (8192 → 16384) before dropping notes.
6. Known limits of the 3B model: "more than N entries in an array" comes out as
   `$size: {$gt: N}` (invalid; use `"array.N": {$exists: true}`), group/count asks need an
   aggregation, and `project`/`sort` are sometimes copied from the example queries unasked.

## Improving answers (preferred over prompt tweaks)

The model is told the collection's alias and notes, field meanings, relations and example
queries from the highlighter files. So:

- wrong field names or meanings → fix `label`/`notes` in `models/<db>.yaml` (`models` skill);
- wrong join/id handling → fix `mappings/<db>.yaml` (`mappings` skill);
- wrong shape for a recurring request → add a `queries:` entry with `title`, `filter`, and
  optional `project`/`sort` on the collection (model file or feature); it becomes both a worked
  example for the model and an item in the Documents tab **Queries** menu.

Check what the model sees with `GET /local-ai/context?ns=<db.coll>` before and after.

## Choosing a model

Low footprint is the rule: the GPU is shared with the Windows desktop, and a resident 7B model
made the whole machine sluggish even while idle. `qwen2.5-coder:3b` was measured against the
1.5B and 7B variants on nine real prompts (table in `extra-features/local-ai.md`) and is the
only chat model kept installed; the other Ollama models on the machine are embeddings used by
another project (`bge-m3`, keep it). Defaults: `qwen2.5-coder:3b` (2 GB VRAM),
`keepAlive: 2m` (unloaded two minutes after the last query), `warmupOnStart: false` (nothing
loads until the first query). Alternatives: `qwen2.5-coder:1.5b` (smallest), `llama3.2:3b`,
and `qwen2.5-coder:7b` only when the user explicitly wants quality over footprint. `numGpu: 0`
runs on the CPU. Set `model:` in `ai.yaml`, list alternatives under `fallbackModels:`; the
first installed one is used. Do not raise `keepAlive` or turn on `warmupOnStart` unless asked.
If the machine feels stuck, check `curl localhost:11434/api/ps` for resident models (other
tools use Ollama too) and unload with `curl localhost:11434/api/generate -d
'{"model":"<name>","keep_alive":0}'`.
