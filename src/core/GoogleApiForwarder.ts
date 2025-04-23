import { Request } from 'express';
import { GoogleGenerativeAI, GenerativeModel, GenerateContentResponse } from '@google/generative-ai';
import { ApiKey } from '../types';
import config from '../config';

// 定义一个简单的错误类型，用于传递 Google API 错误信息，特别是包含 Key 信息
export class GoogleApiError extends Error {
  statusCode?: number;
  apiKey?: string;
  isRateLimitError: boolean;

  constructor(message: string, statusCode?: number, apiKey?: string, isRateLimitError: boolean = false) {
    super(message);
    this.name = 'GoogleApiError';
    this.statusCode = statusCode;
    this.apiKey = apiKey;
    this.isRateLimitError = isRateLimitError;
  }
}

class GoogleApiForwarder {
  async forwardRequest(clientRequest: Request, apiKey: ApiKey): Promise<{ response?: any, stream?: AsyncIterable<GenerateContentResponse>, error?: GoogleApiError }> {
    const { model } = clientRequest.params;
    const genAI = new GoogleGenerativeAI(apiKey.key);
    const generativeModel = genAI.getGenerativeModel({ model });

    try {
      // 假设客户端请求体是 JSON 格式，并且包含 generateContent 所需的参数
      const requestBody = clientRequest.body;
      const isStreaming = requestBody.stream === true;

      if (isStreaming) {
        // 处理流式请求
        const streamingResult = await generativeModel.generateContentStream(requestBody);
        console.info(`GoogleApiForwarder: 转发流式请求到模型 ${model} 使用 Key ${apiKey.key}`);
        return { stream: streamingResult.stream };
      } else {
        // 处理非流式请求
        const result = await generativeModel.generateContent(requestBody);
        const response = result.response;
        console.info(`GoogleApiForwarder: 转发非流式请求到模型 ${model} 使用 Key ${apiKey.key}`);
        return { response };
      }

    } catch (error: any) {
      console.error(`GoogleApiForwarder: 调用 Google API 时发生错误 (${apiKey.key}):`, error.message);

      // 尝试识别速率限制错误 (HTTP 429) 或其他 Google API 错误
      const statusCode = error.response?.status || error.statusCode;
      const isRateLimit = statusCode === 429; // Google API 返回 429 表示速率限制

      // 创建自定义错误对象，包含 Key 信息和是否为速率限制错误
      const googleApiError = new GoogleApiError(
        `Google API Error: ${error.message}`,
        statusCode,
        apiKey.key,
        isRateLimit
      );

      return { error: googleApiError };
    }
  }
}

export default GoogleApiForwarder;