import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarTempoRelativo } from "@/lib/formato";
import { Iniciais, SeloComPonto, type Tom } from "@/components/layout/ListaV1";
import { getContactOrigin, LIFECYCLE_LABELS, type LifecycleStage } from "@/lib/contact-options";
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
const TOM_DO_ESTAGIO: Record<LifecycleStage, Tom> = {
  lead: "info",
  contacted: "marca",
  qualified: "marca",
  opportunity: "marca",
  customer: "sucesso",
  disqualified: "neutro",
};

export function EstagioSelo({ stage, variante = "texto" }: { stage: LifecycleStage | null; variante?: "texto" | "suave" }) {
  const e = stage ?? "lead";
  return <SeloComPonto tom={TOM_DO_ESTAGIO[e]} variante={variante}>{LIFECYCLE_LABELS[e]}</SeloComPonto>;
}

/**
 * Origem é categoria, não estado: pílula neutra. A bolinha mantém a cor que
 * `getContactOrigin` já devolve, para a origem continuar reconhecível.
 */
export function OrigemSelo({ metadata }: { metadata: unknown }) {
  const o = getContactOrigin(metadata as Record<string, unknown> | null);
  return (
    <span className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 text-xs font-medium text-foreground">
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: o.color }} />
      {o.label}
    </span>
  );
}

/** Dias sem contato a partir dos quais o texto fica vermelho. */
const DIAS_PARA_ATRASO = 7;

/**
 * "há 2 horas", "há 8 dias" -- vermelho depois de uma semana.
 *
 * Sem data de atividade o texto diz isso, em vez de inventar uma: contato que
 * nunca foi tocado não é "há 0 dias".
 */
export function UltimoContato({ data }: { data: Date | null | undefined }) {
  if (!data) return <span className="text-xs text-muted-foreground">Sem atividade</span>;
  const dias = Math.floor((Date.now() - data.getTime()) / 86_400_000);
  const atrasado = dias > DIAS_PARA_ATRASO;
  return (
    <span className={cn("whitespace-nowrap text-xs", atrasado ? "font-semibold text-destructive" : "text-foreground")}>
      {formatarTempoRelativo(data)}
    </span>
  );
}

type Membro = { id: string; name: string | null; email: string | null };

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
    <span className="inline-flex items-center gap-2 text-xs">
      <Iniciais nome={nome} tamanho="sm" destaque />
      <span className="truncate">{primeiroNome(nome) || nome}</span>
    </span>
  ) : (
    <span className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-input px-2.5 text-xs font-medium text-muted-foreground">
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
