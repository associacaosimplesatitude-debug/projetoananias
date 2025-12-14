import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LandingEBD from '@/pages/LandingEBD';

const isEBDDomain = (): boolean => {
  const hostname = window.location.hostname.toLowerCase();
  return hostname.includes('gestaoebd') || hostname.includes('ebd.');
};

const EBDLandingRedirect = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [shouldShowLanding, setShouldShowLanding] = useState(false);

  useEffect(() => {
    // If on EBD domain and not logged in, show landing page
    if (!loading && !user && isEBDDomain()) {
      setShouldShowLanding(true);
    } else {
      setShouldShowLanding(false);
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // On EBD domain and not logged in -> show landing page
  if (shouldShowLanding) {
    return <LandingEBD />;
  }

  // Otherwise, render children (normal auth flow)
  return <>{children}</>;
};

export default EBDLandingRedirect;

