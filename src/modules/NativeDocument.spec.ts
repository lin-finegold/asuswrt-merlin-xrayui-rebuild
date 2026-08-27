import {
  JsonPatchOperation,
  NativeDocument,
  createNativeDocument
} from './NativeDocument';

describe('NativeDocument', () => {
  it('keeps an immutable baseline separate from the working copy', () => {
    const source = { routing: { rules: [{ idx: 0, outboundTag: 'direct' }] }, unknown: { keep: true } };
    const document = createNativeDocument(source);

    const baseline = document.getBaseline();
    const working = document.getWorking();
    working.routing.rules[0].outboundTag = 'proxy';
    working.unknown.keep = false;

    expect(Object.isFrozen(baseline)).toBe(true);
    expect(Object.isFrozen(baseline.routing)).toBe(true);
    expect(Object.isFrozen(baseline.routing.rules[0])).toBe(true);
    expect(baseline).toEqual(source);
    expect(baseline.routing.rules[0].outboundTag).toBe('direct');
    expect(baseline.unknown.keep).toBe(true);
    expect(working).not.toBe(baseline);
    expect(document.isDirty()).toBe(false);
  });

  it('supports replacing the document root as an atomic patch', () => {
    const document = createNativeDocument({ old: true });

    document.applyPatch({ op: 'replace', path: '', value: { new: true } });

    expect(document.getBaseline()).toEqual({ old: true });
    expect(document.getWorking()).toEqual({ new: true });
    expect(document.getPatches()).toHaveLength(1);
  });
  it('records ordered patches and applies them to working', () => {
    const document = createNativeDocument({ outbounds: [{ tag: 'direct', settings: {} }] });
    const patches: JsonPatchOperation[] = [
      { op: 'add', path: '/outbounds/0/settings/domainStrategy', value: 'UseIP' },
      { op: 'replace', path: '/outbounds/0/tag', value: 'proxy' }
    ];

    document.applyPatches(patches);

    expect(document.getWorking()).toEqual({
      outbounds: [{ tag: 'proxy', settings: { domainStrategy: 'UseIP' } }]
    });
    expect(document.getPatches()).toEqual(patches);
    expect(document.isDirty()).toBe(true);
  });

  it('supports escaped JSON Pointer tokens and appending to arrays', () => {
    const document = createNativeDocument({ 'a/b': { '~key': [] } });

    document.applyPatch({ op: 'add', path: '/a~1b/~0key/-', value: 'preserved' });

    expect(document.getWorking()['a/b']['~key']).toEqual(['preserved']);
  });

  it('atomically rolls back a batch when one operation is invalid', () => {
    const document = createNativeDocument({ items: ['original'] });
    const invalidBatch: JsonPatchOperation[] = [
      { op: 'replace', path: '/items/0', value: 'temporary' },
      { op: 'remove', path: '/missing/path' }
    ];

    expect(() => document.applyPatches(invalidBatch)).toThrow();
    expect(document.getWorking()).toEqual({ items: ['original'] });
    expect(document.getPatches()).toEqual([]);
    expect(document.isDirty()).toBe(false);
  });

  it('rejects unsupported operations without changing document state', () => {
    const document = createNativeDocument({ value: 1 });

    expect(() => document.applyPatch({ op: 'move', path: '/value', from: '/other' } as unknown as JsonPatchOperation)).toThrow();
    expect(document.getWorking()).toEqual({ value: 1 });
    expect(document.getPatches()).toEqual([]);
  });

  it('resets working and patches to the baseline', () => {
    const document = new NativeDocument({ value: 1 });
    document.applyPatch({ op: 'replace', path: '/value', value: 2 });

    document.reset();

    expect(document.getWorking()).toEqual({ value: 1 });
    expect(document.getPatches()).toEqual([]);
    expect(document.isDirty()).toBe(false);
  });
});
