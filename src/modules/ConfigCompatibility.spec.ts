import { validateConfigurationForApply } from './ConfigCompatibility';

describe('validateConfigurationForApply', () => {
  it('blocks a VLESS inbound that only has native users until the UI adapter exists', () => {
    const result = validateConfigurationForApply({
      inbounds: [{ protocol: 'vless', tag: 'in-4443', settings: { users: [{ id: 'redacted', email: 'user' }] } }],
      outbounds: [],
      routing: { rules: [] }
    });

    expect(result.compatible).toBe(false);
    expect(result.issues).toContain('inbounds[0].settings.users');
  });

  it('blocks a simplified flat VLESS outbound until the flat adapter exists', () => {
    const result = validateConfigurationForApply({
      inbounds: [],
      outbounds: [
        {
          protocol: 'vless',
          tag: 'homexray',
          settings: { address: 'example.invalid', port: 443, id: 'redacted', reverse: { tag: 'homexraylocal' } }
        }
      ],
      routing: { rules: [] }
    });

    expect(result.compatible).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining(['outbounds[0].settings.address', 'outbounds[0].settings.reverse']));
  });

  it('blocks native reverse fields that the current top-level reverse UI cannot round-trip', () => {
    const result = validateConfigurationForApply({
      inbounds: [],
      outbounds: [
        {
          protocol: 'vless',
          tag: 'proxy',
          settings: {
            vnext: [{ address: 'example.invalid', port: 443, users: [] }],
            reverse: { tag: 'portal-tag' }
          }
        }
      ],
      routing: { rules: [] }
    });

    expect(result.compatible).toBe(false);
    expect(result.issues).toContain('outbounds[0].settings.reverse');
  });

  it('allows a legacy VLESS configuration already represented by the UI model', () => {
    const result = validateConfigurationForApply({
      inbounds: [{ protocol: 'vless', tag: 'in-443', settings: { clients: [{ id: 'redacted', email: 'user' }] } }],
      outbounds: [
        {
          protocol: 'vless',
          tag: 'proxy',
          settings: { vnext: [{ address: 'example.invalid', port: 443, users: [] }] }
        }
      ],
      routing: { rules: [] }
    });

    expect(result).toEqual({ compatible: true, issues: [] });
  });
});
