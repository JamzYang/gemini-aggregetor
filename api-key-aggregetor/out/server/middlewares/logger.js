"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggerMiddleware = exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const pino_http_1 = __importDefault(require("pino-http"));
const config_1 = __importDefault(require("../config"));
// 创建 Pino 日志记录器实例
const logger = (0, pino_1.default)({
    level: config_1.default.LOG_LEVEL,
    transport: {
        target: 'pino-pretty', // 使用 pino-pretty 美化输出
        options: {
            colorize: true,
        },
    },
});
exports.logger = logger;
// 创建 pino-http 中间件
const loggerMiddleware = (0, pino_http_1.default)({
    logger: logger,
    // 自定义日志消息，包含请求方法、URL、状态码和响应时间
    customSuccessMessage: function (req, res) {
        return `${req.method} ${req.originalUrl} ${res.statusCode} `;
    },
    customErrorMessage: function (req, res, err) {
        return `${req.method} ${req.originalUrl} ${res.statusCode} - Error: ${err.message}`;
    },
    // 过滤掉健康检查等不重要的日志 (可选)
    // autoLogging: {
    //   ignorePaths: ['/healthz'],
    // },
});
exports.loggerMiddleware = loggerMiddleware;
//# sourceMappingURL=logger.js.map