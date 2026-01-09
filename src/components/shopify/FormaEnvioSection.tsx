import { useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Truck, MapPin, Clock, ChevronDown, ChevronUp, Check } from "lucide-react";

export type FormaEnvio = "entrega" | "retirada" | "retirada_pe" | "retirada_penha";

interface FormaEnvioSectionProps {
  value: FormaEnvio;
  onChange: (value: FormaEnvio) => void;
}

// Configuração da Matriz - Rio de Janeiro
const MATRIZ_CONFIG = {
  endereco: "Estrada do Guerenguê, 1851 - Taquara, Rio de Janeiro - RJ",
  cep: "22713-001",
  horario: "Segunda a Sexta: 9h às 18h"
};

// Configuração do Polo Pernambuco
const PERNAMBUCO_CONFIG = {
  endereco: "Rua Adalberto Coimbra, 211, Galpão B - Jardim Jordão, Jaboatão dos Guararapes - PE",
  cep: "54315-110",
  horario: "Segunda a Sexta: 9h às 18h"
};

// Configuração do Polo Penha - Rio de Janeiro
const PENHA_CONFIG = {
  endereco: "R. Honório Bicalho, 102 - Penha, Rio de Janeiro - RJ",
  cep: "21020-002",
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
      return { label: "Retirada na Matriz - Rio de Janeiro", badge: "Frete Grátis" };
    }
    if (value === "retirada_pe") {
      return { label: "Retirada no Polo - Pernambuco", badge: "Frete Grátis" };
    }
    if (value === "retirada_penha") {
      return { label: "Retirada no Polo - Penha / RJ", badge: "Frete Grátis" };
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

            {/* Retirada na Matriz - Rio de Janeiro */}
            <div className={`flex items-start space-x-2 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
              value === "retirada" ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
            }`}>
              <RadioGroupItem value="retirada" id="envio-retirada" className="mt-0.5 h-3.5 w-3.5" />
              <label htmlFor="envio-retirada" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-green-600" />
                  <span className="font-medium">Retirada na Matriz - Rio de Janeiro</span>
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

            {/* Retirada no Polo - Pernambuco */}
            <div className={`flex items-start space-x-2 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
              value === "retirada_pe" ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
            }`}>
              <RadioGroupItem value="retirada_pe" id="envio-retirada-pe" className="mt-0.5 h-3.5 w-3.5" />
              <label htmlFor="envio-retirada-pe" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-green-600" />
                  <span className="font-medium">Retirada no Polo - Pernambuco</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Frete Grátis
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-0.5 leading-tight">
                  {PERNAMBUCO_CONFIG.endereco}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {PERNAMBUCO_CONFIG.horario}
                  </span>
                </div>
              </label>
            </div>

            {/* Retirada no Polo - Penha / RJ */}
            <div className={`flex items-start space-x-2 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
              value === "retirada_penha" ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
            }`}>
              <RadioGroupItem value="retirada_penha" id="envio-retirada-penha" className="mt-0.5 h-3.5 w-3.5" />
              <label htmlFor="envio-retirada-penha" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-green-600" />
                  <span className="font-medium">Retirada no Polo - Penha / RJ</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Frete Grátis
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-0.5 leading-tight">
                  {PENHA_CONFIG.endereco}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {PENHA_CONFIG.horario}
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

export { MATRIZ_CONFIG, PERNAMBUCO_CONFIG, PENHA_CONFIG };
