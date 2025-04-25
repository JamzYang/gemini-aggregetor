"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../config"));
class ApiKeyManager {
    keys = new Map();
    roundRobinIndex = 0;
    constructor() {
        this.loadKeys();
        // 定期检查冷却中的 Key 是否可恢复
        setInterval(() => this.checkCoolingDownKeys(), 2000); // 每 2 秒检查一次
    }
    loadKeys() {
        if (!config_1.default.GEMINI_API_KEYS || config_1.default.GEMINI_API_KEYS.length === 0) {
            console.warn('ApiKeyManager: 未加载任何 API Key。请检查配置。');
            return;
        }
        this.keys.clear();
        config_1.default.GEMINI_API_KEYS.forEach(key => {
            this.keys.set(key, {
                key,
                status: 'available',
                currentRequests: 0,
            });
        });
        console.info(`ApiKeyManager: 成功加载 ${this.keys.size} 个 API Key。`);
    }
    getAvailableKey() {
        const availableKeys = Array.from(this.keys.values()).filter(key => key.status === 'available' && (!key.coolingDownUntil || key.coolingDownUntil <= Date.now()));
        if (availableKeys.length === 0) {
            console.warn('ApiKeyManager: 没有可用的 API Key。');
            return null;
        }
        // 简单轮询策略
        const selectedKey = availableKeys[this.roundRobinIndex % availableKeys.length];
        this.roundRobinIndex = (this.roundRobinIndex + 1) % availableKeys.length;
        // 标记为正在使用 (如果需要更复杂的并发控制)
        // this.incrementRequestCount(selectedKey.key);
        return selectedKey;
    }
    markAsCoolingDown(key, durationMs) {
        const apiKey = this.keys.get(key);
        if (apiKey) {
            apiKey.status = 'cooling_down';
            apiKey.coolingDownUntil = Date.now() + durationMs;
            console.warn(`ApiKeyManager: Key ${key} 标记为冷却中，直到 ${new Date(apiKey.coolingDownUntil).toISOString()}`);
        }
    }
    markAsAvailable(key) {
        const apiKey = this.keys.get(key);
        if (apiKey) {
            apiKey.status = 'available';
            apiKey.coolingDownUntil = undefined;
            console.info(`ApiKeyManager: Key ${key} 标记为可用。`);
        }
    }
    // 可选方法，用于更复杂的并发控制
    incrementRequestCount(key) {
        const apiKey = this.keys.get(key);
        if (apiKey) {
            apiKey.currentRequests++;
        }
    }
    // 可选方法，用于更复杂的并发控制
    decrementRequestCount(key) {
        const apiKey = this.keys.get(key);
        if (apiKey && apiKey.currentRequests > 0) {
            apiKey.currentRequests--;
        }
    }
    checkCoolingDownKeys() {
        const now = Date.now();
        this.keys.forEach(apiKey => {
            if (apiKey.status === 'cooling_down' && apiKey.coolingDownUntil && apiKey.coolingDownUntil <= now) {
                this.markAsAvailable(apiKey.key);
            }
        });
    }
}
exports.default = ApiKeyManager;
//# sourceMappingURL=ApiKeyManager.js.map