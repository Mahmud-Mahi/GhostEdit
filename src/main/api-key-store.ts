import * as fs from 'node:fs';
import * as path from 'node:path';
import { safeStorage } from 'electron';
import { configManager } from './config-manager';

function getKeyPath(): string {
  return path.join(configManager.configDirPath, 'api-key.enc');
}

export function loadApiKey(): string {
  const keyPath = getKeyPath();
  if (!fs.existsSync(keyPath)) return '';
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure credential storage is unavailable on this system');
  }
  return safeStorage.decryptString(fs.readFileSync(keyPath));
}

export function saveApiKey(apiKey: string): void {
  const keyPath = getKeyPath();
  if (!apiKey) {
    fs.rmSync(keyPath, { force: true });
    return;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure credential storage is unavailable on this system');
  }
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(keyPath, safeStorage.encryptString(apiKey));
}