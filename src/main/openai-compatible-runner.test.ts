import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../shared/constants';
import { correctTextOpenAICompatible, correctTextOpenAICompatibleStreaming, listApiModels, listOpenAICompatibleModels } from './openai-compatible-runner';

const config = {
  ...DEFAULT_CONFIG,
  apiBaseUrl: 'https://api.example.test/v1/',
  apiModel: 'example-model',
  timeoutSeconds: 10,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenAI-compatible API runner', () => {
  it('lists and sorts models from the configured host', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'z-model' }, { id: 'a-model' }, { id: 'a-model' }, { id: '' }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const models = await listOpenAICompatibleModels('https://api.example.test/v1/', 'secret');

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/v1/models', {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer secret' },
    });
    expect(models).toEqual(['a-model', 'z-model']);
  });

  it('accepts a base URL ending in chat completions when discovering models', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'local-model' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await listOpenAICompatibleModels('http://localhost:1234/v1/chat/completions', '');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:1234/v1/models', expect.any(Object));
  });

  it('surfaces errors returned by the host model-list endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Not supported' } }), { status: 404 })));

    await expect(listOpenAICompatibleModels('https://api.example.test/v1', ''))
      .rejects.toThrow('Could not load models (404): Not supported');
  });

  it('sends chat-completion messages and returns the model text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '  corrected text  ' } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await correctTextOpenAICompatible('Fix grammar', 'input text', config, 'secret');

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer secret' },
      body: JSON.stringify({
        model: 'example-model',
        stream: false,
        messages: [
          { role: 'system', content: 'Fix grammar' },
          { role: 'user', content: 'input text' },
        ],
      }),
    }));
    expect(result.text).toBe('corrected text');
  });

  it('supports streamed chat completion deltas', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"fixed "}}]}\n\ndata: {"choices":[{"delta":{"content":"text"}}]}\n\ndata: [DONE]\n\n'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { status: 200 })));
    const onChunk = vi.fn();

    const result = await correctTextOpenAICompatibleStreaming('', 'input', onChunk, config, '');

    expect(onChunk.mock.calls.map(([chunk]) => chunk).join('')).toBe('fixed text');
    expect(result.text).toBe('fixed text');
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    }));
  });

  it('parses a final stream delta without a trailing newline', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"last chunk"}}]}'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { status: 200 })));
    const onChunk = vi.fn();

    const result = await correctTextOpenAICompatibleStreaming('', 'input', onChunk, config, '');

    expect(onChunk).toHaveBeenCalledWith('last chunk');
    expect(result.text).toBe('last chunk');
  });

  it('surfaces provider errors from OpenAI-shaped error responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'Invalid API key' },
    }), { status: 401, statusText: 'Unauthorized' })));

    await expect(correctTextOpenAICompatible('', 'input', config, 'bad-key'))
      .rejects.toThrow('API request failed (401): Invalid API key');
  });

  it('does not send Authorization when an API key is not required', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await correctTextOpenAICompatible('', 'input', config, '');

    expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
  });
});

describe('native provider API runner', () => {
  it.each([
    {
      preset: 'claude' as const,
      baseUrl: 'https://api.anthropic.com/v1',
      endpoint: 'https://api.anthropic.com/v1/messages',
      response: { content: [{ type: 'text', text: 'fixed by claude' }] },
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'secret', 'anthropic-version': '2023-06-01' },
      body: {
        model: 'claude-model',
        max_tokens: 2048,
        system: 'System prompt',
        messages: [{ role: 'user', content: 'original' }],
        stream: false,
      },
    },
    {
      preset: 'codex' as const,
      baseUrl: 'https://api.openai.com/v1',
      endpoint: 'https://api.openai.com/v1/responses',
      response: { output_text: 'fixed by codex' },
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer secret' },
      body: { model: 'codex-model', instructions: 'System prompt', input: 'original', stream: false },
    },
    {
      preset: 'gemini' as const,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-model:generateContent?key=secret',
      response: { candidates: [{ content: { parts: [{ text: 'fixed by gemini' }] } }] },
      headers: { 'Content-Type': 'application/json' },
      body: {
        systemInstruction: { parts: [{ text: 'System prompt' }] },
        contents: [{ role: 'user', parts: [{ text: 'original' }] }],
      },
    },
  ])('sends and parses the $preset native API format', async ({ preset, baseUrl, endpoint, response, headers, body }) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const nativeConfig = { ...config, apiPreset: preset, apiBaseUrl: baseUrl, apiModel: preset === 'claude' ? 'claude-model' : preset === 'codex' ? 'codex-model' : 'gemini-model' };

    const result = await correctTextOpenAICompatible('System prompt', 'original', nativeConfig, 'secret');

    expect(fetchMock).toHaveBeenCalledWith(endpoint, expect.objectContaining({
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }));
    expect(result.text).toBe(`fixed by ${preset}`);
  });

  it('uses the selected native provider to discover models', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      models: [{ name: 'models/gemini-2.5-flash' }, { name: 'models/gemini-2.0-flash' }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const models = await listApiModels('https://generativelanguage.googleapis.com/v1beta', 'secret', 'gemini');

    expect(fetchMock).toHaveBeenCalledWith('https://generativelanguage.googleapis.com/v1beta/models?key=secret', expect.any(Object));
    expect(models).toEqual(['gemini-2.0-flash', 'gemini-2.5-flash']);
  });
});