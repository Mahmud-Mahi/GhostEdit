import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { app } from 'electron';
import type { BonsaiModelSize, BonsaiModelInfo } from '../shared/types';
import { BONSAI_MODELS, BONSAI_GGUF_FILES, BONSAI_HF_REPOS } from '../shared/constants';

// ── Paths ──

export function getUserBonsaiModelDir(): string {
  return path.join(app.getPath('home'), '.ghostedit', 'models', 'bonsai');
}

export function getBonsaiModelPath(size: BonsaiModelSize): string | null {
  const filename = BONSAI_GGUF_FILES[size];

  const modelPath = path.join(getUserBonsaiModelDir(), filename);
  return fs.existsSync(modelPath) ? modelPath : null;
}

// ── Scanning ──

let cachedModels: BonsaiModelInfo[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000;

export function scanBonsaiModels(): BonsaiModelInfo[] {
  const now = Date.now();
  if (cachedModels && now - cacheTimestamp < CACHE_TTL) {
    return cachedModels;
  }

  const userDir = getUserBonsaiModelDir();

  const result: BonsaiModelInfo[] = BONSAI_MODELS.map((m) => {
    const filename = BONSAI_GGUF_FILES[m.size];
    const userPath = path.join(userDir, filename);
    const downloaded = fs.existsSync(userPath);

    return {
      size: m.size,
      displayName: m.displayName,
      sizeMB: m.sizeMB,
      available: downloaded,
      bundled: false,
    };
  });

  cachedModels = result;
  cacheTimestamp = now;
  return result;
}

export function invalidateBonsaiModelCache(): void {
  cachedModels = null;
  cacheTimestamp = 0;
}

// ── Download ──

async function getLatestModelRevision(size: BonsaiModelSize): Promise<string> {
  const repo = BONSAI_HF_REPOS[size];
  const response = await fetch(`https://huggingface.co/api/models/${repo}`);
  if (!response.ok) throw new Error(`Could not check the latest Bonsai model (HTTP ${response.status})`);
  const modelInfo = await response.json();
  if (typeof modelInfo.sha !== 'string' || !modelInfo.sha) {
    throw new Error('Hugging Face did not return a Bonsai model revision');
  }
  return modelInfo.sha;
}

async function installLatestBonsaiModel(
  size: BonsaiModelSize,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const destDir = getUserBonsaiModelDir();
  const filename = BONSAI_GGUF_FILES[size];
  const destPath = path.join(destDir, filename);
  const partialPath = destPath + '.partial';
  const manifestPath = path.join(destDir, `${filename}.json`);
  const repo = BONSAI_HF_REPOS[size];

  let revision: string;
  try {
    revision = await getLatestModelRevision(size);
  } catch (error) {
    if (fs.existsSync(destPath)) {
      console.warn(`[GhostEdit] Could not check for a newer Bonsai model; using the installed model: ${(error as Error).message}`);
      return;
    }
    throw error;
  }

  try {
    const installed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as { revision?: string };
    if (installed.revision === revision && fs.existsSync(destPath)) return;
  } catch {
    // An untracked existing model is refreshed to the current Hugging Face revision.
  }

  fs.mkdirSync(destDir, { recursive: true });
  const url = `https://huggingface.co/${repo}/resolve/${revision}/${filename}`;
  console.log(`[GhostEdit] Downloading latest Bonsai ${size} model from Hugging Face`);

  try {
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error(`Model download failed with HTTP ${response.status}`);
    const totalBytes = Number(response.headers.get('content-length')) ||
      (BONSAI_MODELS.find((model) => model.size === size)?.sizeMB ?? 0) * 1_000_000;
    let downloadedBytes = 0;
    onProgress?.(0);
    const progressStream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            downloadedBytes += value.byteLength;
            if (totalBytes && onProgress) onProgress(Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)));
            controller.enqueue(value);
          }
          controller.close();
          onProgress?.(100);
        } catch (error) {
          controller.error(error);
        }
      },
    });
    await pipeline(Readable.fromWeb(progressStream as never), fs.createWriteStream(partialPath));
    if (fs.statSync(partialPath).size === 0) throw new Error('Downloaded Bonsai model file is empty');

    fs.renameSync(partialPath, destPath);
    fs.writeFileSync(manifestPath, JSON.stringify({ revision, repo, updatedAt: new Date().toISOString() }, null, 2));
    invalidateBonsaiModelCache();
    console.log(`[GhostEdit] Bonsai ${size} model is ready`);
  } catch (error) {
    fs.rmSync(partialPath, { force: true });
    if (fs.existsSync(destPath)) {
      console.warn(`[GhostEdit] Could not update Bonsai model; using the installed model: ${(error as Error).message}`);
      return;
    }
    throw error;
  }
}

const modelInstallPromises = new Map<BonsaiModelSize, Promise<void>>();

export function downloadBonsaiModel(
  size: BonsaiModelSize,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const existing = modelInstallPromises.get(size);
  if (existing) return existing;

  const installPromise = installLatestBonsaiModel(size, onProgress).finally(() => {
    modelInstallPromises.delete(size);
  });
  modelInstallPromises.set(size, installPromise);
  return installPromise;
}
