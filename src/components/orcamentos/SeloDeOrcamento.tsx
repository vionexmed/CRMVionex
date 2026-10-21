import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Orcamento } from "@/lib/api/orcamentos";
import { SeloComPonto, type Tom } from "@/components/layout/ListaV1";
import { diasParaVencer } from "@/lib/orcamento-resumo";

/*
  O derivador mora em `orcamento-calculo.ts`, junto da aritmética -- e a edge
  function repete a MESMA regra em Deno, onde não dá para importar de `src`.
  Os dois pontos estão marcados: mudar a regra exige mudar os dois.
*/
import { estadoDoOrcamento } from "@/lib/orcamento-calculo";

const SELO: Record<string, { rotulo: string; tom: Tom }> = {
  enviado: { rotulo: "Enviado", tom: "neutro" },
  aprovado: { rotulo: "Aceito", tom: "sucesso" },
  recusado: { rotulo: "Recusado", tom: "perigo" },
  expirado: { rotulo: "Vencido", tom: "atencao" },
};

/**
 * A situação do orçamento no vocabulário do V1: ponto + texto, e o rascunho
 * como pílula tracejada (ainda não é um estado "de verdade", só um começo).
 *
 * Para o ENVIADO a regra escolhe o que mais ajuda quem espera resposta: vencer
 * logo ganha de "visualizado", porque é o que pede ação. O "3×" vem de
 * `visualizacoes`; num banco sem a coluna (migração pendente) o selo diz só
 * "Visualizado" -- inventar o número seria mentir.
 */
export function SeloDeOrcamento({
  orcamento,
  className,
}: {
  orcamento: Pick<Orcamento, "status" | "valido_ate"> & { visto_em?: string | null; visualizacoes?: number | null };
  className?: string;
}) {
  const estado = estadoDoOrcamento(orcamento);

  if (estado === "rascunho") {
    return (
      <span className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-full border border-dashed border-input px-2.5 text-xs font-medium text-muted-foreground",
        className,
      )}>
        Rascunho
      </span>
    );
  }

  if (estado === "enviado") {
    const dias = diasParaVencer(orcamento.valido_ate);
    if (dias !== null && dias <= 1) {
      return (
        <SeloComPonto tom="atencao" className={className}>
          {dias <= 0 ? "Expira hoje" : "Expira amanhã"}
        </SeloComPonto>
      );
    }
    if (orcamento.visto_em) {
      return (
        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-info", className)}>
          <Eye aria-hidden="true" className="h-3.5 w-3.5" />
          Visualizado{Number(orcamento.visualizacoes) > 0 ? ` ${Number(orcamento.visualizacoes)}×` : ""}
        </span>
      );
    }
  }

  const s = SELO[estado] ?? SELO.enviado;
  // "Enviado" é o estado neutro: o texto fica no tom do corpo (só o ponto é cinza).
  return <SeloComPonto tom={s.tom} className={cn(s.tom === "neutro" && "text-foreground", className)}>{s.rotulo}</SeloComPonto>;
}
