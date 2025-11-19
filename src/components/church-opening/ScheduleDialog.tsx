import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CalendarIcon, Clock } from 'lucide-react';

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  stageId: number;
  subTaskId: string;
  onSuccess: () => void;
}

const AVAILABLE_TIMES = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

export const ScheduleDialog = ({
  open,
  onOpenChange,
  churchId,
  stageId,
  subTaskId,
  onSuccess,
}: ScheduleDialogProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const isWeekday = (date: Date) => {
    const day = date.getDay();
    return day !== 0 && day !== 6; // 0 = Sunday, 6 = Saturday
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error('Selecione uma data e horário');
      return;
    }

    setSaving(true);
    try {
      const [hours, minutes] = selectedTime.split(':');
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const { error } = await supabase
        .from('church_stage_progress')
        .upsert({
          church_id: churchId,
          stage_id: stageId,
          sub_task_id: subTaskId,
          status: 'pending_approval',
          scheduled_datetime: scheduledDateTime.toISOString(),
        });

      if (error) throw error;

      toast.success('Agendamento confirmado! Aguardando aprovação.');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error('Erro ao confirmar agendamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Agendar Certificação</DialogTitle>
          <DialogDescription>
            Selecione uma data (segunda a sexta) e um horário disponível para sua certificação digital.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarIcon className="h-4 w-4" />
              <span>Selecione a Data</span>
            </div>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return date < today || !isWeekday(date);
                }}
                initialFocus
                className={cn('rounded-md border pointer-events-auto')}
                locale={ptBR}
              />
            </div>
          </div>

          {selectedDate && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" />
                <span>Selecione o Horário</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {AVAILABLE_TIMES.map((time) => (
                  <Button
                    key={time}
                    variant={selectedTime === time ? 'default' : 'outline'}
                    onClick={() => setSelectedTime(time)}
                    className="w-full"
                  >
                    {time}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {selectedDate && selectedTime && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-medium">Agendamento Selecionado:</p>
              <p className="text-lg font-semibold mt-1">
                {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })} às {selectedTime}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedDate || !selectedTime || saving}
          >
            {saving ? 'Confirmando...' : 'Confirmar Agendamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
