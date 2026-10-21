/**
 * O bloco de um relatório: título, ações e o gráfico ou tabela dentro de um
 * cartão.
 *
 * Os cinco relatórios montavam o bloco à mão, cada um com
 * `<section className="border-t px-4 py-5"><header><h2 className="text-sm
 * font-semibold">` -- o mesmo trecho vinte vezes, com título fora da hierarquia
 * de texto. No Visual 01 cada bloco é um cartão sobre o fundo da página, como
 * no painel, e o título é o `CardTitle` do sistema.
 *
 * Tabela dentro do bloco usa `rente` e `vx-table rounded-none border-x-0
 * border-b-0`: a moldura do `.vx-table` some nas laterais e embaixo (o cartão
 * já desenha) e fica a linha de cima separando do título. A classe vai escrita
 * em cada tabela, não numa constante, porque o teste de moldura procura
 * `vx-table` no arquivo que monta a `<Table>`.
 */
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CartaoDeRelatorio({
  titulo, descricao, acoes, rente = false, className, children,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  /** Sem respiro: para tabela, que desenha a própria borda até a do cartão. */
  rente?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("min-w-0 overflow-hidden", className)}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 space-y-1">
            <CardTitle>{titulo}</CardTitle>
            {descricao && <CardDescription>{descricao}</CardDescription>}
          </div>
          {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
        </div>
      </CardHeader>
      {rente ? <CardContent className="p-0">{children}</CardContent> : <CardContent>{children}</CardContent>}
    </Card>
  );
}

/** Estado vazio dentro de um bloco: linha à esquerda, sem caixa nova. */
export function VazioDoBloco({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-20 items-center border-l-2 border-border pl-4 text-xs text-muted-foreground">
      {children}
    </div>
  );
}

/** Duas colunas, a principal com o dobro -- a mesma grade do painel. */
export function GradeDeRelatorio({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]", className)}>
      {children}
    </div>
  );
}
