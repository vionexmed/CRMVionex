import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatarNumero } from "@/lib/formato";
import { AvatarDaPessoa } from "@/components/negocios/AvatarDaPessoa";

/**
 * A ABA DOS FUNIS, na borda esquerda do conteúdo: a lingueta azul com a seta
 * abre a lista de funis num painel lateral, como no padrão da plataforma. O
 * funil ativo é o subtítulo da página, então a tela sempre diz em qual se está.
 *
 * A contagem é de negócios ABERTOS: é o que o quadro mostra em colunas, e o
 * mesmo número do indicador "Em aberto" do resumo.
 */
export function AbaDeFunis({ funis, valor, onChange, contagens, linkNovoFunil }: {
  funis: { id: string; name: string; is_default?: boolean | null }[];
  valor: string;
  onChange: (id: string) => void;
  /** Ausente para um funil: a contagem não aparece (ainda carregando). */
  contagens?: Map<string, number>;
  /**
   * Para onde leva "+ Funil". Ausente: o botão não aparece. Criar funil existe
   * só em Configurações (admin), então não há por que oferecer a quem não pode.
   */
  linkNovoFunil?: string;
}) {
  const [aberto, setAberto] = useState(false);
  // O padrão primeiro, os outros por nome: a ordem de criação no banco não diz
  // nada a quem lê, e mudaria a posição dos funis a cada funil novo.
  const ordenados = [...funis].sort((a, b) =>
    Number(!!b.is_default) - Number(!!a.is_default) || a.name.localeCompare(b.name, "pt-BR"));
  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <button type="button" aria-label="Trocar de funil" title="Funis"
          className="-ml-4 flex h-9 w-6 shrink-0 items-center justify-center rounded-r-md bg-primary text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:-ml-8">
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0 sm:max-w-xs">
        <SheetHeader className="px-5 pb-2 pt-5 text-left">
          <SheetTitle>Funis</SheetTitle>
          <SheetDescription>Escolha o funil exibido no quadro.</SheetDescription>
        </SheetHeader>
        <div role="group" aria-label="Funis" className="flex flex-col gap-0.5 px-3 pb-4">
          {ordenados.map((f) => {
            const ativo = f.id === valor;
            const n = contagens?.get(f.id);
            return (
              <button key={f.id} type="button" aria-pressed={ativo}
                onClick={() => { onChange(f.id); setAberto(false); }}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-md px-3 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                  ativo ? "font-semibold text-primary" : "font-medium text-foreground",
                )}>
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                {n !== undefined && (
                  <span className="text-xs tabular-nums text-muted-foreground">{formatarNumero(n)}</span>
                )}
                {ativo && <Check aria-hidden="true" className="h-4 w-4" />}
              </button>
            );
          })}
          {linkNovoFunil && (
            <Link to={linkNovoFunil} onClick={() => setAberto(false)}
              className="vx-tracejado mt-2 inline-flex h-9 items-center justify-center gap-1 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />Funil
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Quem trabalha o funil: as iniciais de quem tem negócio ABERTO nele, de quem
 * tem mais para quem tem menos -- a pilha responde "de quem é este funil?".
 *
 * Só informa -- filtrar por pessoa é o chip "Responsável", e duas portas para o
 * mesmo filtro com aparências diferentes confundiriam qual está ligada. O nome
 * completo de todos vai no `title`, já que as iniciais sozinhas não identificam.
 */
export function TimeDoFunil({ pessoas, tons, maximo = 4 }: {
  /** Já em ordem. */
  pessoas: { id: string; name: string | null; email?: string | null }[];
  /** Tom de cada pessoa, de `tonsDaEquipe`. */
  tons: Map<string, string>;
  maximo?: number;
}) {
  if (pessoas.length === 0) return null;
  // Sem "+N": a pilha mostra os que mais carregam o funil, e o `title` lista
  // todos -- um quinto círculo só com número disputaria com as iniciais.
  const visiveis = pessoas.slice(0, maximo);
  const nomes = pessoas.map((m) => m.name || m.email || "Sem nome").join(", ");
  return (
    <div title={nomes} aria-label={`Time: ${nomes}`}
      className="flex h-9 shrink-0 items-center gap-2.5 rounded-lg bg-card pl-2 pr-3.5 shadow-card">
      <div className="flex -space-x-1">
        {visiveis.map((m) => (
          <AvatarDaPessoa key={m.id} nome={m.name || m.email} tom={tons.get(m.id)} tamanho="md" className="ring-2 ring-card" />
        ))}
      </div>
      <span className="text-sm font-medium text-foreground">Time</span>
    </div>
  );
}
