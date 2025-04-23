import GoogleApiForwarder, { GoogleApiError } from '../GoogleApiForwarder';
import { GoogleGenerativeAI, GenerativeModel, GenerateContentResponse } from '@google/generative-ai';
import { Request } from 'express';
import { ApiKey } from '../../types';

// Mock @google/generative-ai 模块
jest.mock('@google/generative-ai');

describe('GoogleApiForwarder', () => {
  let googleApiForwarder: GoogleApiForwarder;
  let mockGoogleGenerativeAI: jest.Mocked<GoogleGenerativeAI>;
  let mockGenerativeModel: jest.Mocked<GenerativeModel>;

  const mockApiKey: ApiKey = {
    key: 'test-api-key',
    status: 'available',
    currentRequests: 0,
  };

  const mockRequest = (body: any, params: any = { model: 'gemini-pro' }) => ({
    params,
    body,
  } as Request);

  beforeEach(() => {
    // 清除所有模拟
    jest.clearAllMocks();

    // Mock the methods on the prototype of GenerativeModel
    // This avoids needing to mock the private _requestOptions property
    mockGenerativeModel = {
      generateContent: jest.fn(),
      generateContentStream: jest.fn(),
      // Add other methods if needed by the tests
    } as any; // Use 'any' for the mock implementation

    // Mock the getGenerativeModel method on the prototype of GoogleGenerativeAI
    // This controls what is returned when getGenerativeModel is called
    mockGoogleGenerativeAI = {
        getGenerativeModel: jest.fn().mockReturnValue(mockGenerativeModel),
        // Add other methods if needed by the tests
    } as any; // Use 'any' for the mock implementation

    // Set the mock implementation for the GoogleGenerativeAI constructor
    // This ensures that when `new GoogleGenerativeAI(...)` is called,
    // it returns our mock object.
    (GoogleGenerativeAI as jest.Mock).mockImplementation((apiKey: string) => {
        // Verify constructor received correct API Key
        expect(apiKey).toBe(mockApiKey.key);
        return mockGoogleGenerativeAI;
    });

    // Instantiate GoogleApiForwarder
    googleApiForwarder = new GoogleApiForwarder();
  });

  test('should forward non-streaming request and return response', async () => {
    const requestBody = { contents: [{ parts: [{ text: 'hello' }] }] };
    const mockResponse = { text: () => 'mocked response' };

    // 设置模拟的 generateContent 方法的返回值
    mockGenerativeModel.generateContent.mockResolvedValue({ response: mockResponse } as any);

    const result = await googleApiForwarder.forwardRequest(mockRequest(requestBody).params.model, 'generateContent', requestBody, mockApiKey);

    // 验证 GoogleGenerativeAI 构造函数是否被调用
    expect(GoogleGenerativeAI).toHaveBeenCalledTimes(1);
    // 验证 getGenerativeModel 是否被调用
    expect(mockGoogleGenerativeAI.getGenerativeModel).toHaveBeenCalledTimes(1);
    expect(mockGoogleGenerativeAI.getGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-pro' });
    // 验证 generateContent 是否被调用
    expect(mockGenerativeModel.generateContent).toHaveBeenCalledTimes(1);
    expect(mockGenerativeModel.generateContent).toHaveBeenCalledWith(requestBody);
    // 验证 generateContentStream 是否未被调用
    expect(mockGenerativeModel.generateContentStream).not.toHaveBeenCalled();
    // 验证返回结果
    expect(result.response).toBe(mockResponse);
    expect(result.stream).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  test('should forward streaming request and return stream', async () => {
    const requestBody = { contents: [{ parts: [{ text: 'hello' }] }], stream: true };
    const mockStream = (async function*() { yield { text: 'chunk1' }; yield { text: 'chunk2' }; })(); // 模拟 AsyncIterable

    // 设置模拟的 generateContentStream 方法的返回值
    mockGenerativeModel.generateContentStream.mockResolvedValue({ stream: mockStream } as any);

    const result = await googleApiForwarder.forwardRequest(mockRequest(requestBody).params.model, 'generateContentStream', requestBody, mockApiKey);

    // 验证 generateContentStream 是否被调用
    expect(mockGenerativeModel.generateContentStream).toHaveBeenCalledTimes(1);
    expect(mockGenerativeModel.generateContentStream).toHaveBeenCalledWith(requestBody);
    // 验证 generateContent 是否未被调用
    expect(mockGenerativeModel.generateContent).not.toHaveBeenCalled();
    // 验证返回结果
    expect(result.stream).toBe(mockStream);
    expect(result.response).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  test('should handle Google API error for non-streaming request', async () => {
    const requestBody = { contents: [{ parts: [{ text: 'hello' }] }] };
    const mockError = new Error('API error');
    (mockError as any).response = { status: 400 }; // 模拟 HTTP 状态码

    // 设置模拟的 generateContent 方法抛出错误
    mockGenerativeModel.generateContent.mockRejectedValue(mockError);

    const result = await googleApiForwarder.forwardRequest(mockRequest(requestBody).params.model, 'generateContent', requestBody, mockApiKey);

    // 验证 generateContent 是否被调用
    expect(mockGenerativeModel.generateContent).toHaveBeenCalledTimes(1);
    // 验证返回结果包含错误
    expect(result.error).toBeInstanceOf(GoogleApiError);
    expect(result.error?.message).toContain('Google API Error: API error');
    expect(result.error?.statusCode).toBe(400);
    expect(result.error?.apiKey).toBe(mockApiKey.key);
    expect(result.error?.isRateLimitError).toBe(false);
    expect(result.response).toBeUndefined();
    expect(result.stream).toBeUndefined();
  });

  test('should handle Google API rate limit error (429)', async () => {
    const requestBody = { contents: [{ parts: [{ text: 'hello' }] }] };
    const mockError = new Error('Rate limit exceeded');
    (mockError as any).response = { status: 429 }; // 模拟 HTTP 429 状态码

    // 设置模拟的 generateContent 方法抛出错误
    mockGenerativeModel.generateContent.mockRejectedValue(mockError);

    const result = await googleApiForwarder.forwardRequest(mockRequest(requestBody).params.model, 'generateContent', requestBody, mockApiKey);

    // 验证返回结果包含错误
    expect(result.error).toBeInstanceOf(GoogleApiError);
    expect(result.error?.message).toContain('Google API Error: Rate limit exceeded');
    expect(result.error?.statusCode).toBe(429);
    expect(result.error?.apiKey).toBe(mockApiKey.key);
    expect(result.error?.isRateLimitError).toBe(true); // 验证 isRateLimitError 为 true
    expect(result.response).toBeUndefined();
    expect(result.stream).toBeUndefined();
  });

  test('should handle Google API error for streaming request', async () => {
    const requestBody = { contents: [{ parts: [{ text: 'hello' }] }], stream: true };
    const mockError = new Error('Streaming API error');
    (mockError as any).response = { status: 500 }; // 模拟 HTTP 状态码

    // 设置模拟的 generateContentStream 方法抛出错误
    mockGenerativeModel.generateContentStream.mockRejectedValue(mockError);

    const result = await googleApiForwarder.forwardRequest(mockRequest(requestBody).params.model, 'generateContentStream', requestBody, mockApiKey);

    // 验证 generateContentStream 是否被调用
    expect(mockGenerativeModel.generateContentStream).toHaveBeenCalledTimes(1);
    // 验证返回结果包含错误
    expect(result.error).toBeInstanceOf(GoogleApiError);
    expect(result.error?.message).toContain('Google API Error: Streaming API error');
    expect(result.error?.statusCode).toBe(500);
    expect(result.error?.apiKey).toBe(mockApiKey.key);
    expect(result.error?.isRateLimitError).toBe(false);
    expect(result.response).toBeUndefined();
    expect(result.stream).toBeUndefined();
  });
});