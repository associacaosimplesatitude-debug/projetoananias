import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Send, Mail, User } from "lucide-react";

interface Template {
  id: string;
  codigo: string;
  nome: string;
  variaveis: string[];
  is_active: boolean;
}

interface Autor {
  id: string;
  nome_completo: string;
  email: string;
}

export function SendEmailTab() {
  const [selectedAutorId, setSelectedAutorId] = useState("");
  const [selectedTemplateCode, setSelectedTemplateCode] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  const { data: autores } = useQuery({
    queryKey: ["royalties-autores-email"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalties_autores")
        .select("id, nome_completo, email")
        .eq("is_active", true)
        .order("nome_completo");

      if (error) throw error;
      return data as Autor[];
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["royalties-email-templates-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalties_email_templates")
        .select("id, codigo, nome, variaveis, is_active")
        .eq("is_active", true)
        .order("nome");

      if (error) throw error;
      return data as Template[];
    },
  });

  const selectedTemplate = templates?.find((t) => t.codigo === selectedTemplateCode);
  const selectedAutor = autores?.find((a) => a.id === selectedAutorId);

  // Get variables that need to be filled (exclude nome and email which come from autor)
  const requiredVariables = (selectedTemplate?.variaveis as string[])?.filter(
    (v) => !["nome", "email"].includes(v)
  ) || [];

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAutorId || !selectedTemplateCode) {
        throw new Error("Selecione um autor e um template");
      }

      const { data, error } = await supabase.functions.invoke("send-royalties-email", {
        body: {
          autorId: selectedAutorId,
          templateCode: selectedTemplateCode,
          dados: variableValues,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      toast({ title: "Email enviado com sucesso!" });
      setSelectedAutorId("");
      setSelectedTemplateCode("");
      setVariableValues({});
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Enviar Email Manual
        </CardTitle>
        <CardDescription>
          Selecione um autor e um template para enviar um email
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Selecionar Autor</Label>
            <Select value={selectedAutorId} onValueChange={setSelectedAutorId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um autor..." />
              </SelectTrigger>
              <SelectContent>
                {autores?.map((autor) => (
                  <SelectItem key={autor.id} value={autor.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {autor.nome_completo}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAutor && (
              <p className="text-sm text-muted-foreground">
                Email: {selectedAutor.email}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Selecionar Template</Label>
            <Select value={selectedTemplateCode} onValueChange={(code) => {
              setSelectedTemplateCode(code);
              setVariableValues({});
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um template..." />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((template) => (
                  <SelectItem key={template.id} value={template.codigo}>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {template.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedTemplate && requiredVariables.length > 0 && (
          <div className="space-y-4">
            <div>
              <Label className="text-base">Preencher Variáveis</Label>
              <p className="text-sm text-muted-foreground">
                Preencha os valores para personalizar o email
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requiredVariables.map((variable) => (
                <div key={variable} className="space-y-2">
                  <Label htmlFor={variable} className="flex items-center gap-2">
                    <Badge variant="outline">{`{${variable}}`}</Badge>
                  </Label>
                  <Input
                    id={variable}
                    value={variableValues[variable] || ""}
                    onChange={(e) =>
                      setVariableValues((prev) => ({
                        ...prev,
                        [variable]: e.target.value,
                      }))
                    }
                    placeholder={`Valor para ${variable}...`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={() => sendEmailMutation.mutate()}
            disabled={!selectedAutorId || !selectedTemplateCode || sendEmailMutation.isPending}
            size="lg"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendEmailMutation.isPending ? "Enviando..." : "Enviar Email"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
