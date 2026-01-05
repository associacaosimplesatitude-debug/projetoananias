import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Pencil,
  Trash2,
  BookOpen,
  Gift,
  CheckCircle,
  XCircle,
  Building2,
  User,
  Calendar,
  CreditCard,
  Wallet,
  UserCog,
  ShoppingCart,
  Percent,
  Play,
  FileText,
} from "lucide-react";

interface Cliente {
  id: string;
  nome_igreja: string;
  nome_responsavel: string | null;
  nome_superintendente: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  cnpj: string | null;
  cpf: string | null;
  status_ativacao_ebd: boolean;
  tipo_cliente: string | null;
  data_aniversario_pastor: string | null;
  data_aniversario_superintendente: string | null;
  cupom_aniversario_usado: boolean | null;
  cupom_aniversario_ano: number | null;
  onboarding_concluido: boolean | null;
  vendedor_nome?: string;
  desconto_faturamento?: number | null;
  pode_faturar?: boolean;
}

interface Creditos {
  disponiveis: number;
  usados: number;
}

interface ClienteCardProps {
  cliente: Cliente;
  creditos?: Creditos;
  onEdit?: () => void;
  onDelete?: () => void;
  onLancamentoManual?: () => void;
  onPedido?: () => void;
  onDesconto?: () => void;
  onAtivar?: () => void;
  showDesconto?: boolean;
  showAtivar?: boolean;
  isAdmin?: boolean;
  isRepresentante?: boolean;
}

export function ClienteCard({
  cliente,
  creditos = { disponiveis: 0, usados: 0 },
  onEdit,
  onDelete,
  onLancamentoManual,
  onPedido,
  onDesconto,
  onAtivar,
  showDesconto = false,
  showAtivar = false,
  isAdmin = false,
  isRepresentante = false,
}: ClienteCardProps) {
  const formatDocumento = (cnpj: string | null, cpf: string | null) => {
    const doc = cnpj || cpf || "";
    if (doc.length === 14) {
      return doc.replace(
        /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
        "$1.$2.$3/$4-$5"
      );
    } else if (doc.length === 11) {
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return doc || "-";
  };

  const formatAniversario = (data: string | null) => {
    if (!data) return "-";
    const clean = data.includes("T") ? data.split("T")[0] : data;
    const parts = clean.split("-");
    if (parts.length < 3) return data;
    const [, month, day] = parts;
    return `${day}/${month}`;
  };

  const currentYear = new Date().getFullYear();

  // Regras:
  // - Setup pendente: onboarding_concluido !== true
  // - Setup concluído mas sem data: "Aniversário não informado"
  // - Com data + não resgatou no ano: "Cupom R$50 Disponível"
  // - Com data + resgatou no ano: "Cupom {ano} Resgatado"
  const setupPendente = cliente.onboarding_concluido !== true;
  const aniversarioInformado = !!cliente.data_aniversario_superintendente;

  const cupomResgatado =
    !setupPendente &&
    aniversarioInformado &&
    cliente.cupom_aniversario_usado === true &&
    cliente.cupom_aniversario_ano === currentYear;

  const cupomDisponivel = !setupPendente && aniversarioInformado && !cupomResgatado;
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header - Nome e Status */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate">
                {cliente.nome_igreja}
              </h3>
              {(cliente.nome_responsavel || cliente.nome_superintendente) && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <User className="h-3 w-3" />
                  <span className="truncate">
                    {cliente.nome_responsavel || cliente.nome_superintendente}
                  </span>
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {cliente.status_ativacao_ebd ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Ativo
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="mr-1 h-3 w-3" />
                  Pendente
                </Badge>
              )}
              {cliente.desconto_faturamento && cliente.desconto_faturamento > 0 && (
                <Badge className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs">
                  <Percent className="mr-1 h-3 w-3" />
                  {cliente.desconto_faturamento}% vendedor
                </Badge>
              )}
              {cliente.pode_faturar && (
                <Badge className="bg-primary text-primary-foreground text-xs">
                  <FileText className="mr-1 h-3 w-3" />
                  Faturamento
                </Badge>
              )}
              {cliente.tipo_cliente && (
                <Badge variant="outline" className="text-xs">
                  {cliente.tipo_cliente}
                </Badge>
              )}
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {/* Localização */}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">
                {cliente.endereco_cidade && cliente.endereco_estado
                  ? `${cliente.endereco_cidade}/${cliente.endereco_estado}`
                  : "-"}
              </span>
            </div>

            {/* CPF/CNPJ */}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate font-mono text-xs">
                {formatDocumento(cliente.cnpj, cliente.cpf)}
              </span>
            </div>

            {/* Aniversários - oculto para representante */}
            {!isRepresentante && (
              <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">
                  Pastor: {formatAniversario(cliente.data_aniversario_pastor)} | Superint: {formatAniversario(cliente.data_aniversario_superintendente)}
                </span>
              </div>
            )}

            {/* Créditos - oculto para representante */}
            {!isRepresentante && (
              <>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                  <span>
                    Créditos:{" "}
                    <span className="font-semibold text-green-600">
                      R$ {creditos.disponiveis.toFixed(2)}
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    Usados: R$ {creditos.usados.toFixed(2)}
                  </span>
                </div>
              </>
            )}

            {/* Cupom Aniversário - oculto para representante */}
            {!isRepresentante && (
              <div className="flex items-center gap-1.5 col-span-2">
                <Gift
                  className={`h-3.5 w-3.5 flex-shrink-0 ${
                    cupomDisponivel
                      ? "text-green-600"
                      : setupPendente || !aniversarioInformado
                        ? "text-orange-500"
                        : "text-muted-foreground"
                  }`}
                />
                {setupPendente ? (
                  <Badge
                    variant="outline"
                    className="text-xs border-orange-300 text-orange-600"
                  >
                    Setup Pendente
                  </Badge>
                ) : !aniversarioInformado ? (
                  <Badge
                    variant="outline"
                    className="text-xs border-orange-300 text-orange-600"
                  >
                    Aniversário não informado
                  </Badge>
                ) : cupomDisponivel ? (
                  <Badge
                    variant="outline"
                    className="text-xs border-green-300 text-green-600"
                  >
                    Cupom R$50 Disponível
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    Cupom {currentYear} Resgatado
                  </Badge>
                )}
              </div>
            )}
            {/* Vendedor (apenas para admin) */}
            {isAdmin && cliente.vendedor_nome && (
              <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                <UserCog className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Vendedor: {cliente.vendedor_nome}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t flex-wrap">
            {showDesconto && onDesconto && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDesconto}
                title="Configurar desconto do vendedor"
                className="h-8 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50"
              >
                <Percent className="h-4 w-4 mr-1" />
                Desconto
              </Button>
            )}
            {onPedido && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPedido}
                className="h-8"
              >
                <ShoppingCart className="h-4 w-4 mr-1" />
                Pedido
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="h-8"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
            )}
            {/* Botão Revistas - oculto para representante */}
            {!isRepresentante && onLancamentoManual && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLancamentoManual}
                className="h-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              >
                <BookOpen className="h-4 w-4 mr-1" />
                Revistas
              </Button>
            )}
            {showAtivar && onAtivar && (
              <Button
                size="sm"
                onClick={onAtivar}
                className="h-8"
              >
                <Play className="h-4 w-4 mr-1" />
                Ativar
              </Button>
            )}
            {isAdmin && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
