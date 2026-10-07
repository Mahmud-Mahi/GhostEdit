import type { AppConfig, CorrectionResult, OpenAICompatiblePreset } from '../shared/types';

function getEndpoint(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) throw new Error('API base URL is required');
  return normalized.replace(/\/(chat\/completions|models)$/i, '') + '/chat/completions';
}

function getModelsEndpoint(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) throw new Error('API base URL is required');
  return normalized.replace(/\/(chat\/completions|models)$/i, '') + '/models';
}

function getHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
  return headers;
}

function getRequestBody(systemPrompt: string, text: string, model: string, stream: boolean) {
  if (!model.trim()) throw new Error('API model is required');
  return {
    model: model.trim(),
    stream,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: text },
    ],
  };
}

type NativeApiPreset = Extract<OpenAICompatiblePreset, 'claude' | 'codex' | 'gemini'>;

function getNativeEndpoint(baseUrl: string, preset: NativeApiPreset, model: string, stream: boolean): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) throw new Error('API base URL is required');
  if (preset === 'claude') return `${normalized}/messages`;
  if (preset === 'codex') return `${normalized}/responses`;
  const action = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  return `${normalized}/models/${encodeURIComponent(model)}:${action}`;
}

function getNativeHeaders(preset: NativeApiPreset, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!apiKey.trim()) return headers;
  if (preset === 'claude') {
    headers['x-api-key'] = apiKey.trim();
    headers['anthropic-version'] = '2023-06-01';
  } else if (preset !== 'gemini') {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }
  return headers;
}

function getNativeRequestBody(preset: NativeApiPreset, systemPrompt: string, text: string, model: string, stream: boolean) {
  if (!model.trim()) throw new Error('API model is required');
  if (preset === 'claude') {
    return {
      model: model.trim(),
      max_tokens: 2048,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: text }],
      stream,
    };
  }
  if (preset === 'codex') {
    return { model: model.trim(), instructions: systemPrompt || undefined, input: text, stream };
  }
  return {
    ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
    contents: [{ role: 'user', parts: [{ text }] }],
  };
}

function nativeApiKeyUrl(url: string, preset: NativeApiPreset, apiKey: string): string {
  if (preset !== 'gemini' || !apiKey.trim()) return url;
  return `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey.trim())}`;
}

function extractNativeText(preset: NativeApiPreset, payload: any): string | undefined {
  if (preset === 'claude') {
    return payload.content?.filter((part: any) => part.type === 'text').map((part: any) => part.text).join('');
  }
  if (preset === 'codex') {
    return payload.output_text ?? payload.output?.flatMap((item: any) => item.content ?? []).map((part: any) => part.text ?? '').join('');
  }
  return payload.candidates?.[0]?.content?.parts?.map((part: any) => part.text ?? '').join('');
}

function extractNativeStreamText(preset: NativeApiPreset, payload: any): string | undefined {
  if (preset === 'claude') return payload.type === 'content_block_delta' ? payload.delta?.text : undefined;
  if (preset === 'codex') return payload.type === 'response.output_text.delta' ? payload.delta : undefined;
  return payload.candidates?.[0]?.content?.parts?.map((part: any) => part.text ?? '').join('');
}

async function getErrorMessage(response: Response): Promise<string> {
  const body = await response.text().catch(() => '');
  try {
    const parsed = JSON.parse(body);
    return parsed.error?.message || body || response.statusText;
  } catch {
    return body || response.statusText;
  }
}

export async function listOpenAICompatibleModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const response = await fetch(getModelsEndpoint(baseUrl), {
    headers: getHeaders(apiKey),
  });
  if (!response.ok) {
    throw new Error(`Could not load models (${response.status}): ${await getErrorMessage(response)}`);
  }
  const payload = await response.json() as { data?: Array<{ id?: unknown }> };
  const models = (payload.data ?? [])
    .map((model) => typeof model.id === 'string' ? model.id.trim() : '')
    .filter(Boolean);
  if (models.length === 0) throw new Error('The API host returned no models');
  return [...new Set(models)].sort((a, b) => a.localeCompare(b));
}

export async function listApiModels(baseUrl: string, apiKey: string, preset: OpenAICompatiblePreset): Promise<string[]> {
  if (preset !== 'claude' && preset !== 'gemini') return listOpenAICompatibleModels(baseUrl, apiKey);
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) throw new Error('API base URL is required');
  const url = preset === 'claude' ? `${normalized}/models` : `${normalized}/models`;
  const requestUrl = preset === 'gemini' && apiKey.trim()
    ? `${url}?key=${encodeURIComponent(apiKey.trim())}`
    : url;
  const response = await fetch(requestUrl, { headers: getNativeHeaders(preset, apiKey) });
  if (!response.ok) throw new Error(`Could not load models (${response.status}): ${await getErrorMessage(response)}`);
  const payload = await response.json() as { data?: Array<{ id?: unknown }>; models?: Array<{ name?: unknown }> };
  const models = preset === 'claude'
    ? (payload.data ?? []).map((model) => typeof model.id === 'string' ? model.id.trim() : '')
    : (payload.models ?? []).map((model) => typeof model.name === 'string' ? model.name.replace(/^models\//, '').trim() : '');
  const available = [...new Set(models.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  if (available.length === 0) throw new Error('The API host returned no models');
  return available;
}

export async function correctTextOpenAICompatible(
  systemPrompt: string,
  text: string,
  config: AppConfig,
  apiKey: string,
): Promise<CorrectionResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutSeconds * 1000);
  const started = Date.now();
  try {
    if (config.apiPreset === 'claude' || config.apiPreset === 'codex' || config.apiPreset === 'gemini') {
      const url = getNativeEndpoint(config.apiBaseUrl, config.apiPreset, config.apiModel, false);
      const response = await fetch(nativeApiKeyUrl(url, config.apiPreset, apiKey), {
        method: 'POST',
        headers: getNativeHeaders(config.apiPreset, apiKey),
        body: JSON.stringify(getNativeRequestBody(config.apiPreset, systemPrompt, text, config.apiModel, false)),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`API request failed (${response.status}): ${await getErrorMessage(response)}`);
      const corrected = extractNativeText(config.apiPreset, await response.json())?.trim();
      if (!corrected) throw new Error('API returned an empty response');
      return { text: corrected, durationMs: Date.now() - started };
    }
    const response = await fetch(getEndpoint(config.apiBaseUrl), {
      method: 'POST',
      headers: getHeaders(apiKey),
      body: JSON.stringify(getRequestBody(systemPrompt, text, config.apiModel, false)),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`API request failed (${response.status}): ${await getErrorMessage(response)}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const corrected = payload.choices?.[0]?.message?.content?.trim();
    if (!corrected) throw new Error('API returned an empty response');
    return { text: corrected, durationMs: Date.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

export async function correctTextOpenAICompatibleStreaming(
  systemPrompt: string,
  text: string,
  onChunk: (chunk: string) => void,
  config: AppConfig,
  apiKey: string,
): Promise<CorrectionResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutSeconds * 1000);
  const started = Date.now();
  try {
    if (config.apiPreset === 'claude' || config.apiPreset === 'codex' || config.apiPreset === 'gemini') {
      const url = getNativeEndpoint(config.apiBaseUrl, config.apiPreset, config.apiModel, true);
      const response = await fetch(nativeApiKeyUrl(url, config.apiPreset, apiKey), {
        method: 'POST',
        headers: { ...getNativeHeaders(config.apiPreset, apiKey), Accept: 'text/event-stream' },
        body: JSON.stringify(getNativeRequestBody(config.apiPreset, systemPrompt, text, config.apiModel, true)),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`API request failed (${response.status}): ${await getErrorMessage(response)}`);
      if (!response.body) throw new Error('API response does not support streaming');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let corrected = '';
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        const remainder = lines.pop() ?? '';
        buffer = done ? '' : remainder;
        if (done && remainder.trim()) lines.push(remainder);
        for (const line of lines) {
          const data = line.trim().replace(/^data:\s?/, '');
          if (!data || data === '[DONE]') continue;
          const event = JSON.parse(data);
          const chunk = extractNativeStreamText(config.apiPreset, event);
          if (chunk) {
            corrected += chunk;
            onChunk(chunk);
          }
        }
        if (done) break;
      }
      if (!corrected.trim()) throw new Error('API returned an empty response');
      return { text: corrected.trim(), durationMs: Date.now() - started };
    }
    const response = await fetch(getEndpoint(config.apiBaseUrl), {
      method: 'POST',
      headers: { ...getHeaders(apiKey), Accept: 'text/event-stream' },
      body: JSON.stringify(getRequestBody(systemPrompt, text, config.apiModel, true)),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`API request failed (${response.status}): ${await getErrorMessage(response)}`);
    if (!response.body) throw new Error('API response does not support streaming');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let corrected = '';
    let finished = false;
    while (!finished) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const events = buffer.split('\n');
      const remainder = events.pop() ?? '';
      buffer = done ? '' : remainder;
      if (done && remainder.trim()) events.push(remainder);
      for (const line of events) {
        const data = line.trim();
        if (!data.startsWith('data:')) continue;
        const payload = data.slice(5).trim();
        if (payload === '[DONE]') {
          finished = true;
          break;
        }
        if (!payload) continue;
        const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
        const chunk = parsed.choices?.[0]?.delta?.content;
        if (chunk) {
          corrected += chunk;
          onChunk(chunk);
        }
      }
      if (done) finished = true;
    }
    if (!corrected.trim()) throw new Error('API returned an empty response');
    return { text: corrected.trim(), durationMs: Date.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}