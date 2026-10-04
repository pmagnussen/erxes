import { FrontlinePaths } from '@/types/FrontlinePaths';
import { IconGauge } from '@tabler/icons-react';
import { Button } from 'erxes-ui';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const WorkloadLimitsBreadcrumb = () => {
  const { t } = useTranslation('frontline');

  return (
    <Link
      to={`/settings/${FrontlinePaths.Frontline}${FrontlinePaths.WorkloadLimits}`}
    >
      <Button variant="ghost" className="font-semibold">
        <IconGauge className="w-4 h-4 text-accent-foreground" />
        {t('workload-limits', 'Workload limits')}
      </Button>
    </Link>
  );
};
