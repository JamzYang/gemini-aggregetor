# Gemini Aggregator - TODO List

## 项目设置与基础结构 (Project Setup & Infrastructure)

- [x] 初始化 npm 项目 (`npm init -y`)
- [x] 安装 TypeScript 和相关类型定义 (`npm install -D typescript @types/node @types/express`)
- [ ] 配置 TypeScript (`tsconfig.json`)
- [x] 安装 Express (`npm install express`)
- [x] 设置 Git 忽略文件 (`.gitignore`)
- [x] 创建 `.env.example` 文件并定义所需环境变量
- [x] 安装 `dotenv` 用于加载环境变量 (`npm install dotenv`)
- [x] 选择并安装日志库 (如 `pino` 或 `winston`) (`npm install pino` 或 `npm install winston`)
- [x] 安装 `@google/generative-ai` SDK (`npm install @google/generative-ai`)

## 配置模块 (`src/config/index.ts`)

- [x] 实现加载 `.env` 文件的逻辑
- [x] 定义并导出类型安全的配置对象 (PORT, GEMINI_API_KEYS, KEY_COOL_DOWN_DURATION_MS, LOG_LEVEL, DISPATCH_STRATEGY)

## 类型定义 (`src/types/`)

- [x] 定义 `ApiKey` 接口 (`src/types/ApiKey.ts`) 包含 `key`, `status`, `coolingDownUntil`, `currentRequests` 等字段
- [x] 创建 `src/types/index.ts` 用于导出所有类型

## API Key 管理器 (`src/core/ApiKeyManager.ts`)

- [x] 实现 `ApiKeyManager` 类
- [x] 实现 `loadKeys()` 方法从配置加载 API Keys
- [x] 实现 Key 池的数据结构 (例如 `Map<string, ApiKey>`)
- [x] 实现 `getAvailableKey()` 方法，根据状态和冷却时间选择可用 Key
- [x] 实现 `markAsCoolingDown(key: string, durationMs: number)` 方法
- [x] 实现 `markAsAvailable(key: string)` 方法
- [x] 实现 `incrementRequestCount(key: string)` 和 `decrementRequestCount(key: string)` (如果选择实现基于连接数的策略)
- [x] 实现定期检查冷却 Key 是否可恢复的逻辑 (例如使用 `setInterval`)
- [x] 考虑并处理并发访问 Key 池的潜在问题 (虽然 Node.js 单线程，但异步操作可能影响)

## 请求分发器 (`src/core/RequestDispatcher.ts`)

- [x] 实现 `RequestDispatcher` 类
- [x] 注入 `ApiKeyManager` 实例
- [x] 实现 `selectApiKey()` 方法
- [x] 实现至少一种 Key 选择策略 (例如简单轮询)
- [x] 处理无法获取可用 Key 的情况 (返回 null 或抛出错误)

## Google API 转发器 (`src/core/GoogleApiForwarder.ts`)

- [x] 实现 `GoogleApiForwarder` 类
- [x] 实现 `forwardRequest(clientRequest: Request, apiKey: ApiKey)` 方法
- [x] 使用 `@google/generative-ai` SDK 或 `https` 模块构造和发送请求
- [x] 正确设置 `x-goog-api-key` 等请求头
- [x] 复制必要的客户端请求头和请求体
- [x] 实现非流式请求的处理逻辑
- [x] 识别 Google API 返回的错误，特别是 429 错误

## 流式响应处理器 (集成在 `GoogleApiForwarder.ts` 或 `proxy.ts` 或 `src/core/StreamHandler.ts`)

- [x] 实现处理 Google API 流式响应 (`generateContentStream`) 的逻辑
- [x] 监听流的 `data` 事件，并将数据块 (`chunk`) 实时写入客户端响应流 (`response.write(chunk)`)
- [x] 监听流的 `end` 事件，结束客户端响应流 (`response.end()`)
- [x] 监听流的 `error` 事件，进行错误处理

## HTTP 代理服务器 (`src/server.ts`)

- [ ] 创建 Express 应用实例
- [ ] 使用配置模块加载端口号
- [ ] 启动服务器并监听端口
- [ ] 集成日志中间件 (请求日志)
- [ ] 集成代理路由 (`src/routes/proxy.ts`)
- [ ] 集成统一错误处理中间件 (`src/middlewares/errorHandler.ts`) (应放在路由之后)

## 代理路由 (`src/routes/proxy.ts`)

- [ ] 创建 Express Router
- [ ] 定义 `POST /v1beta/models/:model:generateContent` (或其他 Gemini API 路径) 路由
- [ ] 在路由处理函数中：
    - [ ] 解析客户端请求 (路径参数, 请求体)
    - [ ] 调用 `RequestDispatcher` 获取 `ApiKey`
    - [ ] 处理获取不到 Key 的情况
    - [ ] 调用 `GoogleApiForwarder` 转发请求
    - [ ] 处理来自 `GoogleApiForwarder` 的响应：
        - [ ] 如果是普通响应，将其发送回客户端
        - [ ] 如果是流式响应，调用流式响应处理逻辑将流 pipe 到客户端响应
    - [ ] 处理来自 `GoogleApiForwarder` 的错误
    - [ ] 调用 `ApiKeyManager` 的 `decrementRequestCount` (如果适用)

## 中间件 (`src/middlewares/`)

- [ ] **日志中间件 (`logger.ts`)**:
    - [x] 使用选定的日志库 (pino/winston) 创建日志记录器实例
    - [x] 实现记录请求信息的中间件 (方法, URL, 状态码, 耗时等)
- [ ] **错误处理中间件 (`errorHandler.ts`)**:
    - [x] 实现 Express 错误处理中间件 `(err, req, res, next)`
    - [x] 识别错误类型 (自定义错误、HTTP 错误、Google API 错误)
    - [x] **处理 429 错误**:
        - [x] 从错误信息中提取触发限制的 Key (需要 `GoogleApiForwarder` 传递此信息)
        - [x] 调用 `ApiKeyManager.markAsCoolingDown()`
        - [ ] 实现可选的重试逻辑 (获取新 Key 并重新调用转发)
    - [x] 记录详细错误日志
    - [x] 向客户端发送标准化的错误响应 (JSON 格式)

## 测试 (Testing)

- [ ] 编写 `ApiKeyManager` 的单元测试
- [ ] 编写 `RequestDispatcher` 的单元测试
- [ ] 编写 `GoogleApiForwarder` 的模拟测试 (mock Google API)
- [ ] 编写代理路由的集成测试

## 文档 (Documentation)

- [ ] 更新 `README.md`，包含项目介绍、如何安装、配置和运行

## 部署 (Deployment - 可选)

- [ ] 创建 `Dockerfile`
- [ ] 配置 PM2 进程管理