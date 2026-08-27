import {
  NativeVlessOutboundConflictError,
  getVlessOutboundShape,
  projectVlessOutbound,
  replaceVlessOutboundFields,
  selectOutboundForApply
} from './NativeVlessOutbound';

describe('Native VLESS outbound adapter', () => {
  it('projects flat VLESS fields without creating vnext', () => {
    const settings = {
      address: 'example.invalid',
      port: 443,
      id: 'redacted-id',
      flow: 'xtls-rprx-vision',
      encryption: 'none',
      reverse: { tag: 'homexraylocal' },
      testseed: [900, 500, 900, 256],
      unknown: { preserve: true }
    };

    expect(getVlessOutboundShape(settings)).toBe('flat');
    expect(projectVlessOutbound(settings)).toEqual({
      address: 'example.invalid',
      port: 443,
      id: 'redacted-id',
      flow: 'xtls-rprx-vision',
      encryption: 'none',
      reverse: { tag: 'homexraylocal' },
      testseed: [900, 500, 900, 256],
      unknown: { preserve: true }
    });
    expect(settings).not.toHaveProperty('vnext');
  });

  it('projects the first legacy vnext server without changing the source shape', () => {
    const settings = {
      vnext: [{ address: 'legacy.invalid', port: 443, users: [{ id: 'user-1', email: 'client' }] }],
      unknown: { preserve: true }
    };

    expect(getVlessOutboundShape(settings)).toBe('vnext');
    expect(projectVlessOutbound(settings)).toEqual({
      address: 'legacy.invalid',
      port: 443,
      users: [{ id: 'user-1', email: 'client' }],
      unknown: { preserve: true }
    });
  });

  it('rejects a setting object that contains both flat fields and vnext', () => {
    const settings = { address: 'flat.invalid', vnext: [{ address: 'legacy.invalid', port: 443, users: [] }] };

    expect(getVlessOutboundShape(settings)).toBe('conflict');
    expect(() => projectVlessOutbound(settings)).toThrow(NativeVlessOutboundConflictError);
  });

  it('writes flat edits to flat fields and preserves reverse and unknown fields', () => {
    const settings = {
      address: 'before.invalid',
      port: 443,
      id: 'redacted-id',
      reverse: { tag: 'homexraylocal' },
      unknown: { preserve: true }
    };

    const result = replaceVlessOutboundFields(settings, { address: 'after.invalid', port: 8443 });

    expect(result).toEqual({
      address: 'after.invalid',
      port: 8443,
      id: 'redacted-id',
      reverse: { tag: 'homexraylocal' },
      unknown: { preserve: true }
    });
    expect(result).not.toHaveProperty('vnext');
  });

  it('replays the baseline exactly for an unedited outbound', () => {
    const baseline = { tag: 'proxy', settings: { address: 'native.invalid', reverse: { tag: 'bridge' } } };
    const working = { tag: 'proxy', settings: { vnext: [{ users: [] }] } };

    expect(selectOutboundForApply(baseline, working, false)).toEqual(baseline);
    expect(selectOutboundForApply(baseline, working, false)).not.toBe(baseline);
    expect(selectOutboundForApply(baseline, working, true)).toEqual(working);
  });
});
