// Google Tag Manager DataLayer utilities

declare global {
  interface Window {
    dataLayer: Record<string, any>[];
  }
}

// Initialize dataLayer if not exists
export const initDataLayer = () => {
  window.dataLayer = window.dataLayer || [];
};

// Push login success event
export const pushLoginSuccess = (userId: string, userType: string) => {
  initDataLayer();
  window.dataLayer.push({
    event: 'login_sucesso',
    user_id: userId,
    user_type: userType,
  });
  console.log('[GTM] login_sucesso pushed:', { userId, userType });
};

// Push signup success event
export const pushCadastroSuccess = (userId: string, userType: string) => {
  initDataLayer();
  window.dataLayer.push({
    event: 'cadastro_sucesso',
    user_id: userId,
    user_type: userType,
  });
  console.log('[GTM] cadastro_sucesso pushed:', { userId, userType });
};

// Push proposal approved event
export const pushPropostaAprovada = (propostaId: string, valorTotal: number) => {
  initDataLayer();
  window.dataLayer.push({
    event: 'proposta_aprovada',
    proposta_id: propostaId,
    proposta_valor: valorTotal,
  });
  console.log('[GTM] proposta_aprovada pushed:', { propostaId, valorTotal });
};
