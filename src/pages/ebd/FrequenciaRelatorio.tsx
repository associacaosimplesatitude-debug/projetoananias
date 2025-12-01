import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function EBDFrequenciaRelatorio() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Relatórios de Frequência</h1>
          <p className="text-muted-foreground">Visualize e analise a frequência dos alunos</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Relatórios Disponíveis
            </CardTitle>
            <CardDescription>Análise detalhada de presença e ausências</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Em desenvolvimento</p>
              <p className="text-sm">Relatórios de frequência em breve</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
