import { ChipDeFiltro } from "@/components/layout/ListaV1";
import type { DealFilters } from "@/components/crm/DealsFilters";
import type { FiltroDeSinal } from "@/components/negocios/sinais";
import { formatarData, formatarMoedaInteira } from "@/lib/formato";
import { contarFiltrosAtivos } from "@/components/negocios/ordem-e-intervalo";

/**
 * Os filtros LIGADOS, como chips removíveis ao lado de "Ordenação" e
 * "Intervalo". O painel completo abre pelo botão "Filtros" da barra; com ele
 * fechado, são estes chips que dizem que o quadro está filtrado -- um funil
 * "vazio" pode ser só um valor mínimo esquecido.
 *
 * Nada ligado, nada aparece: a linha fica só com os chips de estado, como no
 * padrão da plataforma.
 *
 * Campo a campo, sem espalhar `filters` em chips genéricos: renomear uma chave
 * de DealFilters precisa dar erro de tipo aqui (CLAUDE.md).
 */
export function ChipsDoFunil({
  filtros, onFiltros, membros, sinais, onSinais, onAbrirFiltros, onLimparTudo,
}: {
  filtros: DealFilters;
  onFiltros: (f: DealFilters) => void;
  membros: { id: string; name: string | null; email: string | null }[];
  /** Ausente: os chips de sinal não aparecem. */
  sinais?: FiltroDeSinal;
  onSinais?: (s: FiltroDeSinal) => void;
  onAbrirFiltros: () => void;
  onLimparTudo: () => void;
}) {
  const dono = filtros.ownerId ? membros.find((m) => m.id === filtros.ownerId) : null;
  const sem = (campo: keyof DealFilters) => () => onFiltros({ ...filtros, [campo]: undefined });
  const total = contarFiltrosAtivos(filtros, sinais && onSinais ? sinais : undefined);
  if (total === 0) return null;

  return (
    <>
      {filtros.ownerId && (
        <ChipDeFiltro ativo onClick={onAbrirFiltros} onRemover={sem("ownerId")} rotuloRemover="Remover filtro de responsável">
          Responsável: {dono?.name || dono?.email || "—"}
        </ChipDeFiltro>
      )}
      {filtros.minValue !== undefined && (
        <ChipDeFiltro ativo onRemover={sem("minValue")} rotuloRemover="Remover valor mínimo">
          A partir de {formatarMoedaInteira(filtros.minValue)}
        </ChipDeFiltro>
      )}
      {filtros.maxValue !== undefined && (
        <ChipDeFiltro ativo onRemover={sem("maxValue")} rotuloRemover="Remover valor máximo">
          Até {formatarMoedaInteira(filtros.maxValue)}
        </ChipDeFiltro>
      )}
      {filtros.closeDateFrom && (
        <ChipDeFiltro ativo onRemover={sem("closeDateFrom")} rotuloRemover="Remover início do fechamento">
          Fecha a partir de {formatarData(filtros.closeDateFrom)}
        </ChipDeFiltro>
      )}
      {filtros.closeDateTo && (
        <ChipDeFiltro ativo onRemover={sem("closeDateTo")} rotuloRemover="Remover fim do fechamento">
          Fecha até {formatarData(filtros.closeDateTo)}
        </ChipDeFiltro>
      )}

      {sinais && onSinais && (
        <>
          {sinais.quentes && (
            <ChipDeFiltro ativo onRemover={() => onSinais({ ...sinais, quentes: false })} rotuloRemover="Remover filtro de quentes">
              Quentes
            </ChipDeFiltro>
          )}
          {sinais.atrasada && (
            <ChipDeFiltro ativo onRemover={() => onSinais({ ...sinais, atrasada: false })} rotuloRemover="Remover filtro de atividade atrasada">
              Atividade atrasada
            </ChipDeFiltro>
          )}
          {/* O link "parados há 14+ dias" do resumo liga este mesmo filtro com
              14; o chip mostra o número que está valendo. */}
          {sinais.paradosHa !== null && (
            <ChipDeFiltro ativo onRemover={() => onSinais({ ...sinais, paradosHa: null })} rotuloRemover="Remover filtro de parados">
              Parados há {sinais.paradosHa}+ dias
            </ChipDeFiltro>
          )}
        </>
      )}

      {total > 1 && (
        <button type="button" onClick={onLimparTudo}
          className="inline-flex h-8 items-center rounded-full px-2 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Limpar filtros
        </button>
      )}
    </>
  );
}

/**
 * Os SINAIS dentro do painel de filtros: liga e desliga "Quentes", "Atividade
 * atrasada" e "Parados há 7+ dias". Só existem onde há como calculá-los --
 * precisam das atividades embutidas, que só a consulta completa do quadro traz.
 */
export function SinaisDoFunil({ sinais, onSinais }: {
  sinais: FiltroDeSinal;
  onSinais: (s: FiltroDeSinal) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sinais">
      {/* `deals.temperatura`, a avaliação do vendedor. Sem a coluna no banco o
          chip não aparece: filtraria tudo para fora. */}
      {sinais.quentes !== undefined && (
        <ChipDeFiltro ativo={sinais.quentes} onClick={() => onSinais({ ...sinais, quentes: !sinais.quentes })}>
          Quentes
        </ChipDeFiltro>
      )}
      <ChipDeFiltro ativo={sinais.atrasada} onClick={() => onSinais({ ...sinais, atrasada: !sinais.atrasada })}>
        Atividade atrasada
      </ChipDeFiltro>
      <ChipDeFiltro ativo={sinais.paradosHa !== null}
        onClick={() => onSinais({ ...sinais, paradosHa: sinais.paradosHa === null ? 7 : null })}>
        Parados há {sinais.paradosHa ?? 7}+ dias
      </ChipDeFiltro>
    </div>
  );
}
