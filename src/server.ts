import express from 'express';
import config from './config';
import { loggerMiddleware } from './middlewares/logger';
import proxyRouter from './routes/proxy';
import errorHandler from './middlewares/errorHandler';

const app = express();
const port = config.PORT;

// 集成请求日志中间件
app.use(loggerMiddleware);

// 集成代理路由
app.use('/', proxyRouter); // 或者根据需要设置更具体的路径，例如 '/api'

// 集成统一错误处理中间件 (放在路由之后)
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});