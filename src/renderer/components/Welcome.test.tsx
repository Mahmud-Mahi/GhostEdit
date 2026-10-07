// @vitest-environment jsdom
import '../test-setup';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Welcome from './Welcome';
import { DEFAULT_CONFIG } from '../../shared/constants';

const defaultProps = {
  config: { ...DEFAULT_CONFIG },
  onComplete: vi.fn(),
  onConfigUpdate: vi.fn().mockResolvedValue(undefined),
};

describe('Welcome component', () => {
  it('step 0 renders menu bar description', () => {
    render(<Welcome {...defaultProps} />);
    expect(screen.getByText(/lives in your menu bar/i)).toBeInTheDocument();
  });

  it('step 1 shows both hotkeys with Local Model and CLI Provider labels', () => {
    render(<Welcome {...defaultProps} />);
    // Navigate to step 1
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByText('Local Model')).toBeInTheDocument();
    expect(screen.getByText('CLI Provider')).toBeInTheDocument();
  });

  it('step 2 shows providers and all three local model choices', () => {
    render(<Welcome {...defaultProps} />);
    // Navigate to step 2
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByText('Claude')).toBeInTheDocument();
    expect(screen.getByText('Codex')).toBeInTheDocument();
    expect(screen.getByText('Gemini')).toBeInTheDocument();
    expect(screen.getByText('OpenAI Compatible')).toBeInTheDocument();
    expect(screen.getByText('Built-in (Offline)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bonsai 1.7B/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bonsai 4B/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bonsai 8B/ })).toBeInTheDocument();
  });

  it('step 3 shows "Try it now" with sample text and Fix it button', () => {
    render(<Welcome {...defaultProps} />);
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByText(/Try it now/i)).toBeInTheDocument();
    expect(screen.getByText('Fix it')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/tset of GhostEdit/)).toBeInTheDocument();
  });

  it('completing onboarding with local saves the selected Bonsai model size', () => {
    const onComplete = vi.fn();
    render(<Welcome {...defaultProps} onComplete={onComplete} />);

    // Navigate to last step (step 3)
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    // Default is local; click Get Started
    fireEvent.click(screen.getByText('Get Started'));

    expect(onComplete).toHaveBeenCalledWith({
      firstRunComplete: true,
      provider: 'local',
      bonsaiModelSize: '1.7b',
      model: 'bonsai-1.7b',
    }, true);
  });

  it('downloads the selected 8B model during first-run local setup', () => {
    const onComplete = vi.fn();
    render(<Welcome {...defaultProps} onComplete={onComplete} />);

    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByRole('button', { name: /Bonsai 8B/ }));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Get Started'));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'local',
      bonsaiModelSize: '8b',
      model: 'bonsai-8b',
    }), true);
  });

  it.each([
    ['claude', 'Claude (Anthropic API)', 'https://api.anthropic.com/v1', 'claude-sonnet-4-5'],
    ['codex', 'Codex (OpenAI API)', 'https://api.openai.com/v1', 'gpt-5-codex'],
    ['gemini', 'Gemini (Google API)', 'https://generativelanguage.googleapis.com/v1beta', 'gemini-2.5-flash'],
  ] as const)('sets up %s API before the try step', async (provider, apiName, baseUrl, model) => {
    const onComplete = vi.fn();
    const onConfigUpdate = vi.fn().mockResolvedValue(undefined);
    render(<Welcome {...defaultProps} onComplete={onComplete} onConfigUpdate={onConfigUpdate} />);

    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText(provider === 'claude' ? 'Claude' : provider === 'codex' ? 'Codex' : 'Gemini'));
    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save & Continue' })).toBeEnabled());
    expect(screen.getByText(`Set up ${apiName}`)).toBeInTheDocument();
    expect(screen.getByLabelText('Base URL')).toHaveValue(baseUrl);
    expect(screen.getByLabelText('Model')).toHaveValue(model);
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'provider-key' } });
    fireEvent.click(screen.getByText('Save & Continue'));

    await waitFor(() => expect(onConfigUpdate).toHaveBeenCalledWith({
      provider: 'openai-compatible',
      apiPreset: provider,
      apiBaseUrl: baseUrl,
      apiModel: model,
      model,
    }));
    expect(window.ghostedit.saveApiKey).toHaveBeenCalledWith('provider-key');
    expect(screen.getByText('Try it now')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Get Started'));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      firstRunComplete: true,
      provider: 'openai-compatible',
      apiPreset: provider,
      apiBaseUrl: baseUrl,
      apiModel: model,
    }), false);
  });

  it('saves OpenAI-compatible API settings before moving to Try it now', async () => {
    const onComplete = vi.fn();
    const onConfigUpdate = vi.fn().mockResolvedValue(undefined);
    render(<Welcome {...defaultProps} onComplete={onComplete} onConfigUpdate={onConfigUpdate} />);

    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('OpenAI Compatible'));
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save & Continue' })).toBeEnabled());

    fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: 'https://api.example.test/v1' } });
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'test-key' } });
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'test-model' } });
    fireEvent.click(screen.getByText('Save & Continue'));

    await waitFor(() => expect(onConfigUpdate).toHaveBeenCalledWith({
      provider: 'openai-compatible',
      apiPreset: 'openai',
      apiBaseUrl: 'https://api.example.test/v1',
      apiModel: 'test-model',
      model: 'test-model',
    }));
    expect(window.ghostedit.saveApiKey).toHaveBeenCalledWith('test-key');
    expect(screen.getByText('Try it now')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Get Started'));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      firstRunComplete: true,
      provider: 'openai-compatible',
      apiBaseUrl: 'https://api.example.test/v1',
      apiModel: 'test-model',
      model: 'test-model',
    }), false);
  });

  it('provider selection highlights the selected button', () => {
    render(<Welcome {...defaultProps} />);
    // Navigate to step 2 (provider selection)
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));

    // Click Claude
    fireEvent.click(screen.getByText('Claude'));
    // The button should use the Dracula purple highlight.
    const claudeButton = screen.getByText('Claude').closest('button');
    expect(claudeButton?.className).toContain('bg-ghost-purple/20');
  });

  it('back button disabled on step 0', () => {
    render(<Welcome {...defaultProps} />);
    const backButton = screen.getByText('Back');
    expect(backButton).toBeDisabled();
  });

  it('back button works on step 1', () => {
    render(<Welcome {...defaultProps} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText(/press your hotkey/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText(/lives in your menu bar/i)).toBeInTheDocument();
  });

  it('last step button says Get Started', () => {
    render(<Welcome {...defaultProps} />);
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByText('Get Started')).toBeInTheDocument();
  });
});
