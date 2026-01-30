import { CheckCircle, BookOpen, Users, Lightbulb, GraduationCap, Church } from "lucide-react";

interface DiferenciaisSectionProps {
  diferenciais: string[] | null;
}

const icons = [BookOpen, Users, Lightbulb, GraduationCap, Church];

export function DiferenciaisSection({ diferenciais }: DiferenciaisSectionProps) {
  if (!diferenciais || diferenciais.length === 0) return null;

  return (
    <section className="py-16 bg-gradient-to-b from-amber-50 to-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-amber-950 mb-4">
            Por que escolher este livro?
          </h2>
          <p className="text-amber-700 text-lg max-w-2xl mx-auto">
            Um material completo para enriquecer seus estudos bíblicos
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {diferenciais.map((diferencial, index) => {
            const Icon = icons[index % icons.length];
            return (
              <div
                key={index}
                className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow duration-300 border border-amber-100"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-foreground font-medium leading-relaxed">
                    {diferencial}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
