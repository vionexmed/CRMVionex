import { useState } from "react";
import { Copy, Check, Mail, Pencil, ExternalLink, Loader2, BookmarkPlus } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { mensagemErro } from "@/lib/erro-supabase";
import { formatarMoeda, formatarDataHora } from "@/lib/formato";
import { nomeDoContato } from "@/lib/contato-formato";
import { totaisDoOrcamento, type OrcamentoComRelacoes } from "@/lib/api/orcamentos";
import { SeloDeOrcamento } from "@/components/orcamentos/SeloDeOrcamento";
import { Iniciais } from "@/components/layout/ListaV1";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { useMembers } from "@/hooks/queries/useMembers";
import { clienteDoOrcamento, codigoDoOrcamento, resumoDeVisualizacoes } from "@/lib/orcamento-resumo";
import { DocumentoDeOrcamento, type DadosDoDocumento, type SituacaoDoDocumento } from "@/components/orcamentos/DocumentoDeOrcamento";
import { useEmpresaDoDocumento } from "@/hooks/queries/useEmpresaDoDocumento";
import { tintaDe } from "@/components/orcamentos/TabelaDeOrcamentos";
import { diasDeValidade } from "@/lib/orcamento-modelos";
import { FormularioDeModelo, type ModeloInicial } from "@/components/orcamentos/ModelosDeOrcamento";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { estadoDoOrcamento } from "@/lib/orcamento-calculo";
import { useAtualizarOrcamento } from "@/hooks/queries/useOrcamentos";
import { useUpdateDeal } from "@/hooks/queries/useDeals";
import { EmailComposeModal } from "@/components/crm/EmailComposeModal";
import { useDeals } from "@/hooks/queries/useDeals";

/** O link que o cliente abre. Montado do `window.location`, para funcionar em
 *  produção, em prévia da Vercel e em desenvolvimento sem configuração. */
const linkPublico = (token: string) => `${window.location.origin}/o/${token}`;

/**
 * O orçamento por dentro, em dois lugares com o MESMO conteúdo.
 *
 * Em tela larga ele fica ao lado da lista (`PreviaDeOrcamento`), como a prévia
 * da proposta do V1; abaixo disso abre na gaveta de 520px do perfil de contato
 * (`PainelDeOrcamento`) -- "detalhe de uma coisa" já tem um gesto neste CRM.
 * Um só corpo, para as duas versões não divergirem em ação ou aviso.
 */
export function PainelDeOrcamento({
  orcamento,
  aoFechar,
  aoEditar,
}: {
  orcamento: OrcamentoComRelacoes | null;
  aoFechar: () => void;
  aoEditar: (o: OrcamentoComRelacoes) => void;
}) {
  if (!orcamento) return null;
  return (
    <Sheet open={!!orcamento} onOpenChange={(o) => !o && aoFechar()}>
      <SheetContent className="flex w-[520px] flex-col gap-0 p-0 sm:max-w-[520px]">
        <CorpoDoOrcamento orcamento={orcamento} aoEditar={aoEditar} emGaveta />
      </SheetContent>
    </Sheet>
  );
}

/** A prévia fixa ao lado da lista (xl). Sem fechar: trocar a linha troca a prévia. */
export function PreviaDeOrcamento({
  orcamento,
  aoEditar,
}: {
  orcamento: OrcamentoComRelacoes;
  aoEditar: (o: OrcamentoComRelacoes) => void;
}) {
  return (
    <Card className="flex min-h-0 flex-col overflow-hidden">
      <CorpoDoOrcamento orcamento={orcamento} aoEditar={aoEditar} />
    </Card>
  );
}

function CorpoDoOrcamento({
  orcamento,
  aoEditar,
  emGaveta = false,
}: {
  orcamento: OrcamentoComRelacoes;
  aoEditar: (o: OrcamentoComRelacoes) => void;
  emGaveta?: boolean;
}) {
  const { toast } = useToast();
  const atualizar = useAtualizarOrcamento();
  const atualizarNegocio = useUpdateDeal();
  const { data: negocios } = useDeals();
  const { data: membros = [] } = useMembers();

  const [copiado, setCopiado] = useState(false);
  const [compondo, setCompondo] = useState(false);
  const [aceitando, setAceitando] = useState(false);
  const [comoModelo, setComoModelo] = useState<ModeloInicial | null>(null);
  const { user } = useAuth();

  const itens = (orcamento.itens ?? []).map((i) => ({
    preco_unit: Number(i.preco_unit),
    quantidade: Number(i.quantidade),
    desconto: Number(i.desconto),
  }));
  const totais = totaisDoOrcamento(itens, Number(orcamento.desconto) || 0);

  const { nome: cliente } = clienteDoOrcamento(orcamento);
  // "Dr. Henrique Prado": o tratamento só entra se `title` for mesmo um
  // tratamento -- o campo também guarda cargo ("Diretor"), que não cabe antes do nome.
  const tratamento = /^(dra?|sra?|prof\.?)\.?$/i.test(orcamento.contact?.title?.trim() ?? "")
    ? `${orcamento.contact!.title!.trim().replace(/\.?$/, ".")} ` : "";
  const pessoa = orcamento.contact
    ? tratamento + nomeDoContato(orcamento.contact.first_name, orcamento.contact.last_name)
    : "Sem contato";
  const link = linkPublico(orcamento.token);
  const estado = estadoDoOrcamento(orcamento);
  const aprovado = orcamento.status === "aprovado";
  // O responsável se resolve no cliente: `owner_id` aponta para auth.users e o
  // PostgREST não atravessa (ver CLAUDE.md).
  const dono = membros.find((m) => m.id === orcamento.owner_id)?.name ?? null;

  /*
    O negócio vinculado e o quanto ele diverge.

    `deals` vem do cache que a tela de Negócios já carrega -- não é consulta
    nova. Se o orçamento não tem negócio, não há o que sugerir.
  */
  const negocio = orcamento.deal_id
    ? (negocios?.data ?? []).find((d) => d.id === orcamento.deal_id)
    : null;
  const valorDoNegocio = negocio ? Number(negocio.value) || 0 : null;
  const divergeDoNegocio =
    aprovado && valorDoNegocio !== null && Math.abs(valorDoNegocio - totais.total) > 0.01;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast({ title: "Não consegui copiar", description: link, variant: "destructive" });
    }
  };

  /**
   * Marca como enviado.
   *
   * NÃO grava atividade própria: quem envia usa o compositor, e ele já registra
   * o e-mail. Uma segunda linha contaria o mesmo ato duas vezes -- e e-mail
   * conta como abordagem no painel, o que dobraria a métrica.
   */
  const marcarEnviado = async () => {
    try {
      await atualizar.mutateAsync({
        id: orcamento.id,
        patch: { status: "enviado", enviado_em: new Date().toISOString() },
      });
    } catch (e: unknown) {
      toast({ title: "Não foi possível marcar como enviado", description: mensagemErro(e), variant: "destructive" });
    }
  };

  const sincronizarValor = async () => {
    if (!negocio) return;
    try {
      await atualizarNegocio.mutateAsync({ id: negocio.id, deal: { value: totais.total } });
      toast({ title: "Valor do negócio atualizado", description: formatarMoeda(totais.total, orcamento.moeda) });
    } catch (e: unknown) {
      toast({ title: "Não foi possível atualizar o negócio", description: mensagemErro(e), variant: "destructive" });
    }
  };

  /**
   * Registra o aceite pela equipe (cliente que respondeu por telefone ou
   * WhatsApp). Diz QUEM registrou em `decidido_por`: sem isso, "o cliente
   * aprovou" e "o vendedor marcou como aprovado" seriam indistinguíveis.
   */
  const aceitar = async () => {
    const quem = membros.find((m) => m.id === user?.id)?.name ?? "a equipe";
    try {
      await atualizar.mutateAsync({
        id: orcamento.id,
        patch: { status: "aprovado", decidido_em: new Date().toISOString(), decidido_por: `Registrado por ${quem}` },
      });
      setAceitando(false);
    } catch (e: unknown) {
      toast({ title: "Não foi possível registrar o aceite", description: mensagemErro(e), variant: "destructive" });
    }
  };

  const salvarComoModelo = () =>
    setComoModelo({
      nome: "",
      titulo: orcamento.titulo,
      itens: (orcamento.itens ?? []).map((i) => ({
        produto_id: i.produto_id, nome: i.nome, descricao: i.descricao, unidade: i.unidade,
        preco_unit: Number(i.preco_unit), quantidade: Number(i.quantidade), desconto: Number(i.desconto),
      })),
      validade_dias: diasDeValidade(orcamento.valido_ate),
      desconto: Number(orcamento.desconto) || 0,
      condicoes: orcamento.condicoes ?? null,
      observacoes: orcamento.observacoes,
    });

  const codigo = codigoDoOrcamento(orcamento.numero);
  const linhas = orcamento.itens ?? [];
  const { data: empresa } = useEmpresaDoDocumento();
  const documento: DadosDoDocumento = {
    numero: orcamento.numero,
    titulo: orcamento.titulo,
    situacao: estado as SituacaoDoDocumento,
    emitidoEm: orcamento.created_at,
    validoAte: orcamento.valido_ate,
    moeda: orcamento.moeda,
    emitente: { ...(empresa?.empresa ?? {}), nome: empresa?.nome || "Vionex" },
    destinatario: {
      cliente,
      contato: orcamento.contact ? pessoa : null,
      email: orcamento.contact?.email,
      telefone: orcamento.contact?.phone,
    },
    responsavel: dono,
    itens: linhas.map((i) => ({
      nome: i.nome, descricao: i.descricao, unidade: i.unidade,
      quantidade: Number(i.quantidade), preco_unit: Number(i.preco_unit), desconto: Number(i.desconto),
      total: Math.max(0, Number(i.preco_unit) * Number(i.quantidade) - Number(i.desconto)),
    })),
    subtotal: totais.subtotal,
    desconto: totais.desconto,
    total: totais.total,
    condicoes: orcamento.condicoes,
    token: orcamento.token,
  };
  const visitas = resumoDeVisualizacoes(orcamento);

  return (
    <>
      <div className="shrink-0 p-5 pb-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {emGaveta ? (
              <SheetTitle className="vx-titulo-painel truncate">{codigo}</SheetTitle>
            ) : (
              <h2 className="vx-titulo-painel truncate">{codigo}</h2>
            )}
            <div className="mt-1 text-xs text-muted-foreground">
              {visitas ?? <SeloDeOrcamento orcamento={orcamento} />}
            </div>
          </div>
          {dono && <span title={dono} className={cn("shrink-0", emGaveta && "mr-8")}><Iniciais nome={dono} className={cn("h-7 w-7", tintaDe(dono))} /></span>}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5">
        {/* ── A proposta, como o cliente a lê ── */}
        <DocumentoDeOrcamento
          dados={documento}
          acoes={
            orcamento.status === "rascunho" ? (
              <Button className="w-full" onClick={marcarEnviado} disabled={atualizar.isPending}>
                {atualizar.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Marcar como enviado
              </Button>
            ) : orcamento.status === "enviado" && estado !== "expirado" ? (
              <Button className="w-full" onClick={() => setAceitando(true)}>Aceitar proposta</Button>
            ) : (
              <Button className="w-full" disabled variant="secondary">
                {aprovado ? "Proposta aceita" : orcamento.status === "recusado" ? "Proposta recusada" : "Proposta vencida"}
              </Button>
            )
          }
        />

        {/* ── Ações ── */}
        <section className="vx-nao-imprime space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" onClick={copiar}>
              {copiado ? <Check className="mr-1 h-3.5 w-3.5 text-success" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
              {copiado ? "Copiado" : "Copiar link"}
            </Button>
            <Button variant="outline" size="sm"
              disabled={!orcamento.contact?.email}
              title={orcamento.contact?.email ? undefined : "O contato não tem e-mail"}
              onClick={() => setCompondo(true)}>
              <Mail className="mr-1 h-3.5 w-3.5" />E-mail
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={link} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-3.5 w-3.5" />Ver como cliente
              </a>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {/* Editar só antes da decisão: mudar item de orçamento já aprovado
                faria o CRM discordar do que o cliente aprovou por escrito. */}
            <Button
              variant="ghost" size="sm"
              disabled={!!orcamento.decidido_em}
              title={orcamento.decidido_em ? "O cliente já respondeu — não dá para alterar" : undefined}
              onClick={() => aoEditar(orcamento)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />Editar
            </Button>
            <Button variant="ghost" size="sm" onClick={salvarComoModelo} disabled={linhas.length === 0}>
              <BookmarkPlus className="mr-1 h-3.5 w-3.5" />Salvar como modelo
            </Button>
          </div>
        </section>

        {/* ── O ciclo ── */}
        <section className="space-y-1.5 text-xs">
          {[
            ["Criado", orcamento.created_at],
            ["Enviado", orcamento.enviado_em],
            ["Visto pelo cliente", orcamento.visto_em],
            ["Última visualização", orcamento.ultima_visualizacao_em && orcamento.ultima_visualizacao_em !== orcamento.visto_em ? orcamento.ultima_visualizacao_em : null],
            [
              orcamento.status === "recusado" ? "Recusado" : "Aprovado",
              orcamento.decidido_em,
            ],
          ].map(([rotulo, quando]) =>
            quando ? (
              <div key={rotulo as string} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{rotulo}</span>
                <span className="tabular-nums">{formatarDataHora(quando as string)}</span>
              </div>
            ) : null,
          )}
          {orcamento.decidido_por && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Por</span>
              <span className="truncate font-medium">{orcamento.decidido_por}</span>
            </div>
          )}
          {orcamento.motivo_recusa && (
            <p className="mt-1 rounded-md bg-destructive-soft p-2 leading-relaxed text-destructive">
              “{orcamento.motivo_recusa}”
            </p>
          )}
        </section>

        {/* ── Sugerir atualizar o negócio ── */}
        {divergeDoNegocio && (
          /* SUGERE, não sobrescreve. `deals.value` pode ter sido ajustado à
             mão, e gravar sozinho apagaria a decisão de alguém sem avisar. */
          <section className="space-y-2 rounded-lg border border-primary/30 bg-accent p-3">
            <p className="text-xs leading-relaxed">
              O negócio está em <strong>{formatarMoeda(valorDoNegocio!, orcamento.moeda)}</strong> e
              este orçamento aprovado soma <strong>{formatarMoeda(totais.total, orcamento.moeda)}</strong>.
            </p>
            <Button size="sm" className="w-full" onClick={sincronizarValor}
              disabled={atualizarNegocio.isPending}>
              {atualizarNegocio.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Atualizar o negócio para {formatarMoeda(totais.total, orcamento.moeda)}
            </Button>
          </section>
        )}

        {orcamento.observacoes && (
          <section className="rounded-lg border border-border p-3">
            <p className="text-label font-semibold uppercase tracking-wide text-muted-foreground">
              Observação interna
            </p>
            <p className="mt-1 text-xs leading-relaxed">{orcamento.observacoes}</p>
            <p className="mt-1.5 text-label text-muted-foreground/70">
              Não aparece na página do cliente.
            </p>
          </section>
        )}
      </div>

      <FormularioDeModelo inicial={comoModelo} aoFechar={() => setComoModelo(null)} />

      <Dialog open={aceitando} onOpenChange={setAceitando}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="vx-titulo-painel">Registrar aceite de {codigo}?</DialogTitle>
            <DialogDescription className="text-xs">
              Use quando o cliente aceitou fora do link (telefone, WhatsApp). O orçamento passa a
              “Aceito” e deixa de poder ser editado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAceitando(false)} disabled={atualizar.isPending}>Cancelar</Button>
            <Button size="sm" onClick={aceitar} disabled={atualizar.isPending}>
              {atualizar.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Registrar aceite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* O compositor já vincula ao contato e ao negócio, então o envio entra no
          histórico. O link vai no corpo. */}
      <EmailComposeModal
        open={compondo}
        onOpenChange={setCompondo}
        defaultTo={orcamento.contact?.email || ""}
        defaultContactId={orcamento.contact_id}
        defaultDealId={orcamento.deal_id ?? undefined}
        onSent={() => {
          setCompondo(false);
          if (orcamento.status === "rascunho") void marcarEnviado();
        }}
      />
    </>
  );
}
