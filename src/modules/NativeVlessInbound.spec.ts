import {
  NativeVlessInboundConflictError,
  getVlessInboundClientSource,
  projectVlessInboundClients,
  replaceVlessInboundClients,
  mergeVlessInboundClient
} from './NativeVlessInbound';

describe('Native VLESS inbound users adapter', () => {
  it('projects native users to the Clients table without creating clients', () => {
    const settings = {
      decryption: 'none',
      users: [{ id: 'user-1', email: 'native-user', flow: 'xtls-rprx-vision', reverse: { tag: 'bridge' } }],
      testseed: [900, 500, 900, 256]
    };

    expect(getVlessInboundClientSource(settings)).toBe('users');
    expect(projectVlessInboundClients(settings)).toEqual([
      { id: 'user-1', email: 'native-user', flow: 'xtls-rprx-vision', reverse: { tag: 'bridge' } }
    ]);
    expect(settings).not.toHaveProperty('clients');
  });

  it('treats an empty native users array as the native source', () => {
    const settings = { users: [], unknown: { keep: true } };

    expect(getVlessInboundClientSource(settings)).toBe('users');
    expect(projectVlessInboundClients(settings)).toEqual([]);
    expect(replaceVlessInboundClients(settings, [{ id: 'new' }])).toEqual({
      users: [{ id: 'new' }],
      unknown: { keep: true }
    });
  });
  it('uses legacy clients when users is absent', () => {
    const settings = { clients: [{ id: 'client-1', email: 'legacy-client' }], unknown: { keep: true } };

    expect(getVlessInboundClientSource(settings)).toBe('clients');
    expect(projectVlessInboundClients(settings)).toEqual(settings.clients);
  });

  it('treats users plus empty clients as native users', () => {
    const settings = { users: [{ id: 'user-1' }], clients: [] };

    expect(getVlessInboundClientSource(settings)).toBe('users');
    expect(projectVlessInboundClients(settings)).toEqual(settings.users);
  });

  it('reports a conflict when both users and clients are non-empty', () => {
    const settings = { users: [{ id: 'user-1' }], clients: [{ id: 'client-1' }] };

    expect(() => projectVlessInboundClients(settings)).toThrow(NativeVlessInboundConflictError);
    expect(getVlessInboundClientSource(settings)).toBe('conflict');
  });

  it('writes edits to the existing native key and preserves every other field', () => {
    const settings = {
      users: [{ id: 'user-1', email: 'before', reverse: { tag: 'bridge' } }],
      testseed: [900, 500, 900, 256],
      unknown: { preserve: true }
    };
    const result = replaceVlessInboundClients(settings, [{ id: 'user-1', email: 'after' }]);

    expect(result).toEqual({
      users: [{ id: 'user-1', email: 'after' }],
      testseed: [900, 500, 900, 256],
      unknown: { preserve: true }
    });
    expect(result).not.toHaveProperty('clients');
    expect(settings.users[0].reverse).toEqual({ tag: 'bridge' });
  });

  it('merges edited known fields without dropping native unknown fields', () => {
    const original = { id: 'user-1', email: 'before', reverse: { tag: 'bridge' }, testseed: [1, 2] };

    expect(mergeVlessInboundClient(original, { email: 'after' })).toEqual({
      id: 'user-1',
      email: 'after',
      reverse: { tag: 'bridge' },
      testseed: [1, 2]
    });
  });
  it('never merges conflicting arrays or silently chooses one for writes', () => {
    const settings = { users: [{ id: 'user-1' }], clients: [{ id: 'client-1' }] };

    expect(() => replaceVlessInboundClients(settings, [{ id: 'new' }])).toThrow(NativeVlessInboundConflictError);
    expect(settings).toEqual({ users: [{ id: 'user-1' }], clients: [{ id: 'client-1' }] });
  });
});
