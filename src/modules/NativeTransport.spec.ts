import {
  applyNativeTransportEdits,
  getNativeTransportSnapshot,
  selectTransportForApply
} from './NativeTransport';

describe('Native transport preservation', () => {
  it('keeps rawSettings, xhttpSettings, hysteriaSettings and unknown fields on a no-op', () => {
    const streamSettings = {
      network: 'xhttp',
      rawSettings: { native: true, unknown: { keep: 'raw' } },
      xhttpSettings: { path: '/native', mode: 'stream-one', unknownXhttp: { keep: true } },
      hysteriaSettings: { auth: 'redacted', nativeField: 'keep' },
      unknownTransport: { keep: true }
    };

    expect(getNativeTransportSnapshot(streamSettings)).toEqual(streamSettings);
    expect(selectTransportForApply(streamSettings, { network: 'xhttp' }, false)).toEqual(streamSettings);
  });

  it('keeps ECH and pinned certificate fields exactly when unrelated fields are edited', () => {
    const streamSettings = {
      security: 'tls',
      tlsSettings: {
        echConfigList: 'https://dns.example/dns-query',
        pinnedPeerCertSha256: 'AA:BB:CC',
        unknownTls: ['keep']
      },
      rawSettings: { keep: true }
    };

    expect(applyNativeTransportEdits(streamSettings, { network: 'xhttp' })).toEqual({
      security: 'tls',
      tlsSettings: {
        echConfigList: 'https://dns.example/dns-query',
        pinnedPeerCertSha256: 'AA:BB:CC',
        unknownTls: ['keep']
      },
      rawSettings: { keep: true },
      network: 'xhttp'
    });
  });

  it('preserves unknown FinalMask types and their payloads', () => {
    const streamSettings = {
      finalmask: {
        udp: [
          { type: 'future-mask-v99', settings: { opaque: true, values: [1, 2, 3] }, extra: 'preserve-me' },
          { type: 'mkcp-original' }
        ],
        tcp: [{ type: 'future-tcp-mask', arbitrary: { untouched: true } }]
      }
    };

    expect(applyNativeTransportEdits(streamSettings, { network: 'kcp' })).toEqual({
      finalmask: {
        udp: [
          { type: 'future-mask-v99', settings: { opaque: true, values: [1, 2, 3] }, extra: 'preserve-me' },
          { type: 'mkcp-original' }
        ],
        tcp: [{ type: 'future-tcp-mask', arbitrary: { untouched: true } }]
      },
      network: 'kcp'
    });
  });

  it('returns an independent deep copy for baseline replay', () => {
    const baseline = { rawSettings: { value: 1 }, finalmask: { udp: [{ type: 'future' }] } };
    const result = selectTransportForApply(baseline, { rawSettings: {} }, false);

    expect(result).toEqual(baseline);
    expect(result).not.toBe(baseline);
    (result.rawSettings as any).value = 2;
    expect((baseline.rawSettings as any).value).toBe(1);
  });
});
