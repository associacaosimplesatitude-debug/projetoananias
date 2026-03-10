import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Gift,
  Truck,
  BarChart3,
  ShoppingBag,
  Lock,
  Clock,
  MessageCircle,
  ExternalLink,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import logoCentralGospel from '@/assets/ofertas/logo-central-gospel.png';

interface CampaignLink {
  id: string;
  token: string;
  campaign_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  last_order_date: string | null;
  last_products: string[] | null;
  last_order_value: number | null;
  has_discount: boolean;
  discount_percentage: number;
  final_discount: number;
  access_email: string | null;
  access_password: string | null;
  panel_url: string | null;
  first_accessed_at: string | null;
}

const trackEvent = async (token: string, eventType: string, eventData?: Record<string, unknown>) => {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    await fetch(`https://${projectId}.supabase.co/functions/v1/campaign-track-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, event_type: eventType, event_data: eventData }),
    });
  } catch (e) {
    console.error('Track event error:', e);
  }
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
};

const formatCurrency = (value: number | null) => {
  if (!value) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const OfertaPersonalizada = () => {
  const { token } = useParams<{ token: string }>();
  const [link, setLink] = useState<CampaignLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [revealedBenefits, setRevealedBenefits] = useState<number[]>([]);
  const [sessionStart] = useState(Date.now());
  const benefitsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }

    const fetchLink = async () => {
      const { data, error } = await supabase
        .from('campaign_links')
        .select('*')
        .eq('token', token)
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLink(data as unknown as CampaignLink);
      setLoading(false);

      // Track page view
      trackEvent(token, 'page_viewed');

      // Mark first access
      if (!data.first_accessed_at) {
        await supabase
          .from('campaign_links')
          .update({ first_accessed_at: new Date().toISOString() })
          .eq('token', token);
      }
    };

    fetchLink();

    // Track session duration on unmount
    return () => {
      const duration = Math.round((Date.now() - sessionStart) / 1000);
      if (token && duration > 2) {
        trackEvent(token, 'session_end', { duration_seconds: duration });
      }
    };
  }, [token, sessionStart]);

  // Staggered benefit reveal
  useEffect(() => {
    const timers = [
      setTimeout(() => setRevealedBenefits(prev => [...prev, 0]), 400),
      setTimeout(() => setRevealedBenefits(prev => [...prev, 1]), 900),
      setTimeout(() => setRevealedBenefits(prev => [...prev, 2]), 1400),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const handlePanelAccess = () => {
    if (!link || !token) return;
    trackEvent(token, 'panel_accessed', { panel_url: link.panel_url });
    
    const url = link.panel_url || 'https://gestaoebd.com.br/login/ebd';
    // Add UTM params
    const separator = url.includes('?') ? '&' : '?';
    const tracked = `${url}${separator}utm_source=whatsapp&utm_medium=campaign&utm_campaign=reativacao&utm_content=${token}`;
    window.open(tracked, '_blank');
  };

  const handleWhatsApp = () => {
    window.open('https://wa.me/5521999999999?text=Ol%C3%A1%2C+recebi+uma+oferta+e+preciso+de+ajuda', '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(40,30%,97%)] flex items-center justify-center">
        <div className="w-full max-w-lg space-y-6 p-8">
          <Skeleton className="h-12 w-48 mx-auto" />
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (notFound || !link) {
    return (
      <div className="min-h-screen bg-[hsl(40,30%,97%)] flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center border-none shadow-xl bg-[hsl(0,0%,100%)]">
          <CardContent className="p-10 space-y-4">
            <div className="w-16 h-16 rounded-full bg-[hsl(0,0%,95%)] flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-[hsl(0,0%,50%)]" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-[hsl(30,10%,15%)]">Oferta Encerrada</h1>
            <p className="text-[hsl(30,5%,45%)]">
              Esta oferta não está mais disponível ou o link é inválido.
            </p>
            <Button
              onClick={() => window.location.href = 'https://gestaoebd.com.br'}
              className="bg-[hsl(36,50%,45%)] hover:bg-[hsl(36,50%,40%)] text-[hsl(0,0%,100%)]"
            >
              Visitar Central Gospel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const firstName = link.customer_name?.split(' ')[0] || 'Amigo(a)';

  return (
    <div className="min-h-screen bg-[hsl(40,30%,97%)]">
      {/* OG Meta tags are set via document.title */}
      {(() => { document.title = `Oferta Exclusiva para ${firstName} | Central Gospel`; return null; })()}

      {/* Header */}
      <header className="bg-[hsl(0,0%,100%)] border-b border-[hsl(40,20%,90%)] py-4 px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-center">
          <img src={logoCentralGospel} alt="Central Gospel Editora" className="h-10 object-contain" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* SECTION 1 — Hero */}
        <section className="text-center space-y-4 animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-[hsl(36,60%,92%)] text-[hsl(36,50%,35%)] px-4 py-1.5 rounded-full text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            Oferta Exclusiva
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-[hsl(30,10%,15%)] leading-tight">
            Olá, <span className="text-[hsl(36,50%,45%)]">{firstName}</span> 👋
          </h1>
          <p className="text-[hsl(30,5%,40%)] text-lg max-w-md mx-auto">
            {link.last_order_date ? (
              <>Sua última compra foi em <strong>{formatDate(link.last_order_date)}</strong> e preparamos algo especial para te receber de volta.</>
            ) : (
              <>Preparamos algo especial para você!</>
            )}
          </p>
        </section>

        {/* SECTION 2 — 3 Benefícios */}
        <section ref={benefitsRef} className="space-y-4">
          {/* Benefit 1 — Desconto */}
          <div className={`transition-all duration-700 ${revealedBenefits.includes(0) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-[hsl(36,60%,95%)] to-[hsl(36,40%,98%)] overflow-hidden">
              <CardContent className="p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[hsl(36,50%,45%)] flex items-center justify-center flex-shrink-0">
                  <Gift className="w-6 h-6 text-[hsl(0,0%,100%)]" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-[hsl(30,10%,15%)]">Economia Garantida</h3>
                  <p className="text-[hsl(30,5%,40%)] mt-1">
                    Seu desconto exclusivo de{' '}
                    <span className="text-2xl font-bold text-[hsl(36,50%,40%)]">{link.final_discount}%</span>{' '}
                    já está reservado para você.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Benefit 2 — Frete */}
          <div className={`transition-all duration-700 ${revealedBenefits.includes(1) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-[hsl(142,40%,95%)] to-[hsl(142,30%,98%)] overflow-hidden">
              <CardContent className="p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[hsl(142,60%,38%)] flex items-center justify-center flex-shrink-0">
                  <Truck className="w-6 h-6 text-[hsl(0,0%,100%)]" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-[hsl(30,10%,15%)]">Sem Complicação</h3>
                  <p className="text-[hsl(30,5%,40%)] mt-1">
                    Frete grátis em pedidos acima de <strong>R$ 199</strong>. Sua encomenda chega direto na sua igreja.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Benefit 3 — Gestão EBD (surprise) */}
          <div className={`transition-all duration-700 ${revealedBenefits.includes(2) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-[hsl(260,40%,95%)] to-[hsl(260,30%,98%)] overflow-hidden">
              <CardContent className="p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[hsl(260,50%,50%)] flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-6 h-6 text-[hsl(0,0%,100%)]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif font-bold text-lg text-[hsl(30,10%,15%)]">Esse Vai Te Surpreender</h3>
                    <span className="text-xs bg-[hsl(260,50%,50%)] text-[hsl(0,0%,100%)] px-2 py-0.5 rounded-full">PRESENTE</span>
                  </div>
                  <p className="text-[hsl(30,5%,40%)] mt-1">
                    Acesso <strong>gratuito</strong> ao <strong>Gestão EBD</strong> — organize sua escola dominical com frequência, quiz, ranking e muito mais.
                  </p>
                  <a
                    href="https://gestaoebd.com.br/vendedor"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[hsl(260,50%,50%)] font-medium mt-2 hover:underline"
                  >
                    Conhecer o Gestão EBD <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* SECTION 3 — Histórico */}
        {link.last_products && link.last_products.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-serif font-bold text-[hsl(30,10%,15%)] flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[hsl(36,50%,45%)]" />
              Você já comprou conosco
            </h2>
            <div className="grid gap-3">
              {link.last_products.map((product, i) => (
                <Card key={i} className="border border-[hsl(40,20%,90%)] shadow-sm bg-[hsl(0,0%,100%)]">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[hsl(36,60%,92%)] flex items-center justify-center flex-shrink-0">
                      <span className="text-[hsl(36,50%,45%)] font-bold text-sm">{i + 1}</span>
                    </div>
                    <span className="text-[hsl(30,10%,20%)] text-sm font-medium">{product}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
            {link.last_order_value && (
              <p className="text-[hsl(30,5%,40%)] text-sm">
                Valor do último pedido: <strong>{formatCurrency(link.last_order_value)}</strong>
              </p>
            )}
          </section>
        )}

        {/* SECTION 4 — Acesso ao Painel */}
        {(link.access_email || link.access_password) && (
          <section className="space-y-4">
            <Card className="border-2 border-[hsl(36,40%,80%)] shadow-xl bg-[hsl(0,0%,100%)] overflow-hidden">
              <div className="bg-gradient-to-r from-[hsl(36,50%,45%)] to-[hsl(36,50%,55%)] p-4">
                <h2 className="text-xl font-serif font-bold text-[hsl(0,0%,100%)] flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Seus Dados de Acesso ao Painel
                </h2>
              </div>
              <CardContent className="p-6 space-y-4">
                {link.access_email && (
                  <div className="flex items-center gap-3 bg-[hsl(40,30%,97%)] rounded-lg p-3">
                    <span className="text-sm text-[hsl(30,5%,45%)]">📧 Email:</span>
                    <span className="font-mono text-sm font-medium text-[hsl(30,10%,20%)]">{link.access_email}</span>
                  </div>
                )}
                {link.access_password && (
                  <div className="flex items-center gap-3 bg-[hsl(40,30%,97%)] rounded-lg p-3">
                    <span className="text-sm text-[hsl(30,5%,45%)]">🔑 Senha:</span>
                    <span className="font-mono text-sm font-medium text-[hsl(30,10%,20%)]">{link.access_password}</span>
                  </div>
                )}

                <Button
                  onClick={handlePanelAccess}
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-[hsl(36,50%,45%)] to-[hsl(36,60%,50%)] hover:from-[hsl(36,50%,40%)] hover:to-[hsl(36,60%,45%)] text-[hsl(0,0%,100%)] shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Gift className="w-5 h-5 mr-2" />
                  🎁 Ver Minha Surpresa
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Fallback CTA if no credentials */}
        {!link.access_email && !link.access_password && (
          <section>
            <Button
              onClick={handlePanelAccess}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-[hsl(36,50%,45%)] to-[hsl(36,60%,50%)] hover:from-[hsl(36,50%,40%)] hover:to-[hsl(36,60%,45%)] text-[hsl(0,0%,100%)] shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Gift className="w-5 h-5 mr-2" />
              🎁 Ver Minha Surpresa
            </Button>
          </section>
        )}

        {/* SECTION 5 — Urgência + Footer */}
        <section className="text-center space-y-4 pb-24">
          <div className="inline-flex items-center gap-2 bg-[hsl(0,70%,95%)] text-[hsl(0,60%,45%)] px-4 py-2 rounded-full text-sm font-medium animate-pulse">
            <Clock className="w-4 h-4" />
            Oferta por tempo limitado — aproveite agora
          </div>
          <p className="text-xs text-[hsl(30,5%,60%)]">
            Central Gospel Editora • Materiais bíblicos que transformam vidas
          </p>
        </section>
      </main>

      {/* WhatsApp floating button */}
      <button
        onClick={handleWhatsApp}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[hsl(142,70%,40%)] text-[hsl(0,0%,100%)] shadow-xl flex items-center justify-center hover:bg-[hsl(142,70%,35%)] transition-all hover:scale-110 z-50"
        aria-label="Fale conosco no WhatsApp"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    </div>
  );
};

export default OfertaPersonalizada;
