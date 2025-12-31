import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, Clock } from "lucide-react";

export type FormaEnvio = "entrega" | "retirada";

interface FormaEnvioSectionProps {
  value: FormaEnvio;
  onChange: (value: FormaEnvio) => void;
}

// Configuração da Matriz
const MATRIZ_CONFIG = {
  endereco: "Estrada do Guerenguê, 1851 - Taquara, Rio de Janeiro - RJ",
  cep: "22713-001",
  horario: "Segunda a Sexta: 9h às 18h"
};

export function FormaEnvioSection({ value, onChange }: FormaEnvioSectionProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium flex items-center gap-2">
        <Truck className="h-4 w-4" />
        Forma de Envio
      </Label>

      <RadioGroup value={value} onValueChange={(v) => onChange(v as FormaEnvio)}>
        {/* Entrega */}
        <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
          <RadioGroupItem value="entrega" id="envio-entrega" className="mt-1" />
          <label htmlFor="envio-entrega" className="flex-1 cursor-pointer">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Entrega no Endereço</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Receba no endereço selecionado acima
            </p>
          </label>
        </div>

        {/* Retirada na Matriz */}
        <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
          <RadioGroupItem value="retirada" id="envio-retirada" className="mt-1" />
          <label htmlFor="envio-retirada" className="flex-1 cursor-pointer">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-600" />
              <span className="font-medium text-sm">Retirada na Matriz</span>
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Frete Grátis
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {MATRIZ_CONFIG.endereco}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {MATRIZ_CONFIG.horario}
              </p>
            </div>
          </label>
        </div>
      </RadioGroup>
    </div>
  );
}

export { MATRIZ_CONFIG };
