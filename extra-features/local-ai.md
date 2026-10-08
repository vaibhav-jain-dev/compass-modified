# Local AI query generation

**Status:** in-progress (web sandbox first; Electron best effort)

## Summary

"Generate query" in the query bar runs on a local model on your own GPU instead of MongoDB's
cloud assistant, which the sandbox cannot reach. Natural language becomes a `find` (filter,
project, sort, skip, limit) or an aggregation, exactly as upstream does, and the prompt is
enriched with what the highlighter knows about the collection: what fields mean, which ids point
where, and example queries. Nothing leaves the machine.

## Design

Upstream Compass builds a prompt (instructions + schema + sample documents + the user's
sentence), streams the answer from the Atlas assistant through the OpenAI Responses API, parses
the `<filter>…</filter>` style answer and validates it. The fork keeps every one of those steps
and swaps only the transport:

```
query bar ──► LocalAiService (compass-generative-ai, fork)
                 │  builds the same prompt as upstream (buildFindQueryPrompt)
                 ▼
         POST /local-ai/generate   (sandbox dev server, Node)
                 │  adds highlighter context from ~/compass-highlighter/* for the namespace
                 │  streams from Ollama /api/chat with keep_alive and num_ctx
                 ▼
         text chunks ──► parseXmlToJsonResponse + validateAIQueryResponse (upstream code)
                 ▼
         query bar fields
```

Why a dev-server hop instead of calling Ollama from the browser: no CORS configuration on
Ollama, one place to read the highlighter YAML files for context, a warm-up on start, and a
status endpoint the UI can show. Electron can call Ollama directly later with the same service
class (planned).

### Latency, loading and the loader

- **Lazy, low footprint.** Ollama loads the model into VRAM on first use (a couple of seconds
  for the default 3B model) and unloads it `keepAlive` after the last request (2 minutes by
  default), so the GPU is only busy while a query is being generated. `warmupOnStart: true`
  loads the model when the sandbox starts instead; it makes the first query faster but keeps
  VRAM occupied while idle, which on an 8 GB card shared with the Windows desktop makes the
  whole machine sluggish. That is why it is off by default.
- **CPU only.** `numGpu: 0` in `ai.yaml` runs the model without the GPU: slower, but the GPU
  is never touched.
- **Prompt budget.** Ollama silently drops the first half of a prompt that does not fit the
  context window, which removes the instructions and makes the model answer in prose (the query
  bar then stays empty with no error). The dev server estimates the prompt size per request: a
  prompt wider than `numCtx` (8192) gets a larger window for that request, up to `maxNumCtx`
  (16384); only past that are the highlighter notes trimmed (examples first, then relations,
  then field meanings). Every adjustment is logged as `[local-ai] <namespace>: prompt is ~N
tokens, ...` and the response carries `x-local-ai-prompt-tokens`. A collection with a very
  wide schema (`loan_applications` is about 2.7k tokens with notes) is the usual trigger.
- **Loader.** The query bar's AI input shows its animated loading state while a request runs
  (upstream behaviour). In addition, when the model is not yet loaded the fork shows a
  "Loading `<model>` on the GPU, the first query takes longer" toast that closes when the answer
  arrives, so a 10-second first call is not mistaken for a hang.
- **Cancel.** Escape or the cancel button aborts the request end to end: the browser aborts the
  fetch, the dev server aborts the Ollama stream.
- **Status.** `GET /local-ai/status` reports the configured model, whether it is installed,
  whether it is loaded, and the last error; the Highlighter tab shows it under "Local AI".

### Choosing a model

All at 4-bit quantisation. The default is deliberately small: the GPU is shared with the
Windows desktop and a resident 7B model (plus whatever else uses Ollama) left the machine
stuttering even when no query was running. Latency of a few seconds is acceptable; a busy GPU
is not.

| Model                | VRAM   | Notes                                                       |
| -------------------- | ------ | ----------------------------------------------------------- |
| `qwen2.5-coder:3b`   | 2 GB   | default; good on finds and shell syntax, loads in about 2 s |
| `qwen2.5-coder:1.5b` | 1 GB   | smallest usable; simple filters only                        |
| `llama3.2:3b`        | 2 GB   | the Llama option at the same size                           |
| `qwen2.5-coder:7b`   | 4.7 GB | best quality; only when nothing else needs the GPU          |
| `llama3.1:8b`        | 4.9 GB | fine for simple filters, weaker on aggregations             |

Measured on the `devlms` database through the real UI (nine prompts, basic to complex, with the
highlighter notes in the prompt; "correct" means the filter does what was asked):

| Model                | Correct filters | Warm latency | Notes                                                          |
| -------------------- | --------------- | ------------ | -------------------------------------------------------------- |
| `qwen2.5-coder:3b`   | 8 / 9           | 2.4 s        | chosen; uses note vocabulary (`instance_fields.0`, deep paths) |
| `qwen2.5-coder:1.5b` | 7 / 9           | 2.1 s        | invents enum values, pads projections; not worth the saving    |
| `qwen2.5-coder:7b`   | 9 / 9           | 2.6 s        | 4.7 GB resident; made the shared GPU sluggish                  |

The shared miss is "more than 2 entries in an array" (the models write `$size: {$gt: 2}`, which
MongoDB rejects; `"array.2": {$exists: true}` is the find-query form). Aggregation-style asks
(group, count per key) are also beyond a find query; write those pipelines by hand or add a
`shell:` query to the highlighter file. Small models copy `project`/`sort` from the example
queries even when not asked; delete what you do not want before pressing Find.

Install with `ollama pull <model>`. Larger models (14B) spill into system RAM on 8 GB and get
slow; not recommended. Set `model` in `~/compass-highlighter/ai.yaml` or
`COMPASS_LOCAL_AI_MODEL=... npm run start-web`. Check what is resident with
`curl localhost:11434/api/ps` and free it at once with
`curl localhost:11434/api/generate -d '{"model":"<name>","keep_alive":0}'`.

### What the highlighter adds to the prompt

For the collection being queried, from `models/<db>.yaml`, the active feature in
`highlighter.yaml` and `mappings/<db>.yaml`:

- the collection's alias and notes;
- field meanings: `path: label; notes` for every known field (capped by `context.maxFields`);
- relations as plain sentences: `product_id points at products._id`;
- example queries (`queries:` with `filter`/`project`/`sort`) as worked examples, which is the
  single most effective way to teach a small model the house conventions (ids stored as text,
  field names, enum values).

Agents maintain all of this through the `highlighter`, `models` and `mappings` skills, so
improving the AI's answers is a YAML edit, not a prompt-engineering session.

### Predefined queries and views

- The Documents tab toolbar has a **Queries** menu listing the queries defined for the
  collection: the active feature's `queries` with a matching `namespace`, and collection-level
  `queries` from the model file. Clicking one applies filter, project, sort, skip and limit to
  the query bar and runs it.
- The Highlighter tab keeps "Open with filter" on every query (opens a new tab).
- The same queries are the AI's few-shot examples, so the two features reinforce each other.

## How to enable

1. Install Ollama in WSL (`curl -fsSL https://ollama.com/install.sh | sh`) and pull a model:
   `ollama pull qwen2.5-coder:3b`. Check `nvidia-smi` shows the GPU inside WSL.
2. Optionally copy `extra-features/ai.example.yaml` to `~/compass-highlighter/ai.yaml` and edit.
3. `npm run start-web`. In the Documents tab, click "Generate query", type a sentence, press
   Enter. The first call loads the model (a toast says so); `GET /local-ai/status` shows what
   is installed and loaded.

## How to use

- Write what you want in plain words: "clones of the salary field", "loans created last week
  with no occurrences document". Mention collection vocabulary; the model has the highlighter
  notes, so "family key" or "slot 0" are understood when they are in the YAML.
- If the answer is wrong, add a `queries:` example or a field note to the YAML and ask again;
  that beats rephrasing.

## Where the code lives

- `packages/compass-web/scripts/local-ai.js`: config loading, Ollama client, warm-up, status,
  highlighter context builder, `/local-ai/*` endpoints.
- `packages/compass-generative-ai/src/local-ai-service.ts`: the service the query bar calls;
  same interface as the Atlas one, streams from `/local-ai/generate`.
- `packages/compass-generative-ai/src/provider.tsx`: `localAiEndpoint` prop on the provider.
- `packages/compass-web/src/entrypoint.tsx`, `sandbox/index.tsx`: wiring and the `localAi`
  prop.
- `packages/compass-highlighter/src/components/queries-menu.tsx`: the Documents tab menu.
- `packages/compass-query-bar/src/components/hooks.tsx`: `useApplyQueryBarQuery`.

## Upstream files modified

See the list in the code section; each is marked with a "Fork extra feature" comment.

## How to test

```bash
npm test -w @mongodb-js/compass-generative-ai src/local-ai-service.spec.ts
npm test -w @mongodb-js/compass-highlighter
curl -s localhost:<sandbox port>/local-ai/status
```

## Known limitations

- Mock data generation and the assistant chat still need Atlas; only query and aggregation
  generation are local.
- Electron uses the same service but needs an Ollama reachable from the renderer; not wired yet.
- A 7B model can still produce invalid shell syntax on long prompts; the upstream validator
  rejects it and the input shows the error, retry with simpler wording or add an example.
