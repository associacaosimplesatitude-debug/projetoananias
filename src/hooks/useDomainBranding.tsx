import { useMemo } from 'react';

interface DomainBranding {
  logoUrl: string;
  logoHorizontalUrl: string;
  primaryColor: string;
  navBackgroundColor: string;
  navTextColor: string;
  accentColor: string;
  appName: string;
  domain: string;
  isEBD: boolean;
}

const ebdBranding: DomainBranding = {
  logoUrl: '/logos/logo-ebd-horizontal.png',
  logoHorizontalUrl: '/logos/logo-ebd-horizontal.png',
  primaryColor: '#B8860B',
  navBackgroundColor: '#1a1a1a',
  navTextColor: '#FFFFFF',
  accentColor: '#D4A017',
  appName: 'Gestão EBD',
  domain: 'gestaoebd.com.br',
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
  domain: 'projetoananias.com.br',
  isEBD: false
};

export const useDomainBranding = (): DomainBranding => {
  const branding = useMemo(() => {
    const hostname = window.location.hostname.toLowerCase();
    
    // Check if accessing from EBD domain
    if (hostname.includes('gestaoebd') || hostname.includes('ebd')) {
      return ebdBranding;
    }
    
    // Check if accessing from Ananias domain
    if (hostname.includes('ananias') || hostname.includes('projetoananias')) {
      return ananiasBranding;
    }
    
    // Default to EBD for localhost and other domains (including Lovable preview)
    return ebdBranding;
  }, []);

  return branding;
};

export const isEBDDomain = (): boolean => {
  const hostname = window.location.hostname.toLowerCase();
  return hostname.includes('gestaoebd') || hostname.includes('ebd');
};

export const isAnaniasDomain = (): boolean => {
  const hostname = window.location.hostname.toLowerCase();
  return hostname.includes('ananias') || hostname.includes('projetoananias') || 
         (!isEBDDomain() && !hostname.includes('localhost'));
};

export const getCurrentDomain = (): string => {
  return window.location.hostname.toLowerCase();
};

export type { DomainBranding };
