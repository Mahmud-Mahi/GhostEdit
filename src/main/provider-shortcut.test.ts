import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../shared/constants';
import { getProviderShortcutTarget } from './provider-shortcut';

describe('getProviderShortcutTarget', () => {
  it('uses the configured API and model when OpenAI-compatible is selected', () => {
    expect(getProviderShortcutTarget({
      ...DEFAULT_CONFIG,
      provider: 'openai-compatible',
      apiModel: 'api-model',
      apiProfiles: {
        ...DEFAULT_CONFIG.apiProfiles,
        openai: { baseUrl: DEFAULT_CONFIG.apiBaseUrl, model: 'api-model' },
      },
      cliProvider: 'claude',
      cliModel: 'sonnet',
    })).toEqual({ provider: 'openai-compatible', model: 'api-model' });
  });

  it('uses the active API profile instead of the legacy shared model field', () => {
    expect(getProviderShortcutTarget({
      ...DEFAULT_CONFIG,
      provider: 'openai-compatible',
      activeApiProfile: 'grok',
      apiModel: 'legacy-model',
      apiProfiles: {
        ...DEFAULT_CONFIG.apiProfiles,
        grok: { baseUrl: 'https://api.x.ai/v1', model: 'grok-3' },
      },
    })).toEqual({ provider: 'openai-compatible', model: 'grok-3' });
  });

  it('uses the configured CLI provider and model otherwise', () => {
    expect(getProviderShortcutTarget({
      ...DEFAULT_CONFIG,
      provider: 'gemini',
      cliProvider: 'codex',
      cliModel: 'o3',
    })).toEqual({ provider: 'codex', model: 'o3' });
  });

  it('uses the built-in model for Ctrl+E when local is selected', () => {
    expect(getProviderShortcutTarget({
      ...DEFAULT_CONFIG,
      provider: 'local',
      bonsaiModelSize: '4b',
      cliProvider: 'gemini',
      cliModel: 'gemini-2.5-flash',
    })).toEqual({ provider: 'local', model: 'bonsai-4b' });
  });
});