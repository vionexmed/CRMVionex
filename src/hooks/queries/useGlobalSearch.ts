import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { searchEntities } from "@/lib/api/global-search";
import { contactsApi } from "@/lib/api/contacts";
import { companiesApi } from "@/lib/api/companies";

export function useGlobalSearch(term: string, open = true, atrasoMs = 300) {
  const { user, profile } = useAuth();
  const text = term.trim().slice(0, 200);
  const debounced = useDebounce(text, atrasoMs);
  const ready = open && !!user?.id && !!profile?.org_id && text.length >= 2;
  const current = ready && text === debounced;
  const query = useQuery({
    queryKey: ["global-search", user?.id, profile?.org_id, debounced],
    queryFn: ({ signal }) => searchEntities(profile!.org_id!, debounced, signal),
    enabled: current,
    retry: false,
    staleTime: 30_000,
  });
  return {
    data: current ? query.data : undefined,
    error: current ? query.error : null,
    isSearching: ready && (!current || query.isFetching),
    refetch: query.refetch,
  };
}

/** Chaves incluem identidade e ID; nunca reaproveitam a página atual como ficha. */
export function useContactFromSearch(id: string | null) {
  const { user, profile } = useAuth();
  const orgId = profile?.org_id;
  return useQuery({
    queryKey: ["contacts", orgId, "detail", user?.id, id],
    queryFn: ({ signal }) => contactsApi.getById(orgId!, id!, signal),
    enabled: !!user?.id && !!orgId && !!id,
    retry: false,
  });
}

export function useCompanyFromSearch(id: string | null) {
  const { user, profile } = useAuth();
  const orgId = profile?.org_id;
  return useQuery({
    queryKey: ["companies", orgId, "detail", user?.id, id],
    queryFn: ({ signal }) => companiesApi.getById(orgId!, id!, signal),
    enabled: !!user?.id && !!orgId && !!id,
    retry: false,
  });
}
