import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Grupo de opções com divisórias para alternar visão.
 *
 * Existiam quatro cópias deste bloco — Contatos, Empresas, Negócios e Atividades
 * — e elas já haviam divergido: `rounded-lg`/`rounded-md` contra
 * `rounded-md`/`rounded`, `px-2 sm:px-3 py-1.5` contra `px-2 py-1` contra
 * `px-3 py-1.5`. A de Atividades ainda perdeu o `aria-label` e o rótulo.
 *
 * Nenhuma anunciava seleção para leitor de tela: quatro controles de escolha e
 * zero `aria-pressed`.
 */

export type OpcaoSegmento<T extends string> = {
  valor: T;
  rotulo: string;
  icone?: LucideIcon;
  /**
   * Cor do texto quando esta opção está ativa.
   *
   * Existe para a barra do Marketing, onde cada aba tem a cor da plataforma --
   * azul do Meta, vermelho do Google. Sem isso ela manteria a sétima cópia
   * própria deste controle, que é como as seis anteriores apareceram.
   *
   * Só cor de TEXTO, e só quando ativa: o fundo continua sendo o do tema, então
   * a pílula não vira um bloco colorido.
   */
  corAtiva?: string;
};

export function SegmentedControl<T extends string>({
  opcoes,
  valor,
  onChange,
  /** Nome do grupo, para leitor de tela. Ex.: "Visualização". */
  rotuloGrupo,
  /** Esconde o texto no celular, mantendo só o ícone. */
  compactoNoCelular = true,
  className,
}: {
  opcoes: OpcaoSegmento<T>[];
  valor: T;
  onChange: (v: T) => void;
  rotuloGrupo: string;
  compactoNoCelular?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={rotuloGrupo}
      className={cn(
        "flex max-w-full shrink-0 overflow-x-auto rounded-md border border-border bg-background",
        className,
      )}
    >
      {opcoes.map(({ valor: v, rotulo, icone: Icone, corAtiva }) => {
        const ativo = v === valor;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            // `aria-pressed` é o que faz um botão de alternância ser anunciado
            // como selecionado. Nenhuma das quatro cópias tinha.
            aria-pressed={ativo}
            aria-label={`${rotuloGrupo} ${rotulo}`}
            className={cn(
              "vx-control flex min-h-9 min-w-9 shrink-0 items-center justify-center gap-2 border-r border-border px-3 py-2 text-xs font-medium transition-colors duration-150 last:border-r-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              ativo
                ? "bg-muted"
                : "text-muted-foreground hover:text-foreground",
              ativo && !corAtiva && "text-foreground",
            )}
            style={ativo && corAtiva ? { color: corAtiva } : undefined}
          >
            {Icone && <Icone className="h-4 w-4 shrink-0" />}
            <span className={compactoNoCelular && Icone ? "hidden sm:inline" : undefined}>
              {rotulo}
            </span>
          </button>
        );
      })}
    </div>
  );
}
