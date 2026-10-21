import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { contactsKeys } from "@/hooks/queries/useContacts";

/** O que a coluna "Próxima atividade" precisa saber de cada contato da página. */
export type ProximaDoContato = {
  /** Próxima atividade NÃO concluída (a de vencimento mais próximo). */
  atividade: { titulo: string; vence: Date | null } | null;
  /** A última mensagem do WhatsApp é do contato e ninguém respondeu. */
  aguardando: boolean;
};

/**
 * Próxima atividade e "aguardando atendimento" dos contatos da PÁGINA.
 *
 * Consulta só pelos ids visíveis (≤ 50): baixar as atividades da organização
 * inteira esbarraria no corte silencioso de 1000 linhas do PostgREST e a coluna
 * mentiria "Sem atividade" para quem estivesse além dele.
 *
 * Pendente é `completed_at IS NULL`: a atividade guarda a intenção e a conclusão
 * em campos separados, e é a conclusão que conta.
 */
export function useProximasAtividades(orgId: string | null | undefined, contactIds: string[]) {
  const chave = [...contactIds].sort().join(",");
  return useQuery({
    queryKey: [...contactsKeys.all(orgId ?? ""), "proximas-atividades", chave],
    enabled: !!orgId && contactIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const [atv, msgs] = await Promise.all([
        supabase.from("activities")
          .select("contact_id,title,due_date")
          .eq("org_id", orgId!)
          .in("contact_id", contactIds)
          .is("completed_at", null)
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(1000),
        supabase.from("whatsapp_messages")
          .select("contact_id,direction,created_at")
          .eq("org_id", orgId!)
          .in("contact_id", contactIds)
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);
      if (atv.error) throw atv.error;
      if (msgs.error) throw msgs.error;

      const mapa = new Map<string, ProximaDoContato>();
      const get = (id: string) => {
        let r = mapa.get(id);
        if (!r) { r = { atividade: null, aguardando: false }; mapa.set(id, r); }
        return r;
      };
      // Já vem ordenada: a primeira de cada contato é a mais próxima.
      for (const a of atv.data ?? []) {
        if (!a.contact_id) continue;
        const r = get(a.contact_id);
        if (!r.atividade) r.atividade = { titulo: a.title, vence: a.due_date ? new Date(a.due_date) : null };
      }
      // Mais recente primeiro: a primeira mensagem de cada contato decide.
      const vistos = new Set<string>();
      for (const m of msgs.data ?? []) {
        if (!m.contact_id || vistos.has(m.contact_id)) continue;
        vistos.add(m.contact_id);
        if (m.direction === "inbound") get(m.contact_id).aguardando = true;
      }
      return mapa;
    },
  });
}
