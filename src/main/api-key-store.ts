import * as fs from 'node:fs';
import * as path from 'node:path';
import { safeStorage } from 'electron';
import { configManager } from './config-manager';
import type { OpenAICompatiblePreset } from '../shared/types';

function getKeyPath(profile: OpenAICompatiblePreset): string {
  return path.join(configManager.configDirPath, `api-key-${profile}.enc`);
}

function getLegacyKeyPath(): string {
  return path.join(configManager.configDirPath, 'api-key.enc');
}

function decryptKey(keyPath: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure credential storage is unavailable on this system');
  }
  return safeStorage.decryptString(fs.readFileSync(keyPath));
}

export function loadApiKey(profile = configManager.load().activeApiProfile): string {
  const keyPath = getKeyPath(profile);
  if (fs.existsSync(keyPath)) return decryptKey(keyPath);
  const legacyPath = getLegacyKeyPath();
  if (profile === configManager.load().activeApiProfile && fs.existsSync(legacyPath)) return decryptKey(legacyPath);
  return '';
}

export function saveApiKey(apiKey: string, profile = configManager.load().activeApiProfile): void {
  const keyPath = getKeyPath(profile);
  if (!apiKey) {
    fs.rmSync(keyPath, { force: true });
    if (profile === configManager.load().activeApiProfile) fs.rmSync(getLegacyKeyPath(), { force: true });
    return;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure credential storage is unavailable on this system');
  }
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(keyPath, safeStorage.encryptString(apiKey));
}