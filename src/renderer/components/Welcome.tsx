import React, { useEffect, useState } from 'react';
import type { AppConfig, ProviderName, BonsaiModelSize, OpenAICompatiblePreset } from '../../shared/types';
import { ALL_PROVIDERS, API_PRESETS, BONSAI_MODELS } from '../../shared/constants';

interface WelcomeProps {
  config: AppConfig;
  onComplete: (updates: Partial<AppConfig>, installLocalModel: boolean) => void;
  onConfigUpdate: (updates: Partial<AppConfig>) => Promise<void>;
}

const SAMPLE_TEXT = "Ths is a tset of GhostEdit's corection engine.";

function presetForProvider(provider: ProviderName, currentPreset: OpenAICompatiblePreset): OpenAICompatiblePreset {
  if (provider === 'claude' || provider === 'codex' || provider === 'gemini') return provider;
  if (provider === 'openai-compatible' && ['claude', 'codex', 'gemini'].includes(currentPreset)) return 'openai';
  return currentPreset;
}

const STEPS = [
  {
    title: 'GhostEdit lives in your menu bar',
    description:
      'Look for the "G" icon in your menu bar at the top of your screen. Right-click it to access Settings, History, and more.',
  },
  {
    title: 'Select text anywhere, then press your hotkey',
    description: null,
  },
  {
    title: 'Choose your AI provider',
    description: null,
  },
  {
    title: 'Try it now',
    description: null,
  },
];

export default function Welcome({ config, onComplete, onConfigUpdate }: WelcomeProps) {
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<ProviderName>(config.provider);
  const [selectedBonsaiSize, setSelectedBonsaiSize] = useState<BonsaiModelSize>(config.bonsaiModelSize ?? '1.7b');
  const [apiPreset, setApiPreset] = useState<OpenAICompatiblePreset>(presetForProvider(config.provider, config.apiPreset));
  const [apiBaseUrl, setApiBaseUrl] = useState(config.apiBaseUrl);
  const [apiModel, setApiModel] = useState(config.apiModel);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyLoading, setApiKeyLoading] = useState(true);
  const [apiSetupError, setApiSetupError] = useState<string | null>(null);

  // "Try it now" state
  const [tryText, setTryText] = useState(SAMPLE_TEXT);
  const [correcting, setCorrecting] = useState(false);
  const [corrected, setCorrected] = useState(false);

  const apiSetupStep = selectedProvider !== 'local' && step === 3;
  const tryStep = selectedProvider === 'local' ? 3 : 4;
  const isLast = step === tryStep;
  const visibleSteps = selectedProvider !== 'local'
    ? [...STEPS.slice(0, 3), { title: 'Set up your API provider', description: null }, STEPS[3]]
    : STEPS;

  useEffect(() => {
    window.ghostedit.getApiKey()
      .then(setApiKey)
      .catch((err: unknown) => setApiSetupError(err instanceof Error ? err.message : String(err)))
      .finally(() => setApiKeyLoading(false));
  }, []);

  const handleApiSetupNext = async () => {
    const baseUrl = apiBaseUrl.trim();
    const model = apiModel.trim();
    if (!baseUrl || !model) {
      setApiSetupError('Enter both a base URL and a model.');
      return;
    }

    setApiSetupError(null);
    const keyResult = await window.ghostedit.saveApiKey(apiKey.trim());
    if (!keyResult.success) {
      setApiSetupError(keyResult.error || 'Could not save API key.');
      return;
    }

    const updates: Partial<AppConfig> = {
      provider: 'openai-compatible',
      apiPreset,
      apiBaseUrl: baseUrl,
      apiModel: model,
      model,
    };
    try {
      await onConfigUpdate(updates);
      setStep(4);
    } catch (err) {
      setApiSetupError(err instanceof Error ? err.message : 'Could not save API settings.');
    }
  };

  const handleNext = async () => {
    if (apiSetupStep) {
      await handleApiSetupNext();
      return;
    }
    if (isLast) {
      if (selectedProvider === 'local') {
        onComplete({
          firstRunComplete: true,
          provider: 'local',
          bonsaiModelSize: selectedBonsaiSize,
          model: `bonsai-${selectedBonsaiSize}`,
        }, true);
      } else {
        onComplete({
          firstRunComplete: true,
          provider: 'openai-compatible',
          apiPreset,
          apiBaseUrl: apiBaseUrl.trim(),
          apiModel: apiModel.trim(),
          model: apiModel.trim(),
        }, false);
      }
    } else {
      setStep(step + 1);
    }
  };

  const handleTryCorrection = async () => {
    if (correcting) return;
    setCorrecting(true);
    setCorrected(false);
    try {
      const result = await window.ghostedit.correctInline(tryText);
      if (result.success && result.text) {
        setTryText(result.text);
        setCorrected(true);
      }
    } catch {
      // Silently fail in onboarding
    } finally {
      setCorrecting(false);
    }
  };

  const formatHotkey = (acc: string) =>
    acc
      .replace('CommandOrControl', process.platform === 'darwin' ? '\u2318' : 'Ctrl')
      .replace('Shift', process.platform === 'darwin' ? '\u21E7' : 'Shift')
      .replace('Alt', process.platform === 'darwin' ? '\u2325' : 'Alt')
      .replace(/\+/g, process.platform === 'darwin' ? ' ' : '+');

  return (
    <div className="flex flex-col h-screen bg-ghost-bg text-ghost-text">
      {/* Title bar drag region */}
      <div className="drag-region h-10 shrink-0 pl-[72px]" />

      <div className="flex-1 min-h-0 overflow-y-auto px-8">
        <div className="min-h-full flex flex-col items-center justify-center py-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {visibleSteps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? 'bg-ghost-purple' : i < step ? 'bg-ghost-purple/40' : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <h2 className="text-xl font-semibold text-center mb-3">
          {apiSetupStep ? `Set up ${API_PRESETS[apiPreset].displayName}` : visibleSteps[step].title}
        </h2>

        {step === 0 && (
          <p className="text-sm text-ghost-muted text-center max-w-sm">
            {STEPS[0].description}
          </p>
        )}

        {step === 1 && (
          <div className="text-center space-y-3">
            <div>
              <p className="text-xs text-ghost-muted mb-1">Local Model</p>
              <div className="inline-block px-4 py-2 rounded-lg bg-white/10 text-lg font-mono">
                {formatHotkey(config.localHotkeyAccelerator)}
              </div>
            </div>
            <div>
              <p className="text-xs text-ghost-muted mb-1">CLI Provider</p>
              <div className="inline-block px-4 py-2 rounded-lg bg-white/10 text-lg font-mono">
                {formatHotkey(config.cliHotkeyAccelerator)}
              </div>
            </div>
            <p className="text-sm text-ghost-muted max-w-sm">
              Select any text in any app, press a hotkey, and GhostEdit will correct it and paste the result back.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="w-full max-w-xs space-y-2">
            {Object.values(ALL_PROVIDERS).map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  setSelectedProvider(p.name);
                  const preset = presetForProvider(p.name, apiPreset);
                  setApiPreset(preset);
                  setApiBaseUrl(API_PRESETS[preset].baseUrl);
                  setApiModel(API_PRESETS[preset].model);
                }}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors ${
                  selectedProvider === p.name
                    ? 'bg-ghost-purple/20 text-ghost-purple ring-1 ring-ghost-purple/50'
                    : 'bg-white/5 text-ghost-muted hover:bg-white/10'
                }`}
              >
                <span className="font-medium">{p.displayName}</span>
                {p.name === 'local' && (
                  <span className="block text-xs text-ghost-muted mt-0.5">Works offline, no API key needed</span>
                )}
              </button>
            ))}
            {selectedProvider === 'local' && (
              <div className="pt-2">
                <p className="text-xs font-medium text-ghost-text mb-2">Choose a local model</p>
                <div className="grid grid-cols-3 gap-2">
                  {BONSAI_MODELS.map((model) => (
                    <button
                      key={model.size}
                      type="button"
                      aria-pressed={selectedBonsaiSize === model.size}
                      onClick={() => setSelectedBonsaiSize(model.size)}
                      className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                        selectedBonsaiSize === model.size
                          ? 'border-ghost-purple/60 bg-ghost-purple/15 text-ghost-purple'
                          : 'border-white/10 bg-white/[0.03] text-ghost-muted hover:bg-white/[0.07]'
                      }`}
                    >
                      <span className="block text-[12px] font-medium">{model.displayName.replace(' (Default)', '')}</span>
                      <span className="mt-1 block text-[10px] opacity-75">~{model.sizeMB} MB</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-ghost-muted">The selected model will be downloaded during setup.</p>
              </div>
            )}
            <p className="text-xs text-ghost-muted text-center pt-1">
              You can change this later in Settings.
            </p>
          </div>
        )}

        {apiSetupStep && (
          <div className="w-full max-w-sm space-y-3">
            <div>
              <label htmlFor="welcome-api-preset" className="mb-1 block text-xs font-medium">
                {selectedProvider === 'openai-compatible' ? 'Provider preset' : 'API provider'}
              </label>
              {selectedProvider === 'openai-compatible' ? (
                <select
                  id="welcome-api-preset"
                  value={apiPreset}
                  onChange={(event) => {
                    const preset = event.target.value as OpenAICompatiblePreset;
                    setApiPreset(preset);
                    setApiBaseUrl(API_PRESETS[preset].baseUrl);
                    setApiModel(API_PRESETS[preset].model);
                  }}
                  className="input"
                >
                  {Object.entries(API_PRESETS)
                    .filter(([value]) => !['claude', 'codex', 'gemini'].includes(value))
                    .map(([value, preset]) => (
                      <option key={value} value={value}>{preset.displayName}</option>
                    ))}
                </select>
              ) : (
                <p className="input flex items-center">{API_PRESETS[apiPreset].displayName}</p>
              )}
            </div>
            <div>
              <label htmlFor="welcome-api-base-url" className="mb-1 block text-xs font-medium">Base URL</label>
              <input
                id="welcome-api-base-url"
                type="url"
                value={apiBaseUrl}
                onChange={(event) => setApiBaseUrl(event.target.value)}
                placeholder="https://api.example.com/v1"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="welcome-api-key" className="mb-1 block text-xs font-medium">API key</label>
              <input
                id="welcome-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Not required by every provider"
                autoComplete="new-password"
                className="input"
              />
              <p className="mt-1 text-[11px] text-ghost-muted">Stored encrypted. Leave blank only if your API host does not require a key.</p>
            </div>
            <div>
              <label htmlFor="welcome-api-model" className="mb-1 block text-xs font-medium">Model</label>
              <input
                id="welcome-api-model"
                type="text"
                value={apiModel}
                onChange={(event) => setApiModel(event.target.value)}
                placeholder="Model identifier"
                className="input"
              />
            </div>
            {apiSetupError && <p role="alert" className="text-xs text-ghost-error">{apiSetupError}</p>}
          </div>
        )}

        {step === tryStep && (
          <div className="w-full max-w-md space-y-4">
            <p className="text-sm text-ghost-muted text-center">
              Edit the text below or use the sample, then click "Fix it" to see GhostEdit in action.
            </p>
            <textarea
              value={tryText}
              onChange={(e) => { setTryText(e.target.value); setCorrected(false); }}
              className={`input w-full h-28 resize-none text-[14px] transition-colors ${
                corrected ? 'border-ghost-success/50 text-ghost-success' : ''
              }`}
              disabled={correcting}
            />
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleTryCorrection}
                disabled={correcting || !tryText.trim()}
                className="px-5 py-2 rounded-lg text-sm font-medium bg-ghost-accent text-[#282a36] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {correcting ? 'Correcting...' : 'Fix it'}
              </button>
              {corrected && !correcting && (
                <button
                  onClick={() => { setTryText(SAMPLE_TEXT); setCorrected(false); }}
                  className="px-4 py-2 rounded-lg text-sm text-ghost-muted hover:text-white hover:bg-white/10 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
            {corrected && (
              <p className="text-center text-sm text-ghost-success animate-content-in">
                It works! Now try it in any app with your hotkey.
              </p>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between px-8 py-6 shrink-0">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="px-4 py-2 rounded text-sm text-ghost-muted hover:text-white disabled:opacity-0 transition-all"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={apiSetupStep && apiKeyLoading}
          className="px-6 py-2 rounded-lg text-sm font-medium bg-ghost-accent text-[#282a36] hover:brightness-110 transition-colors"
        >
          {apiSetupStep ? 'Save & Continue' : isLast ? 'Get Started' : 'Next'}
        </button>
      </div>
    </div>
  );
}
