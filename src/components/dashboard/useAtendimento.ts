/**
 * Os dados do "Atendimento agora" e da primeira linha de Pendências que não
 * vêm de `sdr_metrics`: quem está na fila, a meta de resposta e o movimento
 * por hora.
 *
 * Nenhum deles tem função SQL própria, e a migração nova não chega junto com o
 * frontend (ver CLAUDE.md, "Edge function precisa de deploy manual" -- vale para
 * migração também). Então cada um é derivado de tabela que já existe, com o
 * MESMO critério do número que acompanha:
 *
 *   leads aguardando  o `aguardando_humano` de sdr_metrics: lead ou contatado,
 *                     sem atividade, sem e-mail enviado, sem WhatsApp enviado.
 *                     Aqui só se buscam os mais antigos, para as iniciais e o
 *                     "espera há" -- a CONTAGEM continua vindo do card.
 *   meta de resposta  `organizations.settings.meta_resposta_min`, editada em
 *                     Configurações > Geral. Ausente = sem meta, e a tela não
 *                     inventa uma.
 *   por hora          mensagens de WhatsApp RECEBIDAS no período, pela hora
 *                     local. É a demanda: quando os leads escrevem.
 *
 * As chaves moram sob `sdr-metrics` para `invalidarPainel` e o botão de
 * atualizar alcançarem tudo junto com os cards.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { getSdrRanges, type SdrPeriod } from "@/hooks/useSdrMetrics";
import { buscarEmBlocos } from "@/lib/paginar";
import { nomeDoContato } from "@/lib/contato-formato";
import { pluralizar } from "@/lib/formato";

const chave = (orgId: string, qual: string, ...resto: string[]) =>
  ["sdr-metrics", orgId, "atendimento", qual, ...resto] as const;

export type LeadAguardando = { id: string; nome: string; desde: string };

/** Quantos nomes o cartão mostra antes do "+N". */
export const NOMES_NA_FILA = 3;
/** Lote por consulta. `.in()` com 100 UUIDs ainda cabe folgado na URL. */
const LOTE = 100;
/** Teto de lotes: a fila do card é número; aqui só se procuram os primeiros. */
const MAX_LOTES = 5;

/**
 * Os leads mais antigos sem nenhuma abordagem.
 *
 * O PostgREST não faz NOT EXISTS, então a busca é em duas etapas: candidatos
 * por ordem de chegada e, para eles, quem já tem algum toque. Para assim que
 * junta NOMES_NA_FILA -- quase sempre no primeiro lote.
 */
export function useLeadsAguardando(ativo: boolean) {
  const { orgId } = useOrg();
  return useQuery<LeadAguardando[]>({
    queryKey: chave(orgId ?? "", "fila"),
    enabled: !!orgId && ativo,
    refetchOnMount: "always",
    queryFn: async () => {
      const achados: LeadAguardando[] = [];
      for (let lote = 0; lote < MAX_LOTES && achados.length < NOMES_NA_FILA; lote++) {
        const { data, error } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, created_at")
          .eq("org_id", orgId!)
          .in("lifecycle_stage", ["lead", "contacted"])
          .order("created_at", { ascending: true })
          .range(lote * LOTE, lote * LOTE + LOTE - 1);
        if (error) throw error;
        const candidatos = data ?? [];
        if (candidatos.length === 0) break;
        const ids = candidatos.map((c) => c.id);

        // Três consultas, os mesmos três NOT EXISTS de sdr_metrics.
        const [atv, eml, wa] = await Promise.all([
          supabase.from("activities").select("contact_id").in("contact_id", ids),
          supabase.from("emails").select("contact_id").eq("direction", "outbound").in("contact_id", ids),
          supabase.from("whatsapp_messages").select("contact_id").eq("direction", "outbound").in("contact_id", ids),
        ]);
        for (const r of [atv, eml, wa]) if (r.error) throw r.error;
        const tocados = new Set(
          [...(atv.data ?? []), ...(eml.data ?? []), ...(wa.data ?? [])].map((l) => l.contact_id),
        );
        for (const c of candidatos) {
          if (tocados.has(c.id) || !c.created_at) continue;
          achados.push({ id: c.id, nome: nomeDoContato(c.first_name, c.last_name), desde: c.created_at });
          if (achados.length >= NOMES_NA_FILA) break;
        }
        if (candidatos.length < LOTE) break;
      }
      return achados;
    },
  });
}

/** Lê a meta só se for inteiro positivo: qualquer outra coisa é "sem meta". */
export function lerMetaResposta(settings: unknown): number | null {
  if (!settings || typeof settings !== "object") return null;
  const v = (settings as Record<string, unknown>).meta_resposta_min;
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
}

export function useMetaResposta() {
  const { orgId } = useOrg();
  return useQuery<number | null>({
    queryKey: chave(orgId ?? "", "meta"),
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return lerMetaResposta(data?.settings);
    },
  });
}

/** Janela mínima do gráfico por hora: o expediente comercial. */
export const HORA_INICIO = 8;
export const HORA_FIM = 16;

/**
 * Conta por hora e decide a janela: o expediente, alargado para a hora fora
 * dele que tenha movimento de verdade (ao menos 1/5 do pico). Uma mensagem
 * solta às 3h não deve espremer as barras do dia; um plantão noturno cheio, sim.
 */
export function agruparPorHora(instantes: string[]): { hora: number; total: number }[] {
  const porHora = new Array<number>(24).fill(0);
  for (const s of instantes) {
    const h = new Date(s).getHours();
    if (!Number.isNaN(h)) porHora[h]++;
  }
  let ini = HORA_INICIO;
  let fim = HORA_FIM; // exclusivo: "16h" é o fim da última barra
  const pico = Math.max(...porHora);
  porHora.forEach((n, h) => {
    if (n === 0 || n <= pico / 5) return;
    ini = Math.min(ini, h);
    fim = Math.max(fim, h + 1);
  });
  return Array.from({ length: fim - ini }, (_, i) => ({ hora: ini + i, total: porHora[ini + i] }));
}

/**
 * Mensagens recebidas no período, por hora do dia.
 *
 * Lê a tabela, e não uma função agregada -- não existe uma. A consequência é
 * que conta o que a RLS deixa a pessoa ver; para o dono e o admin, é tudo.
 */
export function useMensagensPorHora(period: SdrPeriod) {
  const { orgId } = useOrg();
  return useQuery<{ hora: number; total: number }[]>({
    queryKey: chave(orgId ?? "", "por-hora", period),
    enabled: !!orgId,
    refetchOnMount: "always",
    queryFn: async () => {
      const { current } = getSdrRanges(period);
      const linhas = await buscarEmBlocos<{ created_at: string | null }>((de, ate) => {
        let q = supabase
          .from("whatsapp_messages")
          .select("created_at")
          .eq("org_id", orgId!)
          .eq("direction", "inbound");
        if (current.start) q = q.gte("created_at", current.start.toISOString());
        if (current.end) q = q.lt("created_at", current.end.toISOString());
        return q.order("created_at", { ascending: true }).range(de, ate);
      }, { teto: 20_000 });
      return agruparPorHora(linhas.map((l) => l.created_at).filter((s): s is string => !!s));
    },
  });
}

/** "42 min", "3 h", "5 dias": quanto tempo o mais antigo da fila espera. */
export function tempoDeEspera(desde: string, agora: Date = new Date()): string {
  const min = Math.max(0, Math.floor((agora.getTime() - new Date(desde).getTime()) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} ${pluralizar(d, "dia")}`;
}
