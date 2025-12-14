import { useMemo } from 'react';

interface DomainBranding {
  logoUrl: string;
  logoHorizontalUrl: string;
  primaryColor: string;
  navBackgroundColor: string;
  navTextColor: string;
  accentColor: string;
  appName: string;
  isEBD: boolean;
}

const ebdBranding: DomainBranding = {
  logoUrl: '/logos/logo-ebd-horizontal.png',
  logoHorizontalUrl: '/logos/logo-ebd-horizontal.png',
  primaryColor: '#FFC107',
  navBackgroundColor: '#1a1a1a',
  navTextColor: '#FFFFFF',
  accentColor: '#FFC107',
  appName: 'Gestão EBD',
  isEBD: true
};

const ananiasBranding: DomainBranding = {
  logoUrl: '/logos/logo-ananias.png',
  logoHorizontalUrl: '/logos/logo-ananias-horizontal.png',
  primaryColor: '#0056b3',
  navBackgroundColor: '#1e3a5f',
  navTextColor: '#FFFFFF',
  accentColor: '#3b82f6',
  appName: 'Projeto Ananias',
  isEBD: false
};

export const useDomainBranding = (): DomainBranding => {
  const branding = useMemo(() => {
    const hostname = window.location.hostname.toLowerCase();
    
    // Check if accessing from EBD domain
    if (hostname.includes('gestaoebd')) {
      return ebdBranding;
    }
    
    // Default to Ananias for all other domains
    return ananiasBranding;
  }, []);

  return branding;
};

export const isEBDDomain = (): boolean => {
  const hostname = window.location.hostname.toLowerCase();
  return hostname.includes('gestaoebd');
};

export type { DomainBranding };
