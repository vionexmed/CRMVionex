import { Iniciais, iniciais } from "@/components/layout/ListaV1";
import { SeloDeOrcamento } from "@/components/orcamentos/SeloDeOrcamento";
import { estadoDoOrcamento } from "@/lib/orcamento-calculo";
import { clienteDoOrcamento, codigoDoOrcamento, diasParaVencer, totalDe } from "@/lib/orcamento-resumo";
import { formatarMoedaInteira } from "@/lib/formato";
import { dataCurtaSemPonto } from "@/lib/orcamento-resumo";
import { cn } from "@/lib/utils";
import type { OrcamentoComRelacoes } from "@/lib/api/orcamentos";

/**
 * Cada responsável com a sua tinta, para o olho achar "as do Bruno" sem ler. A
 * tinta sai do NOME (soma dos códigos), e não da posição na lista: trocar a
 * ordem dos membros não pode recolorir ninguém.
 */
const TINTAS = [
  "bg-secondary text-neutral [&]:text-label",
  "bg-accent text-accent-foreground [&]:text-label",
  "bg-success-soft text-success [&]:text-label",
  "bg-warning-soft text-warning [&]:text-label",
];
export function tintaDe(nome: string): string {
  return TINTAS[iniciais(nome).charCodeAt(0) % TINTAS.length];
}

/**
 * A tabela do V1 para orçamentos, md em diante.
 *
 * A linha INTEIRA é o botão de abrir: `onClick` na `<tr>` serviria o mouse e
 * deixaria o teclado de fora, então o conteúdo da primeira célula é o botão e
 * a `<tr>` só repete o clique para a área grande.
 */
export function TabelaDeOrcamentos({
  orcamentos, selecionadoId, aoAbrir, nomeDoResponsavel,
}: {
  orcamentos: OrcamentoComRelacoes[];
  selecionadoId?: string | null;
  aoAbrir: (o: OrcamentoComRelacoes) => void;
  nomeDoResponsavel: (id: string | null) => string | null;
}) {
  return (
    <div className="vx-table min-h-0 overflow-auto !rounded-none !border-0 [--row-h:52px] [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:!h-10 [&_tbody_td]:!py-[7px]">
      <table className="w-full table-fixed [&_td]:whitespace-nowrap">
        {/* Larguras fixas: com layout automático a coluna do cliente engolia o
            espaço e empurrava Situação e responsável para fora do cartão. */}
        <colgroup>
          <col className="w-[13.1%]" /><col className="w-[33.3%]" /><col className="w-[13.5%]" />
          <col className="w-[12.5%]" /><col className="w-[20.4%]" /><col className="w-[7.2%]" />
        </colgroup>
        <thead>
          <tr className="text-left">
            <th>Número</th>
            <th>Cliente</th>
            <th className="text-right">Valor</th>
            <th className="!pl-4">Validade</th>
            <th>Situação</th>
            <th aria-label="Responsável" />
          </tr>
        </thead>
        <tbody>
          {orcamentos.map((o) => {
            const { nome, apoio } = clienteDoOrcamento(o);
            const aberto = estadoDoOrcamento(o) === "enviado";
            const dias = aberto ? diasParaVencer(o.valido_ate) : null;
            const urgente = dias !== null && dias <= 2;
            const dono = nomeDoResponsavel(o.owner_id);
            return (
              <tr
                key={o.id}
                onClick={() => aoAbrir(o)}
                aria-selected={o.id === selecionadoId}
                className={cn("cursor-pointer", o.id === selecionadoId && "[&>td]:bg-accent")}
              >
                <td>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); aoAbrir(o); }}
                    className="vx-control whitespace-nowrap font-mono text-xs text-foreground/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {codigoDoOrcamento(o.numero)}
                  </button>
                </td>
                <td>
                  <div className="flex min-w-0 items-center gap-3">
                    <Iniciais nome={nome.split(/\s+/).slice(0, 2).join(" ")} forma="empresa" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{apoio}</p>
                    </div>
                  </div>
                </td>
                <td className="text-right font-bold tabular-nums">
                  {formatarMoedaInteira(totalDe(o), o.moeda)}
                </td>
                <td className={cn("whitespace-nowrap !pl-4 tabular-nums", urgente ? "font-medium text-warning" : "text-foreground")}>
                  {o.valido_ate ? dataCurtaSemPonto(o.valido_ate) : "—"}
                </td>
                <td><SeloDeOrcamento orcamento={o} /></td>
                <td>
                  {dono && <span title={dono}><Iniciais nome={dono} tamanho="sm" className={tintaDe(dono)} /></span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
