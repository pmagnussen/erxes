import { useMutation, useQuery } from '@apollo/client';
import { useToast } from 'erxes-ui';
import { useTranslation } from 'react-i18next';
import {
  FRONTLINE_WORKLOAD_LIMITS,
  FRONTLINE_WORKLOAD_LIMITS_UPDATE,
} from '@/workload-limits/graphql/workloadLimitsQueries';
import { IWorkloadLimits } from '@/workload-limits/types/workloadLimits';

export const useWorkloadLimits = (): {
  limits: IWorkloadLimits;
  loading: boolean;
} => {
  const { data, loading } = useQuery<{
    frontlineWorkloadLimits: IWorkloadLimits | null;
  }>(FRONTLINE_WORKLOAD_LIMITS, { fetchPolicy: 'cache-and-network' });

  return { limits: data?.frontlineWorkloadLimits ?? {}, loading };
};

export const useWorkloadLimitsUpdate = () => {
  const { t } = useTranslation('frontline');
  const { toast } = useToast();
  const [mutate, { loading }] = useMutation<{
    frontlineWorkloadLimitsUpdate: IWorkloadLimits;
  }>(FRONTLINE_WORKLOAD_LIMITS_UPDATE, {
    update: (cache, { data }) => {
      if (!data) return;
      cache.writeQuery({
        query: FRONTLINE_WORKLOAD_LIMITS,
        data: { frontlineWorkloadLimits: data.frontlineWorkloadLimitsUpdate },
      });
    },
  });

  const save = (limits: IWorkloadLimits) =>
    mutate({
      variables: { limits },
      onCompleted: () =>
        toast({ title: t('workload-limits-saved', 'Workload limits saved') }),
      onError: (e) =>
        toast({
          title: t('error', 'Error'),
          description: e.message,
          variant: 'destructive',
        }),
    });

  return { save, loading };
};
