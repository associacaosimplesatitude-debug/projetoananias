import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoyaltiesAuth } from "@/hooks/useRoyaltiesAuth";
import { User, Mail, Phone, MapPin, Building2, CreditCard, Save, Loader2 } from "lucide-react";

export default function AutorPerfil() {
  const { autorId } = useRoyaltiesAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: autor, isLoading } = useQuery({
    queryKey: ["autor-perfil", autorId],
    queryFn: async () => {
      if (!autorId) return null;

      const { data, error } = await supabase
        .from("royalties_autores")
        .select("*")
        .eq("id", autorId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!autorId,
  });

  const [formData, setFormData] = useState({
    telefone: "",
    endereco: "",
    banco: "",
    agencia: "",
    conta: "",
    tipo_conta: "corrente",
    pix: "",
  });

  // Initialize form when data loads
  useState(() => {
    if (autor) {
      const dadosBancarios = autor.dados_bancarios as Record<string, string> || {};
      setFormData({
        telefone: autor.telefone || "",
        endereco: typeof autor.endereco === 'string' ? autor.endereco : "",
        banco: dadosBancarios.banco || "",
        agencia: dadosBancarios.agencia || "",
        conta: dadosBancarios.conta || "",
        tipo_conta: dadosBancarios.tipo_conta || "corrente",
        pix: dadosBancarios.pix || "",
      });
    }
  });

  // Update form when autor data changes
  const handleAutorChange = () => {
    if (autor) {
      const dadosBancarios = autor.dados_bancarios as Record<string, string> || {};
      setFormData({
        telefone: autor.telefone || "",
        endereco: typeof autor.endereco === 'string' ? autor.endereco : "",
        banco: dadosBancarios.banco || "",
        agencia: dadosBancarios.agencia || "",
        conta: dadosBancarios.conta || "",
        tipo_conta: dadosBancarios.tipo_conta || "corrente",
        pix: dadosBancarios.pix || "",
      });
    }
  };

  // Effect to sync form with data
  if (autor && !formData.banco && autor.dados_bancarios) {
    handleAutorChange();
  }

  const handleSave = async () => {
    if (!autorId) return;

    setSaving(true);
    try {
      const dados_bancarios = {
        banco: formData.banco,
        agencia: formData.agencia,
        conta: formData.conta,
        tipo_conta: formData.tipo_conta,
        pix: formData.pix,
      };

      const { error } = await supabase
        .from("royalties_autores")
        .update({
          telefone: formData.telefone || null,
          endereco: formData.endereco || null,
          dados_bancarios,
        })
        .eq("id", autorId);

      if (error) throw error;

      toast({ title: "Dados atualizados com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["autor-perfil"] });
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!autor) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Perfil não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Meus Dados</h1>
          <p className="text-muted-foreground">
            Visualize e atualize suas informações cadastrais
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Alterações
        </Button>
      </div>

      {/* Personal Info - Read Only */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Dados Pessoais
          </CardTitle>
          <CardDescription>
            Informações básicas (somente leitura)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Nome Completo
              </Label>
              <Input value={autor.nome_completo} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </Label>
              <Input value={autor.email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>CPF/CNPJ</Label>
              <Input value={autor.cpf_cnpj || "-"} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Telefone
              </Label>
              <Input
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address - Editable */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Endereço
          </CardTitle>
          <CardDescription>
            Seu endereço para correspondência
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Endereço Completo</Label>
            <Textarea
              value={formData.endereco}
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              placeholder="Rua, número, bairro, cidade, estado, CEP"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bank Data - Editable */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Dados Bancários
          </CardTitle>
          <CardDescription>
            Conta para recebimento de royalties
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Banco
              </Label>
              <Input
                value={formData.banco}
                onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                placeholder="Ex: 001 - Banco do Brasil"
              />
            </div>
            <div className="space-y-2">
              <Label>Agência</Label>
              <Input
                value={formData.agencia}
                onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                placeholder="0000"
              />
            </div>
            <div className="space-y-2">
              <Label>Conta</Label>
              <Input
                value={formData.conta}
                onChange={(e) => setFormData({ ...formData, conta: e.target.value })}
                placeholder="00000-0"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Conta</Label>
              <select
                value={formData.tipo_conta}
                onChange={(e) => setFormData({ ...formData, tipo_conta: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="corrente">Conta Corrente</option>
                <option value="poupanca">Conta Poupança</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Chave PIX</Label>
              <Input
                value={formData.pix}
                onChange={(e) => setFormData({ ...formData, pix: e.target.value })}
                placeholder="CPF, CNPJ, Email, Telefone ou Chave Aleatória"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
