import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, XCircle, Clock, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatarMoeda, formatarData } from "@/lib/formato";
import { CartaoDaProposta } from "@/components/orcamentos/CartaoDaProposta";
import { dataCurtaSemPonto } from "@/lib/orcamento-resumo";
import { cn } from "@/lib/utils";

type ItemPublico = {
  nome: string; descricao: string | null; unidade: string;
  preco_unit: number; quantidade: number; desconto: number; total: number;
};

type OrcamentoPublicoDados = {
  numero: number;
  titulo: string | null;
  empresa: string | null;
  /** "Hospital São Lucas · Dr. Henrique Prado": para quem é a proposta. */
  para?: string | null;
  /** Condições de pagamento que o cliente lê (não é a observação interna). */
  condicoes?: string | null;
  status: string;
  valido_ate: string | null;
  expirado: boolean;
  moeda: string;
  itens: ItemPublico[];
  subtotal: number;
  desconto: number;
  total: number;
  decidido_em: string | null;
  decidido_por: string | null;
  motivo_recusa: string | null;
};

const URL_FUNCAO = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/orcamento-publico`;

/**
 * O orçamento como o CLIENTE vê — sem login, sem CRM em volta.
 *
 * A página é servida pelo APP (Vercel), e não pela edge function. O runtime das
 * Edge Functions troca `text/html` por `text/plain` + `nosniff`, então uma
 * página devolvida por lá apareceria como código-fonte. A função devolve JSON;
 * esta tela desenha.
 *
 * Fora do `ProtectedRoute` e sem a casca do CRM: quem abre isto é alguém que
 * não tem conta, e mostrar barra lateral, busca e menu da conta só criaria
 * portas fechadas.
 */
export default function OrcamentoPublico() {
  const { token } = useParams<{ token: string }>();

  const [dados, setDados] = useState<OrcamentoPublicoDados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [nome, setNome] = useState("");
  const [motivo, setMotivo] = useState("");
  const [recusando, setRecusando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`${URL_FUNCAO}?token=${encodeURIComponent(token ?? "")}`);
        const j = await r.json();
        if (!vivo) return;
        if (!r.ok) setErro(j?.error ?? "Não foi possível abrir o orçamento.");
        else setDados(j);
      } catch {
        if (vivo) setErro("Não foi possível abrir o orçamento. Verifique sua conexão.");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [token]);

  const decidir = async (decisao: "aprovado" | "recusado") => {
    if (!nome.trim()) return;
    setEnviando(true);
    try {
      const r = await fetch(`${URL_FUNCAO}?token=${encodeURIComponent(token ?? "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisao, nome, motivo }),
      });
      const j = await r.json();
      // Mesmo em conflito (já decidido) ou vencido, a função devolve o
      // orçamento junto do erro — então a tela mostra o estado real em vez de
      // ficar presa no formulário.
      if (j?.numero) setDados(j);
      if (!r.ok) setErro(j?.error ?? "Não foi possível registrar sua resposta.");
    } catch {
      setErro("Não foi possível registrar sua resposta. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-semibold">{erro ?? "Orçamento não encontrado"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Confira o link ou peça um novo a quem enviou.
          </p>
        </div>
      </div>
    );
  }

  const decidido = !!dados.decidido_em;
  const aprovado = dados.status === "aprovado";
  const podeDecidir = !decidido && !dados.expirado;

  const marca = dados.empresa ?? "Vionex";
  const linhas = dados.itens.map((item) => ({
    nome: item.nome,
    apoio: item.descricao
      || `${item.quantidade} ${item.unidade} × ${formatarMoeda(item.preco_unit, dados.moeda)}${item.desconto > 0 ? ` − ${formatarMoeda(item.desconto, dados.moeda)}` : ""}`,
    valor: item.total,
  }));

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      {/* O MESMO cartão da prévia no CRM: quem vende e quem lê veem o mesmo
          documento. Só tokens, para seguir o tema do navegador. */}
      <article className="mx-auto max-w-md">
        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <CartaoDaProposta
            marca={marca}
            validade={dados.valido_ate ? dataCurtaSemPonto(dados.valido_ate) : null}
            vencida={dados.expirado}
            para={dados.para || dados.titulo || `Orçamento #${dados.numero}`}
            linhas={linhas}
            desconto={dados.desconto}
            total={dados.total}
            moeda={dados.moeda}
            condicoes={dados.condicoes}
          >
            {decidido ? (
              <div className="rounded-md bg-surface-2 p-4 text-center">
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  aprovado ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive",
                )}>
                  {aprovado ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {aprovado ? "Aprovado" : "Recusado"}
                </span>
                <p className="mt-2 text-sm font-medium">
                  {aprovado ? "Você aprovou este orçamento." : "Você recusou este orçamento."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dados.decidido_por} · {formatarData(dados.decidido_em)}
                </p>
                {dados.motivo_recusa && (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    “{dados.motivo_recusa}”
                  </p>
                )}
              </div>
            ) : dados.expirado ? (
              <div className="rounded-md bg-warning-soft p-4 text-center">
                <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-warning">
                  <Clock className="h-3.5 w-3.5" />Este orçamento venceu
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Peça um novo a quem enviou — os preços podem ter mudado.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Seu nome *</Label>
                  <Input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Como você assina"
                    className="text-sm"
                  />
                  {/* Dizer POR QUE o nome é pedido: sem isso, um campo obrigatório
                      numa página pública lê como coleta de dado. */}
                  <p className="text-label text-muted-foreground">
                    Fica registrado junto da sua resposta, para quem enviou saber quem respondeu.
                  </p>
                </div>

                {recusando && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">O que não ficou bom?</Label>
                    <Textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Preço, prazo, escopo… (opcional)"
                      className="min-h-[70px] text-sm"
                    />
                  </div>
                )}

                {erro && <p className="text-xs text-destructive">{erro}</p>}

                <Button
                  className="w-full"
                  disabled={!nome.trim() || enviando || !podeDecidir}
                  onClick={() => decidir("aprovado")}
                >
                  {enviando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Aceitar proposta
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={enviando || !podeDecidir}
                  onClick={() => (recusando ? decidir("recusado") : setRecusando(true))}
                >
                  {recusando ? "Confirmar recusa" : "Recusar"}
                </Button>
              </div>
            )}
          </CartaoDaProposta>
        </div>
      </article>

      <p className="mx-auto max-w-md py-4 text-center text-label text-muted-foreground">
        Este orçamento foi enviado por {dados.empresa ?? "seu contato"} · Nº {dados.numero}.
      </p>
    </div>
  );
}
