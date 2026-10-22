import { Fragment, type CSSProperties, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Iniciais } from "./ListaV1";
import { classeDoItemDaLateral } from "./navegacao";
import { normalizar } from "./useBuscaGlobal";
import { ID_DA_LISTA_DE_BUSCA, type BuscaDaLateral, type OpcaoDaBusca } from "./useBuscaDaLateral";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** O trecho que casa com o termo, em negrito (sem acento e sem caixa, como a busca). */
export function trechoEmDestaque(texto: string, termo: string): ReactNode {
  const alvo = normalizar(termo.trim());
  if (!alvo) return texto;
  let norma = "";
  const mapa: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const n = normalizar(texto[i]);
    norma += n;
    for (let k = 0; k < n.length; k++) mapa.push(i);
  }
  const pos = norma.indexOf(alvo);
  if (pos < 0) return texto;
  const ini = mapa[pos];
  const fim = mapa[pos + alvo.length - 1] + 1;
  return <>{texto.slice(0, ini)}<strong className="font-semibold text-sidebar-foreground">{texto.slice(ini, fim)}</strong>{texto.slice(fim)}</>;
}

/**
 * O campo da lateral. Em repouso é uma linha com lupa, "Buscar" e ⌘K, com cara
 * de campo; aberto, vira o campo de verdade (a borda ganha a cor de foco e a
 * altura cresce por transição, sem `transform`). Recolhida, é só o ícone.
 */
export function CampoDaBuscaLateral({ busca, recolhida, aoAbrir }: { busca: BuscaDaLateral; recolhida: boolean; aoAbrir?: () => void }) {
  const { aberta, saindo, termo, setTermo, abrir, fechar, campoRef, gatilhoRef, ativoId, aoTeclar } = busca;
  if (recolhida && !aberta) {
    return <Tooltip>
      <TooltipTrigger asChild>
        <button ref={gatilhoRef} type="button" onClick={() => { aoAbrir?.(); abrir(); }} aria-label="Buscar no CRM (Ctrl ou ⌘ K)" className={cn(classeDoItemDaLateral(true, false), "vx-busca-icone")}>
          <Search aria-hidden="true" className="h-5 w-5 shrink-0" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>Buscar (⌘K)</TooltipContent>
    </Tooltip>;
  }
  return (
    <div className="vx-busca-campo" data-aberta={aberta && !saindo ? "true" : "false"}>
      <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-sidebar-muted" />
      {aberta ? <>
        <input ref={campoRef} type="text" role="combobox" aria-label="Buscar no CRM" aria-expanded="true" aria-controls={ID_DA_LISTA_DE_BUSCA}
          aria-autocomplete="list" aria-activedescendant={ativoId} autoComplete="off" spellCheck={false} maxLength={200}
          placeholder="Buscar no CRM…" value={termo} onChange={(e) => setTermo(e.target.value)} onKeyDown={aoTeclar}
          className="vx-busca-input" />
        {termo
          ? <button type="button" aria-label="Limpar busca" onClick={() => { setTermo(""); campoRef.current?.focus(); }} className="vx-busca-fechar"><X aria-hidden="true" className="h-3.5 w-3.5" /></button>
          : <button type="button" aria-label="Fechar busca" onClick={() => fechar(true)} className="vx-busca-fechar"><kbd className="font-sans text-label leading-none">Esc</kbd></button>}
      </> : <button ref={gatilhoRef} type="button" onClick={() => { aoAbrir?.(); abrir(); }} aria-label="Buscar no CRM (Ctrl ou ⌘ K)" className="vx-busca-gatilho">
        <span className="flex-1 truncate text-left">Buscar</span>
        <kbd className="flex h-5 items-center rounded border border-sidebar-border px-1.5 font-sans text-label leading-none text-sidebar-muted">⌘K</kbd>
      </button>}
    </div>
  );
}

function Opcao({ op, i, ativa, termo, busca }: { op: OpcaoDaBusca; i: number; ativa: boolean; termo: string; busca: BuscaDaLateral }) {
  const Icone = op.icone;
  const verTodos = !op.tipo;
  return (
    <div id={`busca-op-${op.id}`} role="option" aria-selected={ativa} data-ativo={ativa} tabIndex={-1}
      onClick={op.aoEscolher} onMouseMove={() => { if (!ativa) busca.setAtivo(i); }}
      style={{ "--vx-i": Math.min(i, 8) } as CSSProperties}
      className={cn("vx-busca-opcao", verTodos && "vx-busca-todos")}>
      {op.forma ? <Iniciais nome={op.titulo} forma={op.forma} tamanho="sm" />
        : Icone ? <Icone aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm" title={op.titulo}>{op.destacar ? trechoEmDestaque(op.titulo, termo) : op.titulo}</span>
        {op.apoio && <span className="block truncate text-label text-sidebar-muted" title={op.apoio}>{op.destacar ? trechoEmDestaque(op.apoio, termo) : op.apoio}</span>}
      </span>
      {op.tipo && <span className="shrink-0 text-label text-sidebar-muted">{op.tipo}</span>}
    </div>
  );
}

/** O painel que SUBSTITUI a lista de navegação enquanto a busca está aberta. */
export function PainelDaBuscaLateral({ busca }: { busca: BuscaDaLateral }) {
  const { secoes, ativo, term, semResultado, dica, falhas, anuncio, saindo, temHistorico, limparHistorico, tentarDeNovo } = busca;
  let indice = -1;
  return (
    <div className="vx-busca-painel" data-saindo={saindo ? "true" : "false"}>
      <p role="status" aria-live="polite" className="sr-only">{anuncio}</p>
      <div id={ID_DA_LISTA_DE_BUSCA} role="listbox" aria-label="Resultados da busca">
        {secoes.map((sec) => (
          <div key={sec.id} role="group" aria-label={sec.rotulo} className="vx-busca-grupo">
            <p aria-hidden="true" className="vx-busca-rotulo">{sec.rotulo}</p>
            {sec.carregando && <div aria-hidden="true" className="space-y-1.5 px-2.5 pb-1"><div className="h-8 animate-pulse rounded-md bg-sidebar-accent" /><div className="h-8 w-4/5 animate-pulse rounded-md bg-sidebar-accent" /></div>}
            {sec.erro && <p className="px-2.5 py-1 text-xs text-sidebar-muted">{sec.erro}</p>}
            {sec.opcoes.map((op) => { indice += 1; return <Fragment key={op.id}><Opcao op={op} i={indice} ativa={indice === ativo} termo={term} busca={busca} /></Fragment>; })}
          </div>
        ))}
      </div>
      {dica && <p className="px-2.5 pt-3 text-xs text-sidebar-muted">{dica}</p>}
      {semResultado && <div className="px-2.5 pt-4">
        <p className="text-sm font-medium text-sidebar-foreground">Nenhum resultado para “{term}”</p>
        <p className="mt-1 text-xs text-sidebar-muted">Confira a grafia ou tente só parte do nome, do e-mail ou do domínio.</p>
      </div>}
      {falhas.length > 0 && <div role="alert" className="px-2.5 pt-3">
        <button type="button" onClick={tentarDeNovo} className="vx-busca-acao">Tentar novamente</button>
      </div>}
      {!term && temHistorico && <div className="px-2.5 pt-2">
        <button type="button" onClick={limparHistorico} className="vx-busca-acao">Limpar recentes</button>
      </div>}
    </div>
  );
}
