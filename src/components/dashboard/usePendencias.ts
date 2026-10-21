/**
 * O que está esperando alguém agir, para o cartão "Pendências" do painel.
 *
 * Só entra pendência com FONTE no banco, e cada uma segue o critério que a tela
 * de destino já usa -- senão o cartão diria "5 atrasadas" e a tela de
 * Atividades mostraria 4:
 *
 *   atividades atrasadas  sem `completed_at` e com prazo vencido, o mesmo
 *                         `overdue` de Activities.tsx
 *   negócios parados      `deals_parados`, a função do resumo do Slack: aberto,
 *                         sem atividade há 7+ dias
 *   propostas vencendo    orçamento `enviado` que vence em até DIAS_DE_AVISO
 *                         dias, o mesmo "vence em breve" de Orçamentos
 *
 * Os leads aguardando vêm de `sdr_metrics` (`aguardandoHumano`), que o painel
 * já carrega -- não há consulta para eles aqui.
 *
 * TRÊS consultas separadas, não um Promise.all: uma falha (permissão, rede)
 * apaga só a sua linha, e as outras continuam dizendo a verdade.
 *
 * A chave mora sob o prefixo `sdr-metrics` para `invalidarPainel` e o botão de
 * atualizar alcançarem estas contagens junto com os cards.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { DIAS_DE_AVISO } from "@/lib/orcamento-resumo";
import { nomeDoContato } from "@/lib/contato-formato";
import type { ActivityType } from "@/lib/atividade-tipos";

/** O PostgREST corta em 1000 linhas; acima disso a divisão por tipo seria parcial. */
const TETO_ATIVIDADES = 1000;
/** Quantos negócios parados buscar. A contagem acima disso vira "50+". */
export const TETO_PARADOS = 50;

export type AtividadesAtrasadas = {
  total: number;
  /** null quando a amostra foi cortada: dividir por tipo só uma parte mentiria. */
  porTipo: Partial<Record<ActivityType, number>> | null;
};

export type NegocioParado = { titulo: string; contato: string; valor: number; dias: number };

export type PropostaVencendo = { id: string; nome: string; validoAte: string };

const chave = (orgId: string, qual: string) => ["sdr-metrics", orgId, "pendencias", qual] as const;

/** "AAAA-MM-DD" no fuso de quem olha -- `valido_ate` é data, não instante. */
function diaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function useAtividadesAtrasadas() {
  const { orgId } = useOrg();
  return useQuery<AtividadesAtrasadas>({
    queryKey: chave(orgId ?? "", "atividades"),
    enabled: !!orgId,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, count, error } = await supabase
        .from("activities")
        .select("type", { count: "exact" })
        .eq("org_id", orgId!)
        .is("completed_at", null)
        .lt("due_date", new Date().toISOString())
        .limit(TETO_ATIVIDADES);
      if (error) throw error;
      const linhas = (data ?? []) as { type: ActivityType }[];
      const total = count ?? linhas.length;
      if (linhas.length < total) return { total, porTipo: null };
      const porTipo: Partial<Record<ActivityType, number>> = {};
      for (const l of linhas) porTipo[l.type] = (porTipo[l.type] ?? 0) + 1;
      return { total, porTipo };
    },
  });
}

export function useNegociosParados() {
  const { orgId } = useOrg();
  return useQuery<NegocioParado[]>({
    queryKey: chave(orgId ?? "", "parados"),
    enabled: !!orgId,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("deals_parados", {
        _org_id: orgId!,
        _limite: TETO_PARADOS,
      });
      if (error) throw error;
      return (data ?? []).map((d) => ({
        titulo: d.titulo,
        contato: d.contato,
        valor: Number(d.valor) || 0,
        dias: d.dias_parado,
      }));
    },
  });
}

export function usePropostasVencendo() {
  const { orgId } = useOrg();
  return useQuery<PropostaVencendo[]>({
    queryKey: chave(orgId ?? "", "propostas"),
    enabled: !!orgId,
    refetchOnMount: "always",
    queryFn: async () => {
      const hoje = new Date();
      const ate = new Date(hoje);
      ate.setDate(ate.getDate() + DIAS_DE_AVISO);
      const { data, error } = await supabase
        .from("orcamentos")
        .select("id, numero, titulo, valido_ate, contact:contacts!orcamentos_contact_id_fkey(first_name, last_name), company:companies!orcamentos_company_id_fkey(name)")
        .eq("org_id", orgId!)
        .eq("status", "enviado")
        // Vencido hoje ainda vale: a validade cobre o dia inteiro (ver `venceu`).
        .gte("valido_ate", diaLocal(hoje))
        .lte("valido_ate", diaLocal(ate))
        .order("valido_ate", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((o) => {
        const empresa = o.company?.name?.trim();
        const contato = o.contact ? nomeDoContato(o.contact.first_name, o.contact.last_name) : null;
        return {
          id: o.id,
          nome: empresa || contato || o.titulo || `Orçamento #${o.numero}`,
          validoAte: o.valido_ate as string,
        };
      });
    },
  });
}
