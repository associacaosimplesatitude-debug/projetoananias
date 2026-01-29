import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, BarChart3, TrendingUp } from "lucide-react";

export default function RoyaltiesRelatorios() {
  const relatorios = [
    {
      title: "Relatório de Vendas",
      description: "Vendas por período, livro e autor",
      icon: BarChart3,
    },
    {
      title: "Relatório de Comissões",
      description: "Comissões calculadas por período",
      icon: TrendingUp,
    },
    {
      title: "Projeção de Pagamentos",
      description: "Pagamentos futuros previstos",
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">
          Gere relatórios detalhados do sistema de royalties
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {relatorios.map((relatorio) => (
          <Card key={relatorio.title}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <relatorio.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{relatorio.title}</CardTitle>
              </div>
              <CardDescription>{relatorio.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Gerar Relatório
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Relatórios Personalizados</CardTitle>
          <CardDescription>
            Em breve você poderá criar relatórios personalizados com filtros avançados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Funcionalidade em desenvolvimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
