import request from 'supertest';
import express from 'express';
import createProxyRouter from '../../routes/proxy';
import ApiKeyManager from '../../core/ApiKeyManager';
import RequestDispatcher from '../../core/RequestDispatcher';
import GoogleApiForwarder from '../../core/GoogleApiForwarder';
import { StreamHandler } from '../../core/StreamHandler';
import config from '../../config'; // 假设 config 可以加载测试环境配置

// 模拟配置，确保在测试中可以访问 API Key
// 在实际集成测试中，这些 Key 应该来自环境变量或测试配置
const testApiKeys = process.env.GEMINI_API_KEYS?.split(',') || ['YOUR_TEST_API_KEY_1', 'YOUR_TEST_API_KEY_2']; // 从环境变量获取或使用占位符

// 确保测试配置加载了冷却时间
const testCoolDownDuration = parseInt(process.env.KEY_COOL_DOWN_DURATION_MS || '60000', 10); // 默认 60 秒

// 初始化核心组件
const apiKeyManager = new ApiKeyManager();
const requestDispatcher = new RequestDispatcher(apiKeyManager);
const googleApiForwarder = new GoogleApiForwarder();
const streamHandler = new StreamHandler();

// 创建 Express 应用并挂载代理路由
const app = express();
app.use(express.json()); // 需要解析请求体
app.use(createProxyRouter(apiKeyManager, requestDispatcher, googleApiForwarder, streamHandler));

describe('Proxy Route Integration Tests', () => {
  // 在所有测试开始前，ApiKeyManager 会在其构造函数中加载 API Key
  beforeAll(async () => {
    console.log(`使用以下 Key 进行集成测试: ${testApiKeys.map(key => key.substring(0, 5) + '...').join(', ')}`);
    if (testApiKeys.includes('YOUR_TEST_API_KEY_1')) {
        console.warn('警告: 正在使用占位符 API Key 进行测试。请设置 GEMINI_API_KEYS 环境变量为真实的 Gemini API Key。');
    }
  });

  // 在每个测试后重置 Key 状态（可选，取决于测试需求）
  afterEach(() => {
    // 例如，将所有 Key 标记为可用
    testApiKeys.forEach(key => apiKeyManager.markAsAvailable(key));
  });

  it('should successfully proxy a generateContent request to Google API', async () => {
    // 这是一个基本的成功请求测试
    // 注意: 这将调用真实的 Google API，会消耗配额
    const requestBody = {
      contents: [{
        parts: [{ text: 'Write a very short story about a cat.' }],
      }],
    };

    const res = await request(app)
      .post('/v1beta/models/gemini-2.0-flash-lite:generateContent') // 使用一个有效的模型名称
      .send(requestBody)
      .expect(200); // 期望成功的 HTTP 状态码

    // 验证响应结构或内容（取决于 Google API 的实际响应）
    // 这里只做一个简单的检查，确保响应体存在
    expect(res.body).toBeDefined();
    // 可以进一步检查 res.body 的结构，例如是否包含 'candidates' 字段
    expect(res.body.candidates).toBeDefined();
    expect(Array.isArray(res.body.candidates)).toBe(true);
  }, 30000); // 增加超时时间，因为是网络请求

  it('should successfully proxy a generateContent stream request to Google API', async () => {
    // 测试流式响应
    const requestBody = {
      contents: [{
        parts: [{ text: 'Tell me a longer story about a dog.' }],
      }],
    };

    // 使用 node-fetch 发起请求来测试流式响应
    // 需要获取测试服务器的实际地址和端口
    // 假设测试服务器运行在 http://localhost:TEST_PORT
    const TEST_PORT = process.env.TEST_PORT || 3000; // 替换为获取实际端口的逻辑
    const url = `http://localhost:${TEST_PORT}/v1beta/models/gemini-2.0-flash-lite:streamGenerateContent`;

    console.info(`Test: 使用 node-fetch 发起请求到 ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // 验证响应状态码
    expect(response.status).toBe(200);

    // 验证响应头是否指示流式响应 (例如 Content-Type: text/event-stream)
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    // 监听数据事件来捕获流式数据
    let receivedData = ''; // 将声明移到外部
    if (response.body) {
      console.info('Test: 响应体是可读流');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // 使用 reader 读取流数据
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.info('Test: 流读取完毕');
          break;
        }
        // 将 Uint8Array 转换为字符串并添加到 receivedData
        receivedData += decoder.decode(value, { stream: true });
        console.info('Test: 接收到数据块');
      }
    } else {
      console.error('Test: 响应体不是可读流');
    }

    // 验证接收到的数据是否包含预期的 SSE 格式或内容
    console.info(`Test: 接收到的数据长度: ${receivedData.length}`);
    expect(receivedData.length).toBeGreaterThan(0);
    // 更复杂的检查：可以尝试解析 SSE 数据块并验证其结构
    // 例如，查找 data: 开头的行
    expect(receivedData).toContain('data: ');

  }, 60000); // 增加超时时间

  it('should return 503 Service Unavailable if no API keys are available', async () => {
    // 将所有 Key 标记为冷却中，模拟无可用 Key 的情况
    testApiKeys.forEach(key => apiKeyManager.markAsCoolingDown(key, 10000)); // 冷却 10 秒

    const requestBody = {
      contents: [{
        parts: [{ text: 'This request should fail due to no available keys.' }],
      }],
    };

    const res = await request(app)
      .post('/v1beta/models/gemini-2.0-flash-lite:generateContent')
      .send(requestBody)
      .expect(503); // 期望返回 503 Service Unavailable

    // 验证响应体是否包含预期的错误信息
    expect(res.body).toBeDefined();
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe(503);
    expect(res.body.error.message).toContain('No available API keys.');
  });

  it('should mark the key as cooling down and return error on Google API 429 (Rate Limit)', async () => {
    // 模拟 GoogleApiForwarder 返回一个 429 错误
    const mockRateLimitError = new Error('Mock Rate Limit Error') as any;
    mockRateLimitError.statusCode = 429;
    mockRateLimitError.isRateLimitError = true; // 模拟自定义属性

    // 暂存原始的 forwardRequest 方法
    const originalForwardRequest = googleApiForwarder.forwardRequest;

    // 模拟 forwardRequest 方法，使其在第一次调用时返回速率限制错误
    // 注意：这个模拟只对当前测试有效
    googleApiForwarder.forwardRequest = jest.fn().mockResolvedValueOnce({ error: mockRateLimitError });

    const requestBody = {
      contents: [{
        parts: [{ text: 'This request should trigger a rate limit error.' }],
      }],
    };

    // 发送请求，期望收到 429 错误
    const res = await request(app)
      .post('/v1beta/models/gemini-2.0-flash-lite:generateContent')
      .send(requestBody)
      .expect(429); // 期望返回 429

    // 验证响应体是否包含预期的错误信息
    expect(res.body).toBeDefined();
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe(429);
    // 错误消息可能因错误处理中间件而异，这里简单检查状态
    expect(res.body.error.status).toBe('RESOURCE_EXHAUSTED'); // Google API 429 对应的 status

    // 验证 ApiKeyManager 的 markAsCoolingDown 方法是否被调用
    // 由于 ApiKeyManager 是单例，我们需要检查它的状态
    // 假设我们知道第一个 Key 会被选中
    const firstKey = testApiKeys[0];
    const keyStatus = (apiKeyManager as any).keys.get(firstKey)?.status; // 访问私有属性进行验证
    expect(keyStatus).toBe('cooling_down');

    // 恢复原始的 forwardRequest 方法
    googleApiForwarder.forwardRequest = originalForwardRequest;
  }, 10000); // 设置一个合理的超时时间

  it('should return appropriate error on Google API 401/403 (Authentication Error)', async () => {
    // 模拟 GoogleApiForwarder 返回一个 401 错误
    const mockAuthError = new Error('Mock Authentication Error') as any;
    mockAuthError.statusCode = 401;

    // 暂存原始的 forwardRequest 方法
    const originalForwardRequest = googleApiForwarder.forwardRequest;

    // 模拟 forwardRequest 方法，使其返回认证错误
    googleApiForwarder.forwardRequest = jest.fn().mockResolvedValueOnce({ error: mockAuthError });

    const requestBody = {
      contents: [{
        parts: [{ text: 'This request should trigger an auth error.' }],
      }],
    };

    // 发送请求，期望收到 401 错误
    const res = await request(app)
      .post('/v1beta/models/gemini-2.0-flash-lite:generateContent')
      .send(requestBody)
      .expect(401); // 期望返回 401

    // 验证响应体是否包含预期的错误信息
    expect(res.body).toBeDefined();
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe(401);
    // 错误消息可能因错误处理中间件而异，这里简单检查状态
    expect(res.body.error.status).toBe('UNAUTHENTICATED'); // Google API 401 对应的 status

    // 验证 ApiKeyManager 是否将 Key 标记为 disabled (如果实现了该逻辑)
    // 根据 proxy.ts 代码，目前只打印日志并传递错误，没有标记 disabled 的逻辑
    // 如果后续添加了标记 disabled 的逻辑，需要在这里添加相应的验证
    // const firstKey = testApiKeys[0];
    // const keyStatus = (apiKeyManager as any).keys.get(firstKey)?.status;
    // expect(keyStatus).toBe('disabled');


    // 恢复原始的 forwardRequest 方法
    googleApiForwarder.forwardRequest = originalForwardRequest;
  }, 10000); // 设置一个合理的超时时间


  it('should return appropriate error on other Google API errors (e.g., 500)', async () => {
    // 模拟 GoogleApiForwarder 返回一个 500 错误
    const mockGenericError = new Error('Mock Google API Internal Error') as any;
    mockGenericError.statusCode = 500;

    // 暂存原始的 forwardRequest 方法
    const originalForwardRequest = googleApiForwarder.forwardRequest;

    // 模拟 forwardRequest 方法，使其返回通用错误
    googleApiForwarder.forwardRequest = jest.fn().mockResolvedValueOnce({ error: mockGenericError });

    const requestBody = {
      contents: [{
        parts: [{ text: 'This request should trigger a generic Google API error.' }],
      }],
    };

    // 发送请求，期望收到 500 错误
    const res = await request(app)
      .post('/v1beta/models/gemini-2.0-flash-lite:generateContent')
      .send(requestBody)
      .expect(500); // 期望返回 500

    // 验证响应体是否包含预期的错误信息
    expect(res.body).toBeDefined();
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe(500);
    // 错误消息和状态可能因错误处理中间件而异，这里简单检查状态
    expect(res.body.error.status).toBe('INTERNAL'); // Google API 500 对应的 status

    // 恢复原始的 forwardRequest 方法
    googleApiForwarder.forwardRequest = originalForwardRequest;
  }, 10000); // 设置一个合理的超时时间

  // TODO: 添加更多集成测试用例
  // - 测试不同的模型和 API 版本路径 (如果支持)
});