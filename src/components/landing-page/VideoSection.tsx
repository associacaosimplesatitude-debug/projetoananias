import { PlayCircle } from "lucide-react";

interface VideoSectionProps {
  videoUrl: string | null;
}

export function VideoSection({ videoUrl }: VideoSectionProps) {
  if (!videoUrl) return null;

  // Extract YouTube video ID
  const extractYouTubeId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : null;
  };

  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) return null;

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
            <PlayCircle className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-3xl font-bold text-amber-950">Conheça o Livro</h2>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl border border-amber-100">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title="Vídeo do Livro"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
