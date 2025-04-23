import { Router, Request, Response, NextFunction } from 'express';
import ApiKeyManager from '../core/ApiKeyManager';
import RequestDispatcher from '../core/RequestDispatcher';
import GoogleApiForwarder, { GoogleApiError } from '../core/GoogleApiForwarder';
import { StreamHandler } from '../core/StreamHandler';
import config from '../config';
import { GenerateContentResponse } from '@google/generative-ai';

// 修改为导出一个函数，接受依赖作为参数
export default function createProxyRouter(
  apiKeyManager: ApiKeyManager,
  requestDispatcher: RequestDispatcher,
  googleApiForwarder: GoogleApiForwarder,
  streamHandler: StreamHandler
): Router {
  const router = Router();

  // 定义代理路由，匹配 Gemini API 的 generateContent 路径
  router.post('/v1beta/models/:model:generateContent', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let apiKey = null;
    try {
      // 1. 获取可用 API Key
      apiKey = await requestDispatcher.selectApiKey();

      if (!apiKey) {
        // 没有可用 Key
        console.warn('ProxyRoute: 没有可用的 API Key，返回 503。');
        res.status(503).json({
          error: {
            code: 503,
            message: 'Service Unavailable: No available API keys.',
            status: 'UNAVAILABLE',
          },
        });
        return; // 结束请求处理
      }

      console.info(`ProxyRoute: 使用 Key ${apiKey.key} 处理请求。`);
      // 可选：增加 Key 的当前请求计数
      // apiKeyManager.incrementRequestCount(apiKey.key);

      // 2. 转发请求到 Google API
      const forwardResult = await googleApiForwarder.forwardRequest(req, apiKey);

      // 可选：减少 Key 的当前请求计数 (无论成功或失败，请求结束时都应减少)
      if (apiKey) {
        apiKeyManager.decrementRequestCount(apiKey.key);
      }


      if (forwardResult.error) {
        // 处理转发过程中发生的错误
        const err = forwardResult.error;
        console.error(`ProxyRoute: 转发请求时发生错误 (${apiKey.key}):`, err.message);

        if (err.isRateLimitError) {
          // 如果是速率限制错误，标记 Key 冷却
          apiKeyManager.markAsCoolingDown(apiKey.key, config.KEY_COOL_DOWN_DURATION_MS);
          // TODO: 实现可选的重试逻辑
          // 目前将错误传递给错误处理中间件
          next(err);
        } else if (err.statusCode === 401 || err.statusCode === 403) {
           // 认证错误，标记 Key 为 disabled (如果需要持久化状态，这里需要更多逻辑)
           // apiKeyManager.markAsDisabled(apiKey.key); // 假设有一个 markAsDisabled 方法
           console.error(`ProxyRoute: Key ${apiKey.key} 认证失败。`);
           next(err); // 将错误传递给错误处理中间件
        }
        else {
          // 其他 Google API 错误，将错误传递给错误处理中间件
          next(err);
        }

      } else if (forwardResult.stream) {
        // 处理流式响应
        console.info(`ProxyRoute: 处理流式响应 (${apiKey.key})`);
        // 调用 StreamHandler 处理流
        await streamHandler.handleStream(forwardResult.stream, res); // 等待流处理完成

      } else if (forwardResult.response) {
        // 处理非流式响应
        console.info(`ProxyRoute: 处理非流式响应 (${apiKey.key})`);
        // 直接将 Google API 返回的响应体发送给客户端
        res.json(forwardResult.response);
      } else {
         // 未知情况
         console.error(`ProxyRoute: 未知转发结果 (${apiKey.key})`);
         res.status(500).json({
            error: {
              code: 500,
              message: 'Unknown forwarding result.',
              status: 'INTERNAL',
            },
         });
      }

    } catch (error) {
      // 捕获其他潜在错误 (如 KeyManager 或 Dispatcher 错误)
      console.error('ProxyRoute: 处理请求时发生未捕获的错误:', error);
      next(error); // 传递给错误处理中间件
    }
  });

  return router; // 返回配置好的 router
}