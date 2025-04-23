import { Response } from 'express';
import { Stream } from 'stream'; // Assuming the Google API stream is a Node.js Stream

/**
 * 处理 Google API 的流式响应，并实时转发给客户端。
 */
export class StreamHandler {

  /**
   * 处理 Google API 的响应流。
   * @param googleStream 从 Google API 收到的响应流。
   * @param clientResponse 发送给客户端的 Express 响应对象。
   */
  public handleStream(googleStream: Stream, clientResponse: Response): void {
    // 设置响应头，表明是流式响应 (Server-Sent Events)
    // 注意：Google API 返回的 Content-Type 可能不同，这里先用 text/event-stream 作为示例
    // 实际应用中可能需要根据 Google API 的响应头来设置
    clientResponse.setHeader('Content-Type', 'text/event-stream');
    clientResponse.setHeader('Cache-Control', 'no-cache');
    clientResponse.setHeader('Connection', 'keep-alive');
    clientResponse.setHeader('X-Accel-Buffering', 'no'); // Nginx 等代理可能需要此头来禁用缓冲

    // 监听 Google API 流的 'data' 事件
    googleStream.on('data', (chunk: Buffer | string) => {
      // 将数据块实时写入客户端响应流
      // Google API 的流式响应通常是 JSON 格式，需要根据实际情况处理
      // 这里假设直接转发原始数据块
      clientResponse.write(chunk);
    });

    // 监听 Google API 流的 'end' 事件
    googleStream.on('end', () => {
      // Google API 流结束，结束客户端响应流
      clientResponse.end();
    });

    // 监听 Google API 流的 'error' 事件
    googleStream.on('error', (err: Error) => {
      console.error('Error from Google API stream:', err);
      // 处理错误，向客户端发送错误响应
      // 确保在发送错误前检查响应是否已发送头部
      if (!clientResponse.headersSent) {
        clientResponse.status(500).send('Error processing stream');
      } else {
        // 如果头部已发送，尝试结束响应流，但可能客户端已经开始接收数据
        clientResponse.end();
      }
    });

    // 可选：监听客户端断开连接事件，以便及时清理 Google API 流
    clientResponse.on('close', () => {
        console.log('Client disconnected, destroying Google API stream.');
        // 尝试销毁 Google API 流，释放资源
        if (typeof (googleStream as any).destroy === 'function') {
            (googleStream as any).destroy();
        }
    });
  }
}