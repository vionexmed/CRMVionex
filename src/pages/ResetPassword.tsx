import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AuthErro, AuthShell, AuthTitulo, CampoSenha } from "@/components/auth/AuthShell";
import { mensagemErroAuth } from "@/lib/erro-auth";
import { cn } from "@/lib/utils";

const MINIMO = 6;

/**
 * Nova senha, a partir do link de recuperação.
 *
 * Sem o link válido, a tela antes mandava para a entrada SEM dizer nada -- quem
 * abria um link expirado via a tela de login e achava que o clique não tinha
 * funcionado. Agora diz que o link venceu e oferece pedir outro.
 *
 * Válido = a URL ainda traz `type=recovery`, OU o Supabase já trocou o token
 * por sessão (ele limpa o hash ao processar, e isso pode acontecer antes deste
 * efeito rodar).
 */
export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [estado, setEstado] = useState<"verificando" | "valido" | "invalido">("verificando");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let cancelado = false;
    if (window.location.hash.includes("type=recovery")) { setEstado("valido"); return; }
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelado) setEstado(data.session ? "valido" : "invalido");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") setEstado("valido");
    });
    return () => { cancelado = true; subscription.unsubscribe(); };
  }, []);

  const curta = password.length > 0 && password.length < MINIMO;
  const diferentes = confirmacao.length > 0 && confirmacao !== password;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MINIMO) { setErro(`A senha precisa ter pelo menos ${MINIMO} caracteres.`); return; }
    if (password !== confirmacao) { setErro("As duas senhas não são iguais."); return; }
    setLoading(true);
    setErro(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setErro(mensagemErroAuth(error)); return; }
    toast({ title: "Senha atualizada", description: "Você já está dentro do CRM." });
    navigate("/dashboard");
  };

  if (estado === "verificando") {
    return (
      <AuthShell>
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />Conferindo o link…
        </p>
      </AuthShell>
    );
  }

  if (estado === "invalido") {
    return (
      <AuthShell>
        <AuthTitulo titulo="Link expirado" apoio="Este link de recuperação já foi usado ou passou do prazo. Peça um novo na tela de entrada." />
        <Button className="h-10 w-full" onClick={() => navigate("/")}>Ir para a entrada</Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthTitulo titulo="Criar nova senha" apoio="Escolha a senha que você vai usar para entrar daqui em diante." />
      <form onSubmit={handleReset} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-password">Nova senha</Label>
          <CampoSenha id="new-password" autoComplete="new-password" placeholder={`Mínimo de ${MINIMO} caracteres`}
            minLength={MINIMO} value={password} onChange={setPassword} invalido={curta} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Repita a nova senha</Label>
          <CampoSenha id="confirm-password" autoComplete="new-password" minLength={MINIMO}
            value={confirmacao} onChange={setConfirmacao} invalido={diferentes} />
        </div>
        {/* Os dois requisitos à vista ENQUANTO se digita, e não só depois do
            envio: quem erra a repetição descobre antes de clicar. */}
        <ul className="space-y-1 text-xs" aria-live="polite">
          <Requisito ok={password.length >= MINIMO}>Pelo menos {MINIMO} caracteres</Requisito>
          <Requisito ok={password.length > 0 && password === confirmacao}>As duas senhas são iguais</Requisito>
        </ul>
        <AuthErro mensagem={erro} />
        <Button type="submit" className="h-10 w-full" disabled={loading}>
          {loading ? <><Loader2 aria-hidden="true" className="animate-spin" />Salvando…</> : "Salvar nova senha"}
        </Button>
      </form>
    </AuthShell>
  );
}

function Requisito({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icone = ok ? Check : X;
  return (
    <li className={cn("flex items-center gap-1.5", ok ? "text-success" : "text-muted-foreground")}>
      <Icone aria-hidden="true" className="h-3.5 w-3.5" />{children}
    </li>
  );
}
