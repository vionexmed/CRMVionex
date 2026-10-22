import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { mensagemErro } from "@/lib/erro-supabase";
import { cnpjValido, formatarCnpj } from "@/lib/cnpj";
import { empresaVazia, type DadosDaEmpresa } from "@/lib/empresa-documento";
import { useEmpresaDoDocumento, useSalvarEmpresa } from "@/hooks/queries/useEmpresaDoDocumento";

const CAMPOS: { chave: keyof DadosDaEmpresa; rotulo: string; placeholder: string; largo?: boolean }[] = [
  { chave: "razao_social", rotulo: "Razão social", placeholder: "Vionex Serviços Ltda." },
  { chave: "cnpj", rotulo: "CNPJ", placeholder: "00.000.000/0000-00" },
  { chave: "endereco", rotulo: "Endereço", placeholder: "Rua, número, bairro, cidade/UF, CEP", largo: true },
  { chave: "telefone", rotulo: "Telefone", placeholder: "(11) 0000-0000" },
  { chave: "email", rotulo: "E-mail", placeholder: "contato@empresa.com.br" },
  { chave: "site", rotulo: "Site", placeholder: "www.empresa.com.br" },
];

/**
 * Os dados que aparecem como EMITENTE nos orçamentos. Campo vazio não aparece
 * no documento; CNPJ preenchido precisa fechar nos dígitos verificadores, para
 * não imprimir um número inventado num papel que o cliente vai guardar.
 */
export function EmpresaNosDocumentos() {
  const { toast } = useToast();
  const { data } = useEmpresaDoDocumento();
  const salvar = useSalvarEmpresa();
  const [form, setForm] = useState<DadosDaEmpresa>(empresaVazia());

  useEffect(() => { if (data) setForm(data.empresa); }, [data]);

  const cnpjInvalido = form.cnpj.trim() !== "" && !cnpjValido(form.cnpj);

  const gravar = async () => {
    try {
      await salvar.mutateAsync({ ...form, cnpj: form.cnpj ? formatarCnpj(form.cnpj) : "" });
      toast({ title: "Dados da empresa atualizados" });
    } catch (e: unknown) {
      toast({ title: "Não foi possível salvar", description: mensagemErro(e), variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="vx-titulo-secao">Dados da empresa nos documentos</CardTitle>
        <CardDescription>Aparecem como emitente nos orçamentos. Campo vazio não aparece.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {CAMPOS.map((c) => (
            <div key={c.chave} className={`space-y-1 ${c.largo ? "sm:col-span-2" : ""}`}>
              <Label className="text-xs" htmlFor={`empresa-${c.chave}`}>{c.rotulo}</Label>
              <Input
                id={`empresa-${c.chave}`}
                value={form[c.chave]}
                placeholder={c.placeholder}
                inputMode={c.chave === "cnpj" || c.chave === "telefone" ? "numeric" : undefined}
                aria-invalid={c.chave === "cnpj" && cnpjInvalido ? true : undefined}
                onChange={(e) => setForm({ ...form, [c.chave]: c.chave === "cnpj" ? formatarCnpj(e.target.value) : e.target.value })}
                className="h-8 text-xs"
              />
              {c.chave === "cnpj" && cnpjInvalido && (
                <p className="text-label text-destructive">CNPJ inválido: confira os dígitos.</p>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button size="sm" className="h-8 text-xs" onClick={gravar} disabled={cnpjInvalido || salvar.isPending}>
            {salvar.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}Salvar dados da empresa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
