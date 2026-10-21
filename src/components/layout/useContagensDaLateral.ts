import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";

/**
 * Os números ao lado dos itens da lateral e o nome da organização no topo.
 *
 * TRÊS consultas independentes: a lateral aparece em toda tela, e uma falha
 * (rede, coluna ainda não migrada) tem de apagar só o seu número -- nunca a
 * navegação. Por isso cada uma devolve `null` em vez de lançar, e `null` quer
 * dizer "não mostra selo", não "zero".
 *
 * Sem realtime de propósito: uma assinatura por aba em `activities` e
 * `whatsapp_messages` da organização inteira, para desenhar dois números, custa
 * mais do que vale. O intervalo de 60s é o mesmo do sininho, e as chaves moram
 * sob os prefixos que as telas já invalidam ao mexer (`activities`,
 * `atendimento`), então concluir uma atividade atualiza o selo na hora.
 */
const MINUTO = 60_000;

/**
 * Atividades atrasadas da ORGANIZAÇÃO, com o mesmo critério do cartão
 * "Pendências" do painel (sem `completed_at`, prazo vencido). Critério diferente
 * faria a lateral dizer 5 e o painel dizer 3 na mesma tela.
 */
export function useAtrasadasDaLateral() {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: ["activities", orgId ?? "", "lateral-atrasadas"],
    enabled: !!orgId,
    refetchInterval: MINUTO,
    queryFn: async (): Promise<number | null> => {
      const { count, error } = await supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId!)
        .is("completed_at", null)
        .lt("due_date", new Date().toISOString());
      return error ? null : count ?? 0;
    },
  });
}

/**
 * Mensagens de WhatsApp RECEBIDAS que ninguém abriu (`lida_em` nulo).
 *
 * A coluna nasce na migração 20261021120000. Enquanto ela não estiver aplicada
 * o PostgREST responde 42703, e o selo some em vez de mostrar um número
 * inventado.
 */
export function useNaoLidasDaLateral() {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: ["atendimento", orgId ?? "", "lateral-nao-lidas"],
    enabled: !!orgId,
    refetchInterval: MINUTO,
    retry: false,
    queryFn: async (): Promise<number | null> => {
      const { count, error } = await supabase
        .from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId!)
        .eq("direction", "inbound")
        .is("lida_em", null);
      return error ? null : count ?? 0;
    },
  });
}

/** Rótulo do plano como a cobrança o chama; valor desconhecido sai como veio. */
const PLANOS: Record<string, string> = { free: "Free", pro: "Pro", enterprise: "Enterprise" };

export type OrganizacaoDaLateral = { nome: string; detalhe: string | null };

/**
 * "Vionex" e "Clínicas · Plano Pro": o nome da organização, o segmento escolhido
 * no cadastro da empresa (`settings.segment`) e o plano. Só o que existe entra;
 * sem nenhum dos dois, o detalhe fica nulo e quem desenha decide o substituto.
 */
export function useOrganizacaoDaLateral() {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: ["organizacao-lateral", orgId ?? ""],
    enabled: !!orgId,
    staleTime: 10 * MINUTO,
    queryFn: async (): Promise<OrganizacaoDaLateral | null> => {
      const { data, error } = await supabase
        .from("organizations")
        .select("name, plan, settings")
        .eq("id", orgId!)
        .maybeSingle();
      if (error || !data) return null;
      const settings = (data.settings ?? {}) as { segment?: unknown };
      const segmento = typeof settings.segment === "string" && settings.segment.trim() ? settings.segment.trim() : null;
      const plano = data.plan ? `Plano ${PLANOS[data.plan] ?? data.plan}` : null;
      const detalhe = [segmento, plano].filter(Boolean).join(" · ") || null;
      return { nome: data.name, detalhe };
    },
  });
}
