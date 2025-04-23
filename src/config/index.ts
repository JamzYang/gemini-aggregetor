import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 定义配置接口
interface Config {
  PORT: number;
  GEMINI_API_KEYS: string[];
  KEY_COOL_DOWN_DURATION_MS: number;
  LOG_LEVEL: string;
  DISPATCH_STRATEGY: string;
}

// 从环境变量中解析配置
const config: Config = {
  PORT: parseInt(process.env.PORT || '80', 10),
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
export default config;