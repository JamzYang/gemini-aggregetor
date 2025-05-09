
**一、 您的核心需求复述：**

1.  **根本问题：** 在 Cline 插件中直接使用单个 Google Gemini API Key 时，由于并发限制（`API reach limit`），无法满足正常使用需求。
2.  **目标：** 开发一个工具来解决这个问题，提高 Gemini API 的可用性和并发性。
3.  **解决方案：** 模仿 OpenRouter 的概念，构建一个本地代理服务，利用并管理多个 Google 账号下的 Gemini API Key。
4.  **工具功能：**
    *   作为一个中间层（代理服务器），接收来自客户端（例如 Cline 插件）的 API 请求。
    *   维护一个包含多个 Gemini API Key 的池。
    *   根据一定的策略，从 Key 池中选择一个 Key 用于处理当前的请求。
    *   将请求转发给真正的 Google Gemini API Endpoint。
    *   接收 Google API 的响应，并将其返回给客户端。
    *   特别要处理 Google API 返回的速率限制错误，并据此调整 Key 的使用策略（例如，临时禁用某个 Key）。
    *   **重要需求：** 需要支持将 Google API 的流式响应（Streaming）实时转发给客户端，实现类似“一个字一个字显示”的效果。
5.  **技术选型：** 使用 TypeScript 实现。

**二、 实现思路分解：**

基于上述需求，实现这个工具的主要思路如下：

1.  **搭建一个 HTTP 代理服务器：**
    *   使用TS Express.js  创建一个本地 HTTP 服务器。
    *   服务器需要监听一个特定的地址和端口，作为客户端（Cline）新的 API 请求目标。
    *   这个服务器将接收客户端发来的原始 HTTP 请求（包含请求方法、路径、头部、请求体等）。

2.  **实现 API Key 管理模块：**
    *   在内存中维护一个数据结构（如列表或字典），存储所有可用的 Google Gemini API Key。
    *   每个 Key 可能需要关联一些状态信息，例如：Key 本身、当前是否可用、如果在冷却期（收到速率限制错误后）、当前正在处理的请求数等。
    *   提供加载 Key 的方法（从配置文件或环境变量读取）。

3.  **设计请求分发/路由策略模块：**
    *   这是核心智能部分。当接收到客户端请求时，需要从 Key 池中选择一个“最佳”或“可用”的 Key。
    *   策略可以包括：
        *   简单的轮询
    *   这个模块需要考虑多并发请求到来时如何安全地选择和更新 Key 状态。

4.  **处理上游（Forward to Google API）请求：**
    *   使用选定的 Key，构造一个发送给 Google Gemini 官方 API Endpoint 的 HTTP 请求。
    *   将客户端原始请求的请求方法、大部分头部（过滤掉代理层自身的头部）、请求体等复制到这个新的请求中。
    *   将选定的 API Key 添加到 Google API 要求的认证位置（通常是请求头部或 URL 参数）。
    *   使用 @google/genai mime 发送这个请求到 Google API。

5.  **处理下游（Respond to Client）与流式转发：**
    *   接收来自 Google API 的响应。
    *   **对于流式响应：** 这是实现“字字显示”的关键。当从 Google API 收到数据块时，**不进行整体缓冲**，而是立即将这些数据块实时写入到发送给客户端的 HTTP 响应流中。确保 HTTP 响应头部设置正确，以支持流式传输（例如 `Transfer-Encoding: chunked`）。
    *   **对于非流式响应或错误：** 将 Google API 的完整响应（包括状态码、头部、响应体）返回给客户端。
    *   **处理 Google API 错误：** 特别关注速率限制相关的错误码。如果收到这类错误，根据实现策略更新对应 Key 的状态（例如，标记为临时禁用或进入冷却）。记录日志以便监控。
**总结：**