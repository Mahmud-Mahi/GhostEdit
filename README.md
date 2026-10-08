<p align="center">
  <img src="assets/AppIcon1024.png" width="128" height="128" alt="GhostEdit" style="border-radius: 22px;">
</p>

<h1 align="center">GhostEdit</h1>

<p align="center">
  <strong>Fix your writing anywhere. No cloud required.</strong>
</p>

<p align="center">
  <a href="https://github.com/nareshnavinash/GhostEdit/releases/latest"><img src="https://img.shields.io/github/v/release/nareshnavinash/GhostEdit?color=22c55e&label=version" alt="Version"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="Platform">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/nareshnavinash/GhostEdit" alt="License"></a>
</p>

<p align="center">Cross-platform AI text correction from the menu bar</p>

---

### Why GhostEdit?

| | **GhostEdit** | Grammarly | LanguageTool | Apple Writing Tools |
|---|---|---|---|---|
| Works in any app | **Yes** (system-wide) | Browser + select apps | Browser + select apps | Yes |
| Offline mode | **Yes** (built-in Bonsai model) | No | Server only | Yes |
| Multi-provider AI | **Local, Claude, GPT, Gemini, any OpenAI-compatible API** | Grammarly AI only | LanguageTool only | Apple AI only |
| Open source | **MIT** | No | LGPL | No |
| Price | **Free** | $12/mo | $5/mo (premium) | Free (Apple only) |

### Key Features

- **Works in every app** -- System-wide hotkey correction, not a browser extension
- **Offline-first AI** -- Built-in Bonsai grammar model runs on-device, no API keys needed
- **Multi-provider** -- Switch between local AI, Claude, GPT, Gemini, Grok, or any OpenAI-compatible API in one click
- **Bring your own key** -- OpenAI, OpenRouter, Groq, Together, Grok (xAI), Claude/GPT/Gemini native endpoints, Ollama, LM Studio, and Custom presets, each with its own encrypted key (`~/.ghostedit/api-key-<profile>.enc`)
- **Real-time monitoring** -- Traffic light indicator shows writing quality as you type
- **Developer-friendly** -- Preserves code, URLs, @mentions, :emoji:, and file paths
- **13 languages + tone presets** -- Auto-detect language, choose from 5 writing styles

### Quick Start

1. **Download** the latest release from [GitHub Releases](https://github.com/nareshnavinash/GhostEdit/releases/latest)
2. **Open** GhostEdit -- it lives in your menu bar
3. **Select text** anywhere and press the hotkey: `Cmd+E` (General provider) / `Cmd+Shift+E` (local) on macOS, `Ctrl+...` on Win/Linux

<!-- Add screenshot/GIF here: place a demo GIF or screenshot at assets/demo.gif and uncomment the line below -->
<!-- <p align="center"><img src="assets/demo.gif" width="600" alt="GhostEdit demo"></p> -->

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Configuration](#configuration)
- [AI Providers](#ai-providers)
- [Dictionary Engine](#dictionary-engine)
- [Architecture](#architecture)
- [Development](#development)
- [Testing](#testing)
- [Building & Packaging](#building--packaging)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Global hotkey** — Two configurable shortcuts: `Cmd+Shift+E` / `Ctrl+Shift+E` (local) and `Cmd+E` / `Ctrl+E` (General-tab provider)
- **Offline-first** — Built-in Bonsai model served by the bundled llama.cpp runtime runs entirely on-device, no API keys needed
- **Cloud providers** — Claude, Codex (OpenAI), and Gemini via their CLI tools
- **OpenAI-compatible API** — Bring your own key per provider: OpenAI, OpenRouter, Groq, Together AI, Grok (xAI), Claude/Codex/Gemini native endpoints, or local servers (Ollama, LM Studio); multi-profile setup with per-provider curated models, Refresh discovery, and encrypted key storage
- **Dictionary pre-pass** — Harper.js (grammar) + nspell (spelling) fix obvious errors before the AI sees the text, making corrections faster and cheaper
- **Dictionary polish** — Same engine runs again on model output to catch any remaining issues
- **Diff preview** — Side-by-side streaming diff before accepting changes (Tab to accept, Esc to cancel)
- **Token preservation** — URLs, @mentions, `:emoji:`, \`code\`, email addresses, and file paths are never modified
- **Tone presets** — Default, Casual, Professional, Academic, and Slack styles
- **13 languages** — Auto-detect or specify: English, Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese, Russian, Arabic, Hindi
- **Correction history** — Browse, search, and review past corrections
- **Correction cache** — Identical inputs skip the AI entirely
- **Bundled inference runtime** — Pinned llama.cpp server per OS/architecture, SHA-256 verified at build time
- **3 Bonsai model sizes** — 1.7B (248 MB, default), 4B (572 MB), and 8B (1.1 GB), downloaded on demand
- **System tray** — Runs silently in the menu bar with no dock icon (macOS)

---

## Requirements

- **Node.js** >= 18
- **npm** >= 9
- **Operating System**: macOS 12+, Windows 10+, or Linux (x64/arm64)
- **Accessibility permissions** (macOS): Required for keyboard simulation — System Settings > Privacy & Security > Accessibility > enable GhostEdit

### Optional (for cloud providers)

| Provider | CLI Tool | Install |
|----------|----------|---------|
| Claude | `claude` | [claude.ai/cli](https://claude.ai/cli) |
| Codex | `codex` | `npm install -g @openai/codex` |
| Gemini | `gemini` | [ai.google.dev/gemini-api/docs/cli](https://ai.google.dev/gemini-api/docs/cli) |

No CLI? Add an **API key per provider** for any OpenAI-compatible host (OpenAI, OpenRouter,
Groq, Together AI, Grok/xAI) or a local server (Ollama, LM Studio) in Settings >
Providers — see [AI Providers](#ai-providers). Keys are stored encrypted, one file
per provider (`~/.ghostedit/api-key-<profile>.enc`, e.g. `api-key-grok.enc`).

Cloud providers are **not required**. The llama.cpp server is bundled per OS and
architecture. When Local is selected, GhostEdit downloads the Bonsai model from
Hugging Face to `~/.ghostedit/models/bonsai/`; after download, local corrections
work offline.

---

## Installation

### Clone and install dependencies

```bash
git clone https://github.com/nareshnavinash/GhostEdit.git
cd GhostEdit
npm install
```

Each installer bundles the matching llama.cpp CPU server executable and its
native libraries. When the user selects Local during onboarding, GhostEdit
downloads the selected Bonsai GGUF model from Hugging Face into
`~/.ghostedit/models/bonsai/`. API/CLI users do not download the local model
unless they choose to download it in **Settings > Local Model**.

---

## Quick Start

```bash
# Start the app in development mode
npm start
```

On first launch, onboarding lets you choose a provider before local model setup:

1. Choose a provider: **Local** (offline), an **OpenAI-compatible API** preset (each preset keeps its own model, base URL, and encrypted API key — set up as many as you need, including keyless Ollama/LM Studio), or a cloud CLI tool.
2. For Local, pick a Bonsai model size (1.7B / 4B / 8B) — the app downloads it and shows progress.
3. For an API preset, pick the preset card, enter your base URL, model (curated dropdown + **Refresh** from host), and API key (stored encrypted per profile).
4. Set preferences and try a correction in the onboarding flow.

After setup:

1. Select text in any application
2. Press the hotkey
3. A HUD overlay shows "Working..."
4. The corrected text replaces your selection (or appears in a diff preview)

---

## Usage

### Basic correction

1. **Select text** in any application (editor, browser, Slack, email, etc.)
2. **Press the hotkey** (`Cmd+Shift+E` local / `Cmd+E` General-tab provider by default)
3. GhostEdit captures the selection, corrects it, and pastes the result back

### Diff preview mode

When **Show diff preview** is enabled (default):

1. A preview window opens showing original vs. corrected text side-by-side
2. Insertions are highlighted in green, deletions in red
3. Press **Tab** to accept, **Escape** to cancel, **R** to regenerate

### Clipboard-only mode

When enabled, corrected text is copied to clipboard instead of being pasted back. Useful when paste simulation doesn't work in a specific app.

### System tray menu

Right-click (or click on macOS) the tray icon to access:

- **Correct (Local)** — Run the offline model (`Cmd+Shift+E`)
- **Correct (API)** — Run the General-tab provider (`Cmd+E`)
- **Undo Last Correction** — Revert the last paste (`Cmd+Shift+Z`)
- **Settings...** — Open the configuration window
- **History...** — Browse past corrections
- **Quit GhostEdit** — Exit the app

---

## Configuration

All settings are stored in `~/.ghostedit/config.json` and editable through the Settings window.

### Settings tabs

**General** — Language, tone, and correction preferences

**Local Model** — Bonsai model size, download, and inference device

**Providers** — Per-CLI model + path cards, plus per-API-profile cards (model dropdown with curated + Refresh-discovered models, base URL, encrypted API key per provider)

**Hotkeys** — Record custom global shortcuts (local, General provider, undo, line)

**Behavior** — Toggle features:

| Setting | Description | Default |
|---------|-------------|---------|
| Fast correction mode | Greedy decoding for local model (faster, slight quality trade-off) | On |
| Clipboard-only mode | Copy to clipboard instead of pasting back | Off |
| Show diff preview | Side-by-side preview before applying | On |
| Sound feedback | Play sound on completion | On |
| Notify on success | System notification on correction | Off |
| Developer mode | Show inference device info in tray and settings | Off |
| History limit | Max stored corrections | 50 |

### Tone presets

| Preset | Style |
|--------|-------|
| Default | Standard grammar/spelling correction |
| Casual | Friendly, conversational, keeps contractions |
| Professional | Polished business communication |
| Academic | Formal vocabulary, precise structure |
| Slack | Concise, upbeat, preserves emoji and abbreviations |

### Custom system prompt

Create `~/.ghostedit/prompt.txt` to override the default system prompt. The file is read on each correction.

### Config file locations

| File | Purpose |
|------|---------|
| `~/.ghostedit/config.json` | Application settings |
| `~/.ghostedit/history.json` | Correction history |
| `~/.ghostedit/prompt.txt` | Custom system prompt (optional) |
| `~/.ghostedit/api-key.enc` | Legacy single encrypted API key (auto-migrated; removed when cleared) |
| `~/.ghostedit/api-key-<profile>.enc` | Per-provider encrypted API key (e.g. `api-key-openai.enc`, `api-key-grok.enc`) |
| `~/.ghostedit/models/bonsai/` | Downloaded Bonsai GGUF models |
| `~/.ghostedit/device-cache.json` | Cached GPU/CPU detection result |

---

## AI Providers

### Local model (default)

The default engine is **Bonsai**, a grammar-correction GGUF model served by the
llama.cpp CPU server bundled with every installer (pinned release, SHA-256
verified at build time for each OS/architecture).

**Model sizes** (downloaded on demand from Hugging Face to
`~/.ghostedit/models/bonsai/`, then fully offline):

| Model | Size | Notes |
|-------|------|-------|
| Bonsai 1.7B | 248 MB | Default — best speed/quality balance |
| Bonsai 4B | 572 MB | Better quality |
| Bonsai 8B | 1.1 GB | Best quality |

Pick a size in **Settings > Local Model** or during onboarding. The first Local
correction downloads the selected model; afterwards corrections work with no
network access.

A legacy T5 pipeline (transformers.js + ONNX) remains as a fallback for old
configs and is auto-migrated to Bonsai on first launch. When it is active,
**GPU acceleration** is automatic:

| Platform | Primary Device | Fallback |
|----------|---------------|----------|
| macOS (Apple Silicon) | WebGPU (Metal) | WASM (CPU) |
| Windows (any GPU) | DirectML | WebGPU / WASM |
| Linux x64 (NVIDIA) | CUDA | WebGPU / WASM |
| Linux arm64 | WebGPU | WASM (CPU) |

### OpenAI-compatible API (bring your own key — one key per provider)

GhostEdit v1.9.0 gives **every API preset its own profile**: model, base URL, and
encrypted API key are saved independently, so you can configure OpenAI, Grok, Ollama,
and others **all at once** instead of one global key.

Pick presets in **Settings > Providers** — each card shows a **Configured /
Not configured** badge. Hosted providers become configured once their key is saved;
keyless hosts (Ollama, LM Studio, Custom) become configured once you pick/confirm a
model. Paste your API key (encrypted at rest with Electron `safeStorage` into
`~/.ghostedit/api-key-<profile>.enc`), choose from the curated model dropdown or
press **Refresh** to list models live from the host.

| Preset | Base URL | Default model | Key required? | Curated models |
|--------|----------|---------------|---------------|----------------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4.1-mini` | Yes | `gpt-4.1-mini`, `gpt-4.1`, `gpt-4.1-nano`, `gpt-4o`, `gpt-4o-mini`, `o4-mini`, `o3` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4.1-mini` | Yes | `openai/gpt-4.1-mini`, `openai/gpt-4.1`, `anthropic/claude-sonnet-4`, `anthropic/claude-3.5-haiku`, `google/gemini-2.5-flash`, `meta-llama/llama-3.3-70b-instruct` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | Yes | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `gemma2-9b-it`, `mixtral-8x7b-32768` |
| Together AI | `https://api.together.xyz/v1` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | Yes | `meta-llama/Llama-3.3-70B-Instruct-Turbo`, `meta-llama/Llama-3.1-8B-Instruct-Turbo`, `Qwen/Qwen2.5-72B-Instruct-Turbo` |
| Ollama | `http://localhost:11434/v1` | `llama3.2` | No | `llama3.2`, `llama3.1`, `llama3.1:8b`, `mistral`, `gemma2`, `qwen2.5` |
| LM Studio | `http://localhost:1234/v1` | `local-model` | No | `local-model` |
| Custom | (your URL) | (your model) | No | (your saved model + Refresh results) |
| Claude (Anthropic API) | `https://api.anthropic.com/v1` | `claude-sonnet-4-5` | Yes | `claude-sonnet-4-5`, `claude-opus-4-1`, `claude-haiku-4-5`, `claude-3-7-sonnet-latest`, `claude-3-5-haiku-latest` |
| Codex (OpenAI API) | `https://api.openai.com/v1` | `gpt-5-codex` | Yes | curated Codex/GPT list |
| Gemini (Google API) | `https://generativelanguage.googleapis.com/v1beta` | `gemini-2.5-flash` | Yes | curated Gemini list |
| Grok (xAI API) | `https://api.x.ai/v1` | `grok-3-mini` | Yes | `grok-3-mini`, `grok-3`, `grok-2-1212` |

Then pick which configured provider actually runs in **Settings > General >
Default correction model** — GhostEdit only offers providers you have configured
(local is always offered; CLIs only when installed; APIs only when configured). The
**API Hotkey** (`Cmd/Ctrl+E`) runs whatever is selected there.

- Corrections **stream** into the diff preview like every other provider.
- API keys are **encrypted at rest** (`~/.ghostedit/api-key-<profile>.enc`, legacy
  `api-key.enc` auto-migrated) and never stored in `config.json`.
- Legacy single-key configs migrate automatically: your old key/base-URL/model move
  into the profile you had selected.
- Trigger with `Ctrl/Cmd+E` (General provider) or the tray's **Correct (API)** entry.
- Local servers (Ollama, LM Studio) and Custom bridges work without an API key.
  Custom endpoints even fall back to the SSE streaming path for browser-backed
  bridges.

### Cloud providers

Cloud providers use their respective CLI tools, spawned as subprocesses. You must install and authenticate the CLI separately.

**Claude**
```bash
# Install
# Visit https://claude.ai/cli

# Authenticate
claude auth login

# GhostEdit auto-detects the CLI, or set the path in Settings
```

**Codex (OpenAI)**
```bash
npm install -g @openai/codex
codex auth
```

**Gemini**
```bash
# Install from https://ai.google.dev/gemini-api/docs/cli
gemini auth
```

---

## Dictionary Engine

GhostEdit includes a two-layer dictionary engine that mirrors the approach from the companion macOS-native app:

### How it works

1. **Harper.js** (primary) — Rust-powered grammar checker compiled to WASM. Catches spelling, grammar, capitalization, and style issues with suggestions.

2. **nspell** (secondary) — JavaScript port of Hunspell with a full English dictionary. Fills non-overlapping gaps that Harper misses.

3. **Merge strategy** — All Harper issues are kept. nspell issues are added only if they don't overlap with any Harper issue. Proper nouns (capitalized mid-sentence) and acronyms (2+ uppercase letters) are filtered out.

4. **Iterative passes** — The engine runs up to 3 passes. Fixing one error can reveal another (e.g., fixing punctuation may expose a grammar error). Stops early when no more changes are found.

### Where it runs in the pipeline

```
Selected text
  -> Token protection (URLs, @mentions, code, emoji)
  -> Dictionary pre-pass (fix obvious errors)     <-- HERE
  -> Cache lookup
  -> AI engine (local Bonsai / OpenAI-compatible API / cloud CLI)
  -> Token restoration
  -> Dictionary polish (cleanup model output)      <-- AND HERE
  -> Paste back
```

The pre-pass means most simple typos ("teh" -> "the") never reach the AI model, making corrections faster and reducing API costs for cloud providers.

---

## Architecture

```
+-----------------------------------------------------------+
|                   Electron Main Process                     |
|                                                             |
|  Global Hotkey --> Clipboard Capture --> Token Protection    |
|       |                                                     |
|       v                                                     |
|  Dictionary Pre-pass (Harper + nspell, up to 3 passes)      |
|       |                                                     |
|       v                                                     |
|  Cache Lookup --[hit]--> Skip AI                            |
|       |                                                     |
|       v [miss]                                              |
|  Correction Dispatcher                                      |
|    +-- CLI Runner (claude/codex/gemini subprocess)          |
|    +-- API Runner (OpenAI-compatible + native APIs, stream) |
|    +-- Local Runner (llama.cpp + Bonsai GGUF server)        |
|    +-- Inference Window (WebGPU/WASM T5 fallback)           |
|       |                                                     |
|       v                                                     |
|  Token Restoration --> Dictionary Polish --> Paste Back      |
|       |                                                     |
|       v                                                     |
|  History Store --> Correction Cache                          |
|                                                             |
|  System Tray | IPC Handlers | Device Selector               |
+-----------------------------------------------------------+
                          | IPC
+-----------------------------------------------------------+
|                  Renderer Process (React)                    |
|                                                             |
|  Settings | History | HUD Overlay | Streaming Preview        |
|           | Onboarding Wizard | Inference Worker             |
+-----------------------------------------------------------+
```

### Key design decisions

- **Tray-only app** — No dock icon on macOS (`LSUIElement: true`). Runs silently in the menu bar.
- **Context isolation** — Renderer processes are sandboxed. All main/renderer communication goes through a secure preload bridge.
- **Graceful degradation** — If Harper fails to load (WASM issue), nspell still works. If both fail, the AI model handles everything. If the inference window crashes, the main process pipeline takes over.
- **Fire-and-forget pre-warming** — Model, dictionary checkers, and keyboard simulator are loaded in parallel at startup without blocking the UI.
- **Correction cache** — Keyed on `(text, provider, model, tone, language)`. Invalidated on any config change.

---

## Development

### Start in development mode

```bash
npm start
```

This launches Electron with Vite HMR — changes to renderer code are hot-reloaded instantly. Main process changes require a restart.

### Type checking

```bash
npx tsc --noEmit
```

### Linting

```bash
npm run lint
```

### Environment

The project uses:

- **TypeScript 5.7** with strict mode
- **Vite 6** for building main, preload, and renderer
- **React 19** for the UI
- **Tailwind CSS 3** with a custom dark theme
- **Zustand 5** for renderer state management
- **Vitest 4** for testing

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Run a specific test file
npx vitest run src/main/dictionary-checker.test.ts

# Run with verbose output
npx vitest run --reporter=verbose
```

### Test structure

| File | Type | Tests | Covers |
|------|------|-------|--------|
| `dictionary-checker.test.ts` | Unit | 89 | Harper/nspell extraction, merge, filtering, fix application, initialization |
| `dictionary-checker.integration.test.ts` | Integration | 36 | End-to-end with real Harper WASM and nspell Hunspell |
| `token-preservation.test.ts` | Unit | 60 | URL, mention, code, and emoji protection |
| `constants.test.ts` | Unit | 35 | Provider/preset definitions and defaults |
| `Settings.test.tsx` | Component | 50 | Settings sections, model downloads, per-profile API key management |
| `local-model-runner.test.ts` | Unit | 24 | Pipeline loading, device routing, streaming, variant switching |
| `config-manager.test.ts` | Unit | 27 | Config persistence, T5 → Bonsai migration, hotkey + per-profile API migration |
| `history-store.test.ts` | Unit | 18 | History persistence and limits |
| `openai-compatible-runner.test.ts` | Unit | 12 | API presets, model discovery, streaming, native endpoints |
| `ipc-handlers.test.ts` | Unit | 14 | IPC handler registration and behavior (incl. per-profile keys) |
| `tray-manager.test.ts` | Unit | 20 | Tray menu entries (Local + API, no dedicated CLI item) |
| `device-selector.test.ts` | Unit | 11 | Platform detection, disk caching, DirectML/CUDA probing |
| `correction-dispatcher.test.ts` | Unit | 12 | Provider routing (local / CLI / API + per-profile config) |
| `global-shortcuts.test.ts` | Unit | 12 | Hotkey registration and conflict detection (2 correction hotkeys) |
| `cli-runner.test.ts` | Unit | 5 | CLI subprocess spawning and error handling |
| `provider-shortcut.test.ts` | Unit | 5 | General-tab provider → shortcut target resolution |

Current: **530 tests across 28 files, all passing**.

---

## Building & Packaging

### Package (unsigned)

```bash
npm run package
```

Creates an unpacked app in `out/`.

### Build installers

```bash
npm run make
```

Produces platform-specific installers:

| Platform | Format | Output |
|----------|--------|--------|
| macOS | ZIP on Linux; ZIP + DMG on macOS | `out/make/` |
| Windows | Squirrel (`Setup.exe`) on Windows; ZIP on other hosts | `out/make/` |
| Linux | Debian | `out/make/deb/x64/` |

### Build a Debian package

On Linux x64, install `dpkg-deb` and `fakeroot`, then run:

```bash
npm run make:deb
```

The packaging hook downloads the pinned llama.cpp CPU archive for the target,
verifies its SHA-256, and includes its server executable and libraries in the
`.deb`. The Bonsai model remains an on-demand Hugging Face download. Debian
dependencies for Electron and keyboard/desktop integration are declared in the
package metadata.

Linux ARM64 builds can be made with:

```bash
npm run make:deb:arm64
```

### Build Windows and macOS installers

Build on Windows for the native Squirrel installer. Linux and macOS builds
produce a ZIP of the Windows application instead; it contains the app executable
but not the Squirrel install/update workflow.

```bash
# Windows x64: Squirrel installer on Windows, ZIP on Linux/macOS
npm run make:win

# Windows ARM64: Squirrel installer on Windows, ZIP on Linux/macOS
npm run make:win:arm64

# macOS Apple Silicon: ZIP on Linux, ZIP + DMG on macOS
npm run make:mac:arm64

# macOS Intel: ZIP on Linux, ZIP + DMG on macOS
npm run make:mac:x64
```

Windows produces the Squirrel installer set, including `Setup.exe`, when built
on Windows. Cross-builds from Linux or macOS produce a ZIP instead. For macOS
targets, Linux builds produce only a ZIP; macOS builds produce both ZIP and DMG.
Each build bundles only its own OS/architecture server.

### What gets bundled

- The Electron app (ASAR-packed)
- The target OS/architecture llama.cpp server and libraries
- App code and UI assets (Bonsai model weights are downloaded per-user)
- All production dependencies
- App icon (`assets/icon.svg`)

---

## Project Structure

```
src/
  main/                          # Electron main process
    index.ts                     # App lifecycle, correction pipeline, window management
    config-manager.ts            # Config persistence (~/.ghostedit/)
    correction-dispatcher.ts     # Routes corrections to local, CLI, or API providers
    cli-runner.ts                # Spawns CLI subprocesses
    openai-compatible-runner.ts  # OpenAI-compatible + native API corrections (streaming)
    api-key-store.ts             # Encrypted API key storage (Electron safeStorage)
    local-model-runner.ts        # Legacy T5 pipeline (fallback)
    llama-runtime-manager.ts     # Bundled llama.cpp server resolution
    llama-server-manager.ts      # llama.cpp server lifecycle
    bonsai-model-manager.ts      # Bonsai GGUF download and scanning
    dictionary-checker.ts        # Harper.js + nspell spell/grammar checking
    clipboard-manager.ts         # Cmd+C/V simulation via nut.js
    token-preservation.ts        # Protects URLs, @mentions, code, emoji
    correction-cache.ts          # In-memory correction cache
    history-store.ts             # Persists correction history to JSON
    tray-manager.ts              # System tray icon and context menu
    inference-window.ts          # Hidden BrowserWindow for GPU inference
    device-selector.ts           # GPU/CPU detection and caching
    global-shortcuts.ts          # Global hotkey registration
    ipc-handlers.ts              # IPC event handlers
    cli-arguments.ts             # CLI path resolution
    error-messages.ts            # User-friendly error messages

  renderer/                      # React UI
    App.tsx                      # Root component (routes by window type)
    main.tsx                     # React entry point
    windows/
      Settings.tsx               # Configuration UI
      History.tsx                # Correction history browser
      HudOverlay.tsx             # Transparent status overlay
      StreamingPreview.tsx       # Real-time diff preview
    components/
      Welcome.tsx                # Onboarding wizard
      DiffView.tsx               # Side-by-side diff viewer
      HotkeyInput.tsx            # Hotkey recording input
      ProviderSelector.tsx       # Provider selection buttons
      ModelSelector.tsx          # Model dropdown
    inference-worker.ts          # Web worker for model inference

  preload/
    index.ts                     # Secure IPC bridge (contextBridge)

  shared/
    types.ts                     # TypeScript interfaces and IPC channels
    constants.ts                 # Providers, models, languages, defaults

assets/
  icon.svg                       # App icon

resources/
  bin/                           # llama.cpp server runtime per platform-arch (downloaded at build)
  models/                        # Legacy T5 model download target (optional)

scripts/
  download-llama-server.mjs      # Pinned llama.cpp runtime download (SHA-256 verified)
  download-bonsai-model.mjs      # Bonsai GGUF download helper
  download-model.mjs             # Legacy T5 model download script
```

---

## Troubleshooting

### "No text was captured"

- Make sure text is selected before pressing the hotkey
- On macOS, grant Accessibility permission: System Settings > Privacy & Security > Accessibility > enable GhostEdit
- Try clipboard-only mode if paste simulation fails in a specific app

### "CLI: Not found"

- Install the CLI tool for your chosen provider (see [AI Providers](#ai-providers))
- Or set the CLI path manually in Settings > General

### "Authentication required"

- Run the auth command for your provider:
  - Claude: `claude auth login`
  - Codex: `codex auth`
  - Gemini: `gemini auth`

### Local model is slow

- Pick the smaller Bonsai 1.7B model in Settings > Local Model
- Enable "Fast correction mode" in Behavior tab
- Use a cloud CLI or the OpenAI-compatible API provider for heavier edits
- Check the inference device in Settings with Developer Mode enabled

### Corrections take too long

- Increase the timeout in Settings > General
- Switch to a faster model (e.g., `haiku` for Claude, `o4-mini` for Codex)
- Use the local model for instant offline corrections

### Hotkey doesn't work

- Check for conflicts with other apps using the same shortcut
- Change the hotkey in Settings > Hotkey tab
- On macOS, ensure the app has Accessibility permissions

### Model download fails

- Check your internet connection and retry from Settings > Local Model
- Models are downloaded from Hugging Face — ensure `huggingface.co` is accessible
- Files land in `~/.ghostedit/models/bonsai/`; delete a partial download and retry

### "API request failed"

- Verify the right profile's API key in Settings > Providers (each provider stores its own encrypted key in `~/.ghostedit/api-key-<profile>.enc`)
- Confirm the base URL and model name match your host — use **Refresh** on that provider's card to reload the list
- For Ollama / LM Studio, ensure the local server is running on the expected port
- The HUD and error log show the HTTP status and message returned by the host
- If your Custom bridge reports `conversation_deleted`, reset its saved conversation and retry

---

## What's New in v1.9.0 — Per-Provider API Keys + Simplified Hotkeys

**Your API-key system, explained:** every provider preset (OpenAI, OpenRouter, Groq,
Together, Grok/xAI, Claude/Codex/Gemini native, Ollama, LM Studio, Custom) now keeps
its **own model + base URL + encrypted key**. Configure several providers at once —
the Providers tab shows a **Configured / Not configured** badge per card. A new
**Grok (xAI)** preset (`https://api.x.ai/v1`, `grok-3-mini` + curated list) joins the
matrix, each preset ships a curated model dropdown plus **Refresh** discovery, and
legacy single-key configs auto-migrate into the profile you had selected.

Hotkeys are simpler: **2 correction shortcuts** instead of 3 — `Cmd/Ctrl+Shift+E`
(Local) and `Cmd/Ctrl+E` (**General-tab provider**, resolved via the new
`provider-shortcut` module). The tray drops the dedicated CLI item in favor of
**Correct (Local)** + **Correct (API)**. Pasting is safer via
`replaceSelectedText()` (re-verify → Backspace → paste), each CLI remembers its own
model, the proofreading system prompt no longer answers embedded questions, and the
onboarding installs the local model before the Try-it step.

| File (v1.9.0) | Platform | Size |
|---------------|----------|------|
| `GhostEdit-darwin-arm64-1.9.0.zip` | macOS Apple Silicon | ~480 MB |
| `GhostEdit-darwin-x64-1.9.0.zip` | macOS Intel | ~483 MB |
| `GhostEdit-win32-x64-1.9.0.zip` | Windows x64 | ~492 MB |
| `GhostEdit-win32-arm64-1.9.0.zip` | Windows ARM64 | ~490 MB |
| `ghostedit_1.9.0_amd64.deb` | Linux x64 (Debian) | ~322 MB |
| `ghostedit_1.9.0_arm64.deb` | Linux ARM64 (Debian) | ~318 MB |

Each bundle includes the pinned llama.cpp runtime; Bonsai models download on demand
to `~/.ghostedit/models/bonsai/`.

---

## License

See [LICENSE](LICENSE) for details.
