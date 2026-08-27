export type NativeTransportSettings = Record<string, any>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Capture a native streamSettings subtree before any legacy class conversion. */
export function getNativeTransportSnapshot<T extends NativeTransportSettings>(settings: T): T {
  return clone(settings);
}

/**
 * Apply only explicitly supplied top-level transport edits. Nested native
 * subtrees are copied wholesale, so unknown fields and future mask types are
 * never passed through the legacy model serializer.
 */
export function applyNativeTransportEdits<T extends NativeTransportSettings>(
  baseline: T,
  edits: Record<string, any>
): T {
  const result = clone(baseline);
  for (const key of Object.keys(edits)) {
    const value = edits[key];
    if (value === undefined) continue;
    (result as Record<string, any>)[key] = clone(value);
  }
  return result;
}

/** Return baseline for a no-op; only an explicitly edited subtree may use working. */
export function selectTransportForApply<TBaseline, TWorking>(baseline: TBaseline, working: TWorking, edited: false): TBaseline;
export function selectTransportForApply<TBaseline, TWorking>(baseline: TBaseline, working: TWorking, edited: true): TWorking;
export function selectTransportForApply<TBaseline, TWorking>(
  baseline: TBaseline,
  working: TWorking,
  edited: boolean
): TBaseline | TWorking {
  return clone(edited ? working : baseline);
}
