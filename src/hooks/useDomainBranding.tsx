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
}

const brandingConfig: Record<string, DomainBranding> = {
  'gestaoebd.com.br': {
    logoUrl: '/logos/logo-ebd-horizontal.png',
    logoHorizontalUrl: '/logos/logo-ebd-horizontal.png',
    primaryColor: '#FFC107', // Amarelo/Ouro EBD
    navBackgroundColor: '#1a1a1a', // Preto/Escuro
    navTextColor: '#FFFFFF',
    accentColor: '#FFC107', // Amarelo/Ouro
    appName: 'Gestão EBD',
    domain: 'gestaoebd.com.br'
  },
  'projetoananias.com.br': {
    logoUrl: '/logos/logo-ananias.png',
    logoHorizontalUrl: '/logos/logo-ananias-horizontal.png',
    primaryColor: '#0056b3',
    navBackgroundColor: '#1e3a5f',
    navTextColor: '#FFFFFF',
    accentColor: '#3b82f6',
    appName: 'Projeto Ananias',
    domain: 'projetoananias.com.br'
  }
};

// Default branding (Ananias)
const defaultBranding: DomainBranding = {
  logoUrl: '/logos/logo-ananias.png',
  logoHorizontalUrl: '/logos/logo-ananias-horizontal.png',
  primaryColor: '#0056b3',
  navBackgroundColor: '#1e3a5f',
  navTextColor: '#FFFFFF',
  accentColor: '#3b82f6',
  appName: 'Projeto Ananias',
  domain: 'default'
};

export const useDomainBranding = (): DomainBranding => {
  const branding = useMemo(() => {
    const hostname = window.location.hostname;
    
    // Check for exact domain match
    if (brandingConfig[hostname]) {
      return brandingConfig[hostname];
    }
    
    // Check for subdomain match (e.g., www.gestaoebd.com.br)
    for (const [domain, config] of Object.entries(brandingConfig)) {
      if (hostname.endsWith(domain) || hostname.includes(domain.split('.')[0])) {
        return config;
      }
    }
    
    // Return default branding
    return defaultBranding;
  }, []);

  return branding;
};

export const isEBDDomain = (): boolean => {
  const hostname = window.location.hostname;
  return hostname.includes('gestaoebd') || hostname.includes('ebd');
};

export const isAnaniasDomain = (): boolean => {
  const hostname = window.location.hostname;
  return hostname.includes('ananias') || (!isEBDDomain() && !hostname.includes('localhost'));
};

export type { DomainBranding };
