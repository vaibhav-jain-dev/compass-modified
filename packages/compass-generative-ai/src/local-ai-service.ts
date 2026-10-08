import { openToast, closeToast } from '@mongodb-js/compass-components';
import type { AtlasService } from '@mongodb-js/atlas-service/provider';
import type { PreferencesAccess } from 'compass-preferences-model/provider';
import type { Logger } from '@mongodb-js/compass-logging';
import {
  AtlasAiService,
  validateAIAggregationResponse,
  validateAIQueryResponse,
  type GenerativeAiInput,
} from './atlas-ai-service';
import {
  buildAggregateQueryPrompt,
  buildFindQueryPrompt,
  type AiQueryPrompt,
} from './utils/gen-ai-prompt';
import { parseXmlToJsonResponse } from './utils/parse-xml-response';

const LOADING_TOAST_ID = 'local-ai-loading';

type LocalAiStatus = {
  enabled: boolean;
  model?: string | null;
  requestedModel?: string;
  loaded?: boolean;
  reason?: string;
  lastError?: string | null;
};

/**
 * Fork extra feature: "Generate query" against a model running on the local
 * GPU (Ollama) instead of the Atlas assistant. Same prompt, same response
 * parsing and validation as upstream; only the transport differs: the
 * sandbox dev server proxies to Ollama and adds highlighter context.
 * See extra-features/local-ai.md.
 */
export class LocalAiService extends AtlasAiService {
  private endpoint: string;
  private localLogger: Logger;
  private statusCache: LocalAiStatus | null = null;

  constructor({
    endpoint,
    apiURLPreset,
    atlasService,
    preferences,
    logger,
  }: {
    endpoint: string;
    apiURLPreset: 'private-api' | 'cloud';
    atlasService: AtlasService;
    preferences: PreferencesAccess;
    logger: Logger;
  }) {
    super({ apiURLPreset, atlasService, preferences, logger });
    this.endpoint = endpoint.replace(/\/$/, '');
    this.localLogger = logger;
  }

  /** Nothing to opt into: the model is the user's own. */
  override ensureAiFeatureAccess(): Promise<void> {
    return Promise.resolve();
  }

  async fetchStatus(): Promise<LocalAiStatus> {
    try {
      const res = await fetch(`${this.endpoint}/status`, { cache: 'no-store' });
      this.statusCache = (await res.json()) as LocalAiStatus;
    } catch (err) {
      this.statusCache = {
        enabled: false,
        reason: `local AI endpoint unreachable: ${(err as Error).message}`,
      };
    }
    return this.statusCache;
  }

  override async getAggregationFromUserInput(input: GenerativeAiInput) {
    const message = buildAggregateQueryPrompt({
      ...input,
      analyticsId: 'local',
    });
    const text = await this.generateLocally(message, input);
    const parsed = parseXmlToJsonResponse(text, {
      logger: this.localLogger,
      type: 'aggregate',
    });
    validateAIAggregationResponse(parsed);
    return parsed;
  }

  override async getQueryFromUserInput(input: GenerativeAiInput) {
    const message = buildFindQueryPrompt({ ...input, analyticsId: 'local' });
    const text = await this.generateLocally(message, input);
    const parsed = parseXmlToJsonResponse(text, {
      logger: this.localLogger,
      type: 'find',
    });
    validateAIQueryResponse(parsed);
    return parsed;
  }

  override getMockDataSchema(): never {
    throw new Error(
      'Mock data generation is not available with the local AI provider'
    );
  }

  private async generateLocally(
    message: AiQueryPrompt,
    input: GenerativeAiInput
  ): Promise<string> {
    const status = await this.fetchStatus();
    if (!status.enabled) {
      throw new Error(
        status.reason ??
          'Local AI is not available. Is Ollama running on this machine?'
      );
    }
    if (!status.model) {
      throw new Error(
        `No usable model is installed. Run: ollama pull ${
          status.requestedModel ?? 'qwen2.5-coder:3b'
        }`
      );
    }
    // The first request after a start loads the model into VRAM. Say so, or
    // a ten-second wait looks like a hang.
    const showLoading = !status.loaded;
    if (showLoading) {
      openToast(LOADING_TOAST_ID, {
        title: `Loading ${status.model} on the GPU`,
        description:
          'The first query takes longer while the model loads; the next ones are fast.',
        variant: 'progress',
      });
    }
    try {
      const res = await fetch(`${this.endpoint}/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: input.signal,
        body: JSON.stringify({
          instructions: message.metadata.instructions,
          prompt: message.prompt,
          namespace: `${input.databaseName}.${input.collectionName}`,
          requestId: input.requestId,
        }),
      });
      if (!res.ok) {
        let detail = `${res.status}`;
        try {
          detail = ((await res.json()) as { error?: string }).error ?? detail;
        } catch {
          // keep the status code
        }
        throw new Error(`Local AI request failed: ${detail}`);
      }
      const text = await res.text();
      const errorMatch = /<error>([\s\S]*?)<\/error>/.exec(text);
      if (errorMatch) {
        throw new Error(`Local model error: ${errorMatch[1]}`);
      }
      this.localLogger.log.info(
        this.localLogger.mongoLogId(1_001_000_410),
        'LocalAiService',
        'Generated with local model',
        { model: res.headers.get('x-local-ai-model'), length: text.length }
      );
      return text;
    } finally {
      if (showLoading) {
        closeToast(LOADING_TOAST_ID);
      }
    }
  }
}
