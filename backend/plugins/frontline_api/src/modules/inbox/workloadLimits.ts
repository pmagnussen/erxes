export const WORKLOAD_LIMITS_CONFIG_CODE = 'FRONTLINE_WORKLOAD_LIMITS';

export const WORKLOAD_BUCKETS = [
  'email',
  'chat',
  'messenger',
  'call',
  'other',
] as const;

export type TWorkloadBucket = (typeof WORKLOAD_BUCKETS)[number];

export type IWorkloadLimits = Record<TWorkloadBucket, number | null>;

/**
 * Normalises raw input into per-bucket limits. Empty / null means unlimited;
 * anything else must be a non-negative integer.
 */
export const normalizeWorkloadLimits = (raw: unknown): IWorkloadLimits => {
  const source =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const result = {} as IWorkloadLimits;

  for (const bucket of WORKLOAD_BUCKETS) {
    const value = source[bucket];

    if (value === null || value === undefined || value === '') {
      result[bucket] = null;
      continue;
    }

    const num = Number(value);

    if (!Number.isInteger(num) || num < 0) {
      throw new Error(`Invalid workload limit for ${bucket}`);
    }

    result[bucket] = num;
  }

  return result;
};
