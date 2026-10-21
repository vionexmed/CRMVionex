import { ChipAdicionarFiltro, ChipDeFiltro, LinhaDeFiltros } from "@/components/layout/ListaV1";
import type { DealFilters } from "@/components/crm/DealsFilters";
import type { FiltroDeSinal } from "@/components/negocios/sinais";
import { formatarData, formatarMoedaInteira } from "@/lib/formato";

/**
 * A linha de chips acima do quadro.
 *
 * Cada filtro ligado no painel completo (`DealsFilters`) aparece aqui como chip
 * removível. Antes o painel abria e fechava por um botão, e com ele fechado
 * nada na tela dizia que o quadro estava filtrado -- um funil "vazio" podia ser
 * só um valor mínimo esquecido.
 *
 * Os dois chips de SINAL ("Atividade atrasada", "Parados há 7+ dias") só
 * existem onde há como calculá-los: precisam das atividades embutidas, que só
 * a consulta completa do quadro traz. Na lista paginada eles somem em vez de
 * filtrar só a página visível.
 *
 * Campo a campo, sem espalhar `filters` em chips genéricos: renomear uma chave
 * de DealFilters precisa dar erro de tipo aqui (CLAUDE.md).
 */
export function ChipsDoFunil({
  filtros, onFiltros, membros, sinais, onSinais, onAbrirFiltros,
}: {
  filtros: DealFilters;
  onFiltros: (f: DealFilters) => void;
  membros: { id: string; name: string | null; email: string | null }[];
  /** Ausente: os chips de sinal não aparecem. */
  sinais?: FiltroDeSinal;
  onSinais?: (s: FiltroDeSinal) => void;
  onAbrirFiltros: () => void;
}) {
  const dono = filtros.ownerId ? membros.find((m) => m.id === filtros.ownerId) : null;
  const sem = (campo: keyof DealFilters) => () => onFiltros({ ...filtros, [campo]: undefined });

  return (
    <LinhaDeFiltros>
      {filtros.ownerId ? (
        <ChipDeFiltro ativo onClick={onAbrirFiltros} onRemover={sem("ownerId")} rotuloRemover="Remover filtro de responsável">
          Responsável: {dono?.name || dono?.email || "—"}
        </ChipDeFiltro>
      ) : (
        <ChipDeFiltro onClick={onAbrirFiltros}>Responsável: todos</ChipDeFiltro>
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
          <ChipDeFiltro ativo={sinais.atrasada} onClick={() => onSinais({ ...sinais, atrasada: !sinais.atrasada })}>
            Atividade atrasada
          </ChipDeFiltro>
          {/* O link "parados há 14+ dias" da faixa liga este mesmo filtro com
              14; o chip mostra o número que está valendo, e desliga. */}
          <ChipDeFiltro ativo={sinais.paradosHa !== null}
            onClick={() => onSinais({ ...sinais, paradosHa: sinais.paradosHa === null ? 7 : null })}>
            Parados há {sinais.paradosHa ?? 7}+ dias
          </ChipDeFiltro>
        </>
      )}

      <ChipAdicionarFiltro onClick={onAbrirFiltros} />
    </LinhaDeFiltros>
  );
}
