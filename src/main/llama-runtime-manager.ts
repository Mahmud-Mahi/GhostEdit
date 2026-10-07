import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

interface RuntimeTarget {
  binaryName: string;
}

const TARGETS: Record<string, RuntimeTarget> = {
  'linux-x64': { binaryName: 'llama-server' },
  'linux-arm64': { binaryName: 'llama-server' },
  'darwin-x64': { binaryName: 'llama-server' },
  'darwin-arm64': { binaryName: 'llama-server' },
  'win32-x64': { binaryName: 'llama-server.exe' },
  'win32-arm64': { binaryName: 'llama-server.exe' },
};

export function getBundledLlamaServerPath(): string {
  const targetKey = `${process.platform}-${process.arch}`;
  const target = TARGETS[targetKey];
  if (!target) throw new Error(`No bundled llama.cpp server is configured for ${targetKey}`);
  const runtimeDir = app.isPackaged
    ? path.join(process.resourcesPath, targetKey)
    : path.join(app.getAppPath(), 'resources', 'bin', targetKey);
  return path.join(runtimeDir, target.binaryName);
}

export async function ensureLlamaServerRuntime(onProgress?: (progress: number) => void): Promise<string> {
  const binaryPath = getBundledLlamaServerPath();
  if (!fs.existsSync(binaryPath)) {
    throw new Error(`The bundled llama.cpp server is missing for ${process.platform}-${process.arch}. Rebuild GhostEdit with the matching server runtime.`);
  }
  onProgress?.(100);
  return binaryPath;
}