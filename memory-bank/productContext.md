# Product Context

This file provides a high-level overview of the project and the expected product that will be created. Initially it is based upon projectBrief.md (if provided) and all other available project-related information in the working directory. This file is intended to be updated as the project evolves, and should be used to inform all other modes of the project's goals and context.
2025-04-23 18:29:55 - Log of updates made will be appended as footnotes to the end of this file.

*

## Project Goal

*   开发一个本地代理服务（Gemini Aggregator），通过管理和调度多个 Google Gemini API Key，有效规避单一 Key 的并发限制，提高 Gemini API 的整体可用性和并发处理能力，并确保流式响应能够实时转发给客户端。

## Key Features

*   提高并发性
*   提高可用性
*   透明代理
*   流式响应支持
*   易于管理
*   健壮性

## Overall Architecture

*   采用经典的代理服务器架构模式，核心组件包括 HTTP 代理服务器、API Key 管理器、请求分发器、Google API 转发器、流式响应处理器、错误处理器、配置模块和日志模块。