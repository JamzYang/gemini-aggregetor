# API Key Aggregator VS Code Extension

这是一个将 Google Gemini API Key 本地代理服务器集成到 VS Code 插件中的项目。旨在解决使用单个 API Key 时的并发限制问题，并支持流式响应。

## 功能

*   在 VS Code 插件中内嵌一个 HTTP 代理服务器。
*   管理多个 Google Gemini API Key。
*   根据策略（目前是简单轮询）分发 API 请求到不同的 Key。
*   支持 Google Gemini API 的流式响应转发。
*   处理速率限制错误，并对 Key 进行冷却。

## 安装和运行

1.  **克隆项目：**
    ```bash
    git clone your_repository_url
    cd gemini-aggregetor
    ```
2.  **安装依赖：**
    ```bash
    npm install -g yo generator-code
    npm install
    cd api-key-aggregetor
    npm install
    ```
3.  **在 VS Code 中打开插件项目：**
    ```bash
    code api-key-aggregetor
    ```
4.  **配置 API Key：**
    目前 API Key 是在代码中硬编码的（位于 `src/server/config/index.ts` 或其他相关文件）。**请注意：这仅用于开发测试。** 未来将通过 VS Code 配置界面进行管理。
    **临时配置方法：** 修改 `api-key-aggregetor/src/server/config/index.ts` 文件，在 `GEMINI_API_KEYS` 数组中填入你的 API Key。
    ```typescript
    const config: Config = {
      // ... other configurations
      GEMINI_API_KEYS: ["YOUR_API_KEY_1", "YOUR_API_KEY_2"], // Replace with your actual keys
      // ... other configurations
    };
    ```
5.  **运行插件（调试模式）：**
    *   在新打开的 VS Code 窗口中，打开调试视图 (Debug View) (通常在侧边栏的虫子图标)。
    *   在顶部的下拉菜单中选择 "Run Extension" 配置。
    *   点击绿色的开始调试按钮 (Start Debugging)。

    这将会打开一个新的 VS Code 窗口，其中加载了我们正在开发的插件。插件激活时，内嵌的代理服务器应该会启动，并在调试控制台中输出启动信息（例如 "Proxy server is running on port XXXX"）。

## 与其他扩展集成（例如 Cline）

一旦代理服务器成功启动，它将监听一个特定的端口（目前硬编码为 3000）。其他需要使用 Gemini API 的扩展（如 Cline）可以将它们的 API Endpoint 配置指向这个本地代理服务器的地址和端口。

例如，在 Cline 插件的设置中，将 Gemini API Endpoint 配置为 `http://localhost:3000`。

## 项目状态和未来计划

*   核心代理逻辑已初步集成到插件中。
*   需要实现一个用户友好的 VS Code 配置界面来管理 API Key 和其他设置。
*   完善错误处理和日志记录。
*   考虑更复杂的请求分发策略。
*   编写单元测试和集成测试。
