import { promises as fs, watchFile, unwatchFile } from 'fs';
import os from 'os';
import path from 'path';
import type { PreferencesAccess } from 'compass-preferences-model/provider';
import type { ConfigBackend, MappingsSource } from './backend';

export const CONFIG_FILE_NAME = 'highlighter.yaml';
export const CONFIG_DIR_NAME = 'compass-highlighter';
export const MAPPINGS_DIR_NAME = 'mappings';
export const MODELS_DIR_NAME = 'models';
const WATCH_INTERVAL_MS = 1000;

export function getMappingsDir(configPath: string): string {
  return path.join(path.dirname(configPath), MAPPINGS_DIR_NAME);
}

export function getModelsDir(configPath: string): string {
  return path.join(path.dirname(configPath), MODELS_DIR_NAME);
}

export async function readMappingsDir(dir: string): Promise<MappingsSource[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const sources: MappingsSource[] = [];
  for (const entry of entries.filter((e) => /\.ya?ml$/i.test(e)).sort()) {
    const filePath = path.join(dir, entry);
    sources.push({
      path: filePath,
      database: entry.replace(/\.ya?ml$/i, ''),
      text: await fs.readFile(filePath, 'utf8'),
    });
  }
  return sources;
}

/** A cheap fingerprint of the mappings dir, used by the pollers. */
export async function mappingsStamp(dir: string): Promise<string> {
  try {
    const entries = (await fs.readdir(dir)).filter((e) => /\.ya?ml$/i.test(e));
    const stats = await Promise.all(
      entries.sort().map(async (e) => {
        const s = await fs.stat(path.join(dir, e));
        return `${e}:${s.mtimeMs}`;
      })
    );
    return stats.join('|');
  } catch {
    return '';
  }
}

/**
 * Deliberately a visible folder in the home directory rather than the
 * Electron user data dir: agents working in any project must be able to find
 * and edit the file without the user pointing them at it.
 */
export function getDefaultConfigPath(): string {
  return path.join(os.homedir(), CONFIG_DIR_NAME, CONFIG_FILE_NAME);
}

export function resolveConfigPath(
  preferredPath: string | undefined,
  defaultPath: () => string = getDefaultConfigPath
): string {
  if (preferredPath && preferredPath.trim()) {
    return preferredPath.trim();
  }
  return defaultPath();
}

export class FileConfigBackend implements ConfigBackend {
  private readonly getPath: () => string;

  constructor(getPath: () => string) {
    this.getPath = getPath;
  }

  get path(): string {
    return this.getPath();
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.path);
      return true;
    } catch {
      return false;
    }
  }

  readText(): Promise<string> {
    return fs.readFile(this.path, 'utf8');
  }

  async writeText(text: string): Promise<void> {
    await fs.mkdir(path.dirname(this.path), { recursive: true });
    await fs.writeFile(this.path, text, 'utf8');
  }

  readMappings(): Promise<MappingsSource[]> {
    return readMappingsDir(getMappingsDir(this.path));
  }

  readModels(): Promise<MappingsSource[]> {
    return readMappingsDir(getModelsDir(this.path));
  }

  watch(onChange: () => void): () => void {
    const listener = () => onChange();
    // Polling instead of fs.watch: on WSL and network mounts fs.watch misses
    // events from editors that write via rename.
    watchFile(this.path, { interval: WATCH_INTERVAL_MS }, listener);
    let lastStamp: string | null = null;
    const dirs = [getMappingsDir(this.path), getModelsDir(this.path)];
    const interval = setInterval(() => {
      void Promise.all(dirs.map(mappingsStamp)).then((stamps) => {
        const stamp = stamps.join('#');
        if (lastStamp !== null && stamp !== lastStamp) {
          onChange();
        }
        lastStamp = stamp;
      });
    }, WATCH_INTERVAL_MS);
    return () => {
      unwatchFile(this.path, listener);
      clearInterval(interval);
    };
  }
}

/**
 * Desktop backend: path comes from the `highlighterConfigPath` preference and
 * re-points live when the preference changes.
 */
export function createPreferencesFileBackend(
  preferences: PreferencesAccess
): ConfigBackend {
  const getPath = () =>
    resolveConfigPath(preferences.getPreferences().highlighterConfigPath);
  const file = new FileConfigBackend(getPath);
  return {
    get path() {
      return file.path;
    },
    exists: () => file.exists(),
    readText: () => file.readText(),
    writeText: (text) => file.writeText(text),
    readMappings: () => file.readMappings(),
    readModels: () => file.readModels(),
    watch(onChange) {
      let unwatchFile = file.watch(onChange);
      const unsubscribePreference = preferences.onPreferenceValueChanged(
        'highlighterConfigPath',
        () => {
          unwatchFile();
          unwatchFile = file.watch(onChange);
          onChange();
        }
      );
      return () => {
        unwatchFile();
        unsubscribePreference();
      };
    },
  };
}
