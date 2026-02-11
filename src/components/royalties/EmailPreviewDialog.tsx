import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Template {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  assunto: string;
  corpo_html: string;
  variaveis: string[];
  is_active: boolean;
}

interface EmailPreviewDialogProps {
  template: Template | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Sample data for preview
const sampleData: Record<string, string> = {
  nome: "João da Silva",
  email: "joao@email.com",
  senha_temporaria: "abc123",
  link_login: "https://gestaoebd.com.br/login/autor",
  livro: "A Jornada da Fé",
  quantidade: "5",
  valor_venda: "R$ 150,00",
  valor_royalty: "R$ 15,00",
  data: "04/02/2026",
  valor: "R$ 450,00",
  comprovante_url: "https://example.com/comprovante.pdf",
  mes: "Janeiro/2026",
  total_vendas: "R$ 2.500,00",
  total_royalties: "R$ 250,00",
  resumo_livros: "<p><strong>A Jornada da Fé:</strong> 50 unidades - R$ 150,00</p><p><strong>Caminhos de Luz:</strong> 30 unidades - R$ 100,00</p>",
  comprador: "Maria Santos",
  valor_comissao: "R$ 7,50",
  link_afiliado: "https://gestaoebd.com.br/livro/a-jornada-da-fe?ref=joao123",
  codigo: "JOAO123",
};

export function EmailPreviewDialog({ template, open, onOpenChange }: EmailPreviewDialogProps) {
  if (!template) return null;

  // Replace variables with sample data
  let previewSubject = template.assunto;
  let previewBody = template.corpo_html;

  for (const [key, value] of Object.entries(sampleData)) {
    const regex = new RegExp(`\\{${key}\\}`, "g");
    previewSubject = previewSubject.replace(regex, value);
    previewBody = previewBody.replace(regex, value);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Preview: {template.nome}
            <Badge variant={template.is_active ? "default" : "secondary"}>
              {template.is_active ? "Ativo" : "Inativo"}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Visualização com dados de exemplo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-sm text-muted-foreground">Assunto:</p>
            <p className="font-medium">{previewSubject}</p>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-4 py-2 border-b">
              <p className="text-sm text-muted-foreground">Corpo do Email</p>
            </div>
            <div
              className="p-4 bg-white"
              dangerouslySetInnerHTML={{ __html: previewBody }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
