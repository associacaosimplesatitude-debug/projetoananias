import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  vendedorId: string | null;
  nomeCliente: string;
}

export function RegistrarContatoModal({ open, onOpenChange, clienteId, vendedorId, nomeCliente }: Props) {
  const [tipoContato, setTipoContato] = useState("");
  const [resultado, setResultado] = useState("");
  const [motivoPerda, setMotivoPerda] = useState("");
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!tipoContato || !resultado) {
      toast.error("Preencha tipo de contato e resultado");
      return;
    }
    if (resultado === "nao_quer_mais" && !motivoPerda.trim()) {
      toast.error("Informe o motivo da perda");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("ebd_retencao_contatos").insert({
      cliente_id: clienteId,
      vendedor_id: vendedorId,
      tipo_contato: tipoContato,
      resultado,
      motivo_perda: resultado === "nao_quer_mais" ? motivoPerda : null,
      observacao: observacao || null,
    });

    setLoading(false);
    if (error) {
      toast.error("Erro ao registrar contato: " + error.message);
    } else {
      toast.success("Contato registrado!");
      queryClient.invalidateQueries({ queryKey: ["retencao-dashboard"] });
      onOpenChange(false);
      setTipoContato("");
      setResultado("");
      setMotivoPerda("");
      setObservacao("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Contato — {nomeCliente}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Contato</Label>
            <Select value={tipoContato} onValueChange={setTipoContato}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="ligacao">Ligação</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="visita">Visita</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Resultado</Label>
            <Select value={resultado} onValueChange={setResultado}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sem_resposta">Sem resposta</SelectItem>
                <SelectItem value="retorno_agendado">Retorno agendado</SelectItem>
                <SelectItem value="comprou">Comprou</SelectItem>
                <SelectItem value="nao_quer_mais">Não quer mais</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {resultado === "nao_quer_mais" && (
            <div className="space-y-2">
              <Label>Motivo da Perda</Label>
              <Textarea
                value={motivoPerda}
                onChange={e => setMotivoPerda(e.target.value)}
                placeholder="Por que o cliente não quer mais?"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder="Anotações sobre o contato..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
