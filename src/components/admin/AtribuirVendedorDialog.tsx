import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UserCheck } from "lucide-react";

interface Lead {
  id: string;
  nome_igreja: string;
}

interface Vendedor {
  id: string;
  nome: string;
  email: string;
  status: string;
}

interface AtribuirVendedorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onConfirm: (leadId: string, vendedorId: string) => void;
  isLoading?: boolean;
}

export function AtribuirVendedorDialog({
  open,
  onOpenChange,
  lead,
  onConfirm,
  isLoading = false,
}: AtribuirVendedorDialogProps) {
  const [selectedVendedor, setSelectedVendedor] = useState<string>("");

  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedores")
        .select("id, nome, email, status")
        .eq("status", "Ativo")
        .order("nome");

      if (error) throw error;
      return data as Vendedor[];
    },
    enabled: open,
  });

  const handleConfirm = () => {
    if (lead && selectedVendedor) {
      onConfirm(lead.id, selectedVendedor);
      setSelectedVendedor("");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedVendedor("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Atribuir Vendedor
          </DialogTitle>
          <DialogDescription>
            Atribua um vendedor para o lead "{lead?.nome_igreja}".
            Após a atribuição, o lead será movido para "Contato" e entrará na carteira do vendedor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="vendedor">Vendedor</Label>
            <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
              <SelectTrigger id="vendedor">
                <SelectValue placeholder="Selecione um vendedor" />
              </SelectTrigger>
              <SelectContent>
                {vendedores.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedVendedor || isLoading}
          >
            {isLoading ? "Atribuindo..." : "Confirmar Atribuição"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
