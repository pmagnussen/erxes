import {
  IWorkloadLimits,
  normalizeWorkloadLimits,
  WORKLOAD_LIMITS_CONFIG_CODE,
} from '@/inbox/workloadLimits';
import { markResolvers } from 'erxes-api-shared/utils';
import { IContext } from '~/connectionResolvers';

const readLimits = async (models: IContext['models']) => {
  const config = await models.Configs.getConfig(WORKLOAD_LIMITS_CONFIG_CODE);

  try {
    return normalizeWorkloadLimits(config?.value);
  } catch {
    return normalizeWorkloadLimits({});
  }
};

export const workloadLimitsQueries = {
  async frontlineWorkloadLimits(
    _root: undefined,
    _args: Record<string, never>,
    { user, models }: IContext,
  ) {
    if (!user?._id) throw new Error('Unauthorized');

    return readLimits(models);
  },
};

export const workloadLimitsMutations = {
  async frontlineWorkloadLimitsUpdate(
    _root: undefined,
    { limits }: { limits: Partial<IWorkloadLimits> },
    { user, models }: IContext,
  ) {
    if (!user?._id) throw new Error('Unauthorized');

    const value = normalizeWorkloadLimits(limits);

    await models.Configs.createOrUpdateConfig({
      code: WORKLOAD_LIMITS_CONFIG_CODE,
      value,
    });

    return value;
  },
};

markResolvers(workloadLimitsQueries, {
  wrapperConfig: { skipPermission: true },
});

markResolvers(workloadLimitsMutations, {
  wrapperConfig: { skipPermission: true },
});
