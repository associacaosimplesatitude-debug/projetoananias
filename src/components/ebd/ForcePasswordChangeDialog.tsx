import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldAlert } from "lucide-react";

interface ForcePasswordChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ForcePasswordChangeDialog({ 
  open, 
  onOpenChange 
}: ForcePasswordChangeDialogProps) {
  const navigate = useNavigate();

  const handleAlterarAgora = () => {
    onOpenChange(false);
    navigate('/meu-perfil');
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/10 rounded-full">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle>Altere sua Senha</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base pt-2">
            Por segurança, altere sua senha padrão. Clique em 'Alterar Agora' para ir ao seu perfil.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleAlterarAgora}>
            Alterar Agora
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
