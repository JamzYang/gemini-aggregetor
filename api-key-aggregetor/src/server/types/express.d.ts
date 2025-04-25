import 'express';

declare module 'express' {
  interface Response {
    responseTime?: number;
  }
}