"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// 加载环境变量
dotenv_1.default.config();
// 从环境变量中解析配置
const config = {
    PORT: parseInt(process.env.PORT || '3000', 10),
    GEMINI_API_KEYS: process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',').map(key => key.trim()).filter(key => key.length > 0) : [],
    KEY_COOL_DOWN_DURATION_MS: parseInt(process.env.KEY_COOL_DOWN_DURATION_MS || '60000', 10),
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    DISPATCH_STRATEGY: process.env.DISPATCH_STRATEGY || 'round_robin',
};
// 验证必要的配置项
if (config.GEMINI_API_KEYS.length === 0) {
    console.warn('警告: 未配置 GEMINI_API_KEYS。请在 .env 文件中设置 GEMINI_API_KEYS。');
}
// 导出配置对象
exports.default = config;
//# sourceMappingURL=index.js.map