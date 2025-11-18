import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

const PaymentBlocked = () => {
  const { signOut } = useAuth();

  useEffect(() => {
    document.title = 'Acesso Bloqueado - Regularize seus Débitos';
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-destructive">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Acesso Bloqueado</CardTitle>
          <CardDescription className="text-base">
            Seu acesso foi temporariamente suspenso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Identificamos débitos pendentes há mais de 5 dias.
            </p>
            <p className="font-medium text-foreground">
              Para regularizar sua situação e recuperar o acesso, entre em contato com nossa equipe.
            </p>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold text-sm">Informações de Contato:</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>📧 Email: suporte@contabilidade.com</li>
              <li>📱 WhatsApp: (85) 99999-9999</li>
              <li>⏰ Horário: Seg-Sex, 8h às 18h</li>
            </ul>
          </div>

          <Button 
            variant="outline" 
            className="w-full"
            onClick={signOut}
          >
            Fazer Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentBlocked;
