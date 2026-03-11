import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BookOpen, Copy, Upload, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function PagamentoRevistaPublico() {
  const { codigo } = useParams<{ codigo: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [tipoRevista, setTipoRevista] = useState("aluno");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: licenca, isLoading: loadingLicenca } = useQuery({
    queryKey: ["public-licenca", codigo],
    queryFn: async () => {
      if (!codigo) return null;
      const { data, error } = await supabase
        .from("revista_licencas")
        .select("id, superintendente_id, chave_pix, codigo_pagamento, quantidade_total, quantidade_usada, status, revista_aluno_id, revista_professor_id")
        .eq("codigo_pagamento", codigo)
        .eq("status", "ativa")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!codigo,
  });

  const { data: igreja } = useQuery({
    queryKey: ["public-igreja", licenca?.superintendente_id],
    queryFn: async () => {
      if (!licenca?.superintendente_id) return null;
      const { data } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, telefone")
        .eq("id", licenca.superintendente_id)
        .maybeSingle();
      return data;
    },
    enabled: !!licenca?.superintendente_id,
  });

  const { data: revistaAluno } = useQuery({
    queryKey: ["public-revista-aluno", licenca?.revista_aluno_id],
    queryFn: async () => {
      if (!licenca?.revista_aluno_id) return null;
      const { data } = await supabase
        .from("revistas_digitais")
        .select("titulo, trimestre, capa_url")
        .eq("id", licenca.revista_aluno_id)
        .maybeSingle();
      return data;
    },
    enabled: !!licenca?.revista_aluno_id,
  });

  const copyPix = () => {
    if (licenca?.chave_pix) {
      navigator.clipboard.writeText(licenca.chave_pix);
      toast.success("Chave PIX copiada!");
    }
  };

  const handleSubmit = async () => {
    if (!licenca || !nome.trim() || !email.trim() || !senha || senha.length < 6) {
      toast.error("Preencha todos os campos obrigatórios (senha mínimo 6 caracteres)");
      return;
    }
    if (!comprovante) {
      toast.error("Envie o comprovante de pagamento");
      return;
    }

    setSubmitting(true);
    try {
      // Create auth user
      const { data: authResult, error: authError } = await supabase.functions.invoke("create-auth-user-direct", {
        body: { email: email.toLowerCase().trim(), password: senha, full_name: nome },
      });
      if (authError) throw authError;
      if (!authResult?.success) throw new Error(authResult?.error || "Erro ao criar conta");

      // Upload comprovante
      const ext = comprovante.name.split(".").pop() || "jpg";
      const path = `${licenca.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("comprovantes").upload(path, comprovante, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(path);
      const comprovanteUrl = urlData.publicUrl;

      // Insert aluno record
      const { error: insertError } = await supabase.from("revista_licenca_alunos").insert({
        licenca_id: licenca.id,
        superintendente_id: licenca.superintendente_id,
        aluno_nome: nome.trim(),
        aluno_telefone: whatsapp.replace(/\D/g, "") || null,
        aluno_email: email.toLowerCase().trim(),
        tipo_revista: tipoRevista,
        senha_provisoria: senha,
        status: "aguardando_aprovacao",
        comprovante_url: comprovanteUrl,
        comprovante_enviado_em: new Date().toISOString(),
        user_id: authResult.userId,
      } as any);
      if (insertError) throw insertError;

      // Increment usage
      await supabase
        .from("revista_licencas")
        .update({ quantidade_usada: (licenca.quantidade_usada || 0) + 1 } as any)
        .eq("id", licenca.id);

      // Notify SE via WhatsApp
      if (igreja?.telefone) {
        try {
          await supabase.functions.invoke("send-whatsapp-message", {
            body: {
              tipo_mensagem: "notificacao_revista",
              telefone: igreja.telefone.replace(/\D/g, ""),
              nome: igreja.nome_igreja || "Superintendente",
              mensagem: `📋 Novo comprovante recebido!\nAluno: ${nome}\nWhatsApp: ${whatsapp}\nTipo: ${tipoRevista === "professor" ? "Professor" : "Aluno"}\nAcesse o painel para aprovar.`,
            },
          });
        } catch { /* silent */ }
      }

      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar cadastro");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingLicenca) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!licenca) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">Link inválido ou expirado</h2>
            <p className="text-muted-foreground">Este link de pagamento não é válido ou a licença já expirou.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center space-y-6">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
            <h2 className="text-xl font-bold">Cadastro enviado!</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between px-4">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl">✅</span>
                  <span className="text-[11px] font-medium">Cadastro</span>
                </div>
                <div className="flex-1 h-0.5 mx-1 bg-green-400" />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl">✅</span>
                  <span className="text-[11px] font-medium">Comprovante</span>
                </div>
                <div className="flex-1 h-0.5 mx-1 bg-muted" />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl">⏳</span>
                  <span className="text-[11px] font-medium">Aprovação</span>
                </div>
                <div className="flex-1 h-0.5 mx-1 bg-muted" />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl">🔒</span>
                  <span className="text-[11px] font-medium">Acesso</span>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">
                Aguarde a aprovação do seu Superintendente. Você receberá uma mensagem no WhatsApp quando seu acesso for liberado.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const slotsAvailable = licenca.quantidade_total - licenca.quantidade_usada;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-lg mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <BookOpen className="h-10 w-10 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Revista Virtual</h1>
          {igreja && <p className="text-muted-foreground">{igreja.nome_igreja}</p>}
        </div>

        {/* Magazine info */}
        {revistaAluno && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                {revistaAluno.capa_url && (
                  <img src={revistaAluno.capa_url} alt={revistaAluno.titulo} className="w-16 h-20 object-cover rounded shadow" />
                )}
                <div>
                  <p className="font-semibold">{revistaAluno.titulo}</p>
                  <p className="text-sm text-muted-foreground">{revistaAluno.trimestre}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {slotsAvailable <= 0 && (
          <Card className="border-destructive">
            <CardContent className="py-4 text-center text-destructive">
              <p className="font-medium">Todas as vagas já foram preenchidas</p>
            </CardContent>
          </Card>
        )}

        {slotsAvailable > 0 && (
          <>
            {/* PIX Section */}
            {licenca.chave_pix && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pagamento via PIX</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <span className="text-sm font-mono flex-1 truncate">{licenca.chave_pix}</span>
                    <Button size="sm" variant="ghost" onClick={copyPix}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex justify-center p-4 bg-white rounded-lg">
                    <QRCodeSVG value={licenca.chave_pix} size={180} />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Escaneie o QR Code ou copie a chave PIX para realizar o pagamento
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Registration Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Seus dados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome completo *</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
                </div>
                <div>
                  <Label>WhatsApp *</Label>
                  <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="11999999999" />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" type="email" />
                </div>
                <div>
                  <Label>Senha (mínimo 6 caracteres) *</Label>
                  <Input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" placeholder="Crie sua senha" minLength={6} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={tipoRevista} onValueChange={setTipoRevista}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aluno">Aluno</SelectItem>
                      <SelectItem value="professor">Professor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Comprovante de pagamento *</Label>
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {comprovante ? (
                      <div className="space-y-1">
                        <CheckCircle2 className="h-8 w-8 mx-auto text-green-500" />
                        <p className="text-sm font-medium">{comprovante.name}</p>
                        <p className="text-xs text-muted-foreground">Clique para trocar</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Clique para enviar foto ou PDF</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => setComprovante(e.target.files?.[0] || null)}
                  />
                </div>
                <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar Cadastro e Comprovante"
                  )}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
