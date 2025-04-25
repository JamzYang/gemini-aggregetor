"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleApiError = void 0;
const generative_ai_1 = require("@google/generative-ai");
// 定义一个简单的错误类型，用于传递 Google API 错误信息，特别是包含 Key 信息
class GoogleApiError extends Error {
    statusCode;
    apiKey;
    isRateLimitError;
    constructor(message, statusCode, apiKey, isRateLimitError = false) {
        super(message);
        this.name = 'GoogleApiError';
        this.statusCode = statusCode;
        this.apiKey = apiKey;
        this.isRateLimitError = isRateLimitError;
    }
}
exports.GoogleApiError = GoogleApiError;
class GoogleApiForwarder {
    async forwardRequest(modelId, methodName, requestBody, apiKey) {
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey.key);
        const generativeModel = genAI.getGenerativeModel({ model: modelId });
        try {
            let result;
            if (methodName === 'generateContent') {
                // 处理非流式请求
                result = await generativeModel.generateContent(requestBody);
                const response = result.response;
                console.info(`GoogleApiForwarder: 转发非流式请求到模型 ${modelId} 使用 Key ${apiKey.key}`);
                return { response };
            }
            else if (methodName === 'streamGenerateContent') {
                // 处理流式请求
                result = await generativeModel.generateContentStream(requestBody);
                console.info(`GoogleApiForwarder: 转发流式请求到模型 ${modelId} 使用 Key ${apiKey.key}`);
                return { stream: result.stream };
            }
            else {
                // 理论上这部分代码不会被执行，因为 ProxyRoute 已经做了方法名验证
                // 但作为防御性编程，保留此处的错误处理
                const unsupportedMethodError = new GoogleApiError(`Unsupported API method: ${methodName}`, 400, // Bad Request
                apiKey.key, false);
                console.error(`GoogleApiForwarder: 不支持的 API 方法 (${apiKey.key}):`, methodName);
                return { error: unsupportedMethodError };
            }
        }
        catch (error) {
            console.error(`GoogleApiForwarder: 调用 Google API 时发生错误 (${apiKey.key}):`, error.message);
            // 尝试识别速率限制错误 (HTTP 429) 或其他 Google API 错误
            const statusCode = error.response?.status || error.statusCode;
            const isRateLimit = statusCode === 429; // Google API 返回 429 表示速率限制
            // 创建自定义错误对象，包含 Key 信息和是否为速率限制错误
            const googleApiError = new GoogleApiError(`Google API Error: ${error.message}`, statusCode, apiKey.key, isRateLimit);
            return { error: googleApiError };
        }
    }
}
exports.default = GoogleApiForwarder;
//# sourceMappingURL=GoogleApiForwarder.js.map