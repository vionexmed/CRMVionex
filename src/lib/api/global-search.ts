import { supabase } from "@/integrations/supabase/client";
import { mensagemErro } from "@/lib/erro-supabase";
import { nomeDoContato } from "@/lib/contato-formato";
import { formatarMoedaInteira } from "@/lib/formato";

export type SearchResult = { id: string; kind: "contact" | "company" | "deal"; title: string; subtitle?: string; href: string };
export type SearchCategory = "contacts" | "companies" | "deals";
export type EntitySearch = Record<SearchCategory, SearchResult[]> & { errors?: Partial<Record<SearchCategory, string>> };

/** imatch evita o alias * de LIKE. Primeiro escapa regex, depois a string PostgREST. */
function literalFilter(fields: string[], term: string) {
  const literal = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const quoted = JSON.stringify(literal);
  return fields.map((field) => `${field}.imatch.${quoted}`).join(",");
}

export async function searchEntities(orgId: string, term: string, signal?: AbortSignal): Promise<EntitySearch> {
  const text = term.trim().slice(0, 200);
  const result: EntitySearch = { contacts: [], companies: [], deals: [] };
  if (!orgId || text.length < 2) return result;
  if (signal?.aborted) throw new DOMException("Busca cancelada", "AbortError");

  const contacts = supabase.from("contacts").select("id, first_name, last_name, email")
    .eq("org_id", orgId).or(literalFilter(["first_name", "last_name", "email"], text))
    .order("first_name").order("id").limit(5);
  const companies = supabase.from("companies").select("id, name, domain")
    .eq("org_id", orgId).or(literalFilter(["name", "domain"], text))
    .order("name").order("id").limit(5);
  const deals = supabase.from("deals").select("id, title, value")
    .eq("org_id", orgId).or(literalFilter(["title"], text))
    .order("title").order("id").limit(5);
  if (signal) { contacts.abortSignal(signal); companies.abortSignal(signal); deals.abortSignal(signal); }

  const settled = await Promise.allSettled([contacts, companies, deals]);
  if (signal?.aborted) throw new DOMException("Busca cancelada", "AbortError");
  const categories: SearchCategory[] = ["contacts", "companies", "deals"];
  settled.forEach((response, index) => {
    const error = response.status === "rejected" ? response.reason : response.value.error;
    if (error) (result.errors ??= {})[categories[index]] = mensagemErro(error);
  });
  const [c, co, d] = settled;
  if (c.status === "fulfilled" && !c.value.error) result.contacts = (c.value.data ?? []).map((row) => ({
    id: row.id, kind: "contact", title: nomeDoContato(row.first_name, row.last_name), subtitle: row.email ?? undefined,
    href: `/contacts?id=${encodeURIComponent(row.id)}`,
  }));
  if (co.status === "fulfilled" && !co.value.error) result.companies = (co.value.data ?? []).map((row) => ({
    id: row.id, kind: "company", title: row.name, subtitle: row.domain ?? undefined,
    href: `/companies?id=${encodeURIComponent(row.id)}`,
  }));
  if (d.status === "fulfilled" && !d.value.error) result.deals = (d.value.data ?? []).map((row) => ({
    id: row.id, kind: "deal", title: row.title,
    subtitle: row.value == null ? undefined : formatarMoedaInteira(Number(row.value)), href: `/deals/${encodeURIComponent(row.id)}`,
  }));
  return result;
}
