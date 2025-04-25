"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RequestDispatcher {
    apiKeyManager;
    constructor(apiKeyManager) {
        this.apiKeyManager = apiKeyManager;
    }
    async selectApiKey() {
        // 目前只实现简单轮询策略，后续可扩展
        return this.apiKeyManager.getAvailableKey();
    }
}
exports.default = RequestDispatcher;
//# sourceMappingURL=RequestDispatcher.js.map