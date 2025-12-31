import { useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Truck, MapPin, Clock, ChevronDown, ChevronUp, Check } from "lucide-react";

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
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (newValue: FormaEnvio) => {
    onChange(newValue);
    setIsOpen(false);
  };

  const getSelectedDisplay = () => {
    if (value === "retirada") {
      return { label: "Retirada na Matriz", badge: "Frete Grátis" };
    }
    return { label: "Entrega no Endereço", badge: null };
  };

  const selectedDisplay = getSelectedDisplay();

  return (
    <div className="space-y-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors w-full text-left py-1">
            <Truck className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">Forma de Envio</span>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </CollapsibleTrigger>

        {/* Compact selected preview (shown when collapsed) */}
        {!isOpen && (
          <div className="flex items-center gap-2 py-2 px-2 bg-muted/50 rounded-md text-xs">
            <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
            <span className="font-medium">{selectedDisplay.label}</span>
            {selectedDisplay.badge && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                {selectedDisplay.badge}
              </Badge>
            )}
          </div>
        )}

        <CollapsibleContent className="space-y-2 pt-2">
          <RadioGroup value={value} onValueChange={(v) => handleChange(v as FormaEnvio)}>
            {/* Entrega */}
            <div className={`flex items-start space-x-2 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
              value === "entrega" ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
            }`}>
              <RadioGroupItem value="entrega" id="envio-entrega" className="mt-0.5 h-3.5 w-3.5" />
              <label htmlFor="envio-entrega" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-1.5">
                  <Truck className="h-3 w-3 text-primary" />
                  <span className="font-medium">Entrega no Endereço</span>
                </div>
                <p className="text-muted-foreground mt-0.5">
                  Receba no endereço selecionado acima
                </p>
              </label>
            </div>

            {/* Retirada na Matriz */}
            <div className={`flex items-start space-x-2 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
              value === "retirada" ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
            }`}>
              <RadioGroupItem value="retirada" id="envio-retirada" className="mt-0.5 h-3.5 w-3.5" />
              <label htmlFor="envio-retirada" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-green-600" />
                  <span className="font-medium">Retirada na Matriz</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Frete Grátis
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-0.5 leading-tight">
                  {MATRIZ_CONFIG.endereco}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {MATRIZ_CONFIG.horario}
                  </span>
                </div>
              </label>
            </div>
          </RadioGroup>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export { MATRIZ_CONFIG };
