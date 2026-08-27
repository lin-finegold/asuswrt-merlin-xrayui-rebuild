export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface JsonPatchOperation {
  op: 'add' | 'replace' | 'remove';
  path: string;
  value?: JsonValue;
  from?: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as object).forEach(item => freeze(item));
    Object.freeze(value);
  }
  return value;
}

function decodePointerToken(token: string): string {
  let decoded = '';
  for (let index = 0; index < token.length; index += 1) {
    if (token[index] !== '~') {
      decoded += token[index];
      continue;
    }
    const escape = token[index + 1];
    if (escape === '0') decoded += '~';
    else if (escape === '1') decoded += '/';
    else throw new Error(`Invalid JSON Pointer escape in token: ${token}`);
    index += 1;
  }
  return decoded;
}

function pointerTokens(path: string): string[] {
  if (path === '') return [];
  if (!path.startsWith('/')) throw new Error(`JSON Pointer must start with '/': ${path}`);
  return path.slice(1).split('/').map(decodePointerToken);
}

function arrayIndex(token: string, length: number, allowAppend: boolean): number {
  if (allowAppend && token === '-') return length;
  if (!/^(0|[1-9][0-9]*)$/.test(token)) throw new Error(`Invalid array index: ${token}`);
  const index = Number(token);
  if (!Number.isSafeInteger(index) || index < 0 || index > length || (!allowAppend && index >= length)) {
    throw new Error(`Array index out of bounds: ${token}`);
  }
  return index;
}

function resolveParent(document: JsonValue, tokens: string[]): { parent: JsonValue; key: string } {
  if (tokens.length === 0) throw new Error('Root has no parent');
  let current = document;
  for (const token of tokens.slice(0, -1)) {
    if (Array.isArray(current)) {
      const index = arrayIndex(token, current.length, false);
      current = current[index];
    } else if (current !== null && typeof current === 'object') {
      if (!Object.prototype.hasOwnProperty.call(current, token)) throw new Error(`Path does not exist: /${tokens.join('/')}`);
      current = current[token];
    } else {
      throw new Error(`Cannot traverse non-container at: ${token}`);
    }
  }
  return { parent: current, key: tokens[tokens.length - 1] };
}

function applyOperation(document: JsonValue, operation: JsonPatchOperation): JsonValue {
  const tokens = pointerTokens(operation.path);
  if (operation.op !== 'add' && operation.op !== 'replace' && operation.op !== 'remove') {
    throw new Error(`Unsupported JSON Patch operation: ${operation.op}`);
  }
  if (operation.op === 'add' && operation.value === undefined) throw new Error('Add operation requires value');
  if (operation.op === 'replace' && operation.value === undefined) throw new Error('Replace operation requires value');

  if (tokens.length === 0) {
    if (operation.op === 'remove') throw new Error('Cannot remove the document root');
    return clone(operation.value as JsonValue);
  }

  const { parent, key } = resolveParent(document, tokens);
  if (Array.isArray(parent)) {
    const index = arrayIndex(key, parent.length, operation.op === 'add');
    if (operation.op === 'add') parent.splice(index, 0, clone(operation.value as JsonValue));
    else if (operation.op === 'replace') parent[index] = clone(operation.value as JsonValue);
    else parent.splice(index, 1);
    return document;
  }
  if (parent === null || typeof parent !== 'object') throw new Error(`Cannot modify non-container at: ${operation.path}`);
  const record = parent as { [key: string]: JsonValue };
  if (operation.op === 'add') record[key] = clone(operation.value as JsonValue);
  else if (operation.op === 'replace') {
    if (!Object.prototype.hasOwnProperty.call(record, key)) throw new Error(`Path does not exist: ${operation.path}`);
    record[key] = clone(operation.value as JsonValue);
  } else {
    if (!Object.prototype.hasOwnProperty.call(record, key)) throw new Error(`Path does not exist: ${operation.path}`);
    delete record[key];
  }
  return document;
}

export class NativeDocument<T extends JsonValue = JsonValue> {
  private readonly baseline: T;
  private working: T;
  private patches: JsonPatchOperation[] = [];

  constructor(input: T) {
    this.baseline = freeze(clone(input));
    this.working = clone(this.baseline);
  }

  getBaseline(): T {
    return this.baseline;
  }

  getWorking(): T {
    return clone(this.working);
  }

  getPatches(): JsonPatchOperation[] {
    return clone(this.patches);
  }

  applyPatch(operation: JsonPatchOperation): void {
    this.applyPatches([operation]);
  }

  applyPatches(operations: JsonPatchOperation[]): void {
    let candidate = clone(this.working) as JsonValue;
    for (const operation of operations) candidate = applyOperation(candidate, operation);
    this.working = candidate as T;
    this.patches = [...this.patches, ...clone(operations)];
  }

  reset(): void {
    this.working = clone(this.baseline);
    this.patches = [];
  }

  isDirty(): boolean {
    return this.patches.length > 0;
  }
}

export function createNativeDocument<T extends JsonValue>(input: T): NativeDocument<T> {
  return new NativeDocument(input);
}
