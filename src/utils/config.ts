import fs from 'fs';
import path from 'path';
import os from 'os';
import { Logger } from 'pino';

interface ConfigData {
  rpcUrls: string[];
  defaultRpcUrl?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.solana-timestamp');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Ensure config directory exists
const ensureConfigDir = (): void => {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
};

// Get configuration data
export const getConfig = (logger?: Logger): ConfigData => {
  ensureConfigDir();
  
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return {
        rpcUrls: configData.rpcUrls || [],
        defaultRpcUrl: configData.defaultRpcUrl
      };
    }
  } catch (error) {
    logger?.warn({ error }, 'Failed to read config file, using defaults');
  }
  
  // Default empty config
  return { rpcUrls: [] };
};

// Save configuration data
export const saveConfig = (config: ConfigData, logger?: Logger): boolean => {
  ensureConfigDir();
  
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    logger?.error({ error }, 'Failed to save config file');
    return false;
  }
};

// Add an RPC URL to the configuration
export const addRpcUrl = (url: string, setAsDefault = false, logger?: Logger): boolean => {
  const config = getConfig(logger);
  
  // Check if URL already exists
  if (!config.rpcUrls.includes(url)) {
    config.rpcUrls.push(url);
  }
  
  if (setAsDefault) {
    config.defaultRpcUrl = url;
  }
  
  return saveConfig(config, logger);
};

// Remove an RPC URL from the configuration
export const removeRpcUrl = (url: string, logger?: Logger): boolean => {
  const config = getConfig(logger);
  
  config.rpcUrls = config.rpcUrls.filter(rpcUrl => rpcUrl !== url);
  
  // If the default URL was removed, unset it
  if (config.defaultRpcUrl === url) {
    config.defaultRpcUrl = undefined;
  }
  
  return saveConfig(config, logger);
};

// Get all configured RPC URLs
export const getRpcUrls = (logger?: Logger): string[] => {
  return getConfig(logger).rpcUrls;
};

// Get the default RPC URL
export function getDefaultRpcUrl(logger: Logger): string | undefined {
  const config = getConfig(logger);
  const defaultUrl = config.defaultRpcUrl;
  return defaultUrl || undefined;
}

// Set the default RPC URL
export const setDefaultRpcUrl = (url: string, logger?: Logger): boolean => {
  const config = getConfig(logger);
  
  if (!config.rpcUrls.includes(url)) {
    return false;
  }
  
  config.defaultRpcUrl = url;
  return saveConfig(config, logger);
}; 