/**
 * Os indicadores do painel: o que cada um mede, em que grupo mora e por que
 * (ou por que não) tem fonte de dado. A tela só desenha; as regras de métrica
 * ficam aqui e em `useSdrMetrics`.
 */
import type { LucideIcon } from "lucide-react";
import { UserPlus, MessageCircle, Instagram, Globe, Linkedin, Send, CheckCheck, Reply, MessagesSquare, CalendarCheck, Briefcase, Trophy, Sparkles, Timer, Hourglass, UserCheck } from "lucide-react";
import type { StatAccent, StatFormat } from "./StatCard";
import type { MetricKey } from "@/hooks/useSdrMetrics";
import type { MetricDrilldownKey } from "@/hooks/useSdrMetricLeads";

export type TileConfig = {
  key: MetricKey;
  label: string;
  /** Rótulo na faixa de destaque, onde o espaço é de um quarto de cartão. */
  rotuloCurto?: string;
  icon: LucideIcon;
  accent?: StatAccent;
  format?: StatFormat;
  href?: string;
  hint?: string;
  noSource?: boolean;
  noComparison?: boolean;
  /** Métrica com lista por trás do número. Ver useSdrMetricLeads. */
  drilldown?: MetricDrilldownKey;
};

export type Group = { title: string; description: string; tiles: TileConfig[] };

export const GROUPS: Group[] = [
  {
    title: "Entrada",
    description: "De onde e quanto lead está chegando",
    tiles: [
      {
        key: "leadsRecebidos", label: "Leads recebidos", icon: UserPlus, accent: "primary", href: "/contacts?estagio=lead", drilldown: "leadsRecebidos",
        hint: "Contatos criados no período. Conta por data de criação, não por status — a qualificação sobrescreve lead → prospect e apagaria o histórico.",
      },
      {
        key: "leadsWhatsapp", label: "Leads WhatsApp", icon: MessageCircle, accent: "success", href: "/contacts?estagio=lead",
        hint: "Leads criados no período que nos escreveram por WhatsApp. Derivado das mensagens recebidas — o webhook não grava a origem no contato.",
      },
      {
        key: "leadsInstagram", label: "Leads Instagram", icon: Instagram, noSource: true,
        hint: "Sem fonte: nada no sistema grava Instagram como origem. A classificação atual agrupa Instagram dentro de \"Meta Ads\", e a integração de anúncios não cria contato.",
      },
      {
        key: "leadsGoogle", label: "Leads Google", icon: Globe, noSource: true,
        hint: "Sem fonte: não existe integração com Google Ads, e nenhuma entrada garante utm_source=google.",
      },
      {
        key: "leadsLinkedin", label: "Leads LinkedIn", icon: Linkedin, noSource: true,
        hint: "Sem fonte: o campo de LinkedIn no contato é o perfil dele, não a origem do lead. Não há integração nem valor de origem para LinkedIn.",
      },
    ],
  },
  {
    title: "Abordagem",
    description: "O que saiu para o lead e o que voltou",
    tiles: [
      {
        key: "abordagens", label: "Abordagens realizadas", rotuloCurto: "Abordagens", icon: Send, accent: "primary", href: "/activities", drilldown: "abordagens",
        hint: "Tentativas de contato que de fato saíram: ligação e e-mail registrados como concluídos, e-mail enviado pelo CRM, e WhatsApp aceito pela Meta. REUNIÃO NÃO ENTRA — ela é o resultado de abordar, não a abordagem, e tem card próprio. Agendada e não feita não conta, e tentativa que falhou também não.",
      },
      {
        key: "taxaEntrega", label: "Taxa de entrega", icon: CheckCheck, accent: "success", format: "percent",
        hint: "Mensagens de WhatsApp entregues ou lidas sobre o total enviado, pelos callbacks da Meta. Cobre só WhatsApp: e-mail não tem captura de bounce, e envio que falha é apagado do registro.",
      },
      {
        key: "taxaResposta", label: "Taxa de resposta", icon: Reply, accent: "success", format: "percent", drilldown: "taxaResposta",
        hint: "Leads que responderam depois de serem abordados, sobre os abordados no período — por WhatsApp. Resposta que chega fora da janela do período não é contada.",
      },
      {
        key: "conversasIniciadas", label: "Conversas iniciadas", icon: MessagesSquare, accent: "primary", href: "/atendimento?canal=whatsapp",
        hint: "Contatos distintos com pelo menos uma mensagem de WhatsApp no período. Não existe entidade de conversa no banco — é derivado por contato.",
      },
    ],
  },
  {
    title: "Conversão",
    description: "O que a abordagem produziu",
    tiles: [
      {
        key: "reunioes", label: "Reuniões geradas", icon: CalendarCheck, accent: "primary", href: "/activities",
        hint: "Reuniões concluídas no período, pela data da conclusão. Depende de alguém registrar: nada cria reunião automaticamente e não há integração de agenda.",
      },
      {
        key: "oportunidades", label: "Oportunidades geradas", rotuloCurto: "Oportunidades", icon: Briefcase, accent: "primary", href: "/deals", drilldown: "oportunidades",
        hint: "Negócios que SAÍRAM da etapa de entrada. Como todo contato passa a entrar no funil automaticamente, estar nele é o padrão — o feito é ter avançado. Estar no funil não conta como oportunidade.",
      },
      {
        key: "vendasSdr", label: "Vendas originadas pelo SDR", icon: Trophy, accent: "success", href: "/deals",
        hint: "Negócios ganhos com contato vinculado, pela data de fechamento. É aproximação: o negócio não guarda quem o originou, e ganho sem data de fechamento não entra.",
      },
      {
        key: "qualificadosIA", label: "Leads qualificados pela IA", icon: Sparkles, noSource: true,
        hint: "Sem fonte: a qualificação existe, mas só é disparada por clique humano. As funções de IA do CRM devolvem texto e não gravam nada — falta registrar quem qualificou.",
      },
    ],
  },
  {
    title: "Operação",
    description: "Velocidade e fila de atendimento",
    tiles: [
      {
        key: "tempoRespostaMin", label: "Tempo médio de resposta", icon: Timer, accent: "warning", format: "duration",
        hint: "Do momento em que o lead escreve até a nossa primeira resposta, por WhatsApp. É a única fonte com direção e horário de servidor confiáveis. Cair é bom.",
      },
      {
        key: "aguardandoHumano", label: "Aguardando atendimento", icon: Hourglass, accent: "destructive", href: "/contacts?estagio=lead", noComparison: true,
        hint: "Leads sem nenhuma abordagem registrada: nenhuma atividade, nenhum e-mail, nenhuma mensagem. É a fila do momento, por isso não compara com o período anterior.",
      },
      {
        key: "transferidosHumano", label: "Transferidos para humano", icon: UserCheck, noSource: true,
        hint: "Sem fonte: não existe registro de passagem de bastão. Os campos que serviriam para isso foram removidos do banco numa migração anterior.",
      },
    ],
  },
];
