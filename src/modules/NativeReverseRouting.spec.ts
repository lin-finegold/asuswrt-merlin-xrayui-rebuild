import {
  collectNativeReverseReferences,
  collectNativeRoutingTargets,
  getNativeRoutingSnapshot,
  selectRoutingForApply
} from './NativeReverseRouting';

describe('Native Reverse and routing preservation', () => {
  it('collects all Reverse sources without merging their categories', () => {
    const config = {
      reverse: {
        bridges: [{ tag: 'bridge-tag', domain: 'bridge.example' }],
        portals: [{ tag: 'portal-tag', domain: 'portal.example' }]
      },
      inbounds: [
        {
          tag: 'in-1',
          settings: {
            users: [
              { id: 'user-1', reverse: { tag: 'user-reverse' } },
              { id: 'user-2' }
            ]
          }
        }
      ],
      outbounds: [
        { tag: 'out-1', settings: { reverse: { tag: 'out-reverse' } } }
      ]
    };

    expect(collectNativeReverseReferences(config)).toEqual([
      { source: 'reverse.bridges', path: '/reverse/bridges/0', tag: 'bridge-tag', domain: 'bridge.example' },
      { source: 'reverse.portals', path: '/reverse/portals/0', tag: 'portal-tag', domain: 'portal.example' },
      { source: 'inbound.settings.users[].reverse.tag', path: '/inbounds/0/settings/users/0/reverse/tag', tag: 'user-reverse', inboundTag: 'in-1', userIndex: 0 },
      { source: 'outbound.settings.reverse.tag', path: '/outbounds/0/settings/reverse/tag', tag: 'out-reverse', outboundTag: 'out-1' }
    ]);
  });

  it('keeps all routing fields, order and array metadata on a no-op', () => {
    const routing = {
      rules: [
        {
          idx: 20,
          name: 'second',
          inboundTag: ['in-b'],
          outboundTag: 'out-b',
          balancerTag: 'bal-b',
          selector: ['select-b'],
          fallbackTag: 'fallback-b',
          strategy: { type: 'random' },
          unknown: { keep: true }
        },
        {
          idx: 10,
          name: 'first',
          inboundTag: ['in-a'],
          outboundTag: 'out-a',
          selector: ['select-a']
        }
      ],
      disabled_rules: [{ idx: 99, name: 'disabled', unknown: ['keep'] }],
      unknownRouting: { keep: true }
    };

    expect(getNativeRoutingSnapshot(routing)).toEqual(routing);
    expect(selectRoutingForApply(routing, { rules: [] }, false)).toEqual(routing);
  });

  it('does not confuse an inbound user Reverse tag with an outbound Reverse tag', () => {
    const refs = collectNativeReverseReferences({
      inbounds: [{ tag: 'inbound', settings: { users: [{ reverse: { tag: 'same-tag' } }] } }],
      outbounds: [{ tag: 'outbound', settings: { reverse: { tag: 'same-tag' } } }]
    });

    expect(refs.map(ref => [ref.source, ref.path])).toEqual([
      ['inbound.settings.users[].reverse.tag', '/inbounds/0/settings/users/0/reverse/tag'],
      ['outbound.settings.reverse.tag', '/outbounds/0/settings/reverse/tag']
    ]);
  });

  it('exposes native Reverse bridge, portal, and outbound targets to routing selectors', () => {
    expect(
      collectNativeRoutingTargets({
        reverse: { bridges: [{ tag: 'bridge' }], portals: [{ tag: 'portal' }] },
        inbounds: [{ tag: 'inbound' }],
        outbounds: [{ tag: 'outbound', settings: { reverse: { tag: 'native-outbound-reverse' } } }]
      })
    ).toEqual({
      inbounds: ['inbound', 'bridge'],
      outbounds: ['outbound', 'portal', 'native-outbound-reverse']
    });
  });
});
