import { User } from "lucide-react";

interface AboutAuthorSectionProps {
  nomeCompleto: string;
  bio?: string | null;
  fotoUrl?: string | null;
  fotoLocalUrl?: string;
}

export function AboutAuthorSection({
  nomeCompleto,
  bio,
  fotoUrl,
  fotoLocalUrl,
}: AboutAuthorSectionProps) {
  const imageSrc = fotoLocalUrl || fotoUrl;

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-amber-950 text-center mb-12">
          Sobre o Autor
        </h2>

        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
            {/* Author Photo */}
            <div className="flex-shrink-0">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={nomeCompleto}
                  className="h-48 w-48 rounded-full object-cover shadow-xl border-4 border-amber-100"
                />
              ) : (
                <div className="h-48 w-48 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center shadow-xl">
                  <User className="h-24 w-24 text-amber-500" />
                </div>
              )}
            </div>

            {/* Author Info */}
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold text-amber-950 mb-4">
                {nomeCompleto}
              </h3>

              {bio ? (
                <p className="text-muted-foreground text-lg leading-relaxed">
                  {bio}
                </p>
              ) : (
                <p className="text-muted-foreground text-lg italic">
                  Autor publicado pela Central Gospel.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
