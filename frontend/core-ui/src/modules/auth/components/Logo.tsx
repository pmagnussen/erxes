import { useAtomValue } from 'jotai';
import { currentOrganizationState } from 'ui-modules';

type LogoProps = React.SVGProps<SVGSVGElement>;

const FramskakMark = ({ ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 420 420"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <rect x="0" y="0" width="420" height="56" fill="currentColor" />
    <rect x="0" y="365" width="420" height="56" fill="currentColor" />
    <rect x="0" y="55" width="56" height="311" fill="currentColor" />
    <rect x="365" y="55" width="56" height="311" fill="currentColor" />
    <rect
      x="185"
      y="40"
      width="50"
      height="340"
      fill="currentColor"
      transform="rotate(15 210 210)"
    />
  </svg>
);

export const Logo = ({ className }: LogoProps) => {
  const organization = useAtomValue(currentOrganizationState);

  if (!organization?.orgLogo) {
    return (
      <span
        className={`inline-flex items-center justify-center gap-2 text-2xl font-semibold ${
          className ?? ''
        }`}
      >
        <FramskakMark className="size-8" />
        <span>Framskák</span>
      </span>
    );
  }

  return (
    <img
      src={organization.orgLogo}
      alt="Organization Logo"
      className="object-contain h-8 w-auto"
    />
  );
};

export const OrgLogoIcon = ({ ...props }: React.SVGProps<SVGSVGElement>) => {
  const organization = useAtomValue(currentOrganizationState);

  if (organization?.orgLogo) {
    return (
      <img
        src={organization.orgLogo}
        alt="Organization Logo"
        className="object-contain h-8 w-auto"
      />
    );
  }
  return <FramskakMark {...props} />;
};
