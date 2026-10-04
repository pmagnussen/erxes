import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Label, Spinner } from 'erxes-ui';
import { BUCKET_ICONS, BUCKET_ORDER } from '@/team-board/components/BucketIcon';
import { TChannelBucket } from '@/team-board/types/teamBoard';
import {
  useWorkloadLimits,
  useWorkloadLimitsUpdate,
} from '@/workload-limits/hooks/useWorkloadLimits';
import { IWorkloadLimits } from '@/workload-limits/types/workloadLimits';

type TDraft = Record<TChannelBucket, string>;

const toDraft = (limits: IWorkloadLimits): TDraft =>
  BUCKET_ORDER.reduce((acc, bucket) => {
    const value = limits[bucket];
    acc[bucket] = value === null || value === undefined ? '' : String(value);
    return acc;
  }, {} as TDraft);

const isValid = (value: string) => value === '' || /^\d+$/.test(value);

export const WorkloadLimitsSettings = () => {
  const { t } = useTranslation('frontline');
  const { limits, loading } = useWorkloadLimits();
  const { save, loading: saving } = useWorkloadLimitsUpdate();
  const [draft, setDraft] = useState<TDraft>(toDraft({}));

  useEffect(() => {
    setDraft(toDraft(limits));
  }, [limits]);

  const invalid = BUCKET_ORDER.some((bucket) => !isValid(draft[bucket]));

  const handleSave = () => {
    if (invalid) return;
    const payload = BUCKET_ORDER.reduce((acc, bucket) => {
      acc[bucket] = draft[bucket] === '' ? null : Number(draft[bucket]);
      return acc;
    }, {} as IWorkloadLimits);
    save(payload);
  };

  if (loading && !Object.keys(limits).length) {
    return (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">
          {t('agent-workload-limits', 'Agent workload limits')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            'workload-limits-description',
            'Maximum open conversations per agent for each channel. Leave empty for unlimited.',
          )}
        </p>
      </div>
      <div className="rounded-lg border divide-y">
        {BUCKET_ORDER.map((bucket) => {
          const Icon = BUCKET_ICONS[bucket];
          const value = draft[bucket];
          return (
            <div key={bucket} className="flex items-center gap-3 px-4 py-2">
              <Icon className="size-4 text-primary" />
              <Label htmlFor={`workload-${bucket}`} className="flex-1">
                {t(`bucket-${bucket}`, bucket)}
              </Label>
              <Input
                id={`workload-${bucket}`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className="w-28"
                placeholder={t('unlimited', 'Unlimited')}
                value={value}
                aria-invalid={!isValid(value)}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, [bucket]: e.target.value }))
                }
              />
            </div>
          );
        })}
      </div>
      {invalid && (
        <p className="text-sm text-destructive">
          {t(
            'workload-limits-invalid',
            'Limits must be whole numbers of zero or more.',
          )}
        </p>
      )}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={invalid || saving}>
          {saving && <Spinner size="sm" />}
          {t('save', 'Save')}
        </Button>
      </div>
    </div>
  );
};
