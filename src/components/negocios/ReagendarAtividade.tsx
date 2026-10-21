import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useUpdateActivity } from "@/hooks/queries/useActivities";
import { useToast } from "@/hooks/use-toast";
import { mensagemErro } from "@/lib/erro-supabase";
import type { AtividadeDoNegocio } from "@/lib/api/deals";
import { ATIVIDADE_ROTULO } from "@/lib/atividade-tipos";

/** `Date` → valor de `<input type="datetime-local">`, no fuso de quem usa. */
function paraCampo(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Novo prazo para uma atividade vencida.
 *
 * Só troca `due_date` pela mutação que a tela de Atividades já usa
 * (`useUpdateActivity`), que invalida atividades E negócios -- então o card do
 * quadro sai do vermelho sem recarregar. A atividade continua pendente:
 * reagendar não é concluir.
 *
 * Sugere amanhã no MESMO horário: quem marcou às 15h costuma remarcar às 15h.
 */
export function ReagendarAtividade({ atividade, onFechar }: {
  atividade: AtividadeDoNegocio | null;
  onFechar: () => void;
}) {
  const { toast } = useToast();
  const { mutate, isPending } = useUpdateActivity();
  const [quando, setQuando] = useState("");

  useEffect(() => {
    if (!atividade) return;
    const sugestao = new Date();
    sugestao.setDate(sugestao.getDate() + 1);
    const antes = atividade.due_date ? new Date(atividade.due_date) : null;
    if (antes && !Number.isNaN(antes.getTime())) sugestao.setHours(antes.getHours(), antes.getMinutes(), 0, 0);
    else sugestao.setHours(9, 0, 0, 0);
    setQuando(paraCampo(sugestao));
  }, [atividade]);

  const salvar = () => {
    if (!atividade || !quando) return;
    mutate(
      { id: atividade.id, activity: { due_date: new Date(quando).toISOString() } },
      {
        onSuccess: () => { toast({ title: "Atividade reagendada" }); onFechar(); },
        onError: (e) => toast({ title: "Erro ao reagendar", description: mensagemErro(e), variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={!!atividade} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reagendar {atividade ? ATIVIDADE_ROTULO[atividade.type].toLowerCase() : ""}</DialogTitle>
          <DialogDescription>{atividade?.title || "Escolha o novo dia e horário."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reagendar-quando">Novo prazo</Label>
          <Input id="reagendar-quando" type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={!quando || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reagendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
