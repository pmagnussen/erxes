import { normalizeWorkloadLimits } from '@/inbox/workloadLimits';

describe('normalizeWorkloadLimits', () => {
  it('treats missing and empty values as unlimited', () => {
    expect(normalizeWorkloadLimits({ email: '', chat: 3 })).toEqual({
      email: null,
      chat: 3,
      messenger: null,
      call: null,
      other: null,
    });
  });

  it('rejects negative and fractional limits', () => {
    expect(() => normalizeWorkloadLimits({ call: -1 })).toThrow();
    expect(() => normalizeWorkloadLimits({ call: 1.5 })).toThrow();
  });

  it('handles non-object input', () => {
    expect(normalizeWorkloadLimits('').email).toBeNull();
  });
});
