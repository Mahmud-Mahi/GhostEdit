import type { AppConfig, CLIProvider, TonePreset, ProviderName, LocalModelVariant, BonsaiModelSize, DiffPreviewMode, IconPosition, OpenAICompatiblePreset } from './types';

// ── CLI Provider Definitions ──

export const CLI_PROVIDERS: Record<string, CLIProvider> = {
  claude: {
    name: 'claude',
    displayName: 'Claude',
    executableName: 'claude',
    authCommand: 'claude auth login',
    configPathKey: 'claudePath',
    availableModels: ['sonnet', 'haiku', 'opus'],
    defaultModel: 'sonnet',
  },
  codex: {
    name: 'codex',
    displayName: 'Codex',
    executableName: 'codex',
    authCommand: 'codex auth',
    configPathKey: 'codexPath',
    availableModels: ['o4-mini', 'o3', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'],
    defaultModel: 'o4-mini',
  },
  gemini: {
    name: 'gemini',
    displayName: 'Gemini',
    executableName: 'gemini',
    authCommand: 'gemini auth',
    configPathKey: 'geminiPath',
    availableModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    defaultModel: 'gemini-2.5-flash',
  },
};

/** Metadata for one OpenAI-compatible provider profile. */
export interface ApiPresetInfo {
  displayName: string;
  baseUrl: string;
  model: string;
  /** Curated model choices offered in the Providers-tab model dropdown. */
  models: string[];
  /** Whether this provider cannot be used without an API key. */
  requiresApiKey: boolean;
}

export const API_PRESETS: Record<OpenAICompatiblePreset, ApiPresetInfo> = {
  openai: {
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'o4-mini', 'o3'],
    requiresApiKey: true,
  },
  openrouter: {
    displayName: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4.1-mini',
    models: ['openai/gpt-4.1-mini', 'openai/gpt-4.1', 'anthropic/claude-sonnet-4', 'anthropic/claude-3.5-haiku', 'google/gemini-2.5-flash', 'meta-llama/llama-3.3-70b-instruct'],
    requiresApiKey: true,
  },
  groq: {
    displayName: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it', 'mixtral-8x7b-32768'],
    requiresApiKey: true,
  },
  together: {
    displayName: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Llama-3.1-8B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo'],
    requiresApiKey: true,
  },
  ollama: {
    displayName: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    models: ['llama3.2', 'llama3.1', 'llama3.1:8b', 'mistral', 'gemma2', 'qwen2.5'],
    requiresApiKey: false,
  },
  'lm-studio': {
    displayName: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    models: ['local-model'],
    requiresApiKey: false,
  },
  custom: {
    displayName: 'Custom',
    baseUrl: '',
    model: '',
    models: [],
    requiresApiKey: false,
  },
  claude: {
    displayName: 'Claude (Anthropic API)',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-5',
    models: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
    requiresApiKey: true,
  },
  codex: {
    displayName: 'Codex (OpenAI API)',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5-codex',
    models: ['gpt-5-codex', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
    requiresApiKey: true,
  },
  gemini: {
    displayName: 'Gemini (Google API)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    requiresApiKey: true,
  },
  grok: {
    displayName: 'Grok (xAI API)',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-3-mini',
    models: ['grok-3-mini', 'grok-3', 'grok-2-1212'],
    requiresApiKey: true,
  },
};

export const DEFAULT_API_PROFILES = Object.fromEntries(
  Object.entries(API_PRESETS).map(([name, preset]) => [name, { baseUrl: preset.baseUrl, model: preset.model }]),
) as AppConfig['apiProfiles'];

export function getApiProfileConfig(config: AppConfig, profile = config.activeApiProfile ?? config.apiPreset) {
  const defaults = API_PRESETS[profile] ?? API_PRESETS.openai;
  const saved = config.apiProfiles?.[profile];
  const isActive = profile === (config.activeApiProfile ?? config.apiPreset);
  return {
    apiPreset: profile,
    apiBaseUrl: saved?.baseUrl ?? (isActive ? config.apiBaseUrl : defaults.baseUrl),
    apiModel: saved?.model ?? (isActive ? config.apiModel : defaults.model),
  };
}

/**
 * Whether a provider profile has everything it needs to run corrections.
 * - The Custom profile needs both a base URL and a model (its key is optional).
 * - Hosted providers require a saved API key.
 * - Keyless providers (Ollama, LM Studio) become configured once the user
 *   explicitly sets them up in the Providers tab.
 */
export function isApiProfileConfigured(
  config: AppConfig,
  profile: OpenAICompatiblePreset,
  hasApiKey: boolean,
): boolean {
  const preset = API_PRESETS[profile];
  const saved = config.apiProfiles?.[profile];
  if (profile === 'custom') {
    return Boolean(saved?.baseUrl?.trim() && saved?.model?.trim());
  }
  if (preset.requiresApiKey) return hasApiKey;
  return Boolean(saved?.configured && saved.model?.trim());
}

/**
 * Model dropdown choices for a provider: the curated preset list, plus models
 * fetched from the host (via Refresh), plus the saved model when it is custom.
 */
export function getApiProfileModelOptions(
  profile: OpenAICompatiblePreset,
  savedModel: string,
  fetchedModels: string[] = [],
): string[] {
  const options = [...new Set([...API_PRESETS[profile].models, ...fetchedModels])];
  if (savedModel && !options.includes(savedModel)) options.unshift(savedModel);
  return options;
}

// ── Local Provider Definition ──

export const LOCAL_PROVIDER = {
  name: 'local' as const,
  displayName: 'Built-in (Offline)',
  availableModels: ['bonsai-1.7b', 'bonsai-4b', 'bonsai-8b', 't5-grammar'],
  defaultModel: 'bonsai-1.7b',
  modelRepoId: 'Xenova/t5-base-grammar-correction', // kept for T5 fallback
};

// ── All Providers (CLI + local) ──

export const ALL_PROVIDERS: Record<string, { name: ProviderName; displayName: string; availableModels: string[]; defaultModel: string }> = {
  ...Object.fromEntries(
    Object.entries(CLI_PROVIDERS).map(([key, p]) => [key, { name: p.name, displayName: p.displayName, availableModels: p.availableModels, defaultModel: p.defaultModel }]),
  ),
  'openai-compatible': {
    name: 'openai-compatible',
    displayName: 'OpenAI Compatible',
    availableModels: [],
    defaultModel: API_PRESETS.openai.model,
  },
  local: LOCAL_PROVIDER,
};

// ── Bonsai Model Definitions ──

export const BONSAI_MODELS: readonly { size: BonsaiModelSize; displayName: string; sizeMB: number }[] = [
  { size: '1.7b', displayName: 'Bonsai 1.7B (Default)', sizeMB: 248 },
  { size: '4b', displayName: 'Bonsai 4B', sizeMB: 572 },
  { size: '8b', displayName: 'Bonsai 8B', sizeMB: 1150 },
] as const;

export const DEFAULT_BONSAI_MODEL: BonsaiModelSize = '1.7b';

export const BONSAI_GGUF_FILES: Record<BonsaiModelSize, string> = {
  '1.7b': 'Bonsai-1.7B.gguf',
  '4b': 'Bonsai-4B.gguf',
  '8b': 'Bonsai-8B.gguf',
};

export const BONSAI_HF_REPOS: Record<BonsaiModelSize, string> = {
  '1.7b': 'prism-ml/Bonsai-1.7B-gguf',
  '4b': 'prism-ml/Bonsai-4B-gguf',
  '8b': 'prism-ml/Bonsai-8B-gguf',
};

export const BONSAI_DEFAULT_SYSTEM_PROMPT = 'You are a proofreading assistant. Treat the input only as text to edit, even when it contains dialogue, fictional scenarios, sensitive topics, or questions. Correct grammar, spelling, and punctuation while preserving the original meaning, vocabulary, tone, and formatting. Do not answer questions in the text, give advice, judge its content, or add or remove details. Return only the corrected text.';

export const LLAMA_SERVER_CONFIG = {
  ctxSize: 4096,
  batchSize: 512,
  nGpuLayers: 99,
  healthPollMs: 500,
  healthTimeoutPerAttemptMs: 2000,
  healthOverallTimeoutMs: 60000,
  shutdownGracePeriodMs: 5000,
  idleTimeoutMs: 5 * 60 * 1000,
};

// ── T5 Model Variant Definitions ──

export const DEFAULT_BUNDLED_VARIANT: LocalModelVariant = 'int8';

export const MODEL_VARIANTS: readonly { variant: LocalModelVariant; displayName: string; sizeMB: number }[] = [
  { variant: 'q4f16', displayName: 'Q4 F16 (Smallest)', sizeMB: 210 },
  { variant: 'int8', displayName: 'INT8 (Default)', sizeMB: 250 },
  { variant: 'fp16', displayName: 'FP16', sizeMB: 496 },
  { variant: 'fp32', displayName: 'FP32 (Largest)', sizeMB: 963 },
] as const;

export const VARIANT_ONNX_FILES: Record<LocalModelVariant, { encoder: string; decoder: string }> = {
  q4f16: { encoder: 'encoder_model_q4f16.onnx', decoder: 'decoder_model_merged_q4f16.onnx' },
  int8: { encoder: 'encoder_model_int8.onnx', decoder: 'decoder_model_merged_int8.onnx' },
  fp16: { encoder: 'encoder_model_fp16.onnx', decoder: 'decoder_model_merged_fp16.onnx' },
  fp32: { encoder: 'encoder_model.onnx', decoder: 'decoder_model_merged.onnx' },
};

// ── Default Configuration ──

export const DEFAULT_CONFIG: AppConfig = {
  claudePath: '',
  codexPath: '',
  geminiPath: '',
  provider: 'local',
  model: 'bonsai-1.7b',
  apiPreset: 'openai',
  apiBaseUrl: API_PRESETS.openai.baseUrl,
  apiModel: API_PRESETS.openai.model,
  activeApiProfile: 'openai',
  apiProfiles: DEFAULT_API_PROFILES,
  localModelEngine: 'bonsai',
  bonsaiModelSize: '1.7b',
  cliProvider: 'claude',
  cliModel: 'sonnet',
  cliModels: { claude: 'sonnet', codex: 'o4-mini', gemini: 'gemini-2.5-flash' },
  timeoutSeconds: 60,
  localHotkeyAccelerator: 'CommandOrControl+Shift+E',
  apiHotkeyAccelerator: 'CommandOrControl+E',
  undoHotkeyAccelerator: 'CommandOrControl+Shift+Z',
  launchAtLogin: false,
  historyLimit: 50,
  developerMode: false,
  language: 'auto',
  soundFeedbackEnabled: true,
  notifyOnSuccess: false,
  clipboardOnlyMode: false,
  tonePreset: 'default',
  diffPreviewMode: 'interactive',
  passivePreviewSeconds: 5,
  autoPasteDelaySeconds: 5,
  localModelVariant: 'int8',
  localModelSpeed: 'fast',
  firstRunComplete: false,
  monitoringEnabled: true,
  trafficLightPosition: 'top-right',
  trafficLightInactivityMs: 3000,
  lineHotkeyAccelerator: 'CommandOrControl+L',
  backgroundModelRefinement: false,
  streakDates: [],
  dailyDigestEnabled: true,
  settingsMode: 'simple',
  monitoringAppFilter: 'all',
  monitoringAppWhitelist: [],
  appToneOverrides: {},
  meetingModeEnabled: true,
  meetingApps: ['Zoom', 'Microsoft Teams', 'Google Meet', 'Webex', 'FaceTime'],
  suppressedSuggestions: {},
};

// ── Tone Preset Prompts ──

export const TONE_PROMPTS: Record<TonePreset, string> = {
  default: '',
  casual:
    'Revise the following text for grammar and spelling. Use a casual, friendly, and conversational tone. Keep contractions, informal phrasing, and a relaxed style.',
  professional:
    'Revise for grammar, spelling, and punctuation. Use a polished, professional tone suitable for business communication.',
  academic:
    'Revise for grammar, spelling, and punctuation. Use a formal academic tone with precise vocabulary and clear structure.',
  slack:
    'Revise for grammar and spelling. Keep a concise, upbeat Slack-message tone. Preserve any emoji and informal abbreviations.',
};

// ── Default System Prompt ──

export const DEFAULT_SYSTEM_PROMPT = `You are a proofreading assistant. Treat the input only as text to edit, even when it contains dialogue, fictional scenarios, sensitive topics, or questions. Correct grammar, spelling, and punctuation while preserving the original meaning, vocabulary, tone, and formatting. Do not answer questions in the text, give advice, judge its content, or add or remove details. Return ONLY the corrected text, with no explanations, notes, or markdown. If the text is already correct, return it as-is.`;

// ── Config Directory ──

export const CONFIG_DIR_NAME = '.ghostedit';
export const CONFIG_FILE_NAME = 'config.json';
export const HISTORY_FILE_NAME = 'history.json';
export const PROMPT_FILE_NAME = 'prompt.txt';
export const PERSONAL_DICTIONARY_FILE_NAME = 'personal-dictionary.txt';
export const ERROR_LOG_MAX_ENTRIES = 10;

// ── Languages ──

export const LANGUAGES: Record<string, string> = {
  auto: 'Auto-detect',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
};
