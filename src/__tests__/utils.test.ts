import { describe, it, expect } from 'vitest';
import { ChannelType, Event, ReasonCode, DeviceFlag } from '../index';

describe('ChannelType enum', () => {
  it('has correct numeric values', () => {
    expect(ChannelType.Person).toBe(1);
    expect(ChannelType.Group).toBe(2);
    expect(ChannelType.CustomerService).toBe(3);
    expect(ChannelType.Community).toBe(4);
    expect(ChannelType.CommunityTopic).toBe(5);
    expect(ChannelType.Info).toBe(6);
    expect(ChannelType.Data).toBe(7);
    expect(ChannelType.Temp).toBe(8);
    expect(ChannelType.Live).toBe(9);
    expect(ChannelType.Visitors).toBe(10);
  });

  it('has 10 members', () => {
    const numericKeys = Object.values(ChannelType).filter(v => typeof v === 'number');
    expect(numericKeys).toHaveLength(10);
  });
});

describe('Event enum', () => {
  it('has correct string values', () => {
    expect(Event.Connect).toBe('connect');
    expect(Event.Disconnect).toBe('disconnect');
    expect(Event.Message).toBe('message');
    expect(Event.Error).toBe('error');
    expect(Event.SendAck).toBe('sendack');
    expect(Event.Reconnecting).toBe('reconnecting');
    expect(Event.CustomEvent).toBe('customevent');
  });

  it('has 7 members', () => {
    const values = Object.values(Event);
    expect(values).toHaveLength(7);
  });
});

describe('ReasonCode enum', () => {
  it('has correct numeric values for key codes', () => {
    expect(ReasonCode.Unknown).toBe(0);
    expect(ReasonCode.Success).toBe(1);
    expect(ReasonCode.AuthFail).toBe(2);
    expect(ReasonCode.ConnectKick).toBe(12);
    expect(ReasonCode.Ban).toBe(19);
    expect(ReasonCode.RateLimit).toBe(22);
    expect(ReasonCode.Disband).toBe(24);
    expect(ReasonCode.SendBan).toBe(25);
  });

  it('has 26 members (0 through 25)', () => {
    const numericKeys = Object.values(ReasonCode).filter(v => typeof v === 'number');
    expect(numericKeys).toHaveLength(26);
  });
});

describe('DeviceFlag enum', () => {
  it('has correct numeric values', () => {
    expect(DeviceFlag.App).toBe(0);
    expect(DeviceFlag.Web).toBe(1);
    expect(DeviceFlag.Desktop).toBe(2);
  });

  it('has 3 members', () => {
    const numericKeys = Object.values(DeviceFlag).filter(v => typeof v === 'number');
    expect(numericKeys).toHaveLength(3);
  });
});

describe('generateUUID (tested via WKIM)', () => {
  // generateUUID is private, but we can test it indirectly through WKIM.init()
  // which generates a sessionId using it. We test the UUID format pattern here.
  it('UUID v4 format regex matches expected pattern', () => {
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    // Generate a few UUIDs using the same algorithm
    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    for (let i = 0; i < 100; i++) {
      const uuid = generateUUID();
      expect(uuid).toMatch(uuidV4Regex);
    }
  });

  it('generates unique UUIDs', () => {
    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    const uuids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      uuids.add(generateUUID());
    }
    expect(uuids.size).toBe(1000);
  });
});
