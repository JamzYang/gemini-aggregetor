import express from 'express';
import config from './config';
import { loggerMiddleware } from './middlewares/logger';
import createProxyRouter from './routes/proxy'; // Import the function
import errorHandler from './middlewares/errorHandler';
import ApiKeyManager from './core/ApiKeyManager'; // Import dependencies
import RequestDispatcher from './core/RequestDispatcher';
import GoogleApiForwarder from './core/GoogleApiForwarder';
import { StreamHandler } from './core/StreamHandler';

const app = express();
const port = config.PORT;

// Create instances of dependencies
const apiKeyManager = new ApiKeyManager();
const googleApiForwarder = new GoogleApiForwarder();
const streamHandler = new StreamHandler();
const requestDispatcher = new RequestDispatcher(apiKeyManager); // Assuming RequestDispatcher needs ApiKeyManager

// Create the proxy router by calling the function
const proxyRouter = createProxyRouter(apiKeyManager, requestDispatcher, googleApiForwarder, streamHandler);

// 集成解析 JSON 请求体的中间件
app.use(express.json());

// 集成请求日志中间件
app.use(loggerMiddleware);

// 集成代理路由
app.use('/', proxyRouter); // Use the created router instance

// 集成统一错误处理中间件 (放在路由之后)
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});