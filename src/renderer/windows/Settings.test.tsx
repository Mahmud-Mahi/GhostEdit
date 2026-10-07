// @vitest-environment jsdom
import '../test-setup';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import Settings from './Settings';
import { DEFAULT_CONFIG } from '../../shared/constants';

// Mock HotkeyInput
vi.mock('../components/HotkeyInput', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="hotkey-input" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

// Mock Welcome
vi.mock('../components/Welcome', () => ({
  default: ({ onComplete }: { onComplete: (u: any, installLocalModel: boolean) => void }) => (
    <div data-testid="welcome">
      <button onClick={() => onComplete({ firstRunComplete: true, provider: 'local' }, true)}>Complete Local</button>
      <button onClick={() => onComplete({ firstRunComplete: true, provider: 'local', bonsaiModelSize: '8b', model: 'bonsai-8b' }, true)}>Complete Local 8B</button>
      <button onClick={() => onComplete({ firstRunComplete: true, provider: 'claude' }, false)}>Complete API</button>
    </div>
  ),
}));

function mockPlatform(platform: string) {
  (window.ghostedit as any).platform = platform;
}

/** Wait for the settings UI to load by checking for the sidebar nav */
async function waitForSettingsLoaded() {
  await waitFor(() => {
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
}

/** Get the sidebar nav element */
function getSidebar() {
  return screen.getByRole('navigation');
}

beforeEach(() => {
  vi.clearAllMocks();
  window.ghostedit.getConfig = vi.fn().mockResolvedValue({
    ...DEFAULT_CONFIG,
    firstRunComplete: true,
    settingsMode: 'advanced',
  }) as any;
  window.ghostedit.getCLIStatus = vi.fn().mockResolvedValue({}) as any;
  window.ghostedit.getLocalModelStatus = vi.fn().mockResolvedValue({
    ready: false,
    activeVariant: 'fp32',
    variants: [],
  }) as any;
  window.ghostedit.getInferenceDevice = vi.fn().mockResolvedValue(null) as any;
  window.ghostedit.getBonsaiStatus = vi.fn().mockResolvedValue({
    models: [],
    server: { running: false, port: null, healthy: false, modelSize: null },
  }) as any;
  window.ghostedit.downloadBonsaiModel = vi.fn().mockResolvedValue({ success: true }) as any;
  window.ghostedit.onDownloadBonsaiProgress = vi.fn().mockReturnValue(() => {}) as any;
  window.ghostedit.onDownloadBonsaiError = vi.fn().mockReturnValue(() => {}) as any;
  window.ghostedit.getStartupSetupStatus = vi.fn().mockResolvedValue({
    active: false,
    stage: 'ready',
    progress: 100,
    message: 'Setup complete',
  }) as any;
  window.ghostedit.onStartupSetupStatus = vi.fn().mockReturnValue(() => {}) as any;
  window.ghostedit.saveConfig = vi.fn().mockResolvedValue({ success: true }) as any;
  window.ghostedit.onDownloadVariantProgress = vi.fn().mockReturnValue(() => {}) as any;
  window.ghostedit.onDownloadVariantError = vi.fn().mockReturnValue(() => {}) as any;
  window.ghostedit.getSystemPrompt = vi.fn().mockResolvedValue({ prompt: '', defaultPrompt: '' }) as any;
  window.ghostedit.saveSystemPrompt = vi.fn().mockResolvedValue({ success: true }) as any;
  window.ghostedit.getPersonalDictionary = vi.fn().mockResolvedValue([]) as any;
  window.ghostedit.savePersonalDictionary = vi.fn().mockResolvedValue({ success: true }) as any;
  window.ghostedit.getUsageStats = vi.fn().mockResolvedValue({ totalCorrections: 0, successfulCorrections: 0, failedCorrections: 0, successRate: 0, totalDurationMs: 0, avgDurationMs: 0, totalWordsProcessed: 0, correctionsByProvider: {}, correctionsByDate: {} }) as any;
  window.ghostedit.getErrorLog = vi.fn().mockResolvedValue([]) as any;
  window.ghostedit.exportHistory = vi.fn().mockResolvedValue({ success: true }) as any;
  (window.ghostedit as any).platform = 'darwin';
  (window.ghostedit as any).windowControls = { close: vi.fn(), minimize: vi.fn() };
});

describe('Settings component', () => {
  it('renders Welcome after first-run setup completes', async () => {
    window.ghostedit.getConfig = vi.fn().mockResolvedValue({
      ...DEFAULT_CONFIG,
      firstRunComplete: false,
    }) as any;

    render(<Settings />);
    expect(await screen.findByTestId('welcome')).toBeInTheDocument();
  });

  it('starts local model setup only when Local is selected during onboarding', async () => {
    window.ghostedit.getConfig = vi.fn().mockResolvedValue({
      ...DEFAULT_CONFIG,
      firstRunComplete: false,
    }) as any;
    render(<Settings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Complete Local' }));

    await waitFor(() => {
      expect(window.ghostedit.startLocalModelSetup).toHaveBeenCalledTimes(1);
    });
    expect(window.ghostedit.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ provider: 'local' }));
  });

  it('saves the onboarding model size before downloading that Bonsai model', async () => {
    window.ghostedit.getConfig = vi.fn().mockResolvedValue({
      ...DEFAULT_CONFIG,
      firstRunComplete: false,
    }) as any;
    render(<Settings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Complete Local 8B' }));

    await waitFor(() => {
      expect(window.ghostedit.saveConfig).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'local',
        bonsaiModelSize: '8b',
        model: 'bonsai-8b',
      }));
      expect(window.ghostedit.startLocalModelSetup).toHaveBeenCalledTimes(1);
    });
  });

  it('does not start local model setup when an API provider is selected during onboarding', async () => {
    window.ghostedit.getConfig = vi.fn().mockResolvedValue({
      ...DEFAULT_CONFIG,
      firstRunComplete: false,
    }) as any;
    render(<Settings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Complete API' }));

    await waitFor(() => {
      expect(window.ghostedit.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ provider: 'claude' }));
    });
    expect(window.ghostedit.startLocalModelSetup).not.toHaveBeenCalled();
  });

  it('shows setup progress before Welcome on first run', async () => {
    window.ghostedit.getConfig = vi.fn().mockResolvedValue({
      ...DEFAULT_CONFIG,
      firstRunComplete: false,
    }) as any;
    window.ghostedit.getStartupSetupStatus = vi.fn().mockResolvedValue({
      active: true,
      stage: 'model',
      progress: 42,
      message: 'Downloading the Bonsai model',
    }) as any;

    render(<Settings />);
    expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByText('Downloading the Bonsai model')).toBeInTheDocument();
    expect(screen.queryByTestId('welcome')).not.toBeInTheDocument();
  });

  // ── Sidebar Navigation ──

  it('renders the Local Model and Providers sidebar sections without a separate API section', async () => {
    render(<Settings />);
    await waitForSettingsLoaded();

    const nav = getSidebar();
    expect(within(nav).getByText('General')).toBeInTheDocument();
    expect(within(nav).getByText('Local Model')).toBeInTheDocument();
    expect(within(nav).getByText('Providers')).toBeInTheDocument();
    expect(within(nav).queryByText('API')).not.toBeInTheDocument();
    expect(within(nav).getByText('Hotkeys')).toBeInTheDocument();
    expect(within(nav).getByText('Behavior')).toBeInTheDocument();
    expect(within(nav).getByText('Prompt')).toBeInTheDocument();
    expect(within(nav).getByText('Dictionary')).toBeInTheDocument();
    expect(within(nav).getByText('Statistics')).toBeInTheDocument();
  });

  it('supports simple and advanced settings sidebar modes', async () => {
    window.ghostedit.getConfig = vi.fn().mockResolvedValue({
      ...DEFAULT_CONFIG,
      firstRunComplete: true,
      settingsMode: 'simple',
    }) as any;

    render(<Settings />);
    await waitForSettingsLoaded();

    const nav = getSidebar();
    expect(within(nav).queryByText('Local Model')).not.toBeInTheDocument();
    expect(within(nav).queryByText('Providers')).not.toBeInTheDocument();
    expect(within(nav).queryByText('Statistics')).not.toBeInTheDocument();
    const showAllButton = within(nav).getByText('Show all settings');
    expect(showAllButton).toBeInTheDocument();
    expect(within(nav).queryByText('Show fewer settings')).not.toBeInTheDocument();

    fireEvent.click(showAllButton);
    await waitFor(() => {
      expect(within(nav).getByText('Local Model')).toBeInTheDocument();
      expect(within(nav).getByText('Providers')).toBeInTheDocument();
      expect(within(nav).getByText('Statistics')).toBeInTheDocument();
      expect(within(nav).getByText('Show fewer settings')).toBeInTheDocument();
    });
    expect(window.ghostedit.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ settingsMode: 'advanced' }));
  });

  it('General section is active by default', async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('Language')).toBeInTheDocument();
    });
    expect(screen.getByText('Tone Preset')).toBeInTheDocument();
    expect(screen.getByText('Timeout')).toBeInTheDocument();
    expect(screen.getByLabelText('Default correction model')).toHaveValue('local');
  });

  it('shows a larger resizable system prompt editor', async () => {
    render(<Settings />);
    await waitForSettingsLoaded();
    fireEvent.click(within(getSidebar()).getByText('Prompt'));

    const promptBox = await screen.findByLabelText('System prompt');
    expect(promptBox.className).toContain('h-[55vh]');
    expect(promptBox.className).toContain('min-h-[300px]');
  });

  it('downloads Bonsai models into the app model store and shows progress', async () => {
    const unavailableModels = [
      { size: '1.7b', displayName: 'Bonsai 1.7B (Default)', sizeMB: 248, available: true, bundled: false },
      { size: '4b', displayName: 'Bonsai 4B', sizeMB: 572, available: false, bundled: false },
      { size: '8b', displayName: 'Bonsai 8B', sizeMB: 1150, available: false, bundled: false },
    ];
    const downloadedModels = unavailableModels.map((model) => model.size === '4b' ? { ...model, available: true } : model);
    window.ghostedit.getBonsaiStatus = vi.fn()
      .mockResolvedValueOnce({
        models: unavailableModels,
        server: { running: false, port: null, healthy: false, modelSize: null },
      })
      .mockResolvedValueOnce({
        models: downloadedModels,
        server: { running: false, port: null, healthy: false, modelSize: null },
      })
      .mockResolvedValue({
        models: downloadedModels,
        server: { running: false, port: null, healthy: false, modelSize: null },
      }) as any;
    let onProgress: ((data: { size: '4b' | '8b'; progress: number }) => void) | undefined;
    window.ghostedit.onDownloadBonsaiProgress = vi.fn((callback: typeof onProgress) => {
      onProgress = callback;
      return () => {};
    }) as any;
    let finishDownload: ((result: { success: boolean }) => void) | undefined;
    window.ghostedit.downloadBonsaiModel = vi.fn(() => new Promise((resolve) => {
      finishDownload = resolve;
    })) as any;
    window.ghostedit.onDownloadBonsaiError = vi.fn().mockReturnValue(() => {}) as any;

    render(<Settings />);
    await waitForSettingsLoaded();
    fireEvent.click(within(getSidebar()).getByText('Local Model'));

    const downloadButton = (await screen.findAllByRole('button', { name: 'Download' }))[0];
    fireEvent.click(downloadButton);
    await waitFor(() => expect(window.ghostedit.downloadBonsaiModel).toHaveBeenCalledWith('4b'));
    act(() => onProgress?.({ size: '4b', progress: 42 }));
    expect(await screen.findByText('Downloading 42%')).toBeInTheDocument();

    await act(async () => finishDownload?.({ success: true }));
    const bonsaiFourBRow = screen.getByText('~572 MB').closest('.settings-row');
    if (!(bonsaiFourBRow instanceof HTMLElement)) throw new Error('Bonsai 4B model row was not rendered');
    expect(await within(bonsaiFourBRow).findByText('Downloaded')).toBeInTheDocument();
    expect(window.ghostedit.getBonsaiStatus).toHaveBeenCalledTimes(2);
  });

  it('selects API as the default correction model and saves its route', async () => {
    render(<Settings />);
    const select = await screen.findByLabelText('Default correction model');

    fireEvent.change(select, { target: { value: 'openai-compatible' } });

    await waitFor(() => {
      expect(window.ghostedit.saveConfig).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'openai-compatible',
        model: DEFAULT_CONFIG.apiModel,
      }));
    });
  });

  it('selects the configured CLI model as the default correction route', async () => {
    render(<Settings />);
    const select = await screen.findByLabelText('Default correction model');

    fireEvent.change(select, { target: { value: DEFAULT_CONFIG.cliProvider } });

    await waitFor(() => {
      expect(window.ghostedit.saveConfig).toHaveBeenCalledWith(expect.objectContaining({
        provider: DEFAULT_CONFIG.cliProvider,
        model: DEFAULT_CONFIG.cliModel,
      }));
    });
  });

  it('clicking a sidebar item switches the content area', async () => {
    render(<Settings />);
    await waitForSettingsLoaded();

    const nav = getSidebar();
    fireEvent.click(within(nav).getByText('Behavior'));

    await waitFor(() => {
      expect(screen.getByText('Launch at login')).toBeInTheDocument();
    });
  });

  it('active sidebar item has highlighted styling', async () => {
    render(<Settings />);
    await waitForSettingsLoaded();

    const nav = getSidebar();
    const generalBtn = within(nav).getByText('General').closest('button');
    expect(generalBtn?.className).toContain('bg-white/10');
  });

  // ── General Section ──

  it('shows Language select with language options', async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('Language')).toBeInTheDocument();
    });

    const languageRow = screen.getByText('Language').closest('.settings-row');
    const select = languageRow?.querySelector('select');
    expect(select).toBeTruthy();
  });

  it('shows Tone Preset select with 5 options', async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('Tone Preset')).toBeInTheDocument();
    });

    const toneRow = screen.getByText('Tone Preset').closest('.settings-row');
    const select = toneRow?.querySelector('select');
    expect(select).toBeTruthy();
    const options = select!.querySelectorAll('option');
    expect(options).toHaveLength(5);
  });

  it('changing language calls saveConfig', async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('Language')).toBeInTheDocument();
    });

    const languageRow = screen.getByText('Language').closest('.settings-row');
    const select = languageRow?.querySelector('select');
    if (select) {
      fireEvent.change(select, { target: { value: 'es' } });
    }

    await waitFor(() => {
      expect(window.ghostedit.saveConfig).toHaveBeenCalled();
    });
  });

  // ── Models Section ──

  it('Local Model section shows Bonsai without a T5 option or recommendation label', async () => {
    window.ghostedit.getBonsaiStatus = vi.fn().mockResolvedValue({
      models: [
        { size: '1.7b', displayName: 'Bonsai 1.7B (Default)', sizeMB: 248, available: true, bundled: true },
        { size: '4b', displayName: 'Bonsai 4B', sizeMB: 572, available: false, bundled: false },
      ],
      server: { running: false, port: null, healthy: false, modelSize: null },
    }) as any;

    render(<Settings />);
    await waitForSettingsLoaded();

    const nav = getSidebar();
    fireEvent.click(within(nav).getByText('Local Model'));

    await waitFor(() => {
      expect(screen.getByText('Correction Engine')).toBeInTheDocument();
    });
    expect(screen.getByText('Bonsai', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText(/T5|Recommended/)).not.toBeInTheDocument();
    expect(screen.getByText('Bundled')).toBeInTheDocument();
  });

  it('migrates a saved T5 local engine to Bonsai when settings load', async () => {
    window.ghostedit.getConfig = vi.fn().mockResolvedValue({
      ...DEFAULT_CONFIG,
      firstRunComplete: true,
      settingsMode: 'advanced',
      localModelEngine: 't5',
    }) as any;

    render(<Settings />);
    await waitForSettingsLoaded();

    await waitFor(() => {
      expect(window.ghostedit.saveConfig).toHaveBeenCalledWith(expect.objectContaining({
        localModelEngine: 'bonsai',
        model: 'bonsai-1.7b',
      }));
    });
  });

  it('Local Model section can download an unavailable Bonsai model in-app', async () => {
    window.ghostedit.getBonsaiStatus = vi.fn().mockResolvedValue({
      models: [
        { size: '1.7b', displayName: 'Bonsai 1.7B (Default)', sizeMB: 248, available: true, bundled: true },
        { size: '4b', displayName: 'Bonsai 4B', sizeMB: 572, available: false, bundled: false },
      ],
      server: { running: false, port: null, healthy: false, modelSize: null },
    }) as any;
    render(<Settings />);
    await waitForSettingsLoaded();
    fireEvent.click(within(getSidebar()).getByText('Local Model'));
    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download Local Model' })).not.toBeInTheDocument();
  });

  it('shows a Download action for unavailable Bonsai 1.7B', async () => {
    window.ghostedit.getBonsaiStatus = vi.fn()
      .mockResolvedValueOnce({
        models: [
          { size: '1.7b', displayName: 'Bonsai 1.7B (Default)', sizeMB: 248, available: false, bundled: false },
        ],
        server: { running: false, port: null, healthy: false, modelSize: null },
      })
      .mockResolvedValue({
        models: [
          { size: '1.7b', displayName: 'Bonsai 1.7B (Default)', sizeMB: 248, available: true, bundled: false },
        ],
        server: { running: false, port: null, healthy: false, modelSize: null },
      }) as any;

    render(<Settings />);
    await waitForSettingsLoaded();
    fireEvent.click(within(getSidebar()).getByText('Local Model'));
    const bonsaiRow = screen.getByText('Bonsai 1.7B (Default)').closest('.settings-row');
    if (!(bonsaiRow instanceof HTMLElement)) throw new Error('Bonsai 1.7B model row was not rendered');

    fireEvent.click(within(bonsaiRow).getByRole('button', { name: 'Download' }));

    await waitFor(() => expect(window.ghostedit.downloadBonsaiModel).toHaveBeenCalledWith('1.7b'));
  });

  it('Local Model section retains model availability information', async () => {
    window.ghostedit.getBonsaiStatus = vi.fn().mockResolvedValue({
      models: [
        { size: '1.7b', displayName: 'Bonsai 1.7B (Default)', sizeMB: 248, available: true, bundled: true },
        { size: '4b', displayName: 'Bonsai 4B', sizeMB: 572, available: false, bundled: false },
      ],
      server: { running: false, port: null, healthy: false, modelSize: null },
    }) as any;

    render(<Settings />);
    await waitForSettingsLoaded();

    const nav = getSidebar();
    fireEvent.click(within(nav).getByText('Local Model'));

    await waitFor(() => {
      expect(screen.getByText('Unavailable')).toBeInTheDocument();
    });
  });

  // ── Providers Section ──

  it('Providers section shows CLI provider selector with 3 providers', async () => {
    render(<Settings />);
    await waitForSettingsLoaded();

    const nav = getSidebar();
    fireEvent.click(within(nav).getByText('Providers'));

    await waitFor(() => {
      // "Provider" appears as row label in the content area
      expect(screen.getByText('Provider')).toBeInTheDocument();
    });

    const providerRow = screen.getByText('Provider').closest('.settings-row');
    const select = providerRow?.querySelector('select');
    expect(select).toBeTruthy();
    const options = select!.querySelectorAll('option');
    expect(options).toHaveLength(3);
  });

  it('Providers section lists compatible API presets and lets the key be saved', async () => {
    render(<Settings />);
    await waitForSettingsLoaded();
    fireEvent.click(within(getSidebar()).getByText('Providers'));

    await screen.findByText('OpenAI-compatible API');
    const apiSelect = screen.getByText('OpenAI-compatible API').closest('.settings-row')?.querySelector('select');
    if (!apiSelect) throw new Error('API provider select was not rendered');
    expect(apiSelect.querySelectorAll('option')).toHaveLength(10);
    expect(apiSelect.querySelector('option[value="claude"]')).toBeInTheDocument();
    expect(apiSelect.querySelector('option[value="codex"]')).toBeInTheDocument();
    expect(apiSelect.querySelector('option[value="gemini"]')).toBeInTheDocument();
    fireEvent.change(apiSelect, { target: { value: 'groq' } });
    await waitFor(() => {
      expect(window.ghostedit.saveConfig).toHaveBeenCalledWith(expect.objectContaining({
        apiPreset: 'groq',
        apiBaseUrl: 'https://api.groq.com/openai/v1',
        apiModel: 'llama-3.3-70b-versatile',
      }));
    });

    const modelSelect = screen.getByText('Models available from this API host').closest('.settings-row')?.querySelector('select');
    if (!modelSelect) throw new Error('API model select was not rendered');
    await waitFor(() => {
      expect(window.ghostedit.getApiModels).toHaveBeenCalled();
      expect(modelSelect.querySelectorAll('option')).toHaveLength(3);
    });
    fireEvent.change(modelSelect, { target: { value: 'gpt-4.1' } });
    await waitFor(() => {
      expect(window.ghostedit.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ apiModel: 'gpt-4.1' }));
    });

    fireEvent.change(screen.getByPlaceholderText('Required by hosted providers'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save key' }));
    await waitFor(() => {
      expect(window.ghostedit.saveApiKey).toHaveBeenCalledWith('secret');
    });
  });

  it('shows an error when the API host cannot provide its model catalog', async () => {
    window.ghostedit.getApiModels = vi.fn().mockResolvedValue({
      success: false,
      models: [],
      error: 'Could not load models (404): Not supported',
    }) as any;

    render(<Settings />);
    await waitForSettingsLoaded();
    fireEvent.click(within(getSidebar()).getByText('Providers'));

    expect(await screen.findByText('Could not load models (404): Not supported')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  // ── Hotkeys Section ──

  it('Hotkeys section shows three HotkeyInput components', async () => {
    render(<Settings />);
    await waitForSettingsLoaded();

    const nav = getSidebar();
    fireEvent.click(within(nav).getByText('Hotkeys'));

    await waitFor(() => {
      const inputs = screen.getAllByTestId('hotkey-input');
      expect(inputs).toHaveLength(4);
    });
  });

  // ── Behavior Section ──

  it('Behavior section hides fast-correction toggle when engine is bonsai', async () => {
    render(<Settings />);
    await waitForSettingsLoaded();

    const nav = getSidebar();
    fireEvent.click(within(nav).getByText('Behavior'));

    await waitFor(() => {
      expect(screen.getByText('Launch at login')).toBeInTheDocument();
    });
    expect(screen.queryByText('Fast correction mode')).not.toBeInTheDocument();
  });

  it('Behavior section shows core toggles', async () => {
    render(<Settings />);
    await waitForSettingsLoaded();

    const nav = getSidebar();
    fireEvent.click(within(nav).getByText('Behavior'));

    await waitFor(() => {
      expect(screen.getByText('Launch at login')).toBeInTheDocument();
    });
    expect(screen.getByText('Clipboard-only mode')).toBeInTheDocument();
    expect(screen.getByText('Sound feedback')).toBeInTheDocument();
    expect(screen.getByText('Notify on success')).toBeInTheDocument();
    expect(screen.getByText('Developer mode')).toBeInTheDocument();
  });

  it('Behavior section shows Diff preview dropdown with 3 options', async () => {
    render(<Settings />);
    await waitForSettingsLoaded();

    const nav = getSidebar();
    fireEvent.click(within(nav).getByText('Behavior'));

    await waitFor(() => {
      expect(screen.getByText('Diff preview')).toBeInTheDocument();
    });

    const diffRow = screen.getByText('Diff preview').closest('.settings-row');
    const select = diffRow?.querySelector('select');
    expect(select).toBeTruthy();
    const options = select!.querySelectorAll('option');
    expect(options).toHaveLength(3);
  });

  it('Behavior section shows auto-paste delay when diffPreviewMode is interactive', async () => {
    window.ghostedit.getConfig = vi.fn().mockResolvedValue({
      ...DEFAULT_CONFIG,
      firstRunComplete: true,
      settingsMode: 'advanced',
      diffPreviewMode: 'interactive',
    }) as any;

    render(<Settings />);
    await waitForSettingsLoaded();

    const nav = getSidebar();
    fireEvent.click(within(nav).getByText('Behavior'));

    await waitFor(() => {
      expect(screen.getByText('Auto-paste delay')).toBeInTheDocument();
    });
  });

  it('Behavior section hides auto-paste delay when diffPreviewMode is none', async () => {
    window.ghostedit.getConfig = vi.fn().mockResolvedValue({
      ...DEFAULT_CONFIG,
      firstRunComplete: true,
      settingsMode: 'advanced',
      diffPreviewMode: 'none',
    }) as any;

    render(<Settings />);
    await waitForSettingsLoaded();

    const nav = getSidebar();
    fireEvent.click(within(nav).getByText('Behavior'));

    await waitFor(() => {
      expect(screen.getByText('Diff preview')).toBeInTheDocument();
    });
    expect(screen.queryByText('Auto-paste delay')).not.toBeInTheDocument();
  });

  it('Behavior section shows Preview duration when diffPreviewMode is passive', async () => {
    window.ghostedit.getConfig = vi.fn().mockResolvedValue({
      ...DEFAULT_CONFIG,
      firstRunComplete: true,
      settingsMode: 'advanced',
      diffPreviewMode: 'passive',
    }) as any;

    render(<Settings />);
    await waitForSettingsLoaded();

    const nav = getSidebar();
    fireEvent.click(within(nav).getByText('Behavior'));

    await waitFor(() => {
      expect(screen.getByText('Preview duration')).toBeInTheDocument();
    });
  });

  it('Behavior section hides Preview duration when diffPreviewMode is interactive', async () => {
    window.ghostedit.getConfig = vi.fn().mockResolvedValue({
      ...DEFAULT_CONFIG,
      firstRunComplete: true,
      settingsMode: 'advanced',
      diffPreviewMode: 'interactive',
    }) as any;

    render(<Settings />);
    await waitForSettingsLoaded();

    const nav = getSidebar();
    fireEvent.click(within(nav).getByText('Behavior'));

    await waitFor(() => {
      expect(screen.getByText('Diff preview')).toBeInTheDocument();
    });
    expect(screen.queryByText('Preview duration')).not.toBeInTheDocument();
  });

  it('Behavior section shows History limit input', async () => {
    render(<Settings />);
    await waitForSettingsLoaded();

    const nav = getSidebar();
    fireEvent.click(within(nav).getByText('Behavior'));

    await waitFor(() => {
      expect(screen.getByText('History limit')).toBeInTheDocument();
    });
  });

  // ── Save Feedback ──

  it('floating toast appears after config change', async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('Language')).toBeInTheDocument();
    });

    const languageRow = screen.getByText('Language').closest('.settings-row');
    const select = languageRow?.querySelector('select');
    if (select) {
      fireEvent.change(select, { target: { value: 'es' } });
    }

    await waitFor(() => {
      expect(screen.getByText('Settings saved')).toBeInTheDocument();
    });
  });

  // ── Cross-Platform Title Bar ──

  it('macOS: no window control buttons rendered', async () => {
    mockPlatform('darwin');
    render(<Settings />);
    await waitForSettingsLoaded();

    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Minimize')).not.toBeInTheDocument();
  });

  it('non-macOS: renders close and minimize buttons', async () => {
    mockPlatform('win32');
    render(<Settings />);
    await waitForSettingsLoaded();

    expect(screen.getByLabelText('Close')).toBeInTheDocument();
    expect(screen.getByLabelText('Minimize')).toBeInTheDocument();
  });

  it('non-macOS: title text is visible', async () => {
    mockPlatform('win32');
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('GhostEdit Settings')).toBeInTheDocument();
    });
  });

  it('non-macOS: close button calls windowControls.close()', async () => {
    mockPlatform('win32');
    render(<Settings />);
    await waitForSettingsLoaded();

    fireEvent.click(screen.getByLabelText('Close'));
    expect(window.ghostedit.windowControls.close).toHaveBeenCalled();
  });

  it('non-macOS: minimize button calls windowControls.minimize()', async () => {
    mockPlatform('win32');
    render(<Settings />);
    await waitForSettingsLoaded();

    fireEvent.click(screen.getByLabelText('Minimize'));
    expect(window.ghostedit.windowControls.minimize).toHaveBeenCalled();
  });
});
