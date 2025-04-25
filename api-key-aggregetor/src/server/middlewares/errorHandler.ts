import { Request, Response, NextFunction } from 'express';
import { logger } from './logger'; // 导入日志记录器
import { GoogleApiError } from '../core/GoogleApiForwarder'; // 导入自定义错误类型
import ApiKeyManager from '../core/ApiKeyManager'; // 导入 ApiKeyManager (用于处理速率限制)
import config from '../config'; // 导入配置


const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // 记录详细错误日志
  logger.error({ err, req }, `处理请求时发生错误: ${err.message}`);

  let statusCode = 500;
  let message = 'Internal Server Error';
  let status = 'INTERNAL'; // 映射到 Google API 的错误状态

  if (err instanceof GoogleApiError) {
    statusCode = err.statusCode || 500;
    message = `Google API Error: ${err.message}`;

    if (err.isRateLimitError) {
      status = 'RESOURCE_EXHAUSTED';
      // 在代理路由中已经处理了 Key 的冷却标记，这里不再重复
      // 如果需要在错误处理中间件中处理，可以取消注释下面的代码
      // if (err.apiKey) {
      //   apiKeyManager.markAsCoolingDown(err.apiKey, config.KEY_COOL_DOWN_DURATION_MS);
      // }
    } else if (statusCode === 401 || statusCode === 403) {
       status = 'UNAUTHENTICATED'; // 或 PERMISSION_DENIED
    } else {
       // 其他 Google API 错误，尝试从错误信息中提取更具体的 Google API 状态
       // 这可能需要解析 Google API 返回的错误体，这里简化处理
       status = 'INTERNAL'; // 默认映射为 INTERNAL
    }

  } else if (err.message.includes('No available API keys')) {
     // 处理无可用 Key 的错误 (如果代理路由没有完全处理)
     statusCode = 503;
     message = 'Service Unavailable: No available API keys.';
     status = 'UNAVAILABLE';
  }
  // 可以添加其他自定义错误类型的处理

  // 向客户端返回标准格式的错误响应
  res.status(statusCode).json({
    error: {
      code: statusCode,
      message: message,
      status: status,
      // 可选：在开发模式下包含错误堆栈
      // ...(process.env.NODE_ENV === 'development' && { details: err.stack }),
    },
  });
};

export default errorHandler;