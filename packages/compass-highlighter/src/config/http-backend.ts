import type { ConfigBackend, MappingsSource } from './backend';

const POLL_INTERVAL_MS = 1500;

type ConfigResponse = {
  path: string;
  exists: boolean;
  mtimeMs: number | null;
  text?: string;
  // fingerprint of the mappings directory, so one poll covers everything
  mappingsStamp?: string;
};

/**
 * Browser backend. Talks to the endpoint that the compass-web dev server
 * exposes for the YAML file (see packages/compass-web/webpack.config.js).
 * Change detection polls the file's mtime.
 */
export class HttpConfigBackend implements ConfigBackend {
  private knownPath = '';
  private readonly url: string;
  private readonly fetchFn: typeof fetch;

  constructor(
    url: string,
    fetchFn: typeof fetch = (...args) => fetch(...args)
  ) {
    this.url = url;
    this.fetchFn = fetchFn;
  }

  get path(): string {
    return this.knownPath || this.url;
  }

  private async getMeta(): Promise<ConfigResponse> {
    const res = await this.fetchFn(`${this.url}?meta=1`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`Highlighter endpoint returned ${res.status}`);
    }
    const meta = (await res.json()) as ConfigResponse;
    this.knownPath = meta.path;
    return meta;
  }

  async exists(): Promise<boolean> {
    return (await this.getMeta()).exists;
  }

  async readText(): Promise<string> {
    const res = await this.fetchFn(this.url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Highlighter endpoint returned ${res.status}`);
    }
    const body = (await res.json()) as ConfigResponse;
    this.knownPath = body.path;
    return body.text ?? '';
  }

  private async readSidecars(
    kind: 'mappings' | 'models'
  ): Promise<MappingsSource[]> {
    const res = await this.fetchFn(`${this.url}/${kind}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`Highlighter endpoint returned ${res.status}`);
    }
    return (await res.json()) as MappingsSource[];
  }

  readMappings(): Promise<MappingsSource[]> {
    return this.readSidecars('mappings');
  }

  readModels(): Promise<MappingsSource[]> {
    return this.readSidecars('models');
  }

  async writeText(text: string): Promise<void> {
    const res = await this.fetchFn(this.url, {
      method: 'PUT',
      headers: { 'content-type': 'text/yaml' },
      body: text,
    });
    if (!res.ok) {
      throw new Error(`Highlighter endpoint returned ${res.status}`);
    }
  }

  watch(onChange: () => void): () => void {
    let last: string | null = null;
    let stopped = false;
    const tick = async () => {
      try {
        const meta = await this.getMeta();
        const stamp = `${meta.exists}:${meta.mtimeMs ?? ''}:${
          meta.mappingsStamp ?? ''
        }`;
        if (last !== null && stamp !== last) {
          onChange();
        }
        last = stamp;
      } catch {
        // endpoint temporarily unavailable (dev server restarting); keep polling
      }
    };
    const interval = setInterval(() => {
      if (!stopped) {
        void tick();
      }
    }, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }
}
