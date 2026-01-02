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

// Push form submission event
export const pushFormularioEnviado = (formName: string) => {
  initDataLayer();
  window.dataLayer.push({
    event: 'formulario_enviado',
    form_name: formName,
  });
  console.log('[GTM] formulario_enviado pushed:', { formName });
};

// Push setup completed event
export const pushSetupPreenchido = (userId: string) => {
  initDataLayer();
  window.dataLayer.push({
    event: 'setup_preenchido',
    user_id: userId,
  });
  console.log('[GTM] setup_preenchido pushed:', { userId });
};

// Push purchase completed event
export const pushCompraRealizada = (orderId: string, valorTotal: number) => {
  initDataLayer();
  window.dataLayer.push({
    event: 'compra_realizada',
    order_id: orderId,
    order_value: valorTotal,
  });
  console.log('[GTM] compra_realizada pushed:', { orderId, valorTotal });
};

// Push first login event
export const pushPrimeiroLogin = (userId: string, userType: string) => {
  initDataLayer();
  window.dataLayer.push({
    event: 'primeiro_login',
    user_id: userId,
    user_type: userType,
  });
  console.log('[GTM] primeiro_login pushed:', { userId, userType });
};
