import { Iniciais } from "@/components/layout/ListaV1";
import { SeloDeOrcamento } from "@/components/orcamentos/SeloDeOrcamento";
import { estadoDoOrcamento } from "@/lib/orcamento-calculo";
import { clienteDoOrcamento, codigoDoOrcamento, diasParaVencer, totalDe } from "@/lib/orcamento-resumo";
import { formatarDataCurta, formatarMoeda } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { OrcamentoComRelacoes } from "@/lib/api/orcamentos";

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
    <div className="vx-table !rounded-none !border-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th>Número</th>
            <th>Cliente</th>
            <th className="text-right">Valor</th>
            <th>Validade</th>
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
                    className="vx-control font-mono text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {codigoDoOrcamento(o.numero)}
                  </button>
                </td>
                <td>
                  <div className="flex min-w-0 items-center gap-3">
                    <Iniciais nome={nome} forma="empresa" tamanho="lg" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{apoio}</p>
                    </div>
                  </div>
                </td>
                <td className="text-right text-sm font-bold tabular-nums">
                  {formatarMoeda(totalDe(o), o.moeda)}
                </td>
                <td className={cn("whitespace-nowrap text-sm tabular-nums", urgente ? "font-medium text-warning" : "text-foreground")}>
                  {o.valido_ate ? formatarDataCurta(o.valido_ate) : "—"}
                </td>
                <td><SeloDeOrcamento orcamento={o} /></td>
                <td>
                  {dono && <span title={dono}><Iniciais nome={dono} /></span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
