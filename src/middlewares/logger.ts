import { Request, Response, NextFunction } from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import config from '../config';

// 创建 Pino 日志记录器实例
const logger = pino({
  level: config.LOG_LEVEL,
  transport: {
    target: 'pino-pretty', // 使用 pino-pretty 美化输出
    options: {
      colorize: true,
    },
  },
});

// 创建 pino-http 中间件
const loggerMiddleware = pinoHttp({
  logger: logger,
  // 自定义日志消息，包含请求方法、URL、状态码和响应时间
  customSuccessMessage: function (req: Request, res: Response) {
    return `${req.method} ${req.originalUrl} ${res.statusCode} `;
  },
  customErrorMessage: function (req: Request, res: Response, err: Error) {
     return `${req.method} ${req.originalUrl} ${res.statusCode} - Error: ${err.message}`;
  },
  // 过滤掉健康检查等不重要的日志 (可选)
  // autoLogging: {
  //   ignorePaths: ['/healthz'],
  // },
});

// 导出日志记录器和中间件
export { logger, loggerMiddleware };