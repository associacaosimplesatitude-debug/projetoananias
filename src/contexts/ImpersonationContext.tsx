import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface ImpersonatedVendedor {
  id: string;
  nome: string;
  email: string;
  email_bling: string | null;
  comissao_percentual: number;
  meta_mensal_valor: number;
  tipo_perfil: 'vendedor' | 'representante';
  status: string;
  foto_url: string | null;
  polo: string | null;
}

interface ImpersonationContextType {
  impersonatedVendedor: ImpersonatedVendedor | null;
  impersonateVendedor: (vendedor: ImpersonatedVendedor) => void;
  stopImpersonation: () => void;
  isImpersonating: boolean;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

const STORAGE_KEY = 'impersonated_vendedor';

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [impersonatedVendedor, setImpersonatedVendedor] = useState<ImpersonatedVendedor | null>(() => {
    // Initialize from sessionStorage
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Sync with sessionStorage
  useEffect(() => {
    if (impersonatedVendedor) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(impersonatedVendedor));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [impersonatedVendedor]);

  const impersonateVendedor = useCallback((vendedor: ImpersonatedVendedor) => {
    setImpersonatedVendedor(vendedor);
    navigate('/vendedor');
  }, [navigate]);

  const stopImpersonation = useCallback(() => {
    setImpersonatedVendedor(null);
    navigate('/admin/ebd');
  }, [navigate]);

  const isImpersonating = impersonatedVendedor !== null;

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedVendedor,
        impersonateVendedor,
        stopImpersonation,
        isImpersonating,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider');
  }
  return context;
}
