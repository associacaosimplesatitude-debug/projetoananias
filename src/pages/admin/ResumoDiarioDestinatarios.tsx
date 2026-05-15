import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Inbox,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface Destinatario {
  id: string;
  nome: string;
  telefone: string;
  cargo: string | null;
  ativo: boolean;
}

const schema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(100),
  telefone: z
    .string()
    .regex(/^\+\d{11,15}$/, "Use formato internacional, ex: +5511999999999"),
  cargo: z.string().trim().max(100).optional().or(z.literal("")),
  ativo: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function formatTelefoneDisplay(e164: string): string {
  // +55 (11) 99999-9999 — assumindo BR (12-13 dígitos com DDI)
  const digits = e164.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const dd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) return `+55 (${dd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    return `+55 (${dd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return e164;
}

function maskPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 15);
  if (!digits) return "";
  // BR mask
  if (digits.startsWith("55") && digits.length > 2) {
    const dd = digits.slice(2, 4);
    const rest = digits.slice(4);
    let out = `+55`;
    if (dd) out += ` (${dd}`;
    if (dd.length === 2) out += `)`;
    if (rest) {
      if (rest.length <= 4) out += ` ${rest}`;
      else if (rest.length <= 8) out += ` ${rest.slice(0, 4)}-${rest.slice(4)}`;
      else out += ` ${rest.slice(0, 5)}-${rest.slice(5, 9)}`;
    }
    return out;
  }
  return `+${digits}`;
}

function inputToE164(masked: string): string {
  const digits = masked.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

export default function ResumoDiarioDestinatarios() {
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Destinatario | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Destinatario | null>(null);

  const { data: lista, isLoading } = useQuery({
    queryKey: ["resumo-diario-destinatarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resumo_diario_destinatarios")
        .select("id, nome, telefone, cargo, ativo")
        .order("nome");
      if (error) throw error;
      return data as Destinatario[];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", telefone: "", cargo: "", ativo: true },
  });

  function openNew() {
    setEditing(null);
    form.reset({ nome: "", telefone: "", cargo: "", ativo: true });
    setSheetOpen(true);
  }

  function openEdit(d: Destinatario) {
    setEditing(d);
    form.reset({
      nome: d.nome,
      telefone: d.telefone,
      cargo: d.cargo ?? "",
      ativo: d.ativo,
    });
    setSheetOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        nome: values.nome.trim(),
        telefone: values.telefone,
        cargo: values.cargo?.trim() || null,
        ativo: values.ativo,
      };
      if (editing) {
        const { error } = await supabase
          .from("resumo_diario_destinatarios")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("resumo_diario_destinatarios")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Destinatário atualizado" : "Destinatário adicionado");
      qc.invalidateQueries({ queryKey: ["resumo-diario-destinatarios"] });
      setSheetOpen(false);
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("resumo_diario_destinatarios")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resumo-diario-destinatarios"] }),
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("resumo_diario_destinatarios")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Destinatário removido");
      qc.invalidateQueries({ queryKey: ["resumo-diario-destinatarios"] });
      setConfirmDelete(null);
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/resumo-diario">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Destinatários do resumo diário
          </h1>
          <p className="text-sm text-muted-foreground">
            Quem recebe o WhatsApp com o resumo do dia
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar destinatário
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : !lista || lista.length === 0 ? (
        <div className="border rounded-lg py-16 flex flex-col items-center text-center gap-4">
          <MessageCircle className="h-12 w-12 text-muted-foreground/50" />
          <div>
            <p className="text-base font-medium">Nenhum destinatário cadastrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Adicione contatos para receber o resumo diário no WhatsApp
            </p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar primeiro destinatário
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.nome}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatTelefoneDisplay(d.telefone)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.cargo || "—"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={d.ativo}
                      onCheckedChange={(v) => toggleAtivo.mutate({ id: d.id, ativo: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(d)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setConfirmDelete(d)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editing ? "Editar destinatário" : "Adicionar destinatário"}
            </SheetTitle>
            <SheetDescription>
              Cadastre quem deve receber o resumo diário via WhatsApp.
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
              className="space-y-4 mt-6"
            >
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: João Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+55 (11) 99999-9999"
                        value={maskPhoneInput(field.value || "")}
                        onChange={(e) => field.onChange(inputToE164(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cargo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Diretor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ativo"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Label className="text-sm">Ativo</Label>
                      <p className="text-xs text-muted-foreground">
                        Receberá o resumo diário enquanto estiver ativo
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <SheetFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSheetOpen(false)}
                  disabled={saveMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir destinatário?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.nome} não receberá mais o resumo diário. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
