import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoyaltiesAuth } from "@/hooks/useRoyaltiesAuth";

export default function AutorPerfil() {
  const { autorId } = useRoyaltiesAuth();

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
        Perfil não encontrado.
      </div>
    );
  }

  const endereco = autor.endereco as Record<string, string> || {};
  const dadosBancarios = autor.dados_bancarios as Record<string, string> || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meus Dados</h1>
        <p className="text-muted-foreground">
          Visualize suas informações cadastrais
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados Pessoais</CardTitle>
          <CardDescription>Suas informações básicas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input value={autor.nome_completo} disabled />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={autor.email} disabled />
            </div>
            <div className="space-y-2">
              <Label>CPF/CNPJ</Label>
              <Input value={autor.cpf_cnpj || "-"} disabled />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={autor.telefone || "-"} disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endereço</CardTitle>
          <CardDescription>Seu endereço cadastrado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input value={endereco.cep || "-"} disabled />
            </div>
            <div className="space-y-2">
              <Label>Logradouro</Label>
              <Input value={endereco.logradouro || "-"} disabled />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={endereco.numero || "-"} disabled />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input value={endereco.bairro || "-"} disabled />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={endereco.cidade || "-"} disabled />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={endereco.uf || "-"} disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados Bancários</CardTitle>
          <CardDescription>Conta para recebimento de royalties</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Banco</Label>
              <Input value={dadosBancarios.banco || "-"} disabled />
            </div>
            <div className="space-y-2">
              <Label>Agência</Label>
              <Input value={dadosBancarios.agencia || "-"} disabled />
            </div>
            <div className="space-y-2">
              <Label>Conta</Label>
              <Input value={dadosBancarios.conta || "-"} disabled />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input value={dadosBancarios.tipo || "-"} disabled />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
