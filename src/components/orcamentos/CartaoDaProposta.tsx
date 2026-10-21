import type { ReactNode } from "react";
import { formatarMoedaInteira } from "@/lib/formato";
import { cn } from "@/lib/utils";

export type LinhaDaProposta = { nome: string; apoio: string; valor: number };

/**
 * O cartão "Proposta comercial", UM só para a prévia do CRM e para a página que
 * o cliente abre: se cada lado desenhasse o seu, a pessoa de vendas veria uma
 * coisa e o cliente leria outra. Só tokens de cor, para seguir o tema.
 *
 * Valores sem centavos, como na referência; o centavo continua no construtor e
 * no banco -- aqui o arredondamento é só de exibição.
 */
export function CartaoDaProposta({
  marca, validade, vencida = false, titulo = "Proposta comercial", para, linhas,
  desconto, total, moeda, condicoes, children, className,
}: {
  marca: string;
  /** "30 out", já formatado. */
  validade?: string | null;
  vencida?: boolean;
  titulo?: string;
  para: string;
  linhas: LinhaDaProposta[];
  desconto: number;
  total: number;
  moeda: string;
  condicoes?: string | null;
  /** Rodapé: o botão de aceitar na prévia, o formulário de resposta na página pública. */
  children?: ReactNode;
  className?: string;
}) {
  const dinheiro = (v: number) => formatarMoedaInteira(v, moeda);
  return (
    <div className={cn("rounded-lg bg-card p-5 shadow-lg shadow-black/5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            {marca.charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-sm font-semibold">{marca}</span>
        </span>
        {validade && (
          <span className={cn("shrink-0 text-label", vencida ? "font-semibold text-warning" : "text-muted-foreground")}>
            válido até {validade}
          </span>
        )}
      </div>

      <h3 className="vx-titulo-painel mt-5 !text-lg !font-bold">{titulo}</h3>
      <p className="mt-1 text-xs text-muted-foreground">Para {para}</p>

      <ul>
        {linhas.map((l, i) => (
          <li key={i} className="flex items-start justify-between gap-3 border-b border-border pb-2 pt-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold">{l.nome}</p>
              {l.apoio && <p className="text-xs text-muted-foreground">{l.apoio}</p>}
            </div>
            <p className="shrink-0 text-xs font-semibold tabular-nums">{dinheiro(l.valor)}</p>
          </li>
        ))}
        {desconto > 0 && (
          <li className="flex items-center justify-between gap-3 border-b border-border pb-3 pt-5 text-xs">
            <span className="font-medium">Desconto negociado</span>
            <span className="font-semibold tabular-nums text-success">– {dinheiro(desconto)}</span>
          </li>
        )}
      </ul>

      <div className="flex items-baseline justify-between pt-3">
        <span className="text-xs font-semibold">Total</span>
        <span className="text-xl font-bold tabular-nums tracking-tight">{dinheiro(total)}</span>
      </div>

      {condicoes && <p className="mt-3 text-label text-muted-foreground">{condicoes}</p>}
      {children && <div className="mt-3 [&_button]:h-9">{children}</div>}
    </div>
  );
}
