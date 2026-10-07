import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { VitePlugin } from '@electron-forge/plugin-vite';

// Native/external modules that Vite externalizes and must ship in node_modules.
// Includes direct externals and their transitive native/runtime dependencies.
const EXTERNAL_MODULES = [
  '@nut-tree-fork',
  '@huggingface',
  'harper.js',
  'nspell',
  'dictionary-en',
  'uiohook-napi',
  // Transitive deps of the above:
  'is-buffer',        // nspell
  'fflate',           // harper.js
  'onnxruntime-node', // @huggingface/transformers
  'sharp',            // @huggingface/transformers
  '@img',             // sharp native bindings
  'detect-libc',      // sharp
  'semver',           // sharp
];

const ICON_EXTRA_RESOURCES = [
  './assets/MenuBarIconIdle.png',
  './assets/MenuBarIconProcessing.png',
];

const isWindowsHost = process.platform === 'win32';
const isMacOSHost = process.platform === 'darwin';

/**
 * Recursively collect all production-dependency package names starting from
 * the EXTERNAL_MODULES seeds.  Scope entries (e.g. '@nut-tree-fork') are
 * expanded to every package under that scope directory.
 *
 * Also scans nested node_modules inside each copied package so that
 * transitive deps of older bundled sub-packages are included.
 */
function collectExternalPackages(sourceModules: string): Set<string> {
  const collected = new Set<string>();
  const queue = [...EXTERNAL_MODULES];

  // Collect deps from a package.json's dependencies field
  function enqueueDeps(pkgJsonPath: string): void {
    if (!fs.existsSync(pkgJsonPath)) return;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      for (const dep of Object.keys(pkg.dependencies ?? {})) {
        if (!collected.has(dep)) queue.push(dep);
      }
    } catch { /* skip malformed */ }
  }

  // Scan nested node_modules inside a package dir for additional deps
  function scanNested(pkgDir: string): void {
    const nestedNM = path.join(pkgDir, 'node_modules');
    if (!fs.existsSync(nestedNM)) return;
    for (const entry of fs.readdirSync(nestedNM)) {
      const entryPath = path.join(nestedNM, entry);
      if (entry.startsWith('@')) {
        // Scoped: scan children
        if (!fs.statSync(entryPath).isDirectory()) continue;
        for (const child of fs.readdirSync(entryPath)) {
          enqueueDeps(path.join(entryPath, child, 'package.json'));
        }
      } else {
        enqueueDeps(path.join(entryPath, 'package.json'));
      }
    }
  }

  while (queue.length > 0) {
    const mod = queue.shift()!;
    if (collected.has(mod)) continue;

    const modPath = path.join(sourceModules, mod);
    if (!fs.existsSync(modPath)) continue;

    // Scope dir → expand to child packages
    if (mod.startsWith('@') && !mod.includes('/')) {
      for (const child of fs.readdirSync(modPath)) {
        queue.push(`${mod}/${child}`);
      }
      continue;
    }

    collected.add(mod);

    // Enqueue production deps from the top-level package.json
    enqueueDeps(path.join(modPath, 'package.json'));

    // Also scan nested node_modules for their transitive deps
    scanNested(modPath);
  }
  return collected;
}

const config: ForgeConfig = {
  hooks: {
    prePackage: async (forgeConfig, platform, arch) => {
      execFileSync(process.execPath, [
        path.join(__dirname, 'scripts', 'download-llama-server.mjs'),
        '--platform',
        platform,
        '--arch',
        arch,
      ], { stdio: 'inherit' });
      forgeConfig.packagerConfig.extraResource = [
        ...ICON_EXTRA_RESOURCES,
        path.join(__dirname, 'resources', 'bin', `${platform}-${arch}`),
      ];
    },
    packageAfterCopy: async (_config, buildPath) => {
      const sourceModules = path.join(__dirname, 'node_modules');
      const targetModules = path.join(buildPath, 'node_modules');
      const packages = collectExternalPackages(sourceModules);

      for (const pkg of packages) {
        const src = path.join(sourceModules, pkg);
        const dest = path.join(targetModules, pkg);
        if (!fs.existsSync(src)) continue;
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.cpSync(src, dest, { recursive: true });
      }
      console.log(`[forge hook] Copied ${packages.size} external packages to build`);

    },
  },
  packagerConfig: {
    name: 'GhostEdit',
    executableName: 'ghostedit',
    icon: './assets/icon',
    appBundleId: 'com.ghostedit.electron',
    asar: {
      unpack: '{**/*.node,**/*.dylib,**/*.so,**/*.so.*,**/*.dll}',
    },
    extraResource: ICON_EXTRA_RESOURCES,
    extendInfo: {
      LSUIElement: true, // Hide from dock on macOS
    },
  },
  makers: [
    ...(isWindowsHost
      ? [new MakerSquirrel({ name: 'GhostEdit', authors: 'GhostEdit contributors' })]
      : []),
    new MakerZIP({}, isWindowsHost ? ['darwin'] : ['darwin', 'win32']),
    ...(isMacOSHost ? [new MakerDMG({ format: 'ULFO' })] : []),
    new MakerDeb({
      options: {
        name: 'ghostedit',
        maintainer: 'GhostEdit contributors',
        homepage: 'https://github.com/nareshnavinash/ghostedit-electron',
        description: 'Cross-platform AI text correction from the menu bar',
        depends: [
          'libasound2', 'libatk1.0-0', 'libatk-bridge2.0-0', 'libatspi2.0-0',
          'libc6', 'libcairo2', 'libcups2', 'libdbus-1-3', 'libdrm2', 'libexpat1',
          'libgbm1', 'libgcc-s1', 'libglib2.0-0', 'libgtk-3-0', 'libnspr4', 'libnss3',
          'libpango-1.0-0', 'libstdc++6', 'libx11-6', 'libx11-xcb1', 'libxcb1',
          'libxcomposite1', 'libxdamage1', 'libxext6', 'libxfixes3', 'libxkbcommon0',
          'libxrandr2', 'libxrender1', 'libxss1', 'libxtst6', 'xdg-utils',
        ],
      },
    }, ['linux']),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
