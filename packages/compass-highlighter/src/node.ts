// Node-only entry point. Kept out of the main entry so the browser bundle
// (compass-web) never pulls in fs/os/path.
export {
  FileConfigBackend,
  createPreferencesFileBackend,
  getDefaultConfigPath,
  resolveConfigPath,
  CONFIG_FILE_NAME,
  CONFIG_DIR_NAME,
} from './config/file-backend';
