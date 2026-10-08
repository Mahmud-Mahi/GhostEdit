import { correctText as correctTextCLI, correctTextStreaming as correctTextStreamingCLI } from './cli-runner';
import { correctTextLocal, correctTextLocalStreaming } from './local-model-runner';
import { correctTextBonsai, correctTextBonsaiStreaming } from './bonsai-inference';
import { correctTextOpenAICompatible, correctTextOpenAICompatibleStreaming } from './openai-compatible-runner';
import { loadApiKey } from './api-key-store';
import { getApiProfileConfig } from '../shared/constants';
import type { AppConfig, CorrectionResult } from '../shared/types';

export async function correctText(
  systemPrompt: string,
  text: string,
  config: AppConfig,
): Promise<CorrectionResult> {
  if (config.provider === 'local') {
    if (config.localModelEngine === 't5') {
      return correctTextLocal(systemPrompt, text);
    }
    return correctTextBonsai(systemPrompt, text);
  }
  if (config.provider === 'openai-compatible') {
    const apiConfig = { ...config, ...getApiProfileConfig(config) };
    return correctTextOpenAICompatible(systemPrompt, text, apiConfig, loadApiKey(apiConfig.apiPreset));
  }
  return correctTextCLI(systemPrompt, text, config);
}

export async function correctTextStreaming(
  systemPrompt: string,
  text: string,
  onChunk: (chunk: string) => void,
  config: AppConfig,
): Promise<CorrectionResult> {
  if (config.provider === 'local') {
    if (config.localModelEngine === 't5') {
      return correctTextLocalStreaming(systemPrompt, text, onChunk);
    }
    return correctTextBonsaiStreaming(systemPrompt, text, onChunk);
  }
  if (config.provider === 'openai-compatible') {
    const apiConfig = { ...config, ...getApiProfileConfig(config) };
    return correctTextOpenAICompatibleStreaming(systemPrompt, text, onChunk, apiConfig, loadApiKey(apiConfig.apiPreset));
  }
  return correctTextStreamingCLI(systemPrompt, text, onChunk, config);
}
