import { BookOpen } from "lucide-react";

interface AboutBookSectionProps {
  descricao: string | null;
}

export function AboutBookSection({ descricao }: AboutBookSectionProps) {
  if (!descricao) return null;

  // Split description into paragraphs for better formatting
  const paragraphs = descricao.split("\n\n").filter(Boolean);

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-amber-700" />
            </div>
            <h2 className="text-3xl font-bold text-amber-950">Sobre o Livro</h2>
          </div>

          <div className="prose prose-lg max-w-none">
            {paragraphs.map((paragraph, index) => (
              <p
                key={index}
                className="text-muted-foreground leading-relaxed mb-6 text-lg"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
