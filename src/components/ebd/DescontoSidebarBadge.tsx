import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Gift, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export function DescontoSidebarBadge() {
  const navigate = useNavigate();

  // Buscar o ebdClienteId do usuário atual
  const { data: ebdCliente } = useQuery({
    queryKey: ["ebd-cliente-desconto-badge"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return null;

      const { data: cliente, error } = await supabase
        .from("ebd_clientes")
        .select("id, desconto_onboarding, onboarding_concluido")
        .eq("superintendente_user_id", user.id)
        .eq("status_ativacao_ebd", true)
        .maybeSingle();

      if (error) throw error;
      if (!cliente) return null;

      // Se ainda não está marcado como concluído, mas as 7 etapas já foram feitas,
      // exibimos o badge mesmo assim (evita inconsistências de sync).
      if (!cliente.onboarding_concluido || !cliente.desconto_onboarding) {
        const { count } = await supabase
          .from("ebd_onboarding_progress")
          .select("id", { count: "exact", head: true })
          .eq("church_id", cliente.id)
          .eq("completada", true);

        if ((count || 0) >= 7) {
          return {
            ...cliente,
            onboarding_concluido: true,
            desconto_onboarding: cliente.desconto_onboarding ?? 20,
          };
        }
      }

      return cliente;
    },
  });

  // Só mostrar se onboarding foi concluído e tem desconto
  if (!ebdCliente?.onboarding_concluido || !ebdCliente?.desconto_onboarding) {
    return null;
  }

  return (
    <button
      onClick={() => navigate("/ebd/catalogo")}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-lg",
        "bg-gradient-to-r from-primary to-accent",
        "hover:from-primary/90 hover:to-accent/90",
        "text-primary-foreground font-medium text-sm",
        "transition-all duration-200 transform hover:scale-[1.02]",
        "shadow-lg shadow-primary/20"
      )}
    >
      <div className="h-8 w-8 rounded-full bg-primary-foreground/15 flex items-center justify-center flex-shrink-0">
        <Gift className="h-4 w-4" />
      </div>
      <div className="flex-1 text-left group-data-[collapsible=icon]:hidden">
        <div className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          <span className="font-bold">{ebdCliente.desconto_onboarding}% OFF</span>
        </div>
        <span className="text-xs text-primary-foreground/80">Desconto Garantido!</span>
      </div>
    </button>
  );
}
