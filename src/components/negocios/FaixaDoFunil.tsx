import { ArrowRight } from "lucide-react";
import { FaixaDeIndicadores, Indicador } from "@/components/layout/ListaV1";
import { formatarMoeda, formatarMoedaInteira, pluralizar } from "@/lib/formato";
import type { ResumoDoFunil } from "@/components/negocios/sinais";

const nomeDoMes = new Intl.DateTimeFormat("pt-BR", { month: "long" });

/**
 * Os números do topo do funil. O cálculo e as regras de cada um moram em
 * `resumirFunil` (sinais.ts); aqui só se desenha.
 *
 * Card sem fonte SOME em vez de mostrar zero: "Previsão ponderada R$ 0" num
 * funil cujas etapas não têm probabilidade afirmaria que nada vai fechar.
 */
export function FaixaDoFunil({ resumo, onVerParados }: {
  resumo: ResumoDoFunil;
  /** Liga o filtro "parados há 14+ dias". */
  onVerParados?: () => void;
}) {
  const { aberto, ponderada, ganhosNoMes, taxa, parados14 } = resumo;
  const comValor = aberto.porEtapa.filter((e) => e.total > 0);
  const mes = nomeDoMes.format(new Date());

  return (
    <FaixaDeIndicadores>
      {/* Wrapper e não `children` do Indicador: o slot dele fica à direita do
          número, e a barra precisa ocupar a largura toda por baixo. */}
      <div className="min-w-0">
        <Indicador
          rotulo="Em aberto"
          valor={formatarMoedaInteira(aberto.total)}
          apoio={`${aberto.quantidade} ${pluralizar(aberto.quantidade, "negócio")}`}
        />
        {aberto.total > 0 && (
          <div className="-mt-2 px-4 pb-4">
            <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full"
              role="img" aria-label={comValor.map((e) => `${e.nome}: ${formatarMoeda(e.total)}`).join("; ")}>
              {comValor.map((e) => (
                <span key={e.id} title={`${e.nome}: ${formatarMoeda(e.total)}`}
                  className={e.classe} style={{ width: `${(e.total / aberto.total) * 100}%` }} />
              ))}
            </div>
            {aberto.porEtapa.length > 1 && (
              <div className="mt-1.5 flex justify-between gap-2 text-label text-muted-foreground">
                <span className="truncate">{aberto.porEtapa[0].nome}</span>
                <span className="truncate">{aberto.porEtapa[aberto.porEtapa.length - 1].nome}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {ponderada !== null && (
        <Indicador
          rotulo="Previsão ponderada"
          valor={formatarMoedaInteira(ponderada)}
          apoio="valor × chance da etapa"
        />
      )}

      <Indicador
        rotulo={`Ganhos em ${mes}`}
        valor={formatarMoedaInteira(ganhosNoMes.total)}
        tom={ganhosNoMes.total > 0 ? "sucesso" : undefined}
        apoio={ganhosNoMes.quantidade > 0
          ? `${ganhosNoMes.quantidade} ${pluralizar(ganhosNoMes.quantidade, "negócio")} · ticket ${formatarMoedaInteira(ganhosNoMes.total / ganhosNoMes.quantidade)}`
          : "pela data de fechamento"}
      />

      <div className="min-w-0">
        <Indicador
          rotulo="Taxa de ganho"
          valor={taxa ? `${taxa.percentual}%` : "—"}
          apoio={taxa
            ? `${taxa.ganhos} de ${taxa.encerrados} ${pluralizar(taxa.encerrados, "encerrado")} viraram venda`
            : "nenhum negócio encerrado ainda"}
        />
        {parados14 > 0 && onVerParados && (
          <div className="-mt-2 px-4 pb-4">
            <button type="button" onClick={onVerParados}
              className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {parados14} {pluralizar(parados14, "parado")} há 14+ dias
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </FaixaDeIndicadores>
  );
}
