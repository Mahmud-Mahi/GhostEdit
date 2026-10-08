import type { AppConfig, ProviderName } from '../shared/types';
import { getApiProfileConfig } from '../shared/constants';

export function getProviderShortcutTarget(config: AppConfig): { provider: ProviderName; model: string } {
  if (config.provider === 'openai-compatible') {
    return { provider: 'openai-compatible', model: getApiProfileConfig(config).apiModel };
  }
  if (config.provider === 'local') {
    const model = config.localModelEngine === 't5'
      ? 't5-grammar'
      : `bonsai-${config.bonsaiModelSize ?? '1.7b'}`;
    return { provider: 'local', model };
  }
  return { provider: config.cliProvider, model: config.cliModel };
}