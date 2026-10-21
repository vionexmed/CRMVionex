import type { ReactNode } from "react";
import { ArrowDown, Check, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { iniciais } from "@/components/layout/ListaV1";
import { getContactOrigin, LIFECYCLE_LABELS, type LifecycleStage } from "@/lib/contact-options";
import { diasDeAtraso, diaEHoraCurtos, diasSemContato, ultimoContatoTexto } from "@/components/clientes/tempoDeLista";
import type { ProximaDoContato } from "@/components/clientes/useProximasAtividades";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Peças de célula compartilhadas por Contatos, Empresas e o kanban.
 *
 * Uma só tradução de estágio para tom: antes cada tela pintava o mesmo estágio
 * com a sua cor, e a mesma pessoa mudava de cor conforme a tela em que se
 * olhava. Tom é token (muda com o tema escuro e com a cor de destaque); o hex de
 * `LIFECYCLE_COLORS` não muda, e por isso saiu das telas.
 */
/**
 * Nomes dos estágios NA LISTA. `LIFECYCLE_LABELS` ("Novo lead", "Em negociação")
 * é o vocabulário do funil e dos menus de ação; a lista do Visual 01 usa o
 * curto -- "Lead", "Oportunidade" -- e é o que cabe na coluna.
 */
const ROTULO_NA_LISTA: Record<LifecycleStage, string> = {
  ...LIFECYCLE_LABELS,
  lead: "Lead",
  opportunity: "Oportunidade",
};
export const rotuloDoEstagio = (e: LifecycleStage | string): string =>
  ROTULO_NA_LISTA[e as LifecycleStage] ?? e;

/**
 * Cor do estágio: um tom por ETAPA da jornada, em vez de tudo azul. As cores
 * são as do Visual 01 no tema claro; no escuro cada uma ganha o par claro, já
 * que o azul-marinho do claro sumiria no fundo escuro.
 */
const COR_DO_ESTAGIO: Record<LifecycleStage, { ponto: string; texto: string }> = {
  lead: { ponto: "bg-[#2041AE] dark:bg-[#84B0F8]", texto: "text-[#2041AE] dark:text-[#84B0F8]" },
  contacted: { ponto: "bg-[#0E5089] dark:bg-[#7CC0F5]", texto: "text-[#0E5089] dark:text-[#7CC0F5]" },
  qualified: { ponto: "bg-[#0E5089] dark:bg-[#7CC0F5]", texto: "text-[#0E5089] dark:text-[#7CC0F5]" },
  opportunity: { ponto: "bg-[#015962] dark:bg-[#5FD3D3]", texto: "text-[#015962] dark:text-[#5FD3D3]" },
  customer: { ponto: "bg-[#065D38] dark:bg-[#4FD99A]", texto: "text-[#065D38] dark:text-[#4FD99A]" },
  disqualified: { ponto: "bg-muted-foreground", texto: "text-muted-foreground" },
};

export function EstagioSelo({ stage, variante = "texto" }: { stage: LifecycleStage | null; variante?: "texto" | "suave" }) {
  const e = stage ?? "lead";
  const c = COR_DO_ESTAGIO[e];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold",
      c.texto,
      variante === "suave" && "h-6 rounded bg-accent px-2",
    )}>
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", c.ponto)} />
      {rotuloDoEstagio(e)}
    </span>
  );
}

/** Bolinhas das origens que a referência mostra; as demais usam a cor de `getContactOrigin`. */
const COR_DA_ORIGEM: Record<string, string> = {
  whatsapp: "#13A89E", indicação: "#F2A93B", site: "#2F5BEA", evento: "#8A93A3",
};

/**
 * Origem é categoria, não estado: pílula neutra. A bolinha mantém a cor que
 * `getContactOrigin` já devolve, para a origem continuar reconhecível.
 */
export function OrigemSelo({ metadata }: { metadata: unknown }) {
  const o = getContactOrigin(metadata as Record<string, unknown> | null);
  return (
    <span className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 text-xs text-foreground">
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: COR_DA_ORIGEM[o.label.toLowerCase()] ?? o.color }} />
      {o.label}
    </span>
  );
}

/** Dias sem contato a partir dos quais o texto fica vermelho. */
const DIAS_PARA_ATRASO = 7;

/**
 * "há 2 h", "ontem", "há 8 dias" -- vermelho depois de uma semana.
 *
 * Sem data de interação o texto diz isso, em vez de inventar uma: contato que
 * nunca foi tocado não é "há 0 dias".
 */
export function UltimoContato({ data }: { data: Date | null | undefined }) {
  if (!data) return <span className="text-muted-foreground">Sem contato</span>;
  const atrasado = diasSemContato(data) > DIAS_PARA_ATRASO;
  return (
    <span className={cn("whitespace-nowrap", atrasado ? "font-semibold text-destructive" : "text-foreground")}>
      {ultimoContatoTexto(data)}
    </span>
  );
}

/**
 * Próxima atividade: "Ligação · seg 09:00", "Aguardando atendimento" (vermelho,
 * o contato escreveu e ninguém respondeu), "Ligação atrasada 1 d" (vermelho) ou
 * "Sem atividade" (cinza). Quem espera resposta vence a agenda: é o que está
 * queimando agora.
 */
export function ProximaAtividade({ info }: { info: ProximaDoContato | undefined }) {
  if (info?.aguardando) return <span className="whitespace-nowrap font-semibold text-destructive">Aguardando atendimento</span>;
  const a = info?.atividade;
  if (!a) return <span className="whitespace-nowrap text-muted-foreground">Sem atividade</span>;
  if (!a.vence) return <span className="whitespace-nowrap text-foreground">{a.titulo}</span>;
  if (a.vence.getTime() < Date.now()) {
    return <span className="whitespace-nowrap font-semibold text-destructive">{a.titulo} atrasada {diasDeAtraso(a.vence)} d</span>;
  }
  return <span className="whitespace-nowrap text-foreground">{a.titulo} · {diaEHoraCurtos(a.vence)}</span>;
}

/** Pontuação: o número em seminegrito e uma barra fina proporcional (0 a 100). */
export function Pontuacao({ valor }: { valor: number | null | undefined }) {
  if (valor == null) return <span className="text-muted-foreground">—</span>;
  const pct = Math.max(0, Math.min(100, valor));
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="w-5 font-bold tabular-nums">{valor}</span>
      <span aria-hidden="true" className="h-1.5 w-10 overflow-hidden rounded-full bg-secondary">
        <span
          className={cn("block h-full rounded-full", pct >= 80 ? "bg-primary" : pct >= 50 ? "bg-primary/55" : "bg-muted-foreground/60")}
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}

/**
 * Caixa de seleção de três estados (marcado / desmarcado / parcial). O
 * `Checkbox` compartilhado só tem dois e mostra sempre um "check": no cabeçalho
 * da tabela "algumas linhas" precisa ser um traço.
 */
export function CaixaDeSelecao({ estado, onChange, rotulo }: {
  estado: boolean | "parcial";
  onChange: () => void;
  rotulo: string;
}) {
  const ligado = estado !== false;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={estado === "parcial" ? "mixed" : estado}
      aria-label={rotulo}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className="vx-control inline-flex h-8 w-8 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={cn(
        "flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border text-primary-foreground transition-colors",
        ligado ? "border-primary bg-primary" : "border-input bg-card",
      )}>
        {estado === "parcial" ? <Minus aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
          : estado ? <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

/** Cabeçalho de coluna: seta só na coluna ordenada, como na referência. */
export function CabecalhoOrdenavel({ rotulo, ativo, direcao, onClick }: {
  rotulo: string;
  ativo: boolean;
  direcao: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ativo ? `${rotulo}, ordenado ${direcao === "asc" ? "crescente" : "decrescente"}. Inverter.` : `${rotulo}. Ordenar por esta coluna.`}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {rotulo}
      {ativo && <ArrowDown aria-hidden="true" className={cn("h-3 w-3", direcao === "asc" && "rotate-180")} />}
    </button>
  );
}

type Membro = { id: string; name: string | null; email: string | null };

/**
 * Cada responsável tem a sua cor, pela posição na equipe: a mesma pessoa mantém
 * a cor em todas as linhas, e as quatro tonalidades se alternam para vizinhos
 * não se confundirem. (Por hash do id duas pessoas da mesma equipe caíam na
 * mesma cor com frequência.)
 */
const TOM_DA_PESSOA = [
  "bg-primary/10 text-primary",
  "bg-success-soft text-success",
  "bg-warning-soft text-warning",
  "bg-secondary text-neutral",
];

function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? "").trim().split(/\s+/)[0] || "";
}

/**
 * Responsável: iniciais + primeiro nome, ou "+ Atribuir" tracejado. Os dois
 * abrem a troca de responsável que a tela já tinha -- o chip é a porta de
 * entrada, não uma troca nova.
 */
export function ResponsavelCelula({ ownerId, membros, onChange, rotuloDe }: {
  ownerId: string | null;
  membros: Membro[];
  onChange?: (novo: string | null) => void;
  /** Texto para leitor de tela: "Responsável por Paula Ramos". */
  rotuloDe: string;
}) {
  const dono = ownerId ? membros.find((m) => m.id === ownerId) : undefined;
  const nome = dono?.name || dono?.email || "";
  const gatilho: ReactNode = dono ? (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        // Sem `cn`: o tailwind-merge trata `text-label` (tamanho) e `text-primary`
        // (cor) como o mesmo grupo e descartaria um dos dois.
        className={`inline-flex h-6 w-6 shrink-0 select-none items-center justify-center rounded-full text-label font-bold ${TOM_DA_PESSOA[Math.max(0, membros.indexOf(dono)) % TOM_DA_PESSOA.length]}`}
      >
        {iniciais(nome)}
      </span>
      <span className="truncate">{primeiroNome(nome) || nome}</span>
    </span>
  ) : (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-input px-3 text-muted-foreground">
      <Plus aria-hidden="true" className="h-3 w-3" />Atribuir
    </span>
  );
  // Sem troca disponível (Empresas), "+ Atribuir" seria um botão que não faz nada.
  if (!onChange) return dono ? gatilho : <span className="text-xs text-muted-foreground">—</span>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={rotuloDe} className="vx-control rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {gatilho}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {membros.map((m) => (
          <DropdownMenuItem key={m.id} onClick={() => onChange(m.id)}>{m.name || m.email}</DropdownMenuItem>
        ))}
        {ownerId && <DropdownMenuItem onClick={() => onChange(null)}>Remover responsável</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
