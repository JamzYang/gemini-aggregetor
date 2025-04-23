import ApiKeyManager from './ApiKeyManager';
import { ApiKey } from '../types';

class RequestDispatcher {
  private apiKeyManager: ApiKeyManager;

  constructor(apiKeyManager: ApiKeyManager) {
    this.apiKeyManager = apiKeyManager;
  }

  async selectApiKey(): Promise<ApiKey | null> {
    // 目前只实现简单轮询策略，后续可扩展
    return this.apiKeyManager.getAvailableKey();
  }
}

export default RequestDispatcher;