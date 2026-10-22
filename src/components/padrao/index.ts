/**
 * Componentes compartilhados do padrão da plataforma. As telas importam daqui
 * (`@/components/padrao`) em vez de remontar barra, tabela, kanban e painel.
 */
export { Pagina, type PaginaProps } from "./Pagina";
export { BarraDeFerramentas, textoDeContagem, type BarraDeFerramentasProps } from "./BarraDeFerramentas";
export {
  BotaoTracejado,
  SeletorTracejado,
  BotaoDeIcone,
  type BotaoTracejadoProps,
  type SeletorTracejadoProps,
  type BotaoDeIconeProps,
} from "./Controles";
export type { Opcao } from "./MenuDeOpcoes";
export { ChipDeEstado, type ChipDeEstadoProps } from "./ChipDeEstado";
export { TabelaDeCartoes, type TabelaDeCartoesProps, type CabecalhoProps, type LinhaProps } from "./TabelaDeCartoes";
export {
  CelulaDeNome,
  SeloDeTipo,
  Metrica,
  AnelDeContagem,
  MenuDeLinha,
  corPastel,
  type CelulaDeNomeProps,
  type SeloDeTipoProps,
  type MetricaProps,
  type AnelDeContagemProps,
  type MenuDeLinhaProps,
  type AcaoDeLinha,
} from "./CelulasDeTabela";
export {
  ColunaKanban,
  NovaColuna,
  textoDeNegocios,
  type ColunaKanbanProps,
  type NovaColunaProps,
  type CorDaEtapa,
} from "./ColunaKanban";
export { CartaoDeIndicador, GradeDeIndicadores, type CartaoDeIndicadorProps } from "./Indicadores";
export { AbasSegmentadas, type AbasSegmentadasProps, type AbaSegmentada } from "./AbasSegmentadas";
export { SeletorDePeriodo, formatarIntervalo, type SeletorDePeriodoProps, type Periodo } from "./SeletorDePeriodo";
export { CartaoDeGrafico, EstadoVazio, type CartaoDeGraficoProps, type EstadoVazioProps } from "./CartaoDeGrafico";
