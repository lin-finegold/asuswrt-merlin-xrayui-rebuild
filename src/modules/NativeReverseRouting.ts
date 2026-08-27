export type NativeConfigDocument = Record<string, any>;

export type NativeReverseReference = {
  source: 'reverse.bridges' | 'reverse.portals' | 'inbound.settings.users[].reverse.tag' | 'outbound.settings.reverse.tag';
  path: string;
  tag: string;
  domain?: string;
  inboundTag?: string;
  outboundTag?: string;
  userIndex?: number;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function addTopLevelReferences(
  refs: NativeReverseReference[],
  reverse: NativeConfigDocument | undefined,
  key: 'bridges' | 'portals'
): void {
  const items = reverse?.[key];
  if (!Array.isArray(items)) return;
  items.forEach((item, index) => {
    if (typeof item?.tag !== 'string' || item.tag.length === 0) return;
    refs.push({
      source: `reverse.${key}`,
      path: `/reverse/${key}/${index}`,
      tag: item.tag,
      ...(typeof item.domain === 'string' ? { domain: item.domain } : {})
    } as NativeReverseReference);
  });
}

export function collectNativeReverseReferences(config: NativeConfigDocument): NativeReverseReference[] {
  const refs: NativeReverseReference[] = [];
  addTopLevelReferences(refs, config.reverse, 'bridges');
  addTopLevelReferences(refs, config.reverse, 'portals');

  if (Array.isArray(config.inbounds)) {
    config.inbounds.forEach((inbound, inboundIndex) => {
      const users = inbound?.settings?.users;
      if (!Array.isArray(users)) return;
      users.forEach((user, userIndex) => {
        const tag = user?.reverse?.tag;
        if (typeof tag !== 'string' || tag.length === 0) return;
        refs.push({
          source: 'inbound.settings.users[].reverse.tag',
          path: `/inbounds/${inboundIndex}/settings/users/${userIndex}/reverse/tag`,
          tag,
          ...(typeof inbound.tag === 'string' ? { inboundTag: inbound.tag } : {}),
          userIndex
        });
      });
    });
  }

  if (Array.isArray(config.outbounds)) {
    config.outbounds.forEach((outbound, outboundIndex) => {
      const tag = outbound?.settings?.reverse?.tag;
      if (typeof tag !== 'string' || tag.length === 0) return;
      refs.push({
        source: 'outbound.settings.reverse.tag',
        path: `/outbounds/${outboundIndex}/settings/reverse/tag`,
        tag,
        ...(typeof outbound.tag === 'string' ? { outboundTag: outbound.tag } : {})
      });
    });
  }

  return refs;
}

export function getNativeRoutingSnapshot<T extends NativeConfigDocument>(routing: T): T {
  return clone(routing);
}

export function selectRoutingForApply<TBaseline, TWorking>(baseline: TBaseline, working: TWorking, edited: false): TBaseline;
export function selectRoutingForApply<TBaseline, TWorking>(baseline: TBaseline, working: TWorking, edited: true): TWorking;
export function selectRoutingForApply<TBaseline, TWorking>(
  baseline: TBaseline,
  working: TWorking,
  edited: boolean
): TBaseline | TWorking {
  return clone(edited ? working : baseline);
}
