export type NativeVlessOutboundSettings = Record<string, any>;
export type VlessOutboundShape = 'flat' | 'vnext' | 'none' | 'conflict';
export type NativeVlessOutboundView = Record<string, any>;

const FLAT_FIELDS = ['address', 'port', 'id', 'flow', 'encryption'];

export class NativeVlessOutboundConflictError extends Error {
  constructor() {
    super('VLESS outbound contains both flat native fields and settings.vnext; refusing to choose or convert a shape.');
    this.name = 'NativeVlessOutboundConflictError';
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function hasFlatField(settings: NativeVlessOutboundSettings): boolean {
  return FLAT_FIELDS.some(field => settings[field] !== undefined) || settings.reverse !== undefined;
}

export function getVlessOutboundShape(settings: NativeVlessOutboundSettings | undefined): VlessOutboundShape {
  if (!settings || typeof settings !== 'object') return 'none';
  const flat = hasFlatField(settings);
  const vnext = Array.isArray(settings.vnext);
  if (flat && vnext) return 'conflict';
  if (flat) return 'flat';
  if (vnext) return 'vnext';
  return 'none';
}

export function projectVlessOutbound(settings: NativeVlessOutboundSettings | undefined): NativeVlessOutboundView {
  const shape = getVlessOutboundShape(settings);
  if (shape === 'conflict') throw new NativeVlessOutboundConflictError();
  if (shape === 'flat') return clone(settings ?? {});
  if (shape === 'vnext') {
    const { vnext, ...otherSettings } = clone(settings ?? {});
    return { ...otherSettings, ...(vnext[0] ?? {}) };
  }
  return {};
}

export function replaceVlessOutboundFields(
  settings: NativeVlessOutboundSettings,
  changes: NativeVlessOutboundView
): NativeVlessOutboundSettings {
  const shape = getVlessOutboundShape(settings);
  if (shape === 'conflict') throw new NativeVlessOutboundConflictError();
  if (shape === 'none') throw new Error('VLESS outbound has no recognized native shape; refusing to create vnext.');

  const result = clone(settings);
  if (shape === 'flat') {
    for (const field of [...FLAT_FIELDS, 'reverse']) {
      if (changes[field] !== undefined) result[field] = clone(changes[field]);
    }
    return result;
  }

  if (!Array.isArray(result.vnext) || result.vnext.length === 0) {
    throw new Error('VLESS outbound vnext shape has no first server; refusing to create a server implicitly.');
  }
  for (const field of ['address', 'port', 'id', 'flow', 'encryption']) {
    if (changes[field] !== undefined) result.vnext[0][field] = clone(changes[field]);
  }
  if (changes.reverse !== undefined) result.reverse = clone(changes.reverse);
  return result;
}

export function selectOutboundForApply<TBaseline, TWorking>(baseline: TBaseline, working: TWorking, edited: false): TBaseline;
export function selectOutboundForApply<TBaseline, TWorking>(baseline: TBaseline, working: TWorking, edited: true): TWorking;
export function selectOutboundForApply<TBaseline, TWorking>(baseline: TBaseline, working: TWorking, edited: boolean): TBaseline | TWorking {
  return clone(edited ? working : baseline);
}
