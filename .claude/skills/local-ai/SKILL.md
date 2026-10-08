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

1. `ollama list` shows a usable model (default `qwen2.5-coder:7b`); if not, `ollama pull` it.
   `curl localhost:11434/api/tags` answers. In WSL, `nvidia-smi` shows the GPU.
2. `curl localhost:<port>/local-ai/status`: `enabled: true`, `model` not null. The sandbox log
   prints `[local-ai] model … ready` after warm-up, or the reason it failed.
3. First query after a start takes longer (model loads into VRAM, a toast says so); later ones
   take a few seconds. If every call is slow, the model is too big for the card (14B on 8 GB
   spills to RAM): switch to a 7B or 3B model in `ai.yaml`.
4. "Unexpected response" errors mean the model answered outside the required
   `<filter>…</filter>` format; simpler wording or an example query usually fixes it.

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

Fits 8 GB VRAM at 4-bit: `qwen2.5-coder:7b` (default, best for structured output),
`llama3.1:8b` (the Llama option), `qwen2.5:7b`, `llama3.2:3b` (fastest). Set `model:` in
`ai.yaml` and list alternatives under `fallbackModels:`; the first installed one is used.
