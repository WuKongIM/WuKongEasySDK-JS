# EasyJSSDK (中文版)

[English README](README.md)

一个简单易用的 WuKongIM 通讯 SDK，基于其 JSON-RPC 协议。

## 安装

```bash
npm install easyjssdk
```

## 平台支持

| 平台 | 状态 | 说明 |
|------|------|------|
| 浏览器 | ✅ | 原生 WebSocket |
| Node.js | ✅ | 通过 `ws`（自动作为可选依赖安装） |
| 微信小程序 | ✅ | 使用 `wx.connectSocket` |
| 支付宝小程序 | ✅ | 使用 `my.connectSocket` |
| UniApp | ✅ | 使用 `uni.connectSocket` |

### 微信小程序

SDK 完全兼容微信小程序的 npm 构建：

1. 在小程序项目中安装：
   ```bash
   npm install easyjssdk
   ```
2. 在微信开发者工具中，点击 **工具 → 构建 npm**
3. 引入使用：
   ```javascript
   const { WKIM, WKIMChannelType, WKIMEvent } = require('easyjssdk');
   ```

`package.json` 中的 `miniprogram` 字段指向 CJS 构建产物，小程序构建工具可以正确定位入口。`ws` 为可选依赖，不会被打包进小程序。

## 使用方法

```typescript
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

// 2.1 接收自定义事件通知
im.on(WKIMEvent.CustomEvent, (event) => {
    console.log("收到事件:", event);
    // 处理来自服务器的自定义事件
    // event = { id, type, timestamp, data }
});

// 更多事件请参考：
// https://github.com/WuKongIM/EasyJSSDK/blob/main/example/app.js#L132

// 3. 连接到服务器
await im.connect()

// 4. 示例：连接成功后发送一条消息
const targetUserId = "friend_user_id"; // 目标用户 ID
const messagePayload = { type: 1, content: "来自 EasyJSSDK 的问候!" };
const sendResult = await im.send(targetUserId, WKIMChannelType.Person, messagePayload);
// sendResult.reasonCode
```

## 特性

- **WebSocket 通讯** - 与 WuKongIM 服务器进行实时双向通讯
- **消息收发** - 支持消息发送与接收，并具有自动回执确认
- **事件协议** - 接收来自服务器的自定义事件通知
- **自动重连** - 支持带指数退避算法的自动重连机制
- **TypeScript 支持** - 包含完整的 TypeScript 类型定义
- **多平台支持** - 浏览器、Node.js、微信小程序、支付宝小程序、UniApp
- **双模块格式** - 同时提供 ESM 和 CommonJS 构建产物
- **单例模式** - 可选的单例模式，方便全局实例管理

## 模块格式

包提供双格式构建产物：

- **ESM** (`dist/esm/`) — 用于现代打包工具和 `import` 语法
- **CJS** (`dist/cjs/`) — 用于 `require()`、Node.js 和小程序环境

`package.json` 中的 `exports` 字段自动处理模块解析：

```jsonc
// package.json（节选）
{
  "main": "dist/cjs/index.js",       // CJS 入口
  "module": "dist/esm/index.js",     // ESM 入口
  "types": "dist/esm/index.d.ts",    // TypeScript 类型
  "miniprogram": "dist/cjs"          // 微信小程序入口
}
```

## 事件协议

SDK 支持事件协议，可以接收来自服务器的自定义事件通知：

```javascript
// 监听自定义事件
im.on(WKIMEvent.CustomEvent, (event) => {
    console.log('事件类型:', event.type);
    console.log('事件数据:', event.data);

    // 处理不同类型的事件
    switch (event.type) {
        case 'user.status.changed':
            updateUserStatus(event.data);
            break;
        case 'system.announcement':
            showAnnouncement(event.data);
            break;
    }
});
```

**事件结构：**
- `id` - 唯一事件标识符
- `type` - 事件类型（如 "user.status.changed"）
- `timestamp` - 事件时间戳（毫秒）
- `data` - 事件负载数据（自动从 JSON 解析）

更多文档：
- [事件协议快速入门](./docs/EVENT_PROTOCOL_QUICKSTART.md)
- [完整事件协议文档](./docs/EVENT_PROTOCOL.md)
- [事件协议示例](./example/event-example.js)
- [交互式事件测试页面](./example/event-test.html)

## 开发

1. 克隆本仓库。
2. 运行 `npm install` 安装依赖。
3. 运行 `npm run build` 编译 TypeScript（同时输出 ESM 和 CJS）。
4. 运行 `npm test` 运行测试套件。

## 运行示例程序

仓库中包含一个简单的 HTML/JS 示例用于测试 SDK。

1.  **构建 SDK：**
    ```bash
    npm run build
    ```
2.  **启动本地服务器：**
    ```bash
    # npm install -g http-server
    http-server .
    ```
3.  **打开示例：** 浏览器访问 `http://localhost:8080/example/`
4.  **测试：** 输入你的 WuKongIM 服务器信息（URL、UID、Token），使用按钮进行连接、断开和发送消息的测试。
