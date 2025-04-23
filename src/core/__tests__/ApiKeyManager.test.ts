import ApiKeyManager from '../ApiKeyManager';
import config from '../../config'; // 导入 config 模块，用于 mock
import { ApiKey } from '../../types'; // 导入 ApiKey 类型

// Mock config 模块
jest.mock('../../config', () => ({
  __esModule: true,
  default: {
    PORT: 3000,
    GEMINI_API_KEYS: [], // 默认空数组，每个测试用例会设置不同的值
    KEY_COOL_DOWN_DURATION_MS: 1000, // 冷却时间设置为 1 秒方便测试
    LOG_LEVEL: 'info',
    DISPATCH_STRATEGY: 'round_robin',
  },
}));

// 模拟 Date.now 以控制时间
const mockDateNow = jest.fn();
global.Date.now = mockDateNow;

describe('ApiKeyManager', () => {
  let apiKeyManager: ApiKeyManager;
  const mockKeys = ['key1', 'key2', 'key3'];

  beforeEach(() => {
    // 重置 config 中的 API Key 列表
    (config as any).GEMINI_API_KEYS = [...mockKeys];
    // 重置 Date.now
    mockDateNow.mockReturnValue(0);
    // 清除所有 setInterval 模拟
    jest.useFakeTimers();
    // 实例化 ApiKeyManager，它会在构造函数中调用 loadKeys
    apiKeyManager = new ApiKeyManager();
  });

  afterEach(() => {
    // 恢复真实的定时器
    jest.useRealTimers();
  });

  test('should load API keys correctly', () => {
    // loadKeys 在 beforeEach 中已经调用
    // 检查 keys Map 是否被正确填充
    const keysMap = (apiKeyManager as any).keys;
    expect(keysMap.size).toBe(mockKeys.length);
    mockKeys.forEach(key => {
      expect(keysMap.has(key)).toBe(true);
      const apiKey = keysMap.get(key);
      expect(apiKey.key).toBe(key);
      expect(apiKey.status).toBe('available');
      expect(apiKey.currentRequests).toBe(0);
      expect(apiKey.coolingDownUntil).toBeUndefined();
    });
  });

  test('should return keys using round robin strategy', () => {
    // 第一次获取
    let key1 = apiKeyManager.getAvailableKey();
    expect(key1?.key).toBe('key1');

    // 第二次获取
    let key2 = apiKeyManager.getAvailableKey();
    expect(key2?.key).toBe('key2');

    // 第三次获取
    let key3 = apiKeyManager.getAvailableKey();
    expect(key3?.key).toBe('key3');

    // 第四次获取，应该回到 key1 (轮询)
    let key4 = apiKeyManager.getAvailableKey();
    expect(key4?.key).toBe('key1');
  });

  test('should return null if no keys are available', () => {
    // 清空 config 中的 API Key 列表
    (config as any).GEMINI_API_KEYS = [];
    // 重新加载 KeyManager
    apiKeyManager = new ApiKeyManager();

    const key = apiKeyManager.getAvailableKey();
    expect(key).toBeNull();
  });

  test('should mark a key as cooling down and make it available after duration', () => {
    const keyToCoolDown = 'key2';
    const coolDownDuration = (config as any).KEY_COOL_DOWN_DURATION_MS;

    // 标记 key2 冷却
    apiKeyManager.markAsCoolingDown(keyToCoolDown, coolDownDuration);

    // 此时 key2 应该不可用
    const availableKeysAfterCoolDown = Array.from<ApiKey>((apiKeyManager as any).keys.values()).filter(
      key => key.status === 'available'
    );
    expect(availableKeysAfterCoolDown.map((k: ApiKey) => k.key)).not.toContain(keyToCoolDown);

    // 快进时间到冷却期结束前
    mockDateNow.mockReturnValue(coolDownDuration - 1);
    jest.advanceTimersByTime(coolDownDuration - 1);

    // 此时 key2 仍然不可用
    const availableKeysBeforeEnd = Array.from<ApiKey>((apiKeyManager as any).keys.values()).filter(
      key => key.status === 'available'
    );
    expect(availableKeysBeforeEnd.map((k: ApiKey) => k.key)).not.toContain(keyToCoolDown);


    // 快进时间到冷却期结束或之后
    mockDateNow.mockReturnValue(coolDownDuration);
    jest.advanceTimersByTime(1); // 触发 setInterval 中的检查

    // 此时 key2 应该再次可用
    const availableKeysAfterEnd = Array.from<ApiKey>((apiKeyManager as any).keys.values()).filter(
      key => key.status === 'available'
    );
    expect(availableKeysAfterEnd.map((k: ApiKey) => k.key)).toContain(keyToCoolDown);
    expect((apiKeyManager as any).keys.get(keyToCoolDown).status).toBe('available');
    expect((apiKeyManager as any).keys.get(keyToCoolDown).coolingDownUntil).toBeUndefined();
  });

  test('should handle markAsAvailable correctly', () => {
    const keyToMarkAvailable = 'key1';
    const keysMap = (apiKeyManager as any).keys;

    // 先手动将 key1 设置为冷却中
    keysMap.set(keyToMarkAvailable, {
      key: keyToMarkAvailable,
      status: 'cooling_down',
      coolingDownUntil: Date.now() + 10000, // 未来时间
      currentRequests: 0,
    });

    // 标记 key1 可用
    apiKeyManager.markAsAvailable(keyToMarkAvailable);

    // 检查 key1 状态是否正确
    const apiKey = keysMap.get(keyToMarkAvailable);
    expect(apiKey.status).toBe('available');
    expect(apiKey.coolingDownUntil).toBeUndefined();
  });

  // 可选：测试并发请求计数方法
  test('should increment and decrement request count', () => {
    const keyToTrack = 'key1';
    const keysMap = (apiKeyManager as any).keys;

    apiKeyManager.incrementRequestCount(keyToTrack);
    expect(keysMap.get(keyToTrack).currentRequests).toBe(1);

    apiKeyManager.incrementRequestCount(keyToTrack);
    expect(keysMap.get(keyToTrack).currentRequests).toBe(2);

    apiKeyManager.decrementRequestCount(keyToTrack);
    expect(keysMap.get(keyToTrack).currentRequests).toBe(1);

    apiKeyManager.decrementRequestCount(keyToTrack);
    expect(keysMap.get(keyToTrack).currentRequests).toBe(0);

    // 确保 currentRequests 不会小于 0
    apiKeyManager.decrementRequestCount(keyToTrack);
    expect(keysMap.get(keyToTrack).currentRequests).toBe(0);
  });
});