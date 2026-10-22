import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Receipt, FileText } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { FaixaDeIndicadores, Indicador, VisoesDaLista } from "@/components/layout/ListaV1";
import { LoadingState, ErrorState, EmptyState } from "@/components/layout/EstadoDaLista";
import { SemOrganizacao } from "@/components/layout/SemOrganizacao";
import { Button } from "@/components/ui/button";
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
import { formatarMesAno, formatarMoedaInteira, pluralizar } from "@/lib/formato";
import { estadoDoOrcamento } from "@/lib/orcamento-calculo";
import { ModelosDeOrcamento } from "@/components/orcamentos/ModelosDeOrcamento";
import type { OrcamentoModelo } from "@/lib/api/orcamento-modelos";
import {
  ordenarOrcamentos, resumirOrcamentos, LIMITE_DA_LISTA,
  type ValorPorMoeda,
} from "@/lib/orcamento-resumo";

/**
 * As cinco abas. "Enviados" é o estado DERIVADO (enviado e ainda válido): o
 * vencido sai dela e fica só em "Todos", senão a aba e "Aguardando resposta"
 * contariam coisas diferentes.
 */
type Filtro = "todos" | "rascunho" | "enviado" | "aprovado" | "recusado";

const FILTROS: readonly Filtro[] = ["todos", "rascunho", "enviado", "aprovado", "recusado"];

/** Uma moeda por parcela: somar moedas diferentes daria um número sem unidade. */
function textoDoValor(v: ValorPorMoeda): string {
  const moedas = Object.keys(v);
  if (moedas.length === 0) return formatarMoedaInteira(0);
  return moedas.map((m) => formatarMoedaInteira(v[m], m)).join(" + ");
}

export default function Orcamentos() {
  const { orgId } = useOrg();
  const { data: orcamentos = [], isLoading, isError, refetch } = useOrcamentos();

  /*
   * A situação mora na URL (replace: a aba não é navegação, e o Voltar não
   * deve desfazer cada clique). Assim F5 e link mantêm a visão. Valor
   * desconhecido cai no padrão -- `?situacao=xyz` não pode deixar a lista vazia
   * sem aba ativa. O padrão não vai para a URL.
   */
  const [params, setParams] = useSearchParams();
  const situacaoUrl = params.get("situacao");
  const filtro: Filtro = FILTROS.includes(situacaoUrl as Filtro) ? (situacaoUrl as Filtro) : "todos";
  const setFiltro = (v: Filtro) => {
    setParams((atual) => {
      const proximo = new URLSearchParams(atual);
      if (v === "todos") proximo.delete("situacao");
      else proximo.set("situacao", v);
      return proximo;
    }, { replace: true });
  };
  const limparFiltros = () => setFiltro("todos");
  const [construindo, setConstruindo] = useState<OrcamentoComRelacoes | "novo" | null>(null);
  const [modelosAberto, setModelosAberto] = useState(false);
  /** Modelo escolhido em "Modelos" para o orçamento novo nascer preenchido. */
  const [modeloEscolhido, setModeloEscolhido] = useState<OrcamentoModelo | null>(null);
  const [noPainel, setNoPainel] = useState<OrcamentoComRelacoes | null>(null);
  /** Linha mostrada na prévia ao lado (xl). Guarda só o id: o dado vem da lista viva. */
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const telaLarga = useTelaLarga();
  const { data: membros = [] } = useMembers();
  const nomeDoResponsavel = (id: string | null) =>
    (id ? membros.find((m) => m.id === id)?.name : null) ?? null;

  // O resumo é da lista INTEIRA, não da filtrada: ele descreve o negócio, e
  // trocar de aba de situação não deve mudar "aprovado no mês".
  const resumo = useMemo(() => resumirOrcamentos(orcamentos), [orcamentos]);

  const visiveis = useMemo(
    () =>
      ordenarOrcamentos(orcamentos, "data").filter((o) =>
        filtro === "todos" ? true
          : filtro === "enviado" ? estadoDoOrcamento(o) === "enviado"
            : o.status === filtro,
      ),
    [orcamentos, filtro],
  );

  // As contagens das abas descrevem a lista inteira, como o resumo.
  const contagens = useMemo(() => {
    const c: Record<Filtro, number> = { todos: orcamentos.length, rascunho: 0, enviado: 0, aprovado: 0, recusado: 0 };
    for (const o of orcamentos) {
      if (o.status === "rascunho" || o.status === "aprovado" || o.status === "recusado") c[o.status]++;
      else if (estadoDoOrcamento(o) === "enviado") c.enviado++;
    }
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
      preencherAltura
      title="Orçamentos"
      actions={
        <>
          <Button size="sm" variant="outline" className="[font-size:inherit]" onClick={() => setModelosAberto(true)}>
            <FileText aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />Modelos
          </Button>
          <Button size="sm" className="[font-size:inherit]" onClick={() => { setModeloEscolhido(null); setConstruindo("novo"); }}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Novo orçamento
          </Button>
        </>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
      {!isLoading && !isError && orcamentos.length > 0 && (
        <div role="group" aria-label="Resumo dos orçamentos" className="!mt-5 [&_.mt-1\.5]:!mt-0">
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
              rotulo="Expiram amanhã"
              tom={resumo.expiramEmBreve.quantidade > 0 ? "atencao" : undefined}
              valor={resumo.expiramEmBreve.quantidade}
              apoio={
                resumo.expiramEmBreve.quantidade > 0
                  ? textoDoValor(resumo.expiramEmBreve.valor)
                  : "Nada vence amanhã"
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

      <div className="!mt-[22px] grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <VisoesDaLista<Filtro>
            rotulo="Situação do orçamento"
            valor={filtro}
            onChange={setFiltro}
            className="px-2 pt-0.5 [&_[role=tab]]:!min-h-11"
            contagemEmChip
            visoes={[
              { valor: "todos", rotulo: "Todos", contagem: contagens.todos },
              { valor: "rascunho", rotulo: "Rascunhos", contagem: contagens.rascunho },
              { valor: "enviado", rotulo: "Enviados", contagem: contagens.enviado },
              { valor: "aprovado", rotulo: "Aceitos", contagem: contagens.aprovado, tom: "sucesso" },
              { valor: "recusado", rotulo: "Recusados", contagem: contagens.recusado, tom: "perigo" },
            ]}
          />
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
              <div className="hidden min-h-0 flex-1 flex-col md:flex">
                <TabelaDeOrcamentos
                  orcamentos={visiveis}
                  selecionadoId={telaLarga ? selecionado?.id : null}
                  aoAbrir={abrir}
                  nomeDoResponsavel={nomeDoResponsavel}
                />
              </div>
              <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto md:hidden">
                {visiveis.map((o) => (
                  <LinhaDeOrcamento key={o.id} orcamento={o} aoAbrir={abrir} />
                ))}
              </ul>
            </>
          )}
        </Card>

        {telaLarga && selecionado && !isLoading && !isError && (
          <div className="min-h-0 overflow-y-auto">
            <PreviaDeOrcamento
              key={selecionado.id}
              orcamento={selecionado}
              aoEditar={(o) => setConstruindo(o)}
            />
          </div>
        )}
      </div>
      </div>

      <ConstrutorDeOrcamento
        aberto={construindo !== null}
        orcamento={construindo === "novo" ? null : construindo}
        modelo={construindo === "novo" ? modeloEscolhido : null}
        aoFechar={() => { setConstruindo(null); setModeloEscolhido(null); }}
      />

      <ModelosDeOrcamento
        aberto={modelosAberto}
        aoFechar={() => setModelosAberto(false)}
        aoUsar={(m) => { setModeloEscolhido(m); setConstruindo("novo"); }}
      />

      <PainelDeOrcamento
        orcamento={telaLarga ? null : noPainel}
        aoFechar={() => setNoPainel(null)}
        aoEditar={(o) => { setNoPainel(null); setConstruindo(o); }}
      />
    </PageShell>
  );
}
