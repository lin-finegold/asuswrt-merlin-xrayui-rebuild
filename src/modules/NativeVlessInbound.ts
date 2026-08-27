import { XrayVlessClientObject } from './ClientsObjects';

export type NativeVlessInboundSettings = Record<string, any>;
export type NativeVlessClient = Partial<XrayVlessClientObject> & Record<string, any>;
export type VlessInboundClientSource = 'users' | 'clients' | 'none' | 'conflict';

export class NativeVlessInboundConflictError extends Error {
  constructor() {
    super('VLESS inbound contains both non-empty settings.users and settings.clients; refusing to merge or choose one.');
    this.name = 'NativeVlessInboundConflictError';
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isNonEmptyArray(value: unknown): value is any[] {
  return Array.isArray(value) && value.length > 0;
}

export function getVlessInboundClientSource(settings: NativeVlessInboundSettings | undefined): VlessInboundClientSource {
  const users = settings?.users;
  const clients = settings?.clients;
  if (isNonEmptyArray(users) && isNonEmptyArray(clients)) return 'conflict';
  if (Array.isArray(users) && !isNonEmptyArray(clients)) return 'users';
  if (Array.isArray(clients)) return 'clients';
  return 'none';
}

export function projectVlessInboundClients(settings: NativeVlessInboundSettings | undefined): NativeVlessClient[] {
  const source = getVlessInboundClientSource(settings);
  if (source === 'conflict') throw new NativeVlessInboundConflictError();
  if (source === 'users') return clone((settings?.users ?? []) as NativeVlessClient[]);
  if (source === 'clients') return clone((settings?.clients ?? []) as NativeVlessClient[]);
  return [];
}

export function mergeVlessInboundClient(original: NativeVlessClient, edited: NativeVlessClient): NativeVlessClient {
  return { ...clone(original), ...clone(edited) };
}

export function replaceVlessInboundClients(
  settings: NativeVlessInboundSettings,
  clients: NativeVlessClient[]
): NativeVlessInboundSettings {
  const source = getVlessInboundClientSource(settings);
  if (source === 'conflict') throw new NativeVlessInboundConflictError();
  if (source === 'none') {
    throw new Error('VLESS inbound has no existing users or clients field; refusing to create a compatibility alias.');
  }

  const result = clone(settings);
  result[source] = clone(clients);
  return result;
}
