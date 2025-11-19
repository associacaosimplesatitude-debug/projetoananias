import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface InfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  content: string;
  videoUrl?: string;
}

export const InfoModal = ({ open, onOpenChange, title, content, videoUrl }: InfoModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>Informações sobre esta etapa</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          {videoUrl && (
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
              <iframe
                src={videoUrl}
                title={`Vídeo explicativo: ${title}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          
          <p className="text-sm text-muted-foreground leading-relaxed">
            {content}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
