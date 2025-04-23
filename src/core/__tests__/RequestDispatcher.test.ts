import RequestDispatcher from '../RequestDispatcher';
import ApiKeyManager from '../ApiKeyManager'; // 导入 ApiKeyManager 用于模拟
import { ApiKey } from '../../types'; // 导入 ApiKey 类型

// Mock ApiKeyManager 模块
jest.mock('../ApiKeyManager');

describe('RequestDispatcher', () => {
  let requestDispatcher: RequestDispatcher;
  let mockApiKeyManager: jest.Mocked<ApiKeyManager>;

  beforeEach(() => {
    // 清除 ApiKeyManager 的模拟实现
    jest.clearAllMocks();
    // 创建 ApiKeyManager 的模拟实例
    mockApiKeyManager = new ApiKeyManager() as jest.Mocked<ApiKeyManager>;
    // 实例化 RequestDispatcher，注入模拟的 ApiKeyManager
    requestDispatcher = new RequestDispatcher(mockApiKeyManager);
  });

  test('should call getAvailableKey on ApiKeyManager and return the result', async () => {
    const mockApiKey: ApiKey = {
      key: 'test-key',
      status: 'available',
      currentRequests: 0,
    };
    // 设置模拟的 getAvailableKey 方法的返回值
    mockApiKeyManager.getAvailableKey.mockReturnValue(mockApiKey);

    const selectedKey = await requestDispatcher.selectApiKey();

    // 验证 ApiKeyManager.getAvailableKey 是否被调用
    expect(mockApiKeyManager.getAvailableKey).toHaveBeenCalledTimes(1);
    // 验证 selectApiKey 返回的值是否与模拟的返回值一致
    expect(selectedKey).toBe(mockApiKey);
  });

  test('should return null if ApiKeyManager.getAvailableKey returns null', async () => {
    // 设置模拟的 getAvailableKey 方法返回 null
    mockApiKeyManager.getAvailableKey.mockReturnValue(null);

    const selectedKey = await requestDispatcher.selectApiKey();

    // 验证 ApiKeyManager.getAvailableKey 是否被调用
    expect(mockApiKeyManager.getAvailableKey).toHaveBeenCalledTimes(1);
    // 验证 selectApiKey 返回的值是否为 null
    expect(selectedKey).toBeNull();
  });
});