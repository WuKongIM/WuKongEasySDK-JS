# Connection Management Guide

## 问题描述

浏览器刷新后发现服务器建立了多个长连接，而且服务器关闭其中一个旧的连接也会触发当前 SDK 的 WebSocket close 事件。

## 问题原因

1. **多个长连接产生的原因**：
   - 浏览器刷新时，旧的 WebSocket 连接可能还没有完全关闭
   - 新页面立即创建新连接，导致同一用户有多个活跃连接
   - 缺少唯一的会话标识符来区分不同的连接实例

2. **连接混淆的原因**：
   - 认证参数中缺少唯一的设备标识符
   - 服务器端可能根据 `uid` + `deviceId` 来管理连接
   - 当多个连接使用相同的 `deviceId` 时，服务器可能会混淆或关闭错误的连接

## 解决方案

### 1. 自动生成唯一设备标识符

SDK 现在会为每个实例自动生成唯一的 `deviceId`：

```javascript
// 每次初始化都会生成唯一的 deviceId
const im = WKIM.init('ws://localhost:5100', {
    uid: 'user123',
    token: 'your-token'
    // deviceId 将自动生成：web_12345678_1703123456789
});
```

### 2. 页面卸载时自动清理连接

SDK 会自动监听页面卸载事件并清理连接：

```javascript
// 页面刷新或关闭时，SDK 会自动断开连接
window.addEventListener('beforeunload', () => {
    // SDK 内部会自动处理
});
```

### 3. 单例模式管理（推荐）

使用单例模式确保只有一个活跃连接：

```javascript
// 启用单例模式（默认）
const im1 = WKIM.init('ws://localhost:5100', authOptions);

// 第二次初始化会自动销毁第一个实例
const im2 = WKIM.init('ws://localhost:5100', authOptions);

// 禁用单例模式
const im3 = WKIM.init('ws://localhost:5100', authOptions, { singleton: false });
```

### 4. 手动管理连接生命周期

```javascript
const im = WKIM.init('ws://localhost:5100', authOptions);

// 连接
await im.connect();

// 业务逻辑...

// 断开连接（保留实例）
im.disconnect();

// 完全销毁实例（推荐在页面卸载前调用）
im.destroy();
```

## 最佳实践

### 1. SPA 应用中的使用

```javascript
// 在应用启动时初始化
const im = WKIM.init('ws://localhost:5100', {
    uid: getCurrentUserId(),
    token: getAuthToken()
});

// 在合适的时机连接
await im.connect();

// 在应用销毁时清理
window.addEventListener('beforeunload', () => {
    im.destroy();
});
```

### 2. React 应用中的使用

```javascript
import { useEffect, useRef } from 'react';
import { WKIM } from 'easyjssdk';

function useWKIM(uid, token) {
    const imRef = useRef(null);
    
    useEffect(() => {
        // 初始化连接
        imRef.current = WKIM.init('ws://localhost:5100', { uid, token });
        imRef.current.connect();
        
        // 清理函数
        return () => {
            if (imRef.current) {
                imRef.current.destroy();
            }
        };
    }, [uid, token]);
    
    return imRef.current;
}
```

### 3. Vue 应用中的使用

```javascript
// composables/useWKIM.js
import { ref, onUnmounted } from 'vue';
import { WKIM } from 'easyjssdk';

export function useWKIM(uid, token) {
    const im = ref(null);
    
    const connect = async () => {
        im.value = WKIM.init('ws://localhost:5100', { uid, token });
        await im.value.connect();
    };
    
    const disconnect = () => {
        if (im.value) {
            im.value.destroy();
            im.value = null;
        }
    };
    
    onUnmounted(() => {
        disconnect();
    });
    
    return { im, connect, disconnect };
}
```

## 技术改进详情

### 1. 唯一会话标识

每个 SDK 实例现在都有唯一的 `sessionId`：

```javascript
// 认证时会发送 sessionId
{
    uid: 'user123',
    token: 'token',
    deviceId: 'web_12345678_1703123456789',
    sessionId: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
}
```

### 2. 自动生成设备 ID

```javascript
// 格式：web_{sessionId前8位}_{时间戳}
deviceId: 'web_12345678_1703123456789'
```

### 3. 页面卸载处理

```javascript
// 监听多个事件确保连接被正确关闭
// 使用标准的 WebSocket 关闭代码
window.addEventListener('beforeunload', cleanupHandler);
window.addEventListener('pagehide', cleanupHandler);

// 关闭代码说明：
// 1000: 正常关闭
// 3000-4999: 自定义关闭代码（用于异常情况）
```

### 4. 全局实例管理

```javascript
// 防止内存泄漏和连接泄漏
if (WKIM.globalInstance) {
    WKIM.globalInstance.destroy(); // 销毁旧实例
}
WKIM.globalInstance = newInstance; // 设置新实例
```

这些改进确保了：
- 每个连接都有唯一标识符
- 页面刷新时旧连接被正确清理
- 避免了连接泄漏和内存泄漏
- 服务器能正确区分不同的连接实例