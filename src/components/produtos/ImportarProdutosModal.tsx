import { useRef, useState } from "react";
import { Loader2, Table2, Upload } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SeloComPonto } from "@/components/layout/ListaV1";
import { useToast } from "@/hooks/use-toast";
import { mensagemErro } from "@/lib/erro-supabase";
import { detectarSeparador, lerTexto, parseCSV } from "@/lib/csv";
import { formatarMoeda, pluralizar } from "@/lib/formato";
import { produtosApi, type Produto } from "@/lib/api/produtos";
import { useOrg } from "@/hooks/useOrg";
import { useQueryClient } from "@tanstack/react-query";
import {
  CAMPOS_DE_PRODUTO, mapearColunasDeProduto, planejarProdutos, type LinhaPlanejada,
} from "@/lib/importar-produtos";

const ROTULO: Record<LinhaPlanejada["situacao"], string> = {
  novo: "Novo", existe: "Já existe", repetido: "Repetido", invalido: "Inválido",
};
const TOM = { novo: "sucesso", existe: "neutro", repetido: "neutro", invalido: "perigo" } as const;

/**
 * Importar produtos de uma planilha, no padrão do importador de contatos:
 * escolher o arquivo, ver a PRÉVIA do que vai acontecer com cada linha, e só
 * então gravar. Quem já está no catálogo (mesmo nome ou código) não é
 * duplicado nem tem o preço sobrescrito.
 */
export function ImportarProdutosModal({
  aberto, aoFechar, existentes,
}: {
  aberto: boolean;
  aoFechar: () => void;
  existentes: Pick<Produto, "nome" | "sku">[];
}) {
  const { toast } = useToast();
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [arquivo, setArquivo] = useState("");
  const [plano, setPlano] = useState<LinhaPlanejada[] | null>(null);
  const [colunas, setColunas] = useState<string[]>([]);

  const fechar = () => { setPlano(null); setArquivo(""); setColunas([]); aoFechar(); };

  const aplicar = (linhas: string[][], nome: string) => {
    const naoVazias = linhas.filter((r) => r.some((c) => String(c ?? "").trim()));
    if (naoVazias.length < 2) {
      toast({ title: "Arquivo vazio", description: "Precisa de um cabeçalho e ao menos uma linha.", variant: "destructive" });
      return;
    }
    const mapa = mapearColunasDeProduto(naoVazias[0]);
    if (!mapa.includes("nome")) {
      toast({
        title: "Não achei a coluna de nome",
        description: "Use um cabeçalho como Nome ou Produto. Colunas aceitas: nome, descrição, preço, categoria.",
        variant: "destructive",
      });
      return;
    }
    setColunas(mapa.filter((c): c is NonNullable<typeof c> => !!c).map((c) => CAMPOS_DE_PRODUTO.find((x) => x.chave === c)!.rotulo));
    setArquivo(nome);
    setPlano(planejarProdutos(naoVazias.slice(1), mapa, existentes));
  };

  const aoEscolher = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setLendo(true);
    try {
      if (/\.xlsx?$/i.test(file.name)) {
        // Import dinâmico: a biblioteca de planilha só baixa para quem importa.
        const { readSheet } = await import("read-excel-file/browser");
        const linhas = await readSheet(file);
        aplicar(linhas.map((r) => r.map((c) => (c === null || c === undefined ? "" : c instanceof Date ? c.toISOString() : String(c)))), file.name);
      } else {
        const texto = await lerTexto(file);
        aplicar(parseCSV(texto, detectarSeparador(texto)), file.name);
      }
    } catch (err) {
      toast({ title: "Não consegui ler o arquivo", description: mensagemErro(err), variant: "destructive" });
    } finally {
      setLendo(false);
    }
  };

  const novos = plano?.filter((l) => l.situacao === "novo") ?? [];
  const contar = (s: LinhaPlanejada["situacao"]) => plano?.filter((l) => l.situacao === s).length ?? 0;

  const importar = async () => {
    if (!orgId || novos.length === 0) return;
    setGravando(true);
    try {
      await produtosApi.criarVarios(orgId, novos.map((l) => l.produto!));
      await qc.invalidateQueries({ queryKey: ["produtos", orgId] });
      toast({ title: `${novos.length} ${pluralizar(novos.length, "produto importado", "produtos importados")}` });
      fechar();
    } catch (err) {
      toast({ title: "Não foi possível importar", description: mensagemErro(err), variant: "destructive" });
    } finally {
      setGravando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Importar produtos</DialogTitle>
          <DialogDescription className="text-xs">
            {plano
              ? `Prévia de ${arquivo}: confira antes de importar.`
              : "Envie um .csv ou .xlsx com nome, descrição, preço e categoria."}
          </DialogDescription>
        </DialogHeader>

        {!plano ? (
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={lendo}
            className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {lendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <span>{lendo ? "Lendo o arquivo…" : "Escolher arquivo"}</span>
            <span className="text-label">Primeira linha = cabeçalho. Só a coluna de nome é obrigatória.</span>
          </button>
        ) : (
          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <Table2 className="h-4 w-4" aria-hidden="true" />
              <span>Colunas lidas: {colunas.join(", ")}</span>
            </p>
            <p className="text-xs">
              <strong>{novos.length}</strong> {pluralizar(novos.length, "novo")} ·{" "}
              {contar("existe")} já {pluralizar(contar("existe"), "existe", "existem")} ·{" "}
              {contar("repetido")} {pluralizar(contar("repetido"), "repetido")} ·{" "}
              {contar("invalido")} {pluralizar(contar("invalido"), "inválido")}
            </p>
            <div className="vx-table max-h-72 overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Linha</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plano.slice(0, 100).map((l) => (
                    <TableRow key={l.linha}>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">{l.linha}</TableCell>
                      <TableCell className="text-xs font-medium">{l.nomeBruto || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.produto?.categoria ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {l.produto ? formatarMoeda(l.produto.preco) : "—"}
                      </TableCell>
                      <TableCell>
                        <SeloComPonto tom={TOM[l.situacao]}>{ROTULO[l.situacao]}</SeloComPonto>
                        {l.motivo && l.situacao === "invalido" && (
                          <span className="ml-2 text-label text-muted-foreground">{l.motivo}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {plano.length > 100 && (
              <p className="text-label text-muted-foreground">Mostrando as 100 primeiras de {plano.length} linhas.</p>
            )}
          </div>
        )}

        <input ref={entrada} type="file" accept=".csv,.xlsx,.xls,text/csv" className="hidden" onChange={aoEscolher} />

        <DialogFooter className="gap-2">
          {plano && (
            <Button variant="ghost" size="sm" className="h-8 text-label" onClick={() => setPlano(null)} disabled={gravando}>
              Trocar arquivo
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-8 text-label" onClick={fechar} disabled={gravando}>
            Cancelar
          </Button>
          {plano && (
            <Button size="sm" className="h-8 text-label" onClick={importar} disabled={gravando || novos.length === 0}>
              {gravando && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Importar {novos.length} {pluralizar(novos.length, "produto")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
