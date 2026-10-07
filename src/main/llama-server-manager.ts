import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import type { BonsaiModelSize, BonsaiServerStatus } from '../shared/types';
import { LLAMA_SERVER_CONFIG } from '../shared/constants';
import { downloadBonsaiModel, getBonsaiModelPath } from './bonsai-model-manager';
import { ensureLlamaServerRuntime, getBundledLlamaServerPath } from './llama-runtime-manager';

// ── Module State ──

let serverProcess: ChildProcess | null = null;
let serverPort: number | null = null;
let currentModelSize: BonsaiModelSize | null = null;
let serverHealthy = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

export interface LlamaServerSetupProgress {
  stage: 'server' | 'model' | 'starting';
  progress: number | null;
}

// ── Paths ──

function getDataDir(): string {
  return path.join(app.getPath('home'), '.ghostedit');
}

function getPidFilePath(): string {
  return path.join(getDataDir(), 'llama-server.pid');
}

function getLogFilePath(): string {
  return path.join(getDataDir(), 'llama-server.log');
}

export function getLlamaServerBinaryPath(): string {
  return getBundledLlamaServerPath();
}

// ── Port Allocation ──

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Failed to allocate port')));
      }
    });
    server.on('error', reject);
  });
}

// ── Health Check ──

async function waitForHealthy(port: number): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < LLAMA_SERVER_CONFIG.healthOverallTimeoutMs) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LLAMA_SERVER_CONFIG.healthTimeoutPerAttemptMs);
      const resp = await fetch(`http://127.0.0.1:${port}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (resp.ok) {
        return;
      }
    } catch {
      // Server not ready yet, keep polling
    }

    // Check if process died during startup
    if (serverProcess && serverProcess.exitCode !== null) {
      throw new Error(`llama-server exited during startup (code ${serverProcess.exitCode}). Check ${getLogFilePath()}`);
    }

    await new Promise((r) => setTimeout(r, LLAMA_SERVER_CONFIG.healthPollMs));
  }

  throw new Error(`llama-server health check timed out after ${LLAMA_SERVER_CONFIG.healthOverallTimeoutMs / 1000}s`);
}

// ── PID File ──

function writePidFile(pid: number, port: number, modelPath: string): void {
  const info = { pid, port, modelPath, startedAt: new Date().toISOString() };
  fs.mkdirSync(getDataDir(), { recursive: true });
  fs.writeFileSync(getPidFilePath(), JSON.stringify(info, null, 2));
}

function deletePidFile(): void {
  try {
    fs.unlinkSync(getPidFilePath());
  } catch {
    // File may not exist
  }
}

// ── Orphan Cleanup ──

/** Kill any leftover llama-server from a previous app session using the PID file. */
function killOrphanedServer(): void {
  try {
    const raw = fs.readFileSync(getPidFilePath(), 'utf-8');
    const info = JSON.parse(raw);
    if (info?.pid) {
      try {
        process.kill(info.pid, 'SIGTERM');
      } catch {
        // Process already dead
      }
    }
  } catch {
    // No PID file or unreadable
  }
  deletePidFile();
}

// ── Start / Stop ──

export async function startLlamaServer(
  modelSize: BonsaiModelSize,
  onProgress?: (progress: LlamaServerSetupProgress) => void,
): Promise<void> {
  // Kill any orphaned server from a previous app session
  killOrphanedServer();

  onProgress?.({ stage: 'server', progress: null });
  const binaryPath = await ensureLlamaServerRuntime((progress) => {
    onProgress?.({ stage: 'server', progress });
  });

  onProgress?.({ stage: 'model', progress: null });
  await downloadBonsaiModel(modelSize, (progress) => {
    onProgress?.({ stage: 'model', progress });
  });

  const modelPath = getBonsaiModelPath(modelSize);
  if (!modelPath) {
    throw new Error(`Bonsai ${modelSize} model not found. Download it first.`);
  }

  const port = await findFreePort();
  onProgress?.({ stage: 'starting', progress: null });
  const logPath = getLogFilePath();
  fs.mkdirSync(getDataDir(), { recursive: true });
  const logFd = fs.openSync(logPath, 'w');

  const args = [
    '-m', modelPath,
    '--host', '127.0.0.1',
    '--port', String(port),
    '--ctx-size', String(LLAMA_SERVER_CONFIG.ctxSize),
    '--threads', String(os.cpus().length),
    '--batch-size', String(LLAMA_SERVER_CONFIG.batchSize),
    '-ngl', String(LLAMA_SERVER_CONFIG.nGpuLayers),
  ];

  // Not detached: server dies with the app (prevents orphans)
  const serverEnv = { ...process.env };
  if (process.platform === 'linux') {
    serverEnv.LD_LIBRARY_PATH = [path.dirname(binaryPath), process.env.LD_LIBRARY_PATH]
      .filter(Boolean)
      .join(path.delimiter);
  } else if (process.platform === 'darwin') {
    serverEnv.DYLD_LIBRARY_PATH = [path.dirname(binaryPath), process.env.DYLD_LIBRARY_PATH]
      .filter(Boolean)
      .join(path.delimiter);
  }

  const child = spawn(binaryPath, args, {
    stdio: ['ignore', logFd, logFd],
    env: serverEnv,
  });

  fs.closeSync(logFd);

  child.on('error', (err) => {
    console.error('[GhostEdit] llama-server spawn error:', err.message);
    serverProcess = null;
    serverHealthy = false;
    currentModelSize = null;
    serverPort = null;
    deletePidFile();
  });

  child.on('exit', (code) => {
    console.warn(`[GhostEdit] llama-server exited (code ${code})`);
    serverProcess = null;
    serverHealthy = false;
    currentModelSize = null;
    serverPort = null;
    deletePidFile();
  });

  serverProcess = child;
  serverPort = port;
  currentModelSize = modelSize;

  writePidFile(child.pid!, port, modelPath);

  await waitForHealthy(port);
  serverHealthy = true;
}

export async function stopLlamaServer(): Promise<void> {
  clearIdleTimer();

  if (!serverProcess) {
    deletePidFile();
    return;
  }

  const proc = serverProcess;
  serverProcess = null;
  serverHealthy = false;
  currentModelSize = null;
  serverPort = null;

  // Send SIGTERM (or taskkill on Windows)
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t']);
    } catch { /* best effort */ }
  } else {
    try {
      proc.kill('SIGTERM');
    } catch { /* best effort */ }
  }

  // Wait for graceful exit
  const exited = await new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(false), LLAMA_SERVER_CONFIG.shutdownGracePeriodMs);
    proc.on('exit', () => {
      clearTimeout(timeout);
      resolve(true);
    });
    // If already exited
    if (proc.exitCode !== null) {
      clearTimeout(timeout);
      resolve(true);
    }
  });

  // Force kill if still alive
  if (!exited) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t']);
      } else {
        proc.kill('SIGKILL');
      }
    } catch { /* best effort */ }
  }

  deletePidFile();
}

export async function ensureLlamaServer(
  modelSize: BonsaiModelSize,
  onProgress?: (progress: LlamaServerSetupProgress) => void,
): Promise<number> {
  // Already running with correct model
  if (serverProcess && serverHealthy && currentModelSize === modelSize && serverPort) {
    return serverPort;
  }

  // Running with different model -- restart
  if (serverProcess) {
    await stopLlamaServer();
  }

  await startLlamaServer(modelSize, onProgress);
  return serverPort!;
}

// ── Idle Timeout ──

// No-op: server stays alive for the lifetime of the app.
// Kept as export so callers don't need to change.
export function resetIdleTimer(): void {}

export function clearIdleTimer(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

// ── Status ──

export function getLlamaServerStatus(): BonsaiServerStatus {
  return {
    running: serverProcess !== null && serverProcess.exitCode === null,
    port: serverPort,
    healthy: serverHealthy,
    modelSize: currentModelSize,
  };
}

// ── Cleanup (synchronous for will-quit) ──

export function shutdownLlamaServer(): void {
  clearIdleTimer();

  if (!serverProcess) {
    deletePidFile();
    return;
  }

  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t']);
    } else {
      serverProcess.kill('SIGTERM');
    }
  } catch { /* best effort */ }

  serverProcess = null;
  serverHealthy = false;
  currentModelSize = null;
  serverPort = null;
  deletePidFile();
}
