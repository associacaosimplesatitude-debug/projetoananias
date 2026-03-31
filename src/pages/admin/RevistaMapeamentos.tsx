import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Link2 } from "lucide-react";
import { format } from "date-fns";

function callAdmin(action: string, params: Record<string, unknown> = {}) {
  return supabase.functions.invoke("revista-licencas-shopify-admin", {
    body: { action, ...params },
  });
}

export default function RevistaMapeamentos() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState("");
  const [revistaDigitalId, setRevistaDigitalId] = useState("");
  const [revistaEbdId, setRevistaEbdId] = useState("");
  const [blingProdutoId, setBlingProdutoId] = useState("");

  const { data: mappings, isLoading } = useQuery({
    queryKey: ["revista-mappings"],
    queryFn: async () => {
      const { data, error } = await callAdmin("list_mappings");
      if (error) throw error;
      return (data as any)?.data ?? [];
    },
  });

  const { data: revistasDigitais } = useQuery({
    queryKey: ["revistas-digitais-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revistas_digitais")
        .select("id, titulo")
        .eq("ativo", true)
        .order("titulo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: revistasEbd } = useQuery({
    queryKey: ["ebd-revistas-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_revistas")
        .select("id, titulo")
        .order("titulo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const insertMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await callAdmin("insert_mapping", {
        sku,
        revista_digital_id: revistaDigitalId,
        revista_id: revistaEbdId || null,
        bling_produto_id: blingProdutoId || null,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast.success("Mapeamento criado!");
      qc.invalidateQueries({ queryKey: ["revista-mappings"] });
      setOpen(false);
      setSku("");
      setRevistaDigitalId("");
      setRevistaEbdId("");
      setBlingProdutoId("");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await callAdmin("delete_mapping", { id });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast.success("Mapeamento removido!");
      qc.invalidateQueries({ queryKey: ["revista-mappings"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6" /> Mapeamento SKU → Revista
          </h1>
          <p className="text-sm text-muted-foreground">
            Vincule SKUs do Shopify às revistas digitais para geração automática de licenças.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Adicionar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Mapeamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>SKU (Shopify) *</Label>
                <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Ex: REV-ADULTO-3T-2026" />
              </div>
              <div className="space-y-2">
                <Label>Revista Digital (revistas_digitais) *</Label>
                <Select value={revistaDigitalId} onValueChange={setRevistaDigitalId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a revista digital..." /></SelectTrigger>
                  <SelectContent>
                    {(revistasDigitais ?? []).map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.titulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Revista EBD / Bling (opcional)</Label>
                <Select value={revistaEbdId} onValueChange={setRevistaEbdId}>
                  <SelectTrigger><SelectValue placeholder="Selecione (opcional)..." /></SelectTrigger>
                  <SelectContent>
                    {(revistasEbd ?? []).map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.titulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bling Produto ID (opcional)</Label>
                <Input value={blingProdutoId} onChange={(e) => setBlingProdutoId(e.target.value)} placeholder="ID numérico do Bling" />
              </div>
              <Button
                className="w-full"
                disabled={!sku || !revistaDigitalId || insertMutation.isPending}
                onClick={() => insertMutation.mutate()}
              >
                {insertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Revista Digital</TableHead>
              <TableHead>Revista EBD</TableHead>
              <TableHead>Bling Produto ID</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(mappings ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum mapeamento cadastrado. Clique em "Adicionar" para vincular um SKU a uma revista.
                </TableCell>
              </TableRow>
            ) : (
              (mappings ?? []).map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-sm">{m.sku}</TableCell>
                  <TableCell>{m.ebd_revistas?.titulo ?? "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{m.bling_produto_id || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.created_at ? format(new Date(m.created_at), "dd/MM/yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Excluir este mapeamento?")) deleteMutation.mutate(m.id);
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
