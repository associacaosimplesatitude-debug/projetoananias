import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import logoCentralGospel from "@/assets/logo_central_gospel.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";

const BRAND_PRIMARY = "#1B3A5C";

const schema = z
  .object({
    novaSenha: z
      .string()
      .min(8, "A senha deve ter no mínimo 8 caracteres")
      .regex(/[A-Za-z]/, "Deve conter ao menos uma letra")
      .regex(/[0-9]/, "Deve conter ao menos um número"),
    confirmacao: z.string(),
  })
  .refine((d) => d.novaSenha === d.confirmacao, {
    message: "As senhas não conferem",
    path: ["confirmacao"],
  });

type FormValues = z.infer<typeof schema>;

export default function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { novaSenha: "", confirmacao: "" },
  });

  useEffect(() => {
    // Listen first to capture PASSWORD_RECOVERY event from URL hash
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      setCheckingSession(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setCheckingSession(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;

      const { error } = await supabase.auth.updateUser({ password: values.novaSenha });
      if (error) {
        toast({
          title: "Não foi possível redefinir a senha",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (uid) {
        await supabase
          .from("ebd_clientes")
          .update({ deve_trocar_senha: false })
          .eq("superintendente_user_id", uid);
      }

      toast({
        title: "Senha redefinida com sucesso!",
        description: "Faça login com a nova senha.",
      });
      await supabase.auth.signOut();
      navigate("/multi-licenca/login", { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-3">
          <img
            src={logoCentralGospel}
            alt="Editora Central Gospel"
            className="mx-auto h-auto w-20 object-contain"
          />
          <CardTitle className="text-2xl" style={{ color: BRAND_PRIMARY }}>
            Redefinir senha
          </CardTitle>
          <CardDescription>
            Crie uma nova senha para acessar o Portal Multi-Licença.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checkingSession ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !hasSession ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Link expirado ou inválido. Solicite um novo link.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/multi-licenca/login")}
                className="w-full"
              >
                Voltar ao login
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="novaSenha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Mínimo 8 caracteres"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar nova senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Repita a nova senha"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting}
                  style={{ backgroundColor: BRAND_PRIMARY, color: "white" }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Redefinir senha"
                  )}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
