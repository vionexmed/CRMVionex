import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import vionexLogo from "@/assets/vionex-logo-sidebar.png";
import { Button } from "@/components/ui/button";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/formato";
import { codigoDoOrcamento } from "@/lib/orcamento-resumo";
import { numeroPorExtenso } from "@/lib/numero-por-extenso";
import { formatarCnpj } from "@/lib/cnpj";
import type { DadosDaEmpresa } from "@/lib/empresa-documento";

export type ItemDoDocumento = {
  nome: string; descricao: string | null; unidade: string;
  quantidade: number; preco_unit: number; desconto: number; total: number;
};

export type SituacaoDoDocumento = "rascunho" | "enviado" | "aprovado" | "recusado" | "expirado";

export type DadosDoDocumento = {
  numero: number;
  titulo: string | null;
  situacao: SituacaoDoDocumento;
  /** ISO ou yyyy-mm-dd. */
  emitidoEm: string | null;
  validoAte: string | null;
  moeda: string;
  emitente: Partial<DadosDaEmpresa> & { nome: string };
  destinatario: { cliente: string; contato?: string | null; email?: string | null; telefone?: string | null };
  responsavel?: string | null;
  itens: ItemDoDocumento[];
  subtotal: number;
  desconto: number;
  total: number;
  /** Visível ao cliente. A observação INTERNA nunca entra aqui: nem existe no tipo. */
  condicoes?: string | null;
  /** Só os 8 primeiros caracteres viram o código de verificação. */
  token: string;
};

const ROTULO_DA_SITUACAO: Record<SituacaoDoDocumento, string> = {
  rascunho: "RASCUNHO", enviado: "ENVIADO", aprovado: "APROVADO", recusado: "RECUSADO", expirado: "EXPIRADO",
};
const COR_DA_SITUACAO: Record<SituacaoDoDocumento, string> = {
  rascunho: "text-[hsl(var(--doc-suave))]",
  enviado: "text-[hsl(var(--doc-tinta))]",
  aprovado: "text-[hsl(var(--doc-ok))]",
  recusado: "text-[hsl(var(--doc-erro))]",
  expirado: "text-[hsl(var(--doc-aviso))]",
};

/** yyyy-mm-dd ou ISO -> dd/mm/aaaa, sem passar por `Date` (evita o dia deslocado pelo fuso). */
function dataBR(s: string | null | undefined): string | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  // ISO com hora (created_at em UTC) vai pelo relógio local; data pura, não.
  if (s!.length > 10) return formatarData(s);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const LARGURA_A4 = 794; // A4 a 96dpi

/**
 * Encolhe a folha para caber quando o contêiner (a prévia ao lado da lista) é
 * mais estreito que o A4 -- em telas >= 768px. Abaixo disso a folha mantém o
 * tamanho real e rola dentro do próprio contêiner. `zoom` e não `transform`:
 * transform não muda o espaço ocupado e deixaria um vazio embaixo da folha.
 */
function useAjusteDeLargura() {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const medir = () => {
      const largo = window.matchMedia("(min-width: 768px)").matches;
      setZoom(largo ? Math.min(1, el.clientWidth / LARGURA_A4) : 1);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, zoom };
}

/** Caixa rotulada: rótulo minúsculo em caixa alta no canto, valor embaixo (como na DANFE). */
function Campo({ rotulo, children, className = "" }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={`vx-doc-caixa min-w-0 px-2 py-1 ${className}`}>
      <span className="vx-doc-rotulo text-label">{rotulo}</span>
      <div className="min-h-[1.25rem] break-words text-xs font-medium">{children}</div>
    </div>
  );
}

function Secao({ titulo }: { titulo: string }) {
  return <p className="vx-doc-rotulo mt-3 px-0.5 pb-1 text-label">{titulo}</p>;
}

/**
 * O orçamento como DOCUMENTO: folha A4 em papel branco, caixas de borda fina com
 * o rótulo no canto, no estilo de uma nota fiscal na ORGANIZAÇÃO -- mas honesto:
 * o rodapé diz "sem valor fiscal". Um só componente para a prévia do CRM e para
 * a página do cliente; se cada lado desenhasse o seu, quem vende e quem lê
 * veriam documentos diferentes.
 *
 * `children` vai dentro do quadro de aceite (o formulário da página pública);
 * `acoes` fica FORA da folha e não é impresso (botões da prévia do CRM).
 */
export function DocumentoDeOrcamento({
  dados, children, acoes, geradoEm = new Date(),
}: {
  dados: DadosDoDocumento;
  children?: ReactNode;
  acoes?: ReactNode;
  geradoEm?: Date;
}) {
  const dinheiro = (v: number) => formatarMoeda(v, dados.moeda);
  const { emitente: e, destinatario: d } = dados;
  const codigo = codigoDoOrcamento(dados.numero);
  const emitidoEm = dataBR(dados.emitidoEm);
  const validade = dataBR(dados.validoAte);
  const { ref, zoom } = useAjusteDeLargura();
  const tenhoDestinatarioExtra = !!(d.contato || d.email || d.telefone);

  return (
    <div className="rounded-lg bg-muted p-2 md:p-6">
      <div className="vx-nao-imprime mb-2 flex justify-end md:mx-auto md:max-w-[794px]">
        <Button variant="outline" size="sm" className="h-8 bg-card" onClick={() => window.print()}>
          <Download className="mr-1.5 h-3.5 w-3.5" />Baixar PDF
        </Button>
      </div>

      {/* A folha mantém a proporção A4: em tela estreita rola AQUI dentro, nunca a página. */}
      <div ref={ref} className="overflow-x-auto">
        <article
          aria-label={`Orçamento ${codigo}`}
          className="vx-documento mx-auto w-[794px] shrink-0 p-8 shadow-md"
          style={zoom < 1 ? { zoom } : undefined}
        >
          {/* 1. Cabeçalho */}
          <header className="vx-doc-bloco flex items-stretch justify-between gap-4">
            <div className="flex flex-col justify-center">
              <img src={vionexLogo} alt="Vionex" className="h-14 w-auto self-start" />
            </div>
            <div className="vx-doc-caixa w-[300px] shrink-0 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-bold uppercase leading-tight tracking-wide vx-doc-destaque">Orçamento</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">Nº {codigo}</p>
                </div>
                <span
                  className={`vx-doc-caixa shrink-0 border-2 px-2 py-0.5 text-xs font-bold tracking-wider ${COR_DA_SITUACAO[dados.situacao]}`}
                  style={{ borderColor: "currentColor" }}
                >
                  {ROTULO_DA_SITUACAO[dados.situacao]}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 text-xs">
                <div><span className="vx-doc-rotulo text-label">Emissão</span><span className="tabular-nums">{emitidoEm ?? "—"}</span></div>
                <div><span className="vx-doc-rotulo text-label">Validade</span><span className="tabular-nums">{validade ?? "—"}</span></div>
              </div>
            </div>
          </header>

          {/* 2. Emitente */}
          <Secao titulo="Emitente" />
          <section className="vx-doc-bloco grid grid-cols-6 gap-px">
            <Campo rotulo="Razão social / nome" className="col-span-4">{e.razao_social || e.nome}</Campo>
            {e.cnpj && <Campo rotulo="CNPJ" className="col-span-2"><span className="tabular-nums">{formatarCnpj(e.cnpj)}</span></Campo>}
            {e.endereco && <Campo rotulo="Endereço" className="col-span-6">{e.endereco}</Campo>}
            {e.telefone && <Campo rotulo="Telefone" className="col-span-2">{e.telefone}</Campo>}
            {e.email && <Campo rotulo="E-mail" className="col-span-2">{e.email}</Campo>}
            {e.site && <Campo rotulo="Site" className="col-span-2">{e.site}</Campo>}
          </section>

          {/* 3. Destinatário: só o que existir */}
          <Secao titulo="Destinatário" />
          <section className="vx-doc-bloco grid grid-cols-6 gap-px">
            <Campo rotulo="Cliente" className="col-span-6">{d.cliente}</Campo>
            {tenhoDestinatarioExtra && (
              <>
                {d.contato && <Campo rotulo="Contato" className="col-span-2">{d.contato}</Campo>}
                {d.email && <Campo rotulo="E-mail" className="col-span-2">{d.email}</Campo>}
                {d.telefone && <Campo rotulo="Telefone" className="col-span-2">{d.telefone}</Campo>}
              </>
            )}
          </section>

          {/* 4. Dados do orçamento */}
          <Secao titulo="Dados do orçamento" />
          <section className="vx-doc-bloco grid grid-cols-6 gap-px">
            <Campo rotulo="Título" className="col-span-3">{dados.titulo || "—"}</Campo>
            <Campo rotulo="Validade" className="col-span-1"><span className="tabular-nums">{validade ?? "—"}</span></Campo>
            <Campo rotulo="Moeda" className="col-span-1">{dados.moeda}</Campo>
            <Campo rotulo="Responsável" className="col-span-1">{dados.responsavel || "—"}</Campo>
          </section>

          {/* 5. Itens */}
          <Secao titulo="Itens" />
          <table className="w-full border-collapse text-xs">
            {/* O rótulo vai num <span>: `display:block` direto no <th> o tira da linha da tabela. */}
            <thead>
              <tr className="vx-doc-fundo">
                {[["Item", "text-left w-10"], ["Descrição", "text-left"], ["Qtd", "text-right w-12"], ["Un.", "text-left w-12"],
                  ["Valor unit.", "text-right w-24"], ["Desc.", "text-right w-20"], ["Total", "text-right w-28"]].map(([t, c]) => (
                  <th key={t} className={`vx-doc-caixa px-2 py-1 ${c}`}><span className="vx-doc-rotulo text-label">{t}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.itens.length === 0 && (
                <tr><td colSpan={7} className="vx-doc-caixa vx-doc-suave px-2 py-3 text-center">Nenhum item.</td></tr>
              )}
              {dados.itens.map((i, n) => (
                <tr key={n}>
                  <td className="vx-doc-caixa px-2 py-1.5 align-top tabular-nums">{String(n + 1).padStart(2, "0")}</td>
                  <td className="vx-doc-caixa px-2 py-1.5 align-top">
                    <span className="font-semibold">{i.nome}</span>
                    {i.descricao && <span className="vx-doc-suave block">{i.descricao}</span>}
                  </td>
                  <td className="vx-doc-caixa px-2 py-1.5 text-right align-top tabular-nums">{i.quantidade}</td>
                  <td className="vx-doc-caixa px-2 py-1.5 align-top">{i.unidade}</td>
                  <td className="vx-doc-caixa px-2 py-1.5 text-right align-top tabular-nums">{dinheiro(i.preco_unit)}</td>
                  <td className="vx-doc-caixa px-2 py-1.5 text-right align-top tabular-nums">{i.desconto > 0 ? dinheiro(i.desconto) : "—"}</td>
                  <td className="vx-doc-caixa px-2 py-1.5 text-right align-top font-semibold tabular-nums">{dinheiro(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 6. Totais */}
          <section className="vx-doc-bloco mt-3 flex items-stretch gap-3">
            <Campo rotulo="Valor por extenso" className="flex-1">{numeroPorExtenso(dados.total, dados.moeda)}</Campo>
            <div className="w-[300px] shrink-0">
              <div className="vx-doc-caixa flex items-baseline justify-between px-2 py-1 text-xs">
                <span className="vx-doc-rotulo text-label">Subtotal</span><span className="tabular-nums">{dinheiro(dados.subtotal)}</span>
              </div>
              <div className="vx-doc-caixa flex items-baseline justify-between px-2 py-1 text-xs" style={{ borderTop: 0 }}>
                <span className="vx-doc-rotulo text-label">Desconto</span>
                <span className="tabular-nums">{dados.desconto > 0 ? `– ${dinheiro(dados.desconto)}` : dinheiro(0)}</span>
              </div>
              <div className="vx-doc-caixa vx-doc-fundo flex items-baseline justify-between border-t-2 px-2 py-2" style={{ borderTopColor: "var(--doc-destaque)" }}>
                <span className="vx-doc-rotulo text-label">Valor total</span>
                <span className="text-lg font-bold tabular-nums">{dinheiro(dados.total)}</span>
              </div>
            </div>
          </section>

          {/* 7. Condições (só o que o cliente pode ler) */}
          {dados.condicoes && (
            <>
              <Secao titulo="Condições e observações" />
              <section className="vx-doc-bloco">
                <div className="vx-doc-caixa whitespace-pre-line px-2 py-2 text-xs leading-relaxed">{dados.condicoes}</div>
              </section>
            </>
          )}

          {/* 8. Aceite */}
          <Secao titulo="Aceite do cliente" />
          <section className="vx-doc-bloco vx-doc-caixa p-3">
            {children && <div className="vx-nao-imprime [&_button]:h-9">{children}</div>}
            {/* Linhas para assinar: sempre na impressão; na tela só quando não há formulário. */}
            <div className={`${children ? "hidden print:grid" : "grid"} grid-cols-6 gap-x-4 gap-y-6 pt-4`}>
              <div className="col-span-3 border-b border-[hsl(var(--doc-tinta))] pb-1"><span className="vx-doc-rotulo text-label">Nome</span></div>
              <div className="col-span-3 border-b border-[hsl(var(--doc-tinta))] pb-1"><span className="vx-doc-rotulo text-label">Data</span></div>
              <div className="col-span-6 mt-4 border-b border-[hsl(var(--doc-tinta))] pb-1"><span className="vx-doc-rotulo text-label">Assinatura</span></div>
            </div>
          </section>

          {/* 9. Rodapé */}
          <footer className="vx-doc-bloco mt-4 border-t border-[hsl(var(--doc-linha))] pt-2 text-label vx-doc-suave">
            <p className="font-semibold">Orçamento comercial · sem valor fiscal</p>
            <p>Documento gerado pelo Vionex CRM em {formatarDataHora(geradoEm)}</p>
            <p>Código de verificação: <span className="font-mono">{dados.token.slice(0, 8)}</span></p>
          </footer>
        </article>
      </div>

      {acoes && <div className="vx-nao-imprime mt-3 md:mx-auto md:max-w-[794px]">{acoes}</div>}
    </div>
  );
}
