import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Login } from '@/auth/login/components/Login';
import { currentUserState } from 'ui-modules';
import { DynamicBanner } from '@/auth/components/DynamicBanner';
import { AuthenticationLayout } from '@/auth/components/AuthenticationLayout';
import { AppPath } from '@/types/paths/AppPath';
import { useAtomValue } from 'jotai';
import { REACT_APP_API_URL } from 'erxes-ui';

const SSO_TRIED_KEY = 'vera-sso-tried';

// vera.fo: silently try Keycloak SSO once per minute before showing the form.
const shouldTrySso = (ssoParam: string | null) => {
  if (ssoParam) {
    return false;
  }
  const last = Number(sessionStorage.getItem(SSO_TRIED_KEY) || 0);
  return Date.now() - last > 60_000;
};

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = useAtomValue(currentUserState);
  const redirect = searchParams.get('redirect') || AppPath.Index;
  const safeRedirect =
    redirect.startsWith('/') && !redirect.startsWith('//')
      ? redirect
      : AppPath.Index;

  const trySso = !currentUser && shouldTrySso(searchParams.get('sso'));

  useEffect(() => {
    if (!trySso) {
      return;
    }
    sessionStorage.setItem(SSO_TRIED_KEY, String(Date.now()));
    window.location.replace(
      `${REACT_APP_API_URL}/pl:veraprovision/sso/start?redirect=${encodeURIComponent(safeRedirect)}`,
    );
  }, [trySso, safeRedirect]);

  useEffect(() => {
    if (currentUser) {
      navigate(safeRedirect, { replace: true });
    }
  }, [currentUser, navigate, safeRedirect]);

  if (trySso) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full z-10">
      <DynamicBanner />
      <AuthenticationLayout>
        <Login />
      </AuthenticationLayout>
    </div>
  );
};

export default LoginPage;
