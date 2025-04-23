export interface ApiKey {
  key: string; // API Key 值
  status: 'available' | 'cooling_down' | 'disabled'; // 当前状态
  coolingDownUntil?: number; // 冷却结束时间戳 (ms)
  currentRequests: number; // 当前使用此 Key 处理的并发请求数 (可选，用于更复杂的策略)
  // 可以添加其他统计信息，如总请求数、失败次数等
}