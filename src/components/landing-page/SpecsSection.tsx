import { FileText, Ruler, Package, Tag, Hash, BookMarked } from "lucide-react";

interface Especificacoes {
  paginas?: number;
  formato?: string;
  acabamento?: string;
  categoria?: string;
  isbn?: string;
  sku?: string;
}

interface SpecsSectionProps {
  especificacoes: Especificacoes | null;
  preco: number;
}

export function SpecsSection({ especificacoes, preco }: SpecsSectionProps) {
  if (!especificacoes) return null;

  const specs = [
    { icon: FileText, label: "Páginas", value: especificacoes.paginas?.toString() },
    { icon: Ruler, label: "Formato", value: especificacoes.formato },
    { icon: Package, label: "Acabamento", value: especificacoes.acabamento },
    { icon: BookMarked, label: "Categoria", value: especificacoes.categoria },
    { icon: Hash, label: "ISBN", value: especificacoes.isbn },
    { icon: Tag, label: "SKU", value: especificacoes.sku },
  ].filter((spec) => spec.value);

  return (
    <section className="py-16 bg-gradient-to-b from-amber-50 to-white">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-amber-950 text-center mb-12">
          Especificações Técnicas
        </h2>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-amber-100 overflow-hidden">
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-amber-100">
              {specs.map((spec, index) => {
                const Icon = spec.icon;
                return (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-6 hover:bg-amber-50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-amber-700" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{spec.label}</p>
                      <p className="font-semibold text-foreground">{spec.value}</p>
                    </div>
                  </div>
                );
              })}

              {/* Price */}
              <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-green-50 to-green-100 md:col-span-2">
                <div className="h-10 w-10 rounded-lg bg-green-600 flex items-center justify-center flex-shrink-0">
                  <Tag className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-green-700">Preço</p>
                  <p className="font-bold text-2xl text-green-700">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(preco)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
