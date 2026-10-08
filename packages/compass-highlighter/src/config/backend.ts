/**
 * Where the YAML lives is platform specific: a file on disk in the desktop
 * app, an endpoint of the dev server in compass-web. The store only talks to
 * this interface.
 */
export type MappingsSource = {
  /** Where the file lives, for messages */
  path: string;
  /** Database name derived from the file name (`mappings/<database>.yaml`) */
  database: string;
  text: string;
};

export type ConfigBackend = {
  /** Human readable location shown in the UI (file path or URL). */
  readonly path: string;
  exists(): Promise<boolean>;
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
  /** All per-database mapping files next to the config (mappings/). */
  readMappings(): Promise<MappingsSource[]>;
  /** All per-database model files next to the config (models/). */
  readModels(): Promise<MappingsSource[]>;
  /** Called whenever the config or a mapping file may have changed. */
  watch(onChange: () => void): () => void;
};

/**
 * Used when no backend is configured (e.g. compass-web embedded in Atlas).
 * The plugin then reports itself as disabled and renders nothing.
 */
export class NullConfigBackend implements ConfigBackend {
  readonly path = '';
  exists() {
    return Promise.resolve(false);
  }
  readText() {
    return Promise.reject(new Error('Highlighter is not available here'));
  }
  writeText() {
    return Promise.reject(new Error('Highlighter is not available here'));
  }
  readMappings() {
    return Promise.resolve([]);
  }
  readModels() {
    return Promise.resolve([]);
  }
  watch() {
    return () => {
      // nothing to unsubscribe
    };
  }
}
