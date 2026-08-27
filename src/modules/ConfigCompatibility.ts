export interface ApplyCompatibilityResult {
  compatible: boolean;
  issues: string[];
}

/**
 * Temporary fail-closed boundary for the legacy UI serializer.
 *
 * Native-preserving Apply will replace this guard after the adapters and
 * baseline/patch pipeline are complete. Until then, an unknown native shape
 * must block Apply rather than risk rewriting or dropping fields.
 */
export function validateConfigurationForApply(config: any): ApplyCompatibilityResult {
  const issues: string[] = [];

  (config?.inbounds ?? []).forEach((inbound: any, index: number) => {
    if (inbound?.protocol !== 'vless') return;
    const settings = inbound.settings;
    if (!settings || typeof settings !== 'object') return;

    if (Array.isArray(settings.users) && !Array.isArray(settings.clients)) {
      issues.push(`inbounds[${index}].settings.users`);
    }

    if (Array.isArray(settings.users)) {
      settings.users.forEach((user: any, userIndex: number) => {
        if (user && typeof user === 'object' && user.reverse !== undefined) {
          issues.push(`inbounds[${index}].settings.users[${userIndex}].reverse`);
        }
      });
    }
  });

  (config?.outbounds ?? []).forEach((outbound: any, index: number) => {
    if (outbound?.protocol !== 'vless') return;
    const settings = outbound.settings;
    if (!settings || typeof settings !== 'object') return;

    if (
      settings.address !== undefined ||
      settings.id !== undefined ||
      settings.flow !== undefined ||
      settings.encryption !== undefined ||
      settings.testpre !== undefined ||
      settings.testseed !== undefined
    ) {
      issues.push(`outbounds[${index}].settings.address`);
    }

    if (settings.reverse !== undefined) {
      issues.push(`outbounds[${index}].settings.reverse`);
    }
  });

  return {
    compatible: issues.length === 0,
    issues: [...new Set(issues)]
  };
}
