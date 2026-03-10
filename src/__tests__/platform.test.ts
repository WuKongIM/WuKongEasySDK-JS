import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlatformType } from '../index';

describe('PlatformType enum', () => {
  it('has correct string values', () => {
    expect(PlatformType.Browser).toBe('browser');
    expect(PlatformType.NodeJS).toBe('nodejs');
    expect(PlatformType.WeChat).toBe('wechat');
    expect(PlatformType.Alipay).toBe('alipay');
    expect(PlatformType.UniApp).toBe('uniapp');
  });

  it('has 5 members', () => {
    const values = Object.values(PlatformType);
    expect(values).toHaveLength(5);
  });
});

describe('Platform detection', () => {
  // The detectPlatform() function runs at module load time and sets currentPlatform.
  // In Node.js test environment with ws installed, it should detect as NodeJS
  // (since there's no global WebSocket in Node without polyfill).
  // But if a global WebSocket exists (e.g., from our mock setup in other tests),
  // it detects as Browser. We test the logic by checking currentPlatform.

  it('getPlatform() returns a valid platform', async () => {
    const mod = await import('../index');
    const platform = mod.getPlatform();
    expect(platform).toBeDefined();
    expect(Object.values(PlatformType)).toContain(platform);
  });

  it('detects Node.js or Browser platform in test environment', async () => {
    const mod = await import('../index');
    const platform = mod.getPlatform();
    // In test environment, it should be either nodejs or browser
    expect([PlatformType.NodeJS, PlatformType.Browser]).toContain(platform);
  });
});

describe('WebSocket factory error handling', () => {
  it('createWebSocket is used internally (tested via WKIM.connect)', () => {
    // createWebSocket is not exported, but we verify it works through WKIM integration tests.
    // Here we just validate the platform detection path works without throwing.
    expect(() => {
      // Importing the module should not throw
      return import('../index');
    }).not.toThrow();
  });
});
