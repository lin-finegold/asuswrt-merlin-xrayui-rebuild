import fs from 'fs';
import path from 'path';

describe('AX86U native configuration fixture', () => {
  const fixturePath = path.join(__dirname, '../../tests/fixtures/native-config/ax86u-config15.redacted.json');

  it('retains the complete structural baseline', () => {
    const config = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    expect(config.inbounds).toHaveLength(4);
    expect(config.outbounds).toHaveLength(32);
    expect(config.routing.rules).toHaveLength(44);
    expect(config.routing.balancers).toHaveLength(3);
    expect(config.inbounds.find((item: any) => item.tag === 'in-4443-tcp').settings.users).toHaveLength(3);
    expect(config.outbounds.find((item: any) => item.tag === 'homexray').settings.reverse.tag).toBe('homexraylocal');
    expect(config.outbounds.some((item: any) => item.streamSettings?.xhttpSettings)).toBe(true);
    expect(config.outbounds.some((item: any) => item.streamSettings?.finalmask)).toBe(true);
    expect(config.outbounds.some((item: any) => item.streamSettings?.hysteriaSettings)).toBe(true);
  });

  it('contains no real secret-bearing values', () => {
    const text = fs.readFileSync(fixturePath, 'utf8');

    expect(text).not.toContain('oJ9hmEr3yDiREf1NfUxv78Wl-i9AvwIYGMk0py_qZng');
    expect(text).not.toContain('gmi7jqsos3fdr0we');
    expect(text).toContain('REDACTED_PRIVATEKEY');
    expect(text).toContain('redacted-native-encryption');
  });
});
