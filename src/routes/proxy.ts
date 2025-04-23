import { Router, Request, Response, NextFunction } from 'express';
import ApiKeyManager from '../core/ApiKeyManager';
import RequestDispatcher from '../core/RequestDispatcher';
import GoogleApiForwarder, { GoogleApiError } from '../core/GoogleApiForwarder';
import config from '../config';
import { GenerateContentResponse } from '@google/generative-ai';

const router = Router();

// 实例化核心管理器和转发器 (这里简化处理，实际应用中可能通过依赖注入或单例模式管理)
const apiKeyManager = new ApiKeyManager();
const requestDispatcher = new RequestDispatcher(apiKeyManager);
const googleApiForwarder = new GoogleApiForwarder();

// 定义代理路由，匹配 Gemini API 的 generateContent 路径
router.post('/v1beta/models/:model:generateContent', async (req: Request, res: Response, next: NextFunction) => {
  let apiKey = null;
  try {
    // 1. 获取可用 API Key
    apiKey = await requestDispatcher.selectApiKey();

    if (!apiKey) {
      // 没有可用 Key
      console.warn('ProxyRoute: 没有可用的 API Key，返回 503。');
      return res.status(503).json({
        error: {
          code: 503,
          message: 'Service Unavailable: No available API keys.',
          status: 'UNAVAILABLE',
        },
      });
    }

    console.info(`ProxyRoute: 使用 Key ${apiKey.key} 处理请求。`);
    // 可选：增加 Key 的当前请求计数
    // apiKeyManager.incrementRequestCount(apiKey.key);

    // 2. 转发请求到 Google API
    const forwardResult = await googleApiForwarder.forwardRequest(req, apiKey);

    // 可选：减少 Key 的当前请求计数 (无论成功或失败，请求结束时都应减少)
    // if (apiKey) {
    //   apiKeyManager.decrementRequestCount(apiKey.key);
    // }


    if (forwardResult.error) {
      // 处理转发过程中发生的错误
      const err = forwardResult.error;
      console.error(`ProxyRoute: 转发请求时发生错误 (${apiKey.key}):`, err.message);

      if (err.isRateLimitError) {
        // 如果是速率限制错误，标记 Key 冷却
        apiKeyManager.markAsCoolingDown(apiKey.key, config.KEY_COOL_DOWN_DURATION_MS);
        // TODO: 实现可选的重试逻辑
        // 目前直接返回错误给客户端
        return res.status(err.statusCode || 429).json({
           error: {
             code: err.statusCode || 429,
             message: `Rate limit exceeded for key. ${err.message}`,
             status: 'RESOURCE_EXHAUSTED', // 映射到 Google API 的 RESOURCE_EXHAUSTED 状态
           }
        });
      } else if (err.statusCode === 401 || err.statusCode === 403) {
         // 认证错误，标记 Key 为 disabled (如果需要持久化状态，这里需要更多逻辑)
         // apiKeyManager.markAsDisabled(apiKey.key); // 假设有一个 markAsDisabled 方法
         console.error(`ProxyRoute: Key ${apiKey.key} 认证失败。`);
         return res.status(err.statusCode).json({
            error: {
              code: err.statusCode,
              message: `Authentication failed for key. ${err.message}`,
              status: 'UNAUTHENTICATED', // 或 PERMISSION_DENIED
            }
         });
      }
      else {
        // 其他 Google API 错误，透传状态码和信息
        return res.status(err.statusCode || 500).json({
          error: {
            code: err.statusCode || 500,
            message: `Google API Error: ${err.message}`,
            status: 'INTERNAL', // 或根据 Google API 错误类型映射
          },
        });
      }

    } else if (forwardResult.stream) {
      // 处理流式响应
      console.info(`ProxyRoute: 处理流式响应 (${apiKey.key})`);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Nginx 优化

      try {
        for await (const chunk of forwardResult.stream) {
           // 将每个数据块写入客户端响应流
           // Google SDK 的 generateContentStream 返回的是 GenerateContentResponse 对象，需要转换为适合 SSE 的格式
           // 这里简化处理，直接发送 JSON 字符串，客户端需要解析
           res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        res.end(); // 流结束
        console.info(`ProxyRoute: 流式响应结束 (${apiKey.key})`);
      } catch (streamError: any) {
         console.error(`ProxyRoute: 处理流式响应时发生错误 (${apiKey.key}):`, streamError.message);
         // 流处理错误，尝试标记 Key 冷却（如果错误表明是 Key 问题）
         // 这里简化处理，直接结束响应并记录错误
         if (!res.headersSent) {
            res.status(500).json({
               error: {
                 code: 500,
                 message: 'Stream processing error.',
                 status: 'INTERNAL',
               },
            });
         } else {
            // 如果头部已发送，只能结束流
            res.end();
         }
         // TODO: 根据 streamError 类型判断是否需要标记 Key 冷却
      }


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


export default router;