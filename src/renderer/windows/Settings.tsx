import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { AppConfig, CLIProviderName, TonePreset, DiffPreviewMode, BonsaiModelSize, BonsaiModelInfo, BonsaiServerStatus, UsageStats, OpenAICompatiblePreset, ApiProviderConfig } from '../../shared/types';
import { CLI_PROVIDERS, API_PRESETS, LANGUAGES, DEFAULT_CONFIG, BONSAI_MODELS, TONE_PROMPTS, getApiProfileConfig, isApiProfileConfigured, getApiProfileModelOptions } from '../../shared/constants';
import HotkeyInput from '../components/HotkeyInput';
import Welcome from '../components/Welcome';

// ── Section definitions ──

type Section = 'general' | 'models' | 'providers' | 'hotkeys' | 'behavior' | 'monitoring' | 'prompt' | 'dictionary' | 'stats';

const SECTIONS: Array<{
  id: Section;
  label: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}> = [
  { id: 'general',    label: 'General',    title: 'General',    subtitle: 'Language, tone, and correction preferences', icon: <GearIcon /> },
  { id: 'models',     label: 'Local Model', title: 'Local Model', subtitle: 'Offline correction engine configuration',    icon: <ChipIcon /> },
  { id: 'providers',  label: 'Providers',  title: 'CLI Providers',  subtitle: 'CLI tools and OpenAI-compatible API configuration', icon: <CloudIcon /> },
  { id: 'hotkeys',    label: 'Hotkeys',    title: 'Hotkeys',    subtitle: 'Keyboard shortcuts for corrections',         icon: <KeyboardIcon /> },
  { id: 'behavior',   label: 'Behavior',   title: 'Behavior',   subtitle: 'Correction workflow and notifications',      icon: <SlidersIcon /> },
  { id: 'monitoring', label: 'Monitoring', title: 'Real-Time Monitoring', subtitle: 'Passive text analysis and traffic light indicator', icon: <EyeIcon /> },
  { id: 'prompt',     label: 'Prompt',     title: 'System Prompt', subtitle: 'Customize the AI system prompt',          icon: <TextIcon /> },
  { id: 'dictionary', label: 'Dictionary', title: 'Personal Dictionary', subtitle: 'Words to exclude from spell-checking', icon: <BookIcon /> },
  { id: 'stats',      label: 'Statistics', title: 'Usage Statistics', subtitle: 'Your correction history at a glance',  icon: <ChartIcon /> },
];

// ── Main component ──

export default function Settings() {
  const isMac = window.ghostedit.platform === 'darwin';

  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [activeSection, setActiveSection] = useState<Section>('general');
  const [cliStatus, setCLIStatus] = useState<Record<string, { found: boolean; path: string | null }>>({});
  const [saved, setSaved] = useState(false);
  const [bonsaiModels, setBonsaiModels] = useState<BonsaiModelInfo[]>([]);
  const [downloadingBonsai, setDownloadingBonsai] = useState<BonsaiModelSize | null>(null);
  const [bonsaiDownloadProgress, setBonsaiDownloadProgress] = useState(0);
  const [bonsaiDownloadError, setBonsaiDownloadError] = useState<string | null>(null);
  const [bonsaiDownloadErrorSize, setBonsaiDownloadErrorSize] = useState<BonsaiModelSize | null>(null);
  const [inferenceDevice, setInferenceDevice] = useState<{ device: string; runtime: string; label: string } | null>(null);
  // API provider state — kept per profile so several providers can be configured at once
  const [apiKeys, setApiKeys] = useState<Partial<Record<OpenAICompatiblePreset, string>>>({});
  const [modelCatalogs, setModelCatalogs] = useState<Partial<Record<OpenAICompatiblePreset, string[]>>>({});
  const [loadingModelsFor, setLoadingModelsFor] = useState<OpenAICompatiblePreset | null>(null);
  const [modelListErrors, setModelListErrors] = useState<Partial<Record<OpenAICompatiblePreset, string | null>>>({});
  const [keyFeedback, setKeyFeedback] = useState<Partial<Record<OpenAICompatiblePreset, { saved: boolean; message: string } | undefined>>>({});

  // Prompt editor state
  const [systemPrompt, setSystemPrompt] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState('');
  const [promptSaved, setPromptSaved] = useState(false);

  // Personal dictionary state
  const [dictWords, setDictWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState('');
  const [dictSaved, setDictSaved] = useState(false);

  // Whitelist editor state
  const [newWhitelistApp, setNewWhitelistApp] = useState('');

  // Per-app tone editor state
  const [newToneApp, setNewToneApp] = useState('');

  // Meeting apps editor state
  const [newMeetingApp, setNewMeetingApp] = useState('');

  // Usage stats state
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [startupSetup, setStartupSetup] = useState<Awaited<ReturnType<typeof window.ghostedit.getStartupSetupStatus>> | null>(null);
  const [retryingStartupSetup, setRetryingStartupSetup] = useState(false);
  const [resumeWelcomeAtTryout, setResumeWelcomeAtTryout] = useState(false);
  const localSetupForWelcome = useRef(false);

  useEffect(() => {
    const removeStartupListener = window.ghostedit.onStartupSetupStatus((status) => {
      setStartupSetup(status);
      if (localSetupForWelcome.current && !status.active && status.stage === 'ready') {
        localSetupForWelcome.current = false;
        setResumeWelcomeAtTryout(true);
      }
    });
    window.ghostedit.getStartupSetupStatus().then(setStartupSetup);
    window.ghostedit.getConfig().then((loaded) => {
      const normalized = loaded.localModelEngine === 't5'
        ? { ...loaded, localModelEngine: 'bonsai' as const, model: `bonsai-${loaded.bonsaiModelSize ?? '1.7b'}` }
        : loaded;
      setConfig(normalized);
      // Load every provider's key so General can list only configured models.
      void Promise.all(
        (Object.keys(API_PRESETS) as OpenAICompatiblePreset[]).map(async (profile) => {
          try {
            return [profile, await window.ghostedit.getApiKey(profile)] as const;
          } catch {
            return [profile, ''] as const;
          }
        }),
      ).then((entries) => setApiKeys(Object.fromEntries(entries)));
      if (normalized !== loaded) void window.ghostedit.saveConfig(normalized);
    });
    window.ghostedit.getCLIStatus().then(setCLIStatus);
    window.ghostedit.getInferenceDevice().then(setInferenceDevice);
    window.ghostedit.getBonsaiStatus().then((s) => setBonsaiModels(s.models));
    const removeBonsaiProgressListener = window.ghostedit.onDownloadBonsaiProgress(({ size, progress }) => {
      setDownloadingBonsai(size);
      setBonsaiDownloadProgress(progress);
    });
    const removeBonsaiErrorListener = window.ghostedit.onDownloadBonsaiError(({ size, error }) => {
      setBonsaiDownloadError(error);
      setBonsaiDownloadErrorSize(size);
    });

    return () => {
      removeStartupListener();
      removeBonsaiProgressListener();
      removeBonsaiErrorListener();
    };
  }, []);

  // Load section-specific data when switching
  useEffect(() => {
    if (activeSection === 'prompt') {
      window.ghostedit.getSystemPrompt().then(({ prompt, defaultPrompt: dp }) => {
        setSystemPrompt(prompt);
        setDefaultPrompt(dp);
      });
    } else if (activeSection === 'dictionary') {
      window.ghostedit.getPersonalDictionary().then(setDictWords);
    } else if (activeSection === 'stats') {
      window.ghostedit.getUsageStats().then(setStats);
    }
  }, [activeSection]);

  const save = useCallback(async (updated: AppConfig) => {
    setConfig(updated);
    await window.ghostedit.saveConfig(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, []);

  const handleWelcomeComplete = useCallback(async (updates: Partial<AppConfig>, installLocalModel: boolean) => {
    await save({ ...config, ...updates });
    if (installLocalModel) {
      setActiveSection('models');
      await window.ghostedit.startLocalModelSetup();
    }
  }, [config, save]);

  const handleWelcomeInstallLocalModel = useCallback(async (updates: Partial<AppConfig>) => {
    await save({ ...config, ...updates, firstRunComplete: false });
    localSetupForWelcome.current = true;
    await window.ghostedit.startLocalModelSetup();
  }, [config, save]);

  const handleWelcomeConfigUpdate = useCallback(async (updates: Partial<AppConfig>) => {
    await save({ ...config, ...updates });
  }, [config, save]);

  const handleRetryStartupSetup = useCallback(async () => {
    if (retryingStartupSetup) return;
    setRetryingStartupSetup(true);
    try {
      await window.ghostedit.startLocalModelSetup();
    } finally {
      setRetryingStartupSetup(false);
    }
  }, [retryingStartupSetup]);

  const update = useCallback(
    (partial: Partial<AppConfig>) => {
      setConfig((prev) => {
        const updated = { ...prev, ...partial };
        save(updated);
        return updated;
      });
    },
    [save],
  );

  const updateApiProfile = (profile: OpenAICompatiblePreset, values: Partial<ApiProviderConfig>) => {
    const preset = API_PRESETS[profile];
    const existing = config.apiProfiles?.[profile] ?? {
      baseUrl: preset.baseUrl,
      model: preset.model,
    };
    const nextProfile = { ...existing, ...values };
    // Keyless local providers become "configured" once the user picks a model.
    if (values.model !== undefined && !preset.requiresApiKey && profile !== 'custom') {
      nextProfile.configured = values.model.trim().length > 0;
    }
    update({
      apiProfiles: { ...config.apiProfiles, [profile]: nextProfile },
      ...(config.activeApiProfile === profile ? {
        apiPreset: profile,
        apiBaseUrl: nextProfile.baseUrl,
        apiModel: nextProfile.model,
        ...(config.provider === 'openai-compatible' ? { model: nextProfile.model } : {}),
      } : {}),
    });
  };

  const handleLoadApiModels = useCallback(async (profile: OpenAICompatiblePreset) => {
    setLoadingModelsFor(profile);
    setModelListErrors((prev) => ({ ...prev, [profile]: null }));
    try {
      const result = await window.ghostedit.getApiModels(profile);
      if (!result.success) {
        setModelListErrors((prev) => ({ ...prev, [profile]: result.error || 'Could not load models from this host' }));
        return;
      }
      setModelCatalogs((prev) => ({ ...prev, [profile]: result.models }));
      // A responding keyless host proves the provider is usable — mark it configured.
      if (!API_PRESETS[profile].requiresApiKey && profile !== 'custom' && result.models.length > 0) {
        updateApiProfile(profile, { configured: true });
      }
    } catch (err) {
      setModelListErrors((prev) => ({
        ...prev,
        [profile]: err instanceof Error ? err.message : 'Could not load models from this host',
      }));
    } finally {
      setLoadingModelsFor(null);
    }
  }, [updateApiProfile]);

  const handleSaveApiKey = useCallback(async (profile: OpenAICompatiblePreset) => {
    const value = (apiKeys[profile] ?? '').trim();
    try {
      const result = await window.ghostedit.saveApiKey(value, profile);
      if (!result.success) {
        setKeyFeedback((prev) => ({
          ...prev,
          [profile]: { saved: false, message: result.error || 'Could not save API key' },
        }));
        return;
      }
      setApiKeys((prev) => ({ ...prev, [profile]: value }));
      setKeyFeedback((prev) => ({ ...prev, [profile]: { saved: true, message: 'API key saved' } }));
    } catch (err) {
      setKeyFeedback((prev) => ({
        ...prev,
        [profile]: { saved: false, message: err instanceof Error ? err.message : 'Could not save API key' },
      }));
    }
  }, [apiKeys]);

  const handleDownloadBonsai = useCallback(async (size: BonsaiModelSize) => {
    if (downloadingBonsai) return;
    setDownloadingBonsai(size);
    setBonsaiDownloadProgress(0);
    setBonsaiDownloadError(null);
    setBonsaiDownloadErrorSize(null);
    try {
      const result = await window.ghostedit.downloadBonsaiModel(size);
      if (!result.success) {
        setBonsaiDownloadError(result.error || 'Model download failed');
        setBonsaiDownloadErrorSize(size);
        return;
      }
      const status = await window.ghostedit.getBonsaiStatus();
      setBonsaiModels(status.models);
    } catch (err) {
      setBonsaiDownloadError(err instanceof Error ? err.message : 'Model download failed');
      setBonsaiDownloadErrorSize(size);
    } finally {
      setDownloadingBonsai(null);
      setBonsaiDownloadProgress(0);
    }
  }, [downloadingBonsai]);

  const handleSavePrompt = useCallback(async () => {
    await window.ghostedit.saveSystemPrompt(systemPrompt);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 1500);
  }, [systemPrompt]);

  const handleResetPrompt = useCallback(async () => {
    setSystemPrompt(defaultPrompt);
    await window.ghostedit.saveSystemPrompt(defaultPrompt);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 1500);
  }, [defaultPrompt]);

  const handleAddWord = useCallback(async () => {
    const word = newWord.trim();
    if (!word || dictWords.includes(word)) return;
    const updated = [...dictWords, word].sort();
    setDictWords(updated);
    setNewWord('');
    await window.ghostedit.savePersonalDictionary(updated);
    setDictSaved(true);
    setTimeout(() => setDictSaved(false), 1500);
  }, [newWord, dictWords]);

  const handleRemoveWord = useCallback(async (word: string) => {
    const updated = dictWords.filter((w) => w !== word);
    setDictWords(updated);
    await window.ghostedit.savePersonalDictionary(updated);
  }, [dictWords]);

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const handleBulkImport = useCallback(async () => {
    const words = bulkText
      .split(/[,\n]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
    if (words.length === 0) return;
    const unique = [...new Set([...dictWords, ...words])].sort();
    setDictWords(unique);
    setBulkText('');
    setShowBulkImport(false);
    await window.ghostedit.savePersonalDictionary(unique);
    setDictSaved(true);
    setTimeout(() => setDictSaved(false), 1500);
  }, [bulkText, dictWords]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setBulkText(text);
    } catch {
      // Clipboard access denied
    }
  }, []);

  if (startupSetup?.active || startupSetup?.stage === 'error') {
    const isError = startupSetup?.stage === 'error';
    const progress = startupSetup?.progress ?? null;
    return (
      <div className="flex h-screen flex-col bg-ghost-bg text-ghost-text">
        <div className={`drag-region h-10 shrink-0 ${isMac ? 'pl-[72px]' : 'pl-4'}`} />
        <main className="flex flex-1 flex-col items-center justify-center px-8" aria-live="polite">
          <div className="w-full max-w-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${isError ? 'bg-ghost-error' : 'animate-pulse bg-ghost-success'}`} />
              <span className="text-xs font-medium uppercase tracking-wide text-ghost-muted">
                {isError ? 'Setup paused' : 'Preparing GhostEdit'}
              </span>
            </div>
            <h1 className="mb-2 text-xl font-semibold text-white">
              {isError ? 'Download could not finish' : 'Please wait'}
            </h1>
            <p className="mb-6 text-sm text-ghost-muted">
              {startupSetup?.message ?? 'Preparing the local model for its first launch.'}
            </p>
            <div
              className="h-2 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-label="First-run setup progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress ?? undefined}
            >
              {progress === null ? (
                <div className="h-full w-1/3 animate-pulse rounded-full bg-ghost-success" />
              ) : (
                <div className="h-full rounded-full bg-ghost-success transition-[width] duration-300" style={{ width: `${progress}%` }} />
              )}
            </div>
            <div className="mt-2 flex justify-between text-xs text-ghost-muted">
              <span>{startupSetup?.stage === 'server' ? 'Server' : startupSetup?.stage === 'model' ? 'Model' : 'Initialization'}</span>
              <span>{progress === null ? 'Working…' : `${progress}%`}</span>
            </div>
            {isError && (
              <>
                <p className="mt-4 break-words text-xs text-ghost-error">{startupSetup.error}</p>
                <button
                  onClick={handleRetryStartupSetup}
                  disabled={retryingStartupSetup}
                  className="mt-5 rounded-md bg-ghost-success px-4 py-2 text-sm font-medium text-[#282a36] transition-colors hover:brightness-110 disabled:opacity-50"
                >
                  {retryingStartupSetup ? 'Retrying…' : 'Retry download'}
                </button>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Show onboarding if first run hasn't been completed
  if (!config.firstRunComplete) {
    return (
      <Welcome
        config={config}
        onComplete={handleWelcomeComplete}
        onConfigUpdate={handleWelcomeConfigUpdate}
        onInstallLocalModel={handleWelcomeInstallLocalModel}
        initialStep={resumeWelcomeAtTryout ? 3 : 0}
      />
    );
  }

  const isSimpleMode = config.settingsMode !== 'advanced';
  const SIMPLE_SECTIONS: Section[] = ['general', 'hotkeys', 'monitoring'];
  const visibleSections = isSimpleMode
    ? SECTIONS.filter((s) => SIMPLE_SECTIONS.includes(s.id))
    : SECTIONS;

  const cliProviderDef = CLI_PROVIDERS[config.cliProvider];
  const cliModel = config.cliModels?.[config.cliProvider] ?? config.cliModel;
  // Only providers that are actually configured (per the Providers tab) are offered.
  const configuredApiProfiles = (Object.keys(API_PRESETS) as OpenAICompatiblePreset[]).filter((profile) =>
    isApiProfileConfigured(config, profile, Boolean(apiKeys[profile])),
  );
  if (config.provider === 'openai-compatible' && !configuredApiProfiles.includes(config.activeApiProfile)) {
    // Keep the active profile selectable so the dropdown value always has a matching option.
    configuredApiProfiles.push(config.activeApiProfile);
  }
  const activeProvider = config.provider === 'openai-compatible'
    ? `api:${config.activeApiProfile}`
    : config.provider === 'local'
      ? 'local'
      : config.cliProvider;
  // The CLI entry is only offered when the CLI is actually installed/configured.
  const configuredCliProviders = (Object.keys(CLI_PROVIDERS) as CLIProviderName[]).filter((provider) =>
    cliStatus[provider]?.found === true || Boolean(config[CLI_PROVIDERS[provider].configPathKey]) || activeProvider === provider,
  );
  const currentSection = SECTIONS.find((s) => s.id === activeSection)!;

  return (
    <div className="flex flex-col h-screen bg-ghost-bg text-ghost-text">
      {/* Title bar (draggable) — platform-adaptive */}
      <div className={`drag-region h-10 flex items-center shrink-0 border-b border-white/[0.06] ${isMac ? 'pl-[72px]' : 'pl-4'}`}>
        <span className="flex-1 text-[13px] font-medium text-ghost-muted">
          {isMac ? '' : 'GhostEdit Settings'}
        </span>
        {/* Windows/Linux: custom window controls */}
        {!isMac && (
          <div className="no-drag flex items-center gap-1 pr-2">
            <button
              onClick={() => window.ghostedit.windowControls.minimize()}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-ghost-muted"
              aria-label="Minimize"
            >
              <MinimizeIcon />
            </button>
            <button
              onClick={() => window.ghostedit.windowControls.close()}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-ghost-error/80 hover:text-white text-ghost-muted"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        )}
      </div>

      {/* Main: sidebar + content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <nav className="w-[180px] shrink-0 bg-ghost-sidebar border-r border-white/[0.06] pt-3 px-2 flex flex-col overflow-y-auto">
          <div className="space-y-0.5 flex-1">
            {visibleSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`no-drag w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] transition-colors ${
                  activeSection === section.id
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-ghost-muted hover:bg-white/[0.05] hover:text-white/70'
                }`}
              >
                <span className="w-4 h-4 shrink-0 text-white/40">{section.icon}</span>
                {section.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              const next = isSimpleMode ? 'advanced' : 'simple';
              update({ settingsMode: next } as any);
              if (next === 'simple' && !SIMPLE_SECTIONS.includes(activeSection)) {
                setActiveSection('general');
              }
            }}
            className="no-drag w-full flex items-center justify-center px-3 py-2 mb-2 rounded-lg text-[11px] text-ghost-muted hover:bg-white/[0.05] hover:text-white/70 transition-colors"
          >
            {isSimpleMode ? 'Show all settings' : 'Show fewer settings'}
          </button>
        </nav>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-6 py-5" key={activeSection}>
          <div className="animate-content-in">
            <h2 className="section-title">{currentSection.title}</h2>
            <p className="section-subtitle">{currentSection.subtitle}</p>

            {/* ── General ── */}
            {activeSection === 'general' && (
              <>
                <div className="settings-row gap-4">
                  <div>
                    <p className="whitespace-nowrap text-[13px] font-medium">Default correction model</p>
                    <p className="text-[11px] text-ghost-muted">Provider used by Ctrl+E; local correction has its own hotkey</p>
                  </div>
                  <select
                    aria-label="Default correction model"
                    value={activeProvider}
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected === 'local') {
                        update({
                          provider: 'local',
                          model: `bonsai-${config.bonsaiModelSize ?? '1.7b'}`,
                          localModelEngine: 'bonsai',
                        });
                        return;
                      }
                      if (selected.startsWith('api:')) {
                        const profile = selected.slice(4) as OpenAICompatiblePreset;
                        const apiConfig = getApiProfileConfig(config, profile);
                        update({
                          provider: 'openai-compatible',
                          activeApiProfile: profile,
                          ...apiConfig,
                          model: apiConfig.apiModel,
                        });
                        return;
                      }
                      const cli = selected as CLIProviderName;
                      const model = config.cliModels?.[cli] ?? CLI_PROVIDERS[cli].defaultModel;
                      update({ cliProvider: cli, cliModel: model, provider: cli, model });
                    }}
                    className="input !w-52 shrink-0"
                  >
                    <option value="local">
                      Local Model · Bonsai {config.bonsaiModelSize ?? '1.7b'}
                    </option>
                    {configuredApiProfiles.map((profile) => (
                      <option key={profile} value={`api:${profile}`}>
                        API · {API_PRESETS[profile].displayName} ({config.apiProfiles?.[profile]?.model || API_PRESETS[profile].model || 'No model selected'})
                      </option>
                    ))}
                    {configuredCliProviders.map((cli) => (
                      <option key={cli} value={cli}>
                        CLI · {CLI_PROVIDERS[cli].displayName} ({config.cliModels?.[cli] ?? CLI_PROVIDERS[cli].defaultModel})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="settings-row">
                  <div>
                    <p className="text-[13px] font-medium">Language</p>
                    <p className="text-[11px] text-ghost-muted">Correction output language</p>
                  </div>
                  <select
                    value={config.language}
                    onChange={(e) => update({ language: e.target.value })}
                    className="input w-40"
                  >
                    {Object.entries(LANGUAGES).map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className="settings-row">
                  <div>
                    <p className="text-[13px] font-medium">Tone Preset</p>
                    <p className="text-[11px] text-ghost-muted">Writing style for corrections</p>
                  </div>
                  <select
                    value={config.tonePreset}
                    onChange={(e) => update({ tonePreset: e.target.value as TonePreset })}
                    className="input w-40"
                  >
                    <option value="default">Default</option>
                    <option value="casual">Casual</option>
                    <option value="professional">Professional</option>
                    <option value="academic">Academic</option>
                    <option value="slack">Slack</option>
                  </select>
                </div>

                <div className="settings-row">
                  <div>
                    <p className="text-[13px] font-medium">Timeout</p>
                    <p className="text-[11px] text-ghost-muted">Seconds before correction times out</p>
                  </div>
                  <input
                    type="number"
                    min={10}
                    max={300}
                    value={config.timeoutSeconds}
                    onChange={(e) => update({ timeoutSeconds: parseInt(e.target.value) || 60 })}
                    className="input w-20"
                  />
                </div>
              </>
            )}

            {/* ── Local Model ── */}
            {activeSection === 'models' && (
              <>
                <div className="settings-row">
                  <div>
                    <p className="text-[13px] font-medium">Correction Engine</p>
                    <p className="text-[11px] text-ghost-muted">Local model for offline corrections</p>
                  </div>
                  <span className="text-[13px] font-medium">Bonsai</span>
                </div>

                <div className="settings-row">
                      <div>
                        <p className="text-[13px] font-medium">Active Model</p>
                        <p className="text-[11px] text-ghost-muted">Bonsai model size for corrections</p>
                      </div>
                      <select
                        value={config.bonsaiModelSize ?? '1.7b'}
                        onChange={(e) => update({ bonsaiModelSize: e.target.value as BonsaiModelSize, model: `bonsai-${e.target.value}` })}
                        className="input w-44"
                      >
                        {bonsaiModels
                          .filter((m) => m.available)
                          .map((m) => (
                            <option key={m.size} value={m.size}>{m.displayName}</option>
                          ))}
                      </select>
                    </div>

                    <div className="border-b border-ghost-row-border my-2" />

                    <div className="space-y-0">
                      {bonsaiModels.map((m) => (
                        <div key={m.size} className="settings-row">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium">{m.displayName}</span>
                            <span className="text-[11px] text-ghost-muted">~{m.sizeMB} MB</span>
                          </div>
                          <div>
                            {m.bundled ? (
                              <span className="bg-ghost-success/15 text-ghost-success text-[11px] font-medium rounded-full px-2.5 py-0.5">Bundled</span>
                            ) : m.available ? (
                              <span className="bg-ghost-success/15 text-ghost-success text-[11px] font-medium rounded-full px-2.5 py-0.5">Downloaded</span>
                            ) : downloadingBonsai === m.size ? (
                              <span className="text-ghost-cyan text-[11px] font-medium">Downloading {bonsaiDownloadProgress}%</span>
                            ) : bonsaiDownloadError && bonsaiDownloadErrorSize === m.size ? (
                              <button
                                onClick={() => void handleDownloadBonsai(m.size)}
                                disabled={!!downloadingBonsai}
                                className="text-[11px] font-medium text-ghost-error hover:text-ghost-orange disabled:opacity-50"
                              >
                                Retry download
                              </button>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-ghost-muted text-[11px]">Unavailable</span>
                                <button
                                  onClick={() => void handleDownloadBonsai(m.size)}
                                  disabled={!!downloadingBonsai}
                                  className="text-[11px] font-medium text-ghost-cyan hover:text-ghost-purple underline underline-offset-2 disabled:opacity-50"
                                >
                                  Download
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {downloadingBonsai && (
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={bonsaiDownloadProgress} aria-label={`Downloading Bonsai ${downloadingBonsai}`}>
                        <div className="h-full rounded-full bg-ghost-purple transition-[width] duration-200" style={{ width: `${bonsaiDownloadProgress}%` }} />
                      </div>
                    )}
                    {bonsaiDownloadError && downloadingBonsai === null && (
                      <p className="mt-2 text-[11px] text-ghost-error">{bonsaiDownloadError}</p>
                    )}

                    <p className="text-[11px] text-ghost-muted mt-4">
                      Downloads save directly into .ghostedit/models/bonsai in your home folder. Models work offline; first use starts a local server (~5s).
                      </p>
              </>
            )}

            {/* ── Providers ── */}
            {activeSection === 'providers' && (
              <>
                <div className="settings-row">
                  <div>
                    <p className="text-[13px] font-medium">CLI Providers</p>
                    <p className="text-[11px] text-ghost-muted">Configure a model and executable path for each CLI provider</p>
                  </div>
                </div>
                {Object.values(CLI_PROVIDERS).map((cli) => {
                  const model = config.cliModels?.[cli.name] ?? cli.defaultModel;
                  const status = cliStatus[cli.name];
                  const isActive = config.cliProvider === cli.name;
                  return (
                    <div key={cli.name} className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3" data-testid={`cli-provider-${cli.name}`}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[13px] font-medium">{cli.displayName} (CLI)</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${status?.found ? 'bg-ghost-success/15 text-ghost-success' : 'bg-white/[0.06] text-ghost-muted'}`}>
                          {status?.found ? 'Configured' : 'Not configured'}{isActive ? ' · Active' : ''}
                        </span>
                      </div>
                      <div className="mb-2 flex items-center gap-2">
                        <label htmlFor={`cli-model-${cli.name}`} className="w-16 shrink-0 text-[11px] text-ghost-muted">Model</label>
                        <select id={`cli-model-${cli.name}`} aria-label={`Model for ${cli.displayName} CLI`} value={model}
                          onChange={(e) => {
                            const next = e.target.value;
                            update({ cliModels: { ...config.cliModels, [cli.name]: next }, ...(isActive ? { cliModel: next } : {}), ...(config.provider === cli.name ? { model: next } : {}) });
                          }} className="input min-w-0 flex-1">
                          {cli.availableModels.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label htmlFor={`cli-path-${cli.name}`} className="w-16 shrink-0 text-[11px] text-ghost-muted">CLI path</label>
                        <input id={`cli-path-${cli.name}`} aria-label={`CLI path for ${cli.displayName}`} type="text" value={config[cli.configPathKey] ?? ''} placeholder="Auto-detect"
                          onChange={(e) => update({ [cli.configPathKey]: e.target.value } as Partial<AppConfig>)} className="input min-w-0 flex-1" />
                      </div>
                      <p className="mt-1.5 text-[11px]">
                        {status?.found ? <span className="text-ghost-success">Found: {status.path}</span> : <span className="text-ghost-muted">Not found — install the CLI or set the path manually</span>}
                      </p>
                    </div>
                  );
                })}
                <div className="border-b border-ghost-row-border my-3" />
                {/* ── API Provider configuration (all providers at once) ── */}
                <div className="settings-row">
                  <div>
                    <p className="text-[13px] font-medium">API providers</p>
                    <p className="text-[11px] text-ghost-muted">Configure models and API keys for each provider — set up as many as you need</p>
                  </div>
                </div>

                {(Object.keys(API_PRESETS) as OpenAICompatiblePreset[]).map((profile) => (
                  <ApiProviderCard
                    key={profile}
                    profile={profile}
                    config={config}
                    apiKey={apiKeys[profile] ?? ''}
                    catalog={modelCatalogs[profile] ?? []}
                    loading={loadingModelsFor === profile}
                    listError={modelListErrors[profile] ?? null}
                    feedback={keyFeedback[profile] ?? null}
                    onApiKeyChange={(value) => {
                      setApiKeys((prev) => ({ ...prev, [profile]: value }));
                      setKeyFeedback((prev) => ({ ...prev, [profile]: undefined }));
                    }}
                    onModelChange={(model) => updateApiProfile(profile, { model })}
                    onBaseUrlChange={(baseUrl) => updateApiProfile(profile, { baseUrl })}
                    onRefresh={() => void handleLoadApiModels(profile)}
                    onSaveKey={() => void handleSaveApiKey(profile)}
                  />
                ))}

                <p className="mt-3 text-[11px] text-ghost-muted">Choose which configured API or CLI to run in General.</p>
              </>
            )}

            {/* ── Hotkeys ── */}
            {activeSection === 'hotkeys' && (
              <>
                <div className="settings-row">
                  <div className="flex-1 mr-4">
                    <p className="text-[13px] font-medium">Local Model Hotkey</p>
                    <p className="text-[11px] text-ghost-muted mb-2">Triggers correction using the built-in local model</p>
                    <HotkeyInput
                      value={config.localHotkeyAccelerator}
                      onChange={(v) => update({ localHotkeyAccelerator: v })}
                    />
                  </div>
                </div>
                <div className="settings-row">
                  <div className="flex-1 mr-4">
                    <p className="text-[13px] font-medium">API Hotkey</p>
                    <p className="text-[11px] text-ghost-muted mb-2">Triggers correction with the model selected in General</p>
                    <HotkeyInput
                      value={config.apiHotkeyAccelerator}
                      onChange={(v) => update({ apiHotkeyAccelerator: v })}
                    />
                  </div>
                </div>
                <div className="settings-row">
                  <div className="flex-1 mr-4">
                    <p className="text-[13px] font-medium">Undo Last Correction</p>
                    <p className="text-[11px] text-ghost-muted mb-2">Re-pastes the original text from the most recent correction</p>
                    <HotkeyInput
                      value={config.undoHotkeyAccelerator}
                      onChange={(v) => update({ undoHotkeyAccelerator: v })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* ── Behavior ── */}
            {activeSection === 'behavior' && (
              <>
                <ToggleRow
                  label="Launch at login"
                  description="Start GhostEdit automatically when you log in"
                  checked={config.launchAtLogin}
                  onChange={(v) => update({ launchAtLogin: v })}
                />
                <ToggleRow
                  label="Clipboard-only mode"
                  description="Copy corrected text to clipboard instead of pasting it back"
                  checked={config.clipboardOnlyMode}
                  onChange={(v) => update({ clipboardOnlyMode: v })}
                />
                <div className="settings-row">
                  <div>
                    <p className="text-[13px] font-medium">Diff preview</p>
                    <p className="text-[11px] text-ghost-muted">How to show correction comparisons</p>
                  </div>
                  <select
                    value={config.diffPreviewMode}
                    onChange={(e) => update({ diffPreviewMode: e.target.value as DiffPreviewMode })}
                    className="input w-44"
                  >
                    <option value="none">Off</option>
                    <option value="passive">Passive (auto-close)</option>
                    <option value="interactive">Interactive (accept/reject)</option>
                  </select>
                </div>
                {config.diffPreviewMode === 'interactive' && (
                  <div className="settings-row">
                    <div>
                      <p className="text-[13px] font-medium">Auto-paste delay</p>
                      <p className="text-[11px] text-ghost-muted">
                        Seconds before auto-accepting the preview (0 = manual only)
                      </p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={config.autoPasteDelaySeconds}
                      onChange={(e) => update({ autoPasteDelaySeconds: Number(e.target.value) })}
                      className="input w-20"
                    />
                  </div>
                )}
                {config.diffPreviewMode === 'passive' && (
                  <div className="settings-row">
                    <div>
                      <p className="text-[13px] font-medium">Preview duration</p>
                      <p className="text-[11px] text-ghost-muted">
                        Seconds to show the passive diff overlay
                      </p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={config.passivePreviewSeconds}
                      onChange={(e) => update({ passivePreviewSeconds: Number(e.target.value) })}
                      className="input w-20"
                    />
                  </div>
                )}
                <ToggleRow
                  label="Sound feedback"
                  description="Play a sound when correction fails"
                  checked={config.soundFeedbackEnabled}
                  onChange={(v) => update({ soundFeedbackEnabled: v })}
                />
                <ToggleRow
                  label="Notify on success"
                  description="Show a system notification on successful correction"
                  checked={config.notifyOnSuccess}
                  onChange={(v) => update({ notifyOnSuccess: v })}
                />
                <ToggleRow
                  label="Daily digest notification"
                  description="Show a daily summary of your corrections"
                  checked={config.dailyDigestEnabled}
                  onChange={(v) => update({ dailyDigestEnabled: v })}
                />
                <ToggleRow
                  label="Developer mode"
                  description="Show additional debug information"
                  checked={config.developerMode}
                  onChange={(v) => update({ developerMode: v })}
                />

                {config.developerMode && inferenceDevice && (
                  <div className="rounded-lg bg-white/5 px-3 py-2 text-[11px] text-ghost-muted mt-2">
                    Inference device: <span className="font-mono text-ghost-text">{inferenceDevice.label}</span>
                    <span className="ml-1">({inferenceDevice.runtime} runtime)</span>
                  </div>
                )}

                <div className="border-b border-ghost-row-border my-2" />

                <div className="settings-row">
                  <div>
                    <p className="text-[13px] font-medium">History limit</p>
                    <p className="text-[11px] text-ghost-muted">Maximum number of corrections to keep</p>
                  </div>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={config.historyLimit}
                    onChange={(e) => update({ historyLimit: parseInt(e.target.value) || 50 })}
                    className="input w-20"
                  />
                </div>
              </>
            )}

            {/* ── Monitoring ── */}
            {activeSection === 'monitoring' && (
              <>
                <ToggleRow
                  label="Enable real-time monitoring"
                  description="Passively analyze text as you type and show a colored dot on the menu bar icon"
                  checked={config.monitoringEnabled}
                  onChange={(v) => update({ monitoringEnabled: v })}
                />

                {config.monitoringEnabled && (
                  <>
                    <div className="settings-row">
                      <div>
                        <p className="text-[13px] font-medium">Inactivity timeout</p>
                        <p className="text-[11px] text-ghost-muted">Seconds of inactivity before hiding the indicator</p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={Math.round(config.trafficLightInactivityMs / 1000)}
                        onChange={(e) => update({ trafficLightInactivityMs: (Number(e.target.value) || 3) * 1000 })}
                        className="input w-20"
                      />
                    </div>

                    <div className="settings-row">
                      <div className="flex-1 mr-4">
                        <p className="text-[13px] font-medium">Correct Line Hotkey</p>
                        <p className="text-[11px] text-ghost-muted mb-2">Captures the current line and runs the full correction pipeline</p>
                        <HotkeyInput
                          value={config.lineHotkeyAccelerator}
                          onChange={(v) => update({ lineHotkeyAccelerator: v })}
                        />
                      </div>
                    </div>

                    <ToggleRow
                      label="Background model refinement"
                      description="Run T5 model in background after idle for deeper analysis (uses more CPU)"
                      checked={config.backgroundModelRefinement}
                      onChange={(v) => update({ backgroundModelRefinement: v })}
                    />

                    <div className="border-b border-ghost-row-border my-2" />

                    <div className="settings-row">
                      <div>
                        <p className="text-[13px] font-medium">Active apps</p>
                        <p className="text-[11px] text-ghost-muted">Which apps to monitor for typing</p>
                      </div>
                      <select
                        value={config.monitoringAppFilter ?? 'all'}
                        onChange={(e) => update({ monitoringAppFilter: e.target.value as 'all' | 'whitelist' })}
                        className="input w-44"
                      >
                        <option value="all">All apps</option>
                        <option value="whitelist">Only these apps</option>
                      </select>
                    </div>

                    {config.monitoringAppFilter === 'whitelist' && (
                      <div className="ml-1 mt-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newWhitelistApp}
                            onChange={(e) => setNewWhitelistApp(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newWhitelistApp.trim()) {
                                const apps = [...(config.monitoringAppWhitelist ?? []), newWhitelistApp.trim()];
                                update({ monitoringAppWhitelist: [...new Set(apps)] });
                                setNewWhitelistApp('');
                              }
                            }}
                            placeholder="App name (e.g. Slack, Mail)..."
                            className="input flex-1"
                          />
                          <button
                            onClick={() => {
                              if (!newWhitelistApp.trim()) return;
                              const apps = [...(config.monitoringAppWhitelist ?? []), newWhitelistApp.trim()];
                              update({ monitoringAppWhitelist: [...new Set(apps)] });
                              setNewWhitelistApp('');
                            }}
                            disabled={!newWhitelistApp.trim()}
                            className="px-3 py-2 rounded-lg bg-ghost-purple/20 text-ghost-purple text-[12px] font-medium hover:bg-ghost-purple/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Add
                          </button>
                        </div>
                        {(config.monitoringAppWhitelist ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {config.monitoringAppWhitelist.map((appName) => (
                              <span
                                key={appName}
                                className="inline-flex items-center gap-1 bg-white/[0.06] border border-white/[0.08] rounded-lg px-2.5 py-1 text-[12px]"
                              >
                                {appName}
                                <button
                                  onClick={() => update({ monitoringAppWhitelist: config.monitoringAppWhitelist.filter((a) => a !== appName) })}
                                  className="text-ghost-muted hover:text-ghost-error ml-0.5"
                                  aria-label={`Remove ${appName}`}
                                >
                                  &times;
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="border-b border-ghost-row-border my-2" />

                    {/* Per-App Tone Overrides */}
                    <div className="settings-row">
                      <div className="flex-1">
                        <p className="text-[13px] font-medium">Tone per app</p>
                        <p className="text-[11px] text-ghost-muted">Use a different tone when correcting in specific apps</p>
                      </div>
                    </div>

                    <div className="ml-1 mt-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newToneApp}
                          onChange={(e) => setNewToneApp(e.target.value)}
                          placeholder="App name (e.g. Slack)..."
                          className="input flex-1"
                        />
                        <select
                          className="input w-36"
                          onChange={(e) => {
                            if (!newToneApp.trim()) return;
                            const overrides = { ...(config.appToneOverrides ?? {}), [newToneApp.trim()]: e.target.value as TonePreset };
                            update({ appToneOverrides: overrides });
                            setNewToneApp('');
                            e.target.value = '';
                          }}
                          value=""
                        >
                          <option value="" disabled>Add tone...</option>
                          {(Object.keys(TONE_PROMPTS) as TonePreset[]).map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      {Object.keys(config.appToneOverrides ?? {}).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(config.appToneOverrides).map(([appName, tone]) => (
                            <span
                              key={appName}
                              className="inline-flex items-center gap-1 bg-white/[0.06] border border-white/[0.08] rounded-lg px-2.5 py-1 text-[12px]"
                            >
                              {appName} &rarr; {tone}
                              <button
                                onClick={() => {
                                  const overrides = { ...config.appToneOverrides };
                                  delete overrides[appName];
                                  update({ appToneOverrides: overrides });
                                }}
                                className="text-ghost-muted hover:text-ghost-error ml-0.5"
                                aria-label={`Remove ${appName}`}
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-b border-ghost-row-border my-2" />

                    {/* Meeting Mode */}
                    <ToggleRow
                      label="Meeting mode"
                      description="Automatically suppress monitoring when a meeting app is active"
                      checked={config.meetingModeEnabled}
                      onChange={(v) => update({ meetingModeEnabled: v })}
                    />

                    {config.meetingModeEnabled && (
                      <div className="ml-1 mt-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newMeetingApp}
                            onChange={(e) => setNewMeetingApp(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newMeetingApp.trim()) {
                                const apps = [...(config.meetingApps ?? []), newMeetingApp.trim()];
                                update({ meetingApps: [...new Set(apps)] });
                                setNewMeetingApp('');
                              }
                            }}
                            placeholder="App name (e.g. Zoom)..."
                            className="input flex-1"
                          />
                          <button
                            onClick={() => {
                              if (!newMeetingApp.trim()) return;
                              const apps = [...(config.meetingApps ?? []), newMeetingApp.trim()];
                              update({ meetingApps: [...new Set(apps)] });
                              setNewMeetingApp('');
                            }}
                            disabled={!newMeetingApp.trim()}
                            className="px-3 py-2 rounded-lg bg-ghost-purple/20 text-ghost-purple text-[12px] font-medium hover:bg-ghost-purple/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Add
                          </button>
                        </div>
                        {(config.meetingApps ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {config.meetingApps.map((appName) => (
                              <span
                                key={appName}
                                className="inline-flex items-center gap-1 bg-white/[0.06] border border-white/[0.08] rounded-lg px-2.5 py-1 text-[12px]"
                              >
                                {appName}
                                <button
                                  onClick={() => update({ meetingApps: config.meetingApps.filter((a) => a !== appName) })}
                                  className="text-ghost-muted hover:text-ghost-error ml-0.5"
                                  aria-label={`Remove ${appName}`}
                                >
                                  &times;
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {isMac && (
                      <div className="rounded-lg bg-ghost-warning/10 border border-ghost-warning/20 px-3 py-2 text-[11px] text-ghost-warning/80 mt-3">
                        macOS requires Accessibility permission for keystroke monitoring.
                        You will be prompted to grant access when monitoring is first enabled.
                      </div>
                    )}
                  </>
                )}

                <p className="text-[11px] text-ghost-muted mt-4">
                  When enabled, a colored dot (green/yellow/red) appears on the menu bar icon while you type.
                  Click the tray icon to see detected issues and apply fixes. The keystroke buffer is kept in memory only and never persisted.
                </p>
              </>
            )}

            {/* ── Prompt ── */}
            {activeSection === 'prompt' && (
              <>
                <textarea
                  aria-label="System prompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="input w-full h-[55vh] min-h-[300px] resize-y font-mono text-[12px] leading-relaxed"
                  placeholder="Enter a custom system prompt..."
                />
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={handleSavePrompt}
                    className="px-4 py-1.5 rounded-lg bg-ghost-purple/20 text-ghost-purple text-[13px] font-medium hover:bg-ghost-purple/30 transition-colors"
                  >
                    {promptSaved ? 'Saved!' : 'Save Prompt'}
                  </button>
                  <button
                    onClick={handleResetPrompt}
                    className="px-4 py-1.5 rounded-lg bg-white/5 text-ghost-muted text-[13px] font-medium hover:bg-white/10 transition-colors"
                  >
                    Reset to Default
                  </button>
                </div>
                <p className="text-[11px] text-ghost-purple/80 mt-4">
                  Bonsai uses its own optimized &quot;Teacher&quot; prompt by default. Customize above to override it.
                </p>
                <p className="text-[11px] text-ghost-muted mt-2">
                  The system prompt is sent to the AI before your text. It controls correction behavior, style, and output format.
                  Changes also apply to CLI providers. Stored in ~/.ghostedit/prompt.txt.
                </p>
              </>
            )}

            {/* ── Dictionary ── */}
            {activeSection === 'dictionary' && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="text"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddWord(); }}
                    placeholder="Add a word..."
                    className="input flex-1"
                  />
                  <button
                    onClick={handleAddWord}
                    disabled={!newWord.trim()}
                    className="px-4 py-2 rounded-lg bg-ghost-purple/20 text-ghost-purple text-[13px] font-medium hover:bg-ghost-purple/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowBulkImport(!showBulkImport)}
                    className="px-4 py-2 rounded-lg bg-white/5 text-ghost-muted text-[13px] font-medium hover:bg-white/10 transition-colors"
                  >
                    Import
                  </button>
                </div>

                {showBulkImport && (
                  <div className="mb-4 space-y-2">
                    <textarea
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder="Paste words separated by commas or newlines..."
                      className="input w-full h-24 resize-y text-[12px]"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleBulkImport}
                        disabled={!bulkText.trim()}
                        className="px-4 py-1.5 rounded-lg bg-ghost-purple/20 text-ghost-purple text-[13px] font-medium hover:bg-ghost-purple/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Import All
                      </button>
                      <button
                        onClick={handlePasteFromClipboard}
                        className="px-4 py-1.5 rounded-lg bg-white/5 text-ghost-muted text-[13px] font-medium hover:bg-white/10 transition-colors"
                      >
                        Paste from Clipboard
                      </button>
                    </div>
                  </div>
                )}

                {dictSaved && (
                  <p className="text-[11px] text-ghost-success mb-2">Dictionary updated</p>
                )}

                {dictWords.length === 0 ? (
                  <p className="text-[11px] text-ghost-muted">
                    No custom words yet. Add proper nouns, product names, or jargon that the spell checker flags incorrectly.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {dictWords.map((word) => (
                      <span
                        key={word}
                        className="inline-flex items-center gap-1 bg-white/[0.06] border border-white/[0.08] rounded-lg px-2.5 py-1 text-[12px]"
                      >
                        {word}
                        <button
                          onClick={() => handleRemoveWord(word)}
                          className="text-ghost-muted hover:text-ghost-error ml-0.5"
                          aria-label={`Remove ${word}`}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-[11px] text-ghost-muted mt-4">
                  Words in your personal dictionary won't be flagged by the spell checker.
                  Stored in ~/.ghostedit/personal-dictionary.txt.
                </p>

                {/* Suppressed Suggestions */}
                {Object.keys(config.suppressedSuggestions ?? {}).length > 0 && (
                  <>
                    <div className="border-b border-ghost-row-border my-3" />
                    <p className="text-[13px] font-medium mb-2">Suppressed suggestions</p>
                    <p className="text-[11px] text-ghost-muted mb-2">
                      Words you have dismissed will stop being flagged after 2 dismissals. Un-suppress to see them again.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(config.suppressedSuggestions)
                        .filter(([, count]) => count >= 2)
                        .map(([word]) => (
                        <span
                          key={word}
                          className="inline-flex items-center gap-1 bg-white/[0.06] border border-white/[0.08] rounded-lg px-2.5 py-1 text-[12px]"
                        >
                          {word}
                          <button
                            onClick={() => {
                              const suppressed = { ...config.suppressedSuggestions };
                              delete suppressed[word];
                              update({ suppressedSuggestions: suppressed });
                            }}
                            className="text-ghost-muted hover:text-ghost-error ml-0.5"
                            aria-label={`Un-suppress ${word}`}
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── Statistics ── */}
            {activeSection === 'stats' && (
              <>
                {stats ? (
                  <div className="space-y-4">
                    {/* Summary cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard label="Total Corrections" value={stats.totalCorrections} />
                      <StatCard label="Success Rate" value={`${stats.successRate}%`} />
                      <StatCard label="Avg Duration" value={`${stats.avgDurationMs}ms`} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard label="Succeeded" value={stats.successfulCorrections} color="green" />
                      <StatCard label="Failed" value={stats.failedCorrections} color="red" />
                      <StatCard label="Words Processed" value={stats.totalWordsProcessed} />
                    </div>

                    {/* By provider */}
                    {Object.keys(stats.correctionsByProvider).length > 0 && (
                      <>
                        <div className="border-b border-ghost-row-border my-2" />
                        <h3 className="text-[13px] font-medium mb-2">By Provider</h3>
                        {Object.entries(stats.correctionsByProvider).map(([provider, count]) => (
                          <div key={provider} className="settings-row">
                            <span className="text-[13px] capitalize">{provider}</span>
                            <span className="text-[13px] text-ghost-muted">{count} corrections</span>
                          </div>
                        ))}
                      </>
                    )}

                    <p className="text-[11px] text-ghost-muted mt-4">
                      All data is computed locally from your correction history. Nothing is sent externally.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-ghost-muted">Loading statistics...</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Save toast (floating pill) */}
      {saved && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-ghost-success/15 border border-ghost-success/20 text-ghost-success text-xs font-medium rounded-full px-4 py-1.5 animate-content-in">
          Settings saved
        </div>
      )}
    </div>
  );
}

// ── Reusable sub-components ──

const Toggle = React.memo(function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={`relative shrink-0 w-[38px] h-[22px] rounded-full transition-colors duration-200 ${
        checked ? 'bg-ghost-purple' : 'bg-white/[0.15]'
      }`}
    >
      <span
        className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-4' : ''
        }`}
      />
    </button>
  );
});

const ToggleRow = React.memo(function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="settings-row">
      <div>
        <p className="text-[13px] font-medium">{label}</p>
        {description && <p className="text-[11px] text-ghost-muted">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
});

// ── Per-provider API configuration card ──

interface ApiProviderCardProps {
  profile: OpenAICompatiblePreset;
  config: AppConfig;
  apiKey: string;
  catalog: string[];
  loading: boolean;
  listError: string | null;
  feedback: { saved: boolean; message: string } | null;
  onApiKeyChange: (value: string) => void;
  onModelChange: (model: string) => void;
  onBaseUrlChange: (baseUrl: string) => void;
  onRefresh: () => void;
  onSaveKey: () => void;
}

function ApiProviderCard({
  profile,
  config,
  apiKey,
  catalog,
  loading,
  listError,
  feedback,
  onApiKeyChange,
  onModelChange,
  onBaseUrlChange,
  onRefresh,
  onSaveKey,
}: ApiProviderCardProps) {
  const preset = API_PRESETS[profile];
  const saved = config.apiProfiles?.[profile];
  const currentModel = saved?.model || preset.model;
  const modelOptions = getApiProfileModelOptions(profile, currentModel, catalog);
  const configured = isApiProfileConfigured(config, profile, apiKey.trim().length > 0);
  const isActive = config.activeApiProfile === profile;
  // Only the Custom preset needs a manual endpoint — every other preset has a built-in base URL.
  const showBaseUrl = profile === 'custom';
  const baseUrl = saved?.baseUrl ?? preset.baseUrl;

  return (
    <div className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3" data-testid={`api-provider-${profile}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium">{preset.displayName}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${configured ? 'bg-ghost-success/15 text-ghost-success' : 'bg-white/[0.06] text-ghost-muted'}`}>
          {configured ? 'Configured' : 'Not configured'}
          {isActive ? ' · Active' : ''}
        </span>
      </div>

      {showBaseUrl && (
        <div className="mb-2 flex items-center gap-2">
          <label htmlFor={`api-base-url-${profile}`} className="w-16 shrink-0 text-[11px] text-ghost-muted">Base URL</label>
          <input
            id={`api-base-url-${profile}`}
            aria-label={`Base URL for ${preset.displayName}`}
            type="url"
            value={baseUrl}
            placeholder="https://api.example.com/v1"
            onChange={(e) => onBaseUrlChange(e.target.value)}
            className="input min-w-0 flex-1"
          />
        </div>
      )}

      <div className="mb-2 flex items-center gap-2">
        <label htmlFor={`api-model-${profile}`} className="w-16 shrink-0 text-[11px] text-ghost-muted">Model</label>
        <select
          id={`api-model-${profile}`}
          aria-label={`Model for ${preset.displayName}`}
          value={currentModel}
          onChange={(e) => onModelChange(e.target.value)}
          className="input min-w-0 flex-1"
        >
          {!currentModel && <option value="">No model selected</option>}
          {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
        </select>
        <button
          onClick={onRefresh}
          disabled={loading}
          aria-label={`Refresh models for ${preset.displayName}`}
          className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/15 disabled:cursor-wait disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {listError && <p role="alert" className="mb-2 text-[11px] text-ghost-error">{listError}</p>}

      <div className="flex items-center gap-2">
        <label htmlFor={`api-key-${profile}`} className="w-16 shrink-0 text-[11px] text-ghost-muted">API key</label>
        <input
          id={`api-key-${profile}`}
          aria-label={`API key for ${preset.displayName}`}
          type="password"
          value={apiKey}
          placeholder={preset.requiresApiKey ? 'Required by hosted providers' : 'Optional for this provider'}
          autoComplete="new-password"
          onChange={(e) => onApiKeyChange(e.target.value)}
          className="input min-w-0 flex-1"
        />
        <button
          onClick={onSaveKey}
          className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/15"
        >
          Save key
        </button>
      </div>
      {feedback && (
        <p role={feedback.saved ? 'status' : 'alert'} className={`mt-1.5 text-[11px] ${feedback.saved ? 'text-ghost-success' : 'text-ghost-error'}`}>
          {feedback.message}
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: 'green' | 'red' }) {
  const textColor = color === 'green' ? 'text-ghost-success' : color === 'red' ? 'text-ghost-error' : 'text-white/90';
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-3 text-center">
      <p className={`text-lg font-semibold ${textColor}`}>{value}</p>
      <p className="text-[11px] text-ghost-muted mt-0.5">{label}</p>
    </div>
  );
}

// ── Icons (16x16 inline SVGs) ──

function GearIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={8} cy={8} r={2.5} />
      <path d="M6.8 1.5h2.4l.3 1.7a5 5 0 0 1 1.2.7l1.6-.6.8 1.4-1.3 1.1a5 5 0 0 1 0 1.4l1.3 1.1-.8 1.4-1.6-.6a5 5 0 0 1-1.2.7l-.3 1.7H6.8l-.3-1.7a5 5 0 0 1-1.2-.7l-1.6.6-.8-1.4 1.3-1.1a5 5 0 0 1 0-1.4L3.9 4.7l.8-1.4 1.6.6a5 5 0 0 1 1.2-.7l.3-1.7Z" />
    </svg>
  );
}

function ChipIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x={4} y={4} width={8} height={8} rx={1.5} />
      <path d="M6.5 1v3M9.5 1v3M6.5 12v3M9.5 12v3M1 6.5h3M1 9.5h3M12 6.5h3M12 9.5h3" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5a3.5 3.5 0 0 1-.5-6.96A5 5 0 0 1 13 7a3 3 0 0 1 .5 5.96" />
      <path d="M4 12.5h9.5" />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x={1} y={3.5} width={14} height={9} rx={2} />
      <path d="M4 6.5h1M7.5 6.5h1M11 6.5h1M5 9.5h6" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4h4M9 4h6M1 8h8M13 8h2M1 12h2M7 12h8" />
      <circle cx={7} cy={4} r={2} />
      <circle cx={11} cy={8} r={2} />
      <circle cx={5} cy={12} r={2} />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h10M8 3v10M5 13h6" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2.5h4.5c1.1 0 1.5.5 1.5 1v10c0-.5-.4-1-1.5-1H2z" />
      <path d="M14 2.5H9.5c-1.1 0-1.5.5-1.5 1v10c0-.5.4-1 1.5-1H14z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 14V8M6 14V4M10 14V6M14 14V2" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" />
      <circle cx={8} cy={8} r={2} />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <path d="M2 6h8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <path d="M2 2l8 8M10 2l-8 8" />
    </svg>
  );
}
