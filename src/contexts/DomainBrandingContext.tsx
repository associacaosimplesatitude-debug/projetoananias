import React, { createContext, useContext, useEffect } from 'react';
import { useDomainBranding, DomainBranding } from '@/hooks/useDomainBranding';

const DomainBrandingContext = createContext<DomainBranding | null>(null);

export const DomainBrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const branding = useDomainBranding();

  // Apply CSS variables based on domain branding
  useEffect(() => {
    const root = document.documentElement;
    
    // Convert hex to HSL for CSS variables
    const hexToHSL = (hex: string): string => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return '0 0% 0%';
      
      let r = parseInt(result[1], 16) / 255;
      let g = parseInt(result[2], 16) / 255;
      let b = parseInt(result[3], 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }

      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };

    // Update document title
    document.title = branding.appName;

    // Apply branding colors as CSS variables for EBD domain
    if (branding.isEBD) {
      root.style.setProperty('--primary', hexToHSL(branding.primaryColor));
      root.style.setProperty('--accent', hexToHSL(branding.accentColor));
    }
  }, [branding]);

  return (
    <DomainBrandingContext.Provider value={branding}>
      {children}
    </DomainBrandingContext.Provider>
  );
};

export const useDomainBrandingContext = (): DomainBranding => {
  const context = useContext(DomainBrandingContext);
  if (!context) {
    throw new Error('useDomainBrandingContext must be used within a DomainBrandingProvider');
  }
  return context;
};
