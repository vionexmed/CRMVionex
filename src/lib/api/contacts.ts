import { supabase } from "@/integrations/supabase/client";
import { TABLES, DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { type LifecycleStage } from "@/lib/contact-options";
import type { Database } from "@/integrations/supabase/types";
import { buscarEmBlocos } from "@/lib/paginar";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];
type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];

export const PAGE_SIZE = DEFAULT_PAGE_SIZE;

export interface ContactListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  /**
   * Filtro por ciclo de vida. Substituiu o filtro por `status`, que apontava
   * para a coluna LEGADA e por isso oferecia só metade dos estágios -- não
   * existia opção para lead nem para "em negociação".
   */
  lifecycleStage?: string;
  ownerId?: string;
  companyId?: string;
  country?: string;
  createdFrom?: string;
  createdTo?: string;
  /**
   * Filtro por origem: cadastro_likawave | landing | manual | import.
   *
   * Lê `metadata.source`, exceto em `import`, que lê a marca
   * `metadata.importado_em` -- desde que a importação passou a gravar o NOME DO
   * ARQUIVO em `source`, o texto deixou de ser previsível.
   */
  origin?: string;
  /**
   * Cidade gravada em `metadata.cidade` pelo cadastro, pela ficha e pela
   * importação. Comparada sem diferenciar maiúsculas, mas inteira: "São Paulo"
   * não traz "São Paulo do Potengi". Os valores oferecidos vêm de
   * `listarCidades`, então a contagem ao lado de cada um bate com o resultado.
   */
  city?: string;
  sortKey?: "name" | "email" | "status" | "created_at" | "title";  // "status" mantido: é a coluna de ordenação do cabeçalho da tabela
  sortDir?: "asc" | "desc";
}

export interface ContactListResult {
  data: Contact[];
  count: number;
}

/**
 * Sanitiza o termo de busca para uso em filtros .or() do PostgREST.
 * Vírgulas, parênteses, aspas e barras quebram (ou alteram) a sintaxe do filtro.
 */
const sanitizeSearch = (s: string) => s.replace(/[,()"\\]/g, " ").trim();

const buildListQuery = (orgId: string, params: ContactListParams) => {
  const { search, lifecycleStage, ownerId, companyId, country, city, createdFrom, createdTo, origin, sortKey = "created_at", sortDir = "desc" } = params;

  // Contatos é a lista de TODAS as pessoas da organização.
  //
  // Havia aqui um `.neq("status", "lead")`, e ele criava uma exclusão mútua com
  // a tela de Leads (que mostra só lifecycle lead/contacted): quem entrava no
  // funil desaparecia da lista de pessoas, e vice-versa. O efeito colateral foi
  // pior que o filtro: para os contatos importados não sumirem daqui, os
  // caminhos de criação passaram a gravar status 'prospect' -- o que fazia o
  // trigger marcá-los como 'qualified' sem ninguém ter qualificado, e aí eles
  // nunca apareciam no funil. A tela escondia gente sem dizer, e a contagem no
  // topo não era o total de pessoas.
  let query = supabase
    .from(TABLES.CONTACTS)
    .select("*", { count: "exact" })
    .eq("org_id", orgId);

  // Ciclo de vida: a coluna que vale. `status` é legado.
  if (lifecycleStage && lifecycleStage !== "all") {
    query = query.eq("lifecycle_stage", lifecycleStage as LifecycleStage);
  }
  if (ownerId && ownerId !== "all") query = query.eq("owner_id", ownerId);
  if (companyId && companyId !== "all") query = query.eq("company_id", companyId);
  // A localização é salva no metadata pelo cadastro e pela importação.
  const pais = country?.trim();
  const literal = (value: string) => value.replace(/[\\%_*]/g, (char) => `\\${char}`);
  if (pais) query = query.ilike("metadata->>pais", literal(pais));
  if (createdFrom) query = query.gte("created_at", createdFrom);
  if (createdTo) query = query.lte("created_at", createdTo);
  // ilike sem curinga: igualdade que ignora maiúsculas. Os curingas do próprio
  // valor são escapados, senão uma cidade com "_" casaria com qualquer letra.
  const cidade = city?.trim();
  if (cidade) query = query.ilike("metadata->>cidade", cidade.replace(/[\\%_]/g, (c) => `\\${c}`));
  // Filtro por origem (metadata.source). Agrupa valores em buckets amigáveis.
  if (origin && origin !== "all") {
    if (origin === "cadastro_likawave") {
      query = query.eq("metadata->>source", "cadastro_likawave");
    } else if (origin === "import") {
      // `importado_em` é a MARCA, e `source` virou o nome do arquivo.
      //
      // O casamento exato em `csv_import` continua para os contatos importados
      // ANTES dessa mudança -- tirá-lo faria eles sumirem deste filtro. Os
      // novos entram pela marca de data, que independe do nome do arquivo: sem
      // ela, uma planilha chamada "Congresso 2026" não seria reconhecida como
      // importação por nada.
      query = query.or(
        "metadata->>importado_em.not.is.null," +
        "metadata->>source.eq.csv_import,metadata->>source.eq.import,metadata->>source.eq.importacao",
      );
    } else if (origin === "landing") {
      query = query.or("metadata->>source.ilike.%landing%,metadata->>source.ilike.%site%,metadata->>source.ilike.%form%,metadata->>source.ilike.%web%,metadata->>source.ilike.%utm%");
    } else if (origin === "manual") {
      // manual = sem origem gravada (contatos antigos/manuais/CSV legados) ou explicitamente "manual"
      query = query.or("metadata->>source.is.null,metadata->>source.eq.manual,metadata->>source.eq.");
    } else if (origin.startsWith(PREFIXO_ORIGEM_EXATA)) {
      // Uma origem ESPECÍFICA, escolhida na lista dinâmica: "NEXMED 2026",
      // "APROXIMA MED". O prefixo existe para não colidir com os buckets --
      // uma planilha chamada "manual" cairia no bucket errado sem ele.
      query = query.eq("metadata->>source", origin.slice(PREFIXO_ORIGEM_EXATA.length));
    }
  }
  if (search) {
    const term = sanitizeSearch(search);
    if (term) {
      query = query.or(
        `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`
      );
    }
  }

  const ascending = sortDir === "asc";
  if (sortKey === "name") {
    query = query.order("first_name", { ascending }).order("last_name", { ascending });
  } else {
    query = query.order(sortKey, { ascending });
  }

  return query;
};

/**
 * Marca uma origem LITERAL, para distingui-la dos buckets.
 *
 * Sem ele, uma planilha chamada "manual" ou "import" cairia no bucket de mesmo
 * nome e filtraria a coisa errada -- e o usuário não teria como saber por quê.
 */
export const PREFIXO_ORIGEM_EXATA = "src:";

export interface CidadeDeContato {
  /** O valor que vai para o filtro: a grafia mais usada daquela cidade. */
  cidade: string;
  contatos: number;
}

/**
 * Agrupa as cidades como o filtro as compara: sem diferenciar maiúsculas.
 *
 * "campinas" e "Campinas" viram uma linha só, com a grafia mais frequente --
 * o ilike do filtro traz as duas. Acento e espaço sobrando NÃO são
 * igualados, porque o filtro também não os iguala: juntar aqui faria a
 * contagem prometer contatos que o filtro não traz. "Sao Paulo" e "São Paulo"
 * aparecem como duas linhas, e é assim que a duplicidade fica visível.
 */
export function agruparCidades(valores: (string | null | undefined)[]): CidadeDeContato[] {
  const grupos = new Map<string, Map<string, number>>();
  for (const valor of valores) {
    if (!valor || !valor.trim()) continue;
    const chave = valor.toLocaleLowerCase("pt-BR");
    const grafias = grupos.get(chave) ?? new Map<string, number>();
    grafias.set(valor, (grafias.get(valor) ?? 0) + 1);
    grupos.set(chave, grafias);
  }
  return [...grupos.values()]
    .map((grafias) => {
      const [cidade] = [...grafias.entries()].sort((a, b) => b[1] - a[1])[0];
      const contatos = [...grafias.values()].reduce((t, n) => t + n, 0);
      return { cidade, contatos };
    })
    .sort((a, b) => a.cidade.trim().localeCompare(b.cidade.trim(), "pt-BR"));
}

export const contactsApi = {
  getById: async (orgId: string, id: string, signal?: AbortSignal): Promise<Contact | null> => {
    if (!orgId || !id) return null;
    const query = supabase.from(TABLES.CONTACTS).select("*").eq("org_id", orgId).eq("id", id);
    if (signal) query.abortSignal(signal);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  },

  /**
   * As origens que existem na base, com contagem.
   *
   * Função SQL e não consulta direta: precisa de DISTINCT com contagem, que o
   * PostgREST não expressa -- e agrupar no navegador esbarraria no teto
   * silencioso de 1000 linhas, deixando a lista de origens incompleta sem avisar.
   */
  listarOrigens: async (orgId: string): Promise<{ origem: string; contatos: number }[]> => {
    // `as any` no nome: os tipos gerados são um retrato do banco NO MOMENTO da
    // geração, e esta função nasce numa migração que ainda não foi aplicada.
    // Mesmo padrão de `create_organization_for_user` em CompanyStep.
    const { data, error } = await (supabase.rpc as unknown as (
      nome: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>)("origens_de_contato", { _org_id: orgId });
    if (error) throw error;
    return (data ?? []) as { origem: string; contatos: number }[];
  },

  /**
   * As cidades que existem na base, com contagem, opcionalmente só de um
   * estágio do ciclo de vida -- na fila de leads, as cidades dos leads.
   *
   * Lê só a coluna da cidade, em blocos: agrupar no navegador sem paginar
   * esbarraria no corte silencioso de 1000 linhas e a lista sairia incompleta.
   */
  listarCidades: async (orgId: string, lifecycleStage?: string): Promise<CidadeDeContato[]> => {
    // Seleção em variável `string`: o literal com `->>` estoura o analisador de
    // tipos do supabase-js (TS2589). O formato da linha está no genérico abaixo.
    const colunas: string = "cidade:metadata->>cidade";
    const linhas = await buscarEmBlocos<{ cidade: string | null }>((inicio, fim) => {
      const base = supabase
        .from(TABLES.CONTACTS)
        .select(colunas)
        .eq("org_id", orgId)
        .not("metadata->>cidade", "is", null);
      const query = lifecycleStage && lifecycleStage !== "all"
        ? base.eq("lifecycle_stage", lifecycleStage as LifecycleStage)
        : base;
      return query.order("id").range(inicio, fim) as unknown as PromiseLike<{ data: { cidade: string | null }[] | null; error: unknown }>;
    });
    return agruparCidades(linhas.map((l) => l.cidade));
  },

  list: async (orgId: string, params: ContactListParams = {}): Promise<ContactListResult> => {
    const { page = 0, pageSize = PAGE_SIZE } = params;
    const from = page * pageSize;
    const query = buildListQuery(orgId, params).range(from, from + pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data ?? [], count: count ?? 0 };
  },

  /**
   * Busca TODOS os contatos (com os filtros atuais), paginando em blocos de
   * 1000 para contornar o max-rows do PostgREST. Usado na exportação CSV e
   * na visão kanban por vendedor.
   */
  listAll: async (orgId: string, params: ContactListParams = {}): Promise<Contact[]> =>
    buscarEmBlocos<Contact>((inicio, fim) => buildListQuery(orgId, params).range(inicio, fim)),

  /**
   * Lista leve para pickers (selects de contato em Negócios/Tarefas).
   * Inclui leads também — tarefas/negócios podem referenciar leads.
   */
  listForPicker: async (
    orgId: string,
  ): Promise<Pick<Contact, "id" | "first_name" | "last_name" | "email" | "lifecycle_stage">[]> =>
    // `lifecycle_stage`, não `status`: a coluna legada tem 4 valores contra 6 e
    // o mapa entre elas perde `contacted` e `opportunity`.
    buscarEmBlocos((inicio, fim) =>
      supabase
        .from(TABLES.CONTACTS)
        .select("id, first_name, last_name, email, lifecycle_stage")
        .eq("org_id", orgId)
        .order("first_name", { ascending: true })
        .range(inicio, fim),
    ),

  create: async (contact: ContactInsert): Promise<Contact> => {
    const { data, error } = await supabase.from(TABLES.CONTACTS).insert(contact).select().single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, contact: ContactUpdate): Promise<Contact> => {
    const { data, error } = await supabase
      .from("contacts")
      .update(contact)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * O que impede a exclusão destes contatos.
   *
   * `deals.contact_id` e `activities.contact_id` foram criados sem cláusula
   * ON DELETE, então valem NO ACTION: o Postgres recusa apagar o contato. Já
   * `emails.contact_id` e `whatsapp_messages.contact_id` são ON DELETE SET NULL
   * -- as mensagens sobrevivem sem dono, e por isso não travam nada.
   *
   * Contar antes serve para a tela dizer o que vai acontecer em vez de deixar o
   * banco recusar com "violates foreign key constraint".
   */
  contarVinculos: async (ids: string[]): Promise<{ negocios: number; atividades: number }> => {
    const [d, a] = await Promise.all([
      supabase.from(TABLES.DEALS).select("id", { count: "exact", head: true }).in("contact_id", ids),
      supabase.from("activities").select("id", { count: "exact", head: true }).in("contact_id", ids),
    ]);
    if (d.error) throw d.error;
    if (a.error) throw a.error;
    return { negocios: d.count ?? 0, atividades: a.count ?? 0 };
  },

  /**
   * Exclui contatos e, quando `comVinculos`, os negócios e atividades deles.
   *
   * A ordem importa: os filhos primeiro, senão o Postgres recusa. E não há
   * transação aqui -- o PostgREST não expõe uma. Se o passo do contato falhar
   * depois de apagar negócios, o resultado é um contato sem negócios, não uma
   * exclusão pela metade que se possa desfazer. É o motivo de a tela pedir
   * confirmação nomeando o que será apagado.
   */
  deleteMany: async (ids: string[], comVinculos = false): Promise<void> => {
    if (comVinculos) {
      const { error: eDeals } = await supabase.from(TABLES.DEALS).delete().in("contact_id", ids);
      if (eDeals) throw eDeals;
      const { error: eAct } = await supabase.from("activities").delete().in("contact_id", ids);
      if (eAct) throw eAct;
    }
    const { error } = await supabase.from(TABLES.CONTACTS).delete().in("id", ids);
    if (error) throw error;
  },

  // `updateStatus` saiu. Era o ÚLTIMO caminho da aplicação para escrever na
  // coluna legada `contacts.status`, e o último consumidor -- o "Aprovar" em
  // lote de Leads -- passou a chamar `qualify_lead`. O gatilho continua
  // mantendo a coluna em dia para quem a leia fora do CRM.

  updateOwner: async (id: string, ownerId: string | null): Promise<void> => {
    const { error } = await supabase.from(TABLES.CONTACTS).update({ owner_id: ownerId }).eq("id", id);
    if (error) throw error;
  },


  /** Move o contato no ciclo de vida. O trigger no banco cuida da auditoria. */
  updateLifecycleStage: async (ids: string[], stage: LifecycleStage): Promise<void> => {
    const { error } = await supabase
      .from(TABLES.CONTACTS)
      .update({ lifecycle_stage: stage })
      .in("id", ids);
    if (error) throw error;
  },
};
