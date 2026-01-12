import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Cliente {
  id: string;
  cnpj: string;
  nome_igreja: string;
  nome_superintendente: string | null;
  email_superintendente: string | null;
}

interface AtivarClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: Cliente;
  onSuccess: () => void;
}

const DIAS_AULA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export function AtivarClienteDialog({
  open,
  onOpenChange,
  cliente,
  onSuccess,
}: AtivarClienteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email_superintendente: cliente.email_superintendente || "",
    nome_superintendente: cliente.nome_superintendente || "",
    senha: "",
    dia_aula: "Domingo",
    data_inicio_ebd: undefined as Date | undefined,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email_superintendente || !formData.data_inicio_ebd || !formData.senha) {
      toast.error("E-mail, Senha e Data de Início são obrigatórios");
      return;
    }

    if (formData.senha.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      // Verificar se o usuário tem uma sessão válida antes de chamar a edge function
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        toast.error("Sua sessão expirou. Por favor, faça login novamente.");
        setLoading(false);
        return;
      }

      // Calculate next purchase date (13 weeks from start date)
      const dataProximaCompra = addWeeks(formData.data_inicio_ebd, 13);

      // Usar a senha definida pelo vendedor
      const tempPassword = formData.senha;

      // 1. Create the superintendent user via edge function (and link to cliente)
      const { data: userData, error: userError } = await supabase.functions.invoke(
        "create-ebd-user",
        {
          body: {
            email: formData.email_superintendente,
            password: tempPassword,
            fullName: formData.nome_superintendente || "Superintendente",
            clienteId: cliente.id,
          },
        }
      );

      if (userError || !userData?.userId) {
        console.error("Error creating user:", userError, userData);
        // Verificar se é erro de autenticação
        const errorMessage = userError?.message || userData?.error || "";
        if (errorMessage.toLowerCase().includes("unauthorized") || errorMessage.toLowerCase().includes("auth")) {
          toast.error("Sessão expirada. Por favor, faça login novamente.");
        } else {
          toast.error("Não foi possível criar o acesso do superintendente. Tente novamente.");
        }
        setLoading(false);
        return;
      }

      // 2. Update the cliente record (redundant com a função, mas garante dados locais)
      const { error: updateError } = await supabase
        .from("ebd_clientes")
        .update({
          email_superintendente: formData.email_superintendente,
          nome_superintendente: formData.nome_superintendente,
          dia_aula: formData.dia_aula,
          data_inicio_ebd: format(formData.data_inicio_ebd, "yyyy-MM-dd"),
          data_proxima_compra: format(dataProximaCompra, "yyyy-MM-dd"),
          status_ativacao_ebd: true,
          // Remover da lista de pós-venda ao ativar painel
          is_pos_venda_ecommerce: false,
          superintendente_user_id: userData.userId,
          senha_temporaria: tempPassword,
        })
        .eq("id", cliente.id);

      if (updateError) throw updateError;

      // 2.5. Atualizar status na tabela pivô ebd_pos_venda_ecommerce (se existir)
      try {
        await (supabase as any)
          .from("ebd_pos_venda_ecommerce")
          .update({ status: "ativado" })
          .eq("cliente_id", cliente.id)
          .eq("status", "pendente");
      } catch (pivotError) {
        console.error("Erro ao atualizar status na tabela pivô (não crítico):", pivotError);
        // Não é crítico, continuar mesmo se falhar
      }

      // 3. Send welcome email
      try {
        await supabase.functions.invoke("send-welcome-email", {
          body: {
            email: formData.email_superintendente,
            nome: formData.nome_superintendente || "Superintendente",
            igreja: cliente.nome_igreja,
          },
        });
      } catch (emailError) {
        console.error("Error sending welcome email:", emailError);
        // Continue anyway
      }

      toast.success("Cliente ativado com sucesso! E-mail de boas-vindas enviado.");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error activating cliente:", error);
      toast.error("Erro ao ativar cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ativar Painel EBD</DialogTitle>
          <DialogDescription>
            Ativar o Painel EBD para <strong>{cliente.nome_igreja}</strong>.
            Um usuário será criado e um e-mail de boas-vindas será enviado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome_superintendente">Nome do Superintendente</Label>
            <Input
              id="nome_superintendente"
              value={formData.nome_superintendente}
              onChange={(e) =>
                setFormData({ ...formData, nome_superintendente: e.target.value })
              }
              placeholder="Nome completo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_superintendente">E-mail do Superintendente *</Label>
            <Input
              id="email_superintendente"
              type="email"
              value={formData.email_superintendente}
              onChange={(e) =>
                setFormData({ ...formData, email_superintendente: e.target.value })
              }
              placeholder="email@igreja.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha">Senha de Acesso *</Label>
            <Input
              id="senha"
              type="text"
              value={formData.senha}
              onChange={(e) =>
                setFormData({ ...formData, senha: e.target.value })
              }
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
            <p className="text-xs text-muted-foreground">
              Esta senha será usada para o primeiro acesso ao painel
            </p>
          </div>

          <div className="space-y-2">
            <Label>Dia da Aula *</Label>
            <Select
              value={formData.dia_aula}
              onValueChange={(value) =>
                setFormData({ ...formData, dia_aula: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o dia" />
              </SelectTrigger>
              <SelectContent>
                {DIAS_AULA.map((dia) => (
                  <SelectItem key={dia} value={dia}>
                    {dia}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data de Início da EBD *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.data_inicio_ebd && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.data_inicio_ebd ? (
                    format(formData.data_inicio_ebd, "dd/MM/yyyy", { locale: ptBR })
                  ) : (
                    <span>Selecione a data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.data_inicio_ebd}
                  onSelect={(date) =>
                    setFormData({ ...formData, data_inicio_ebd: date })
                  }
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            {formData.data_inicio_ebd && (
              <p className="text-xs text-muted-foreground">
                Próxima compra prevista: {format(addWeeks(formData.data_inicio_ebd, 13), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Ativando..." : "Ativar Painel EBD"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
