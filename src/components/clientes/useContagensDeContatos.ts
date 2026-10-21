import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TABLES } from "@/lib/constants";
import { contactsKeys } from "@/hooks/queries/useContacts";

/**
 * Contagens das visões salvas de Contatos, por `count: exact, head: true`.
 *
 * `head` não traz linha nenhuma -- só o total --, então o número da aba custa
 * uma ida ao servidor e não esbarra no corte de 1000 linhas do PostgREST. As
 * contagens são da organização inteira, SEM os outros filtros da tela: a aba
 * responde "quantos há nesta visão?", e não "quantos sobraram do que filtrei".
 * A chave nasce de `contactsKeys.all`, então o realtime já a invalida.
 */
export function useContagensDeContatos(orgId: string | null | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: [...contactsKeys.all(orgId ?? ""), "contagens-das-visoes", userId ?? ""],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async () => {
      const base = () =>
        supabase.from(TABLES.CONTACTS).select("id", { count: "exact", head: true }).eq("org_id", orgId!);
      const total = async (consulta: PromiseLike<{ count: number | null; error: unknown }>) => {
        const { count, error } = await consulta;
        if (error) throw error;
        return count ?? 0;
      };
      const [todos, leads, meus, clientes] = await Promise.all([
        total(base()),
        total(base().eq("lifecycle_stage", "lead")),
        userId ? total(base().eq("owner_id", userId)) : Promise.resolve(0),
        total(base().eq("lifecycle_stage", "customer")),
      ]);
      return { todos, leads, meus, clientes };
    },
  });
}
