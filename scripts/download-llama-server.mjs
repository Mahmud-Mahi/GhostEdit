import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { fileURLToPath } from 'node:url';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
// Update the tag and all target hashes together when refreshing the bundled runtime.
const RELEASE_TAG = 'b11429';

function optionValue(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

const targetPlatform = optionValue('--platform', process.platform);
const targetArch = optionValue('--arch', process.arch);
const targetKey = `${targetPlatform}-${targetArch}`;
const dryRun = args.includes('--dry-run');

const TARGETS = {
  'linux-x64': {
    assetName: (tag) => `llama-${tag}-bin-ubuntu-x64.tar.gz`,
    binaryName: 'llama-server',
    patterns: /\.so(?:\..*)?$/,
    sha256: 'f6d25dde8f51133143d1453da4fd5f73b145127177612a283bf7995957af3392',
  },
  'linux-arm64': {
    assetName: (tag) => `llama-${tag}-bin-ubuntu-arm64.tar.gz`,
    binaryName: 'llama-server',
    patterns: /\.so(?:\..*)?$/,
    sha256: 'ed44c0f79c3d02424f62bdc87e106318b0b89f49050e2e80c5f352723d14e00b',
  },
  'darwin-x64': {
    assetName: (tag) => `llama-${tag}-bin-macos-x64.tar.gz`,
    binaryName: 'llama-server',
    patterns: /\.dylib$/,
    sha256: '29ac3ea02be6bd143e824973f2cc5fa74bc4094393a9eaab0ff6814f19dd8522',
  },
  'darwin-arm64': {
    assetName: (tag) => `llama-${tag}-bin-macos-arm64.tar.gz`,
    binaryName: 'llama-server',
    patterns: /\.dylib$/,
    sha256: '740288ec6887be94280a5dfa25b5e23a78285cab104519e6c7e218904ee82459',
  },
  'win32-x64': {
    assetName: (tag) => `llama-${tag}-bin-win-cpu-x64.zip`,
    binaryName: 'llama-server.exe',
    patterns: /\.dll$/,
    sha256: '1283323272b04cd07905816a597a0da810918102de958f4ff6f7bbaa70ed2efe',
  },
  'win32-arm64': {
    assetName: (tag) => `llama-${tag}-bin-win-cpu-arm64.zip`,
    binaryName: 'llama-server.exe',
    patterns: /\.dll$/,
    sha256: 'ee0f631a9e58b146ff50714099d9cb498906af3143a773b580093a9214a8d1e5',
  },
};

const target = TARGETS[targetKey];
const targetDir = path.join(rootDir, 'resources', 'bin', targetKey);
const targetBinary = path.join(targetDir, target?.binaryName ?? 'llama-server');
const manifestPath = path.join(targetDir, '.llama-server-runtime.json');

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

async function downloadAsset(url, destination, expectedDigest) {
  const response = await fetch(url, { headers: { 'User-Agent': 'GhostEdit-build' } });
  if (!response.ok || !response.body) throw new Error(`Archive download failed (${response.status})`);
  const totalBytes = Number(response.headers.get('content-length')) || 0;
  let downloadedBytes = 0;
  let lastPercent = -1;
  const progressStream = new Transform({
    transform(chunk, _encoding, callback) {
      downloadedBytes += chunk.length;
      if (totalBytes) {
        const percent = Math.floor((downloadedBytes / totalBytes) * 100);
        if (percent !== lastPercent) {
          process.stdout.write(`\r  ${percent}%`);
          lastPercent = percent;
        }
      }
      callback(null, chunk);
    },
    flush(callback) {
      if (totalBytes) process.stdout.write('\n');
      callback();
    },
  });
  await pipeline(Readable.fromWeb(response.body), progressStream, fs.createWriteStream(destination));

  if (expectedDigest?.startsWith('sha256:')) {
    const actual = createHash('sha256').update(fs.readFileSync(destination)).digest('hex');
    if (actual !== expectedDigest.slice('sha256:'.length)) {
      throw new Error('llama.cpp archive SHA-256 did not match the pinned checksum');
    }
  }
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

function isSafeArchivePath(entry) {
  const normalized = entry.replaceAll('\\', '/');
  return !normalized.startsWith('/') && !normalized.split('/').includes('..');
}

async function main() {
  if (!target) {
    throw new Error(`No llama.cpp CPU server archive is configured for ${targetKey}`);
  }

  if (
    fs.existsSync(targetBinary) &&
    readManifest()?.tag === RELEASE_TAG &&
    process.env.FORCE_LLAMA_SERVER_DOWNLOAD !== '1' &&
    !dryRun
  ) {
    console.log(`llama-server ${RELEASE_TAG} already prepared: ${targetBinary}`);
    return;
  }

  const assetName = target.assetName(RELEASE_TAG);
  const assetUrl = `https://github.com/ggml-org/llama.cpp/releases/download/${RELEASE_TAG}/${assetName}`;

  if (dryRun) {
    console.log(`llama.cpp ${RELEASE_TAG}: ${assetName}`);
    return;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghostedit-llama-'));
  const archivePath = path.join(tempDir, assetName);
  const extractedDir = path.join(tempDir, 'extracted');
  fs.mkdirSync(extractedDir);

  try {
    console.log(`Downloading llama.cpp ${RELEASE_TAG} ${assetName}`);
    await downloadAsset(assetUrl, archivePath, `sha256:${target.sha256}`);

    const isZip = assetName.endsWith('.zip');
    const archiveEntries = isZip && process.platform !== 'win32'
      ? execFileSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' }).split('\n').filter(Boolean)
      : execFileSync('tar', ['-tf', archivePath], { encoding: 'utf8' }).split('\n').filter(Boolean);
    if (archiveEntries.some((entry) => !isSafeArchivePath(entry))) {
      throw new Error('llama.cpp archive contains an unsafe file path');
    }

    if (isZip && process.platform !== 'win32') {
      execFileSync('unzip', ['-q', archivePath, '-d', extractedDir], { stdio: 'inherit' });
    } else {
      const extractionArgs = isZip
        ? ['-xf', archivePath, '-C', extractedDir]
        : ['-xzf', archivePath, '-C', extractedDir];
      execFileSync('tar', extractionArgs, { stdio: 'inherit' });
    }

    const extractedFiles = listFiles(extractedDir);
    const binary = extractedFiles.find((file) => path.basename(file) === target.binaryName);
    if (!binary) throw new Error(`${target.binaryName} was not present in the downloaded release archive`);

    fs.mkdirSync(targetDir, { recursive: true });
    const stagedBinary = `${targetBinary}.partial`;
    fs.copyFileSync(binary, stagedBinary);
    if (targetPlatform !== 'win32') fs.chmodSync(stagedBinary, 0o755);
    fs.copyFileSync(stagedBinary, targetBinary);
    fs.unlinkSync(stagedBinary);

    for (const file of extractedFiles.filter((entry) => target.patterns.test(path.basename(entry)))) {
      const destination = path.join(targetDir, path.basename(file));
      const stagedLibrary = `${destination}.partial`;
      fs.copyFileSync(file, stagedLibrary);
      fs.copyFileSync(stagedLibrary, destination);
      fs.unlinkSync(stagedLibrary);
    }

    fs.writeFileSync(manifestPath, JSON.stringify({
      platform: targetPlatform,
      arch: targetArch,
      tag: RELEASE_TAG,
      asset: assetName,
    }, null, 2));

    console.log(`Installed llama-server and bundled native libraries in ${targetDir}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Unable to prepare llama-server: ${error.message}`);
  process.exitCode = 1;
});
