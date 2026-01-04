# EasyJSSDK (中文版)

[English README](README.md)

一个简单易用的 WuKongIM 通讯 SDK，基于其 JSON-RPC 协议。

## 安装

```bash
npm install easyjssdk
```

## 使用方法

```typescript
// 引入必要的组件
import { WKIM, WKIMChannelType, WKIMEvent } from 'easyjssdk';

// 1. 初始化
const im = WKIM.init("ws://your-wukongim-server.com:5200", {
    uid: "your_user_id",        // 你的用户 ID
    token: "your_auth_token"    // 你的认证令牌
    // deviceId: "optional_device_id", // 可选的设备 ID
    // deviceFlag: 2 // 可选的设备标识 (1:APP, 2:WEB, 默认为 2)
});

// 2. 收消息
im.on(WKIMEvent.Message, (message) => {
    console.log("收到消息:", message);
    // 处理收到的消息 (message.payload, message.fromUid 等)
});

// 2.1 Receive custom event notifications (NEW!)
im.on(WKIMEvent.CustomEvent, (event) => {
    console.log("Received event:", event);
    // Handle custom events from server
    // event = { id, type, timestamp, data }
});

// 更多事件，查看对应文档

// 3. 连接到服务器
await im.connect()

// 4. 示例：连接成功后发送一条消息
const targetUserId = "friend_user_id"; // 目标用户 ID
const messagePayload = { type: 1, content: "来自 EasyJSSDK 的问候!" }; // 你的自定义消息负载
return im.send(targetUserId, WKIMChannelType.Person, messagePayload);
```

## 特性

- ✅ **WebSocket 通讯** - 与 WuKongIM 服务器进行实时双向通讯
- ✅ **消息收发** - 支持消息发送与接收，并具有自动回执确认
- ✅ **事件协议** - 接收来自服务器的自定义事件通知
- ✅ **自动重连** - 支持带指数退避算法的自动重连机制
- ✅ **TypeScript 支持** - 包含完整的 TypeScript 类型定义
- ✅ **多平台支持** - 支持 浏览器、Node.js、微信小程序、支付宝小程序 以及 UniApp
- ✅ **单例模式** - 可选的单例模式，方便全局实例管理

## 开发

1.  克隆本仓库。
2.  运行 `npm install` 安装依赖。
3.  运行 `npm run build` 将 TypeScript 编译成 JavaScript。

## 运行示例程序

仓库中包含一个简单的 HTML/JS 示例用于测试 SDK。

1.  **构建 SDK:** 确保你已经先构建了库文件：
    ```bash
    npm run build
    ```
2.  **启动本地服务器:** 在你的终端中，导航到本项目的根目录 (`EasyJSSDK`)。你需要使用一个本地 Web 服务器来提供文件服务，因为示例使用了 ES Modules。一个简单的方法是使用 `http-server`：
    ```bash
    # 如果你还没有 http-server，请全局安装:
    # npm install -g http-server

    # 从 EasyJSSDK 目录运行服务器:
    http-server .
    ```
    或者，使用 VS Code 的 "Live Server" 扩展或其他任何本地服务器，确保它从项目根目录 (`EasyJSSDK`) 提供服务。

3.  **打开示例:** 打开你的 Web 浏览器并访问示例页面，通常是：
    `http://localhost:8080/example/`
    (如果你的服务器使用了不同的端口号，请相应调整)。

4.  **测试:** 输入你的 WuKongIM 服务器信息 (URL, UID, Token)，然后使用按钮进行连接、断开和发送消息的测试。 