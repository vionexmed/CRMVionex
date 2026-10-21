import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Receipt } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { FaixaDeIndicadores, Indicador, VisoesDaLista } from "@/components/layout/ListaV1";
import { SegmentedControl } from "@/components/layout/SegmentedControl";
import { LoadingState, ErrorState, EmptyState } from "@/components/layout/EstadoDaLista";
import { SemOrganizacao } from "@/components/layout/SemOrganizacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOrg } from "@/hooks/useOrg";
import { useOrcamentos } from "@/hooks/queries/useOrcamentos";
import { ConstrutorDeOrcamento } from "@/components/orcamentos/ConstrutorDeOrcamento";
import { LinhaDeOrcamento } from "@/components/orcamentos/LinhaDeOrcamento";
import { TabelaDeOrcamentos } from "@/components/orcamentos/TabelaDeOrcamentos";
import { useTelaLarga } from "@/components/orcamentos/useTelaLarga";
import { useMembers } from "@/hooks/queries/useMembers";
import { PainelDeOrcamento, PreviaDeOrcamento } from "@/components/orcamentos/PainelDeOrcamento";
import type { OrcamentoComRelacoes } from "@/lib/api/orcamentos";
import { Card } from "@/components/ui/card";
import { nomeDoContato } from "@/lib/contato-formato";
import { formatarMesAno, formatarMoeda, pluralizar } from "@/lib/formato";
import {
  ordenarOrcamentos, resumirOrcamentos, LIMITE_DA_LISTA, DIAS_DE_AVISO,
  type OrdemDeOrcamento, type ValorPorMoeda,
} from "@/lib/orcamento-resumo";

/** Os cinco estados, em ordem de ciclo. `expirado` é derivado, não digitado. */
type Filtro = "todos" | "rascunho" | "enviado" | "aprovado" | "recusado";

const FILTROS: readonly Filtro[] = ["todos", "rascunho", "enviado", "aprovado", "recusado"];
const ORDENS: readonly OrdemDeOrcamento[] = ["data", "valor"];

/** Uma moeda por parcela: somar moedas diferentes daria um número sem unidade. */
function textoDoValor(v: ValorPorMoeda): string {
  const moedas = Object.keys(v);
  if (moedas.length === 0) return formatarMoeda(0);
  return moedas.map((m) => formatarMoeda(v[m], m)).join(" + ");
}

export default function Orcamentos() {
  const { orgId } = useOrg();
  const { data: orcamentos = [], isLoading, isError, refetch } = useOrcamentos();

  /*
   * Situação, busca e ordem moram na URL (replace: o filtro não é navegação, e
   * o Voltar não deve desfazer cada letra digitada). Assim F5 e link mantêm a
   * visão. Valor desconhecido cai no padrão -- `?situacao=xyz` não pode deixar
   * a lista vazia sem botão ativo. Os valores padrão não vão para a URL.
   */
  const [params, setParams] = useSearchParams();
  const busca = params.get("q") ?? "";
  const situacaoUrl = params.get("situacao");
  const filtro: Filtro = FILTROS.includes(situacaoUrl as Filtro) ? (situacaoUrl as Filtro) : "todos";
  const ordemUrl = params.get("ordem");
  const ordem: OrdemDeOrcamento = ORDENS.includes(ordemUrl as OrdemDeOrcamento)
    ? (ordemUrl as OrdemDeOrcamento) : "data";

  const mudarParam = (chave: string, valor: string, padrao = "") => {
    setParams((atual) => {
      const proximo = new URLSearchParams(atual);
      if (valor === padrao) proximo.delete(chave);
      else proximo.set(chave, valor);
      return proximo;
    }, { replace: true });
  };
  const setBusca = (v: string) => mudarParam("q", v);
  const setFiltro = (v: Filtro) => mudarParam("situacao", v, "todos");
  // Uma escrita só: duas chamadas seguidas de setParams usam a MESMA query da
  // renderização, e a segunda desfaria a primeira.
  const limparFiltros = () => {
    setParams((atual) => {
      const proximo = new URLSearchParams(atual);
      proximo.delete("q");
      proximo.delete("situacao");
      return proximo;
    }, { replace: true });
  };
  const setOrdem = (v: OrdemDeOrcamento) => mudarParam("ordem", v, "data");
  const [construindo, setConstruindo] = useState<OrcamentoComRelacoes | "novo" | null>(null);
  const [noPainel, setNoPainel] = useState<OrcamentoComRelacoes | null>(null);
  /** Linha mostrada na prévia ao lado (xl). Guarda só o id: o dado vem da lista viva. */
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const telaLarga = useTelaLarga();
  const { data: membros = [] } = useMembers();
  const nomeDoResponsavel = (id: string | null) =>
    (id ? membros.find((m) => m.id === id)?.name : null) ?? null;

  const termo = busca.trim().toLowerCase();

  // O resumo é da lista INTEIRA, não da filtrada: ele descreve o negócio, e
  // trocar de aba de situação não deve mudar "aprovado no mês".
  const resumo = useMemo(() => resumirOrcamentos(orcamentos), [orcamentos]);

  const visiveis = useMemo(
    () =>
      ordenarOrcamentos(orcamentos, ordem).filter((o) => {
        if (filtro !== "todos" && o.status !== filtro) return false;
        if (!termo) return true;
        const pessoa = o.contact
          ? nomeDoContato(o.contact.first_name, o.contact.last_name)
          : "";
        // Número, pessoa, empresa e título: são as quatro formas de alguém se
        // referir a um orçamento ao telefone.
        return `${o.numero} ${pessoa} ${o.company?.name ?? ""} ${o.titulo ?? ""}`
          .toLowerCase().includes(termo);
      }),
    [orcamentos, ordem, filtro, termo],
  );

  // As contagens das abas descrevem a lista inteira, como o resumo: a busca
  // refina a tabela, mas "Enviados 7" não deve mudar a cada letra digitada.
  const contagens = useMemo(() => {
    const c: Record<Filtro, number> = { todos: orcamentos.length, rascunho: 0, enviado: 0, aprovado: 0, recusado: 0 };
    for (const o of orcamentos) if (o.status in c) c[o.status as Filtro]++;
    return c;
  }, [orcamentos]);

  const selecionado = visiveis.find((o) => o.id === selecionadoId) ?? visiveis[0] ?? null;
  const abrir = (o: OrcamentoComRelacoes) => {
    if (telaLarga) setSelecionadoId(o.id);
    else setNoPainel(o);
  };

  if (!orgId) return <SemOrganizacao />;

  const mes = formatarMesAno(new Date()).split(" ")[0];

  return (
    <PageShell
      title="Orçamentos"
      contagem={{ valor: visiveis.length, unidade: "orçamento" }}
      actions={
        // Sem "Modelos": o app não tem modelos de orçamento, e um botão sem
        // função seria promessa vazia.
        <Button onClick={() => setConstruindo("novo")}>
          <Plus className="mr-1.5 h-4 w-4" />Novo orçamento
        </Button>
      }
    >
      {!isLoading && !isError && orcamentos.length > 0 && (
        <div role="group" aria-label="Resumo dos orçamentos">
          <FaixaDeIndicadores>
            <Indicador
              rotulo={`Enviados em ${mes}`}
              valor={resumo.enviadosNoMes.quantidade}
              apoio={textoDoValor(resumo.enviadosNoMes.valor)}
            />
            <Indicador
              rotulo="Aceitos"
              tom="sucesso"
              valor={resumo.aprovadoNoMes.quantidade}
              apoio={
                resumo.aceitosSobreEnviados === null
                  ? textoDoValor(resumo.aprovadoNoMes.valor)
                  : `${textoDoValor(resumo.aprovadoNoMes.valor)} · ${Math.round(resumo.aceitosSobreEnviados * 100)}% dos enviados`
              }
            />
            <Indicador
              rotulo="Aguardando resposta"
              valor={resumo.emAberto.quantidade}
              apoio={textoDoValor(resumo.emAberto.valor)}
            />
            <Indicador
              rotulo="Expiram em breve"
              tom={resumo.expiramEmBreve.quantidade > 0 ? "atencao" : undefined}
              valor={resumo.expiramEmBreve.quantidade}
              apoio={
                resumo.expiramEmBreve.quantidade > 0
                  ? `${textoDoValor(resumo.expiramEmBreve.valor)} · em até ${DIAS_DE_AVISO} dias`
                  : `Nada vence em ${DIAS_DE_AVISO} dias`
              }
            />
          </FaixaDeIndicadores>
          {resumo.possivelmenteCortado && (
            <p className="mt-1.5 text-label text-warning">
              A lista traz no máximo {LIMITE_DA_LISTA} orçamentos; os mais antigos podem
              estar fora, e os totais acima podem estar incompletos.
            </p>
          )}
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="min-w-0 overflow-hidden">
          <VisoesDaLista<Filtro>
            rotulo="Situação do orçamento"
            valor={filtro}
            onChange={setFiltro}
            className="px-2"
            visoes={[
              { valor: "todos", rotulo: "Todos", contagem: contagens.todos },
              { valor: "rascunho", rotulo: "Rascunhos", contagem: contagens.rascunho },
              { valor: "enviado", rotulo: "Enviados", contagem: contagens.enviado },
              { valor: "aprovado", rotulo: "Aceitos", contagem: contagens.aprovado },
              { valor: "recusado", rotulo: "Recusados", contagem: contagens.recusado },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <div className="relative min-w-0 flex-1 sm:max-w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Número, pessoa ou empresa"
                aria-label="Buscar orçamento"
                className="pl-8 text-xs"
              />
            </div>
            <SegmentedControl<OrdemDeOrcamento>
              rotuloGrupo="Ordenação"
              valor={ordem}
              onChange={setOrdem}
              opcoes={[
                { valor: "data", rotulo: "Recentes" },
                { valor: "valor", rotulo: "Maior valor" },
              ]}
            />
          </div>

          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState descricao="" onTentarNovamente={() => refetch()} />
          ) : visiveis.length === 0 ? (
            <EmptyState
              icone={Receipt}
              titulo={
                orcamentos.length === 0
                  ? "Nenhum orçamento ainda"
                  : termo
                    ? `Nada encontrado para “${busca.trim()}”`
                    : "Nenhum orçamento neste estado"
              }
              descricao={
                orcamentos.length === 0
                  ? "Monte um a partir do catálogo e envie o link para o cliente aprovar."
                  : `Há ${orcamentos.length} ${pluralizar(orcamentos.length, "orçamento")} no total.`
              }
              acao={
                orcamentos.length === 0 ? (
                  <Button variant="outline" size="sm" onClick={() => setConstruindo("novo")}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />Criar orçamento
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={limparFiltros}>
                    Ver todos ({orcamentos.length})
                  </Button>
                )
              }
            />
          ) : (
            <>
              <div className="hidden md:block">
                <TabelaDeOrcamentos
                  orcamentos={visiveis}
                  selecionadoId={telaLarga ? selecionado?.id : null}
                  aoAbrir={abrir}
                  nomeDoResponsavel={nomeDoResponsavel}
                />
              </div>
              <ul className="divide-y divide-border md:hidden">
                {visiveis.map((o) => (
                  <LinhaDeOrcamento key={o.id} orcamento={o} aoAbrir={abrir} />
                ))}
              </ul>
            </>
          )}
        </Card>

        {telaLarga && selecionado && !isLoading && !isError && (
          <div className="sticky top-4">
            <PreviaDeOrcamento
              key={selecionado.id}
              orcamento={selecionado}
              aoEditar={(o) => setConstruindo(o)}
            />
          </div>
        )}
      </div>

      <ConstrutorDeOrcamento
        aberto={construindo !== null}
        orcamento={construindo === "novo" ? null : construindo}
        aoFechar={() => setConstruindo(null)}
      />

      <PainelDeOrcamento
        orcamento={telaLarga ? null : noPainel}
        aoFechar={() => setNoPainel(null)}
        aoEditar={(o) => { setNoPainel(null); setConstruindo(o); }}
      />
    </PageShell>
  );
}
