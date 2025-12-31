import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cake, Gift, PartyPopper } from "lucide-react";
import { format, parseISO, getMonth, getDate } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Igreja {
  id: string;
  nome: string;
  data_aniversario_pastor: string | null;
  data_aniversario_superintendente: string | null;
  cupom_aniversario_usado: boolean | null;
  tipo_cliente: string | null;
  responsavel: string | null;
}

interface AniversariantesCardProps {
  igrejas: Igreja[];
}

export function AniversariantesCard({ igrejas }: AniversariantesCardProps) {
  const mesAtual = new Date().getMonth();
  const diaAtual = new Date().getDate();

  const aniversariantesMes = igrejas.filter((igreja) => {
    const dataPastor = igreja.data_aniversario_pastor;
    const dataSuperintendente = igreja.data_aniversario_superintendente;

    const isPastorNiver =
      dataPastor && getMonth(parseISO(dataPastor)) === mesAtual;
    const isSuperintNiver =
      dataSuperintendente &&
      getMonth(parseISO(dataSuperintendente)) === mesAtual;

    return isPastorNiver || isSuperintNiver;
  });

  const getAniversarioInfo = (igreja: Igreja) => {
    const infos: { tipo: string; data: string; isHoje: boolean }[] = [];

    if (igreja.data_aniversario_pastor) {
      const date = parseISO(igreja.data_aniversario_pastor);
      if (getMonth(date) === mesAtual) {
        infos.push({
          tipo: "Pastor",
          data: format(date, "dd 'de' MMMM", { locale: ptBR }),
          isHoje: getDate(date) === diaAtual && getMonth(date) === mesAtual,
        });
      }
    }

    if (igreja.data_aniversario_superintendente) {
      const date = parseISO(igreja.data_aniversario_superintendente);
      if (getMonth(date) === mesAtual) {
        infos.push({
          tipo: "Superintendente",
          data: format(date, "dd 'de' MMMM", { locale: ptBR }),
          isHoje: getDate(date) === diaAtual && getMonth(date) === mesAtual,
        });
      }
    }

    return infos;
  };

  if (aniversariantesMes.length === 0) {
    return null;
  }

  return (
    <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Cake className="h-5 w-5 text-pink-600" />
          Aniversariantes do Mês ({format(new Date(), "MMMM", { locale: ptBR })})
          <Badge variant="secondary" className="ml-auto">
            {aniversariantesMes.length} igreja(s)
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-80 overflow-y-auto">
        {aniversariantesMes.map((igreja) => {
          const aniversarios = getAniversarioInfo(igreja);
          return (
            <div
              key={igreja.id}
              className="flex items-start justify-between gap-3 p-3 rounded-lg bg-white border"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{igreja.nome}</p>
                {igreja.responsavel && (
                  <p className="text-xs text-muted-foreground truncate">
                    {igreja.responsavel}
                  </p>
                )}
                <div className="flex flex-wrap gap-1 mt-1">
                  {aniversarios.map((a, i) => (
                    <Badge
                      key={i}
                      variant={a.isHoje ? "default" : "outline"}
                      className={`text-xs ${
                        a.isHoje
                          ? "bg-pink-500 hover:bg-pink-600"
                          : "border-pink-200 text-pink-600"
                      }`}
                    >
                      {a.isHoje && <PartyPopper className="h-3 w-3 mr-1" />}
                      {a.tipo}: {a.data}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {igreja.cupom_aniversario_usado ? (
                  <Badge variant="secondary" className="text-xs">
                    <Gift className="h-3 w-3 mr-1" />
                    Cupom Resgatado
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-xs border-green-300 text-green-600"
                  >
                    Cupom Disponível
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
