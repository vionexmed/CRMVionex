import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { AuthErro, AuthShell, AuthTitulo, CampoSenha } from "@/components/auth/AuthShell";
import { mensagemErroAuth } from "@/lib/erro-auth";

/**
 * Os quatro caminhos de acesso, um de cada vez.
 *
 * Eram três abas -- Entrar, Cadastrar, Link por e-mail -- com peso igual, e a
 * recuperação de senha era um link que disparava o e-mail NA HORA, usando o
 * que estivesse no campo (ou um toast "Digite seu email" se estivesse vazio).
 * Quem chega aqui quer entrar em 95% das vezes: entrar é a tela, e os outros
 * caminhos são links que trocam o formulário e sabem voltar.
 */
type Modo = "entrar" | "cadastrar" | "link" | "recuperar";

export default function Login() {
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /** E-mail enviado (link de acesso, recuperação ou confirmação de cadastro). */
  const [enviado, setEnviado] = useState<null | "link" | "recuperar" | "cadastro">(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  // Trocar de caminho limpa o erro do anterior; o e-mail digitado fica.
  const irPara = (m: Modo) => { setModo(m); setErro(null); setEnviado(null); };

  const executar = async (acao: () => Promise<void>) => {
    setLoading(true);
    setErro(null);
    try {
      await acao();
    } catch (e: unknown) {
      setErro(mensagemErroAuth(e));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    void executar(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      navigate("/dashboard");
    });
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    void executar(async () => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      // Com sessão, o useEffect([user]) redireciona assim que o AuthContext
      // tiver o usuário -- ele tem a própria espera pelo perfil. Sem sessão, o
      // projeto exige confirmação por e-mail.
      if (!data.session) setEnviado("cadastro");
    });
  };

  const handleMagicLink = (e: React.FormEvent) => {
    e.preventDefault();
    void executar(async () => {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setEnviado("link");
    });
  };

  const handleRecuperar = (e: React.FormEvent) => {
    e.preventDefault();
    void executar(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setEnviado("recuperar");
    });
  };

  const campoEmail = (id: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>E-mail</Label>
      <Input
        id={id}
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="voce@empresa.com.br"
        className="h-10"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoFocus
      />
    </div>
  );

  const botao = (rotulo: string, carregando: string) => (
    <Button type="submit" className="h-10 w-full" disabled={loading}>
      {loading ? <><Loader2 aria-hidden="true" className="animate-spin" />{carregando}</> : rotulo}
    </Button>
  );

  const voltar = (
    <button type="button" onClick={() => irPara("entrar")}
      className="mb-6 inline-flex items-center gap-1.5 rounded text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />Voltar para entrar
    </button>
  );

  if (enviado) {
    const textos = {
      link: { titulo: "Confira seu e-mail", apoio: "Enviamos um link de acesso para", depois: "Abra o link neste navegador para entrar. Ele vale por uma hora." },
      recuperar: { titulo: "Confira seu e-mail", apoio: "Enviamos o link para criar uma nova senha para", depois: "Abra o link e escolha a nova senha. Se não chegar em alguns minutos, olhe a caixa de spam." },
      cadastro: { titulo: "Confirme seu e-mail", apoio: "Sua conta foi criada. Enviamos a confirmação para", depois: "Depois de confirmar, volte aqui e entre com sua senha." },
    }[enviado];
    return (
      <AuthShell>
        {voltar}
        <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <MailCheck aria-hidden="true" className="h-5 w-5" />
        </span>
        <AuthTitulo titulo={textos.titulo} apoio={<>{textos.apoio} <strong className="font-semibold text-foreground">{email.trim()}</strong>.</>} />
        <p className="text-sm leading-relaxed text-muted-foreground">{textos.depois}</p>
        {enviado !== "cadastro" && (
          <Button variant="outline" className="mt-6 h-10 w-full" disabled={loading}
            onClick={() => void executar(async () => {
              const { error } = enviado === "link"
                ? await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } })
                : await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
              if (error) throw error;
            })}>
            {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}Enviar de novo
          </Button>
        )}
        <div className="mt-4"><AuthErro mensagem={erro} /></div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {modo === "entrar" && (
        <>
          <AuthTitulo titulo="Entrar no Vionex" apoio="Use o e-mail e a senha da sua conta." />
          <form onSubmit={handleLogin} className="space-y-4">
            {campoEmail("login-email")}
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="login-password">Senha</Label>
                <button type="button" onClick={() => irPara("recuperar")}
                  className="rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Esqueceu a senha?
                </button>
              </div>
              <CampoSenha id="login-password" autoComplete="current-password" value={password} onChange={setPassword} invalido={!!erro} />
            </div>
            <AuthErro mensagem={erro} />
            {botao("Entrar", "Entrando…")}
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" className="h-10 w-full" onClick={() => irPara("link")}>
            Receber link de acesso por e-mail
          </Button>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <button type="button" onClick={() => irPara("cadastrar")}
              className="rounded font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Criar conta
            </button>
          </p>
        </>
      )}

      {modo === "cadastrar" && (
        <>
          {voltar}
          <AuthTitulo titulo="Criar conta" apoio="Para quem vai montar o CRM da empresa. Se alguém da sua equipe já usa o Vionex, peça um convite." />
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="signup-name">Nome</Label>
              <Input id="signup-name" autoComplete="name" placeholder="Seu nome completo" className="h-10"
                value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            {campoEmail("signup-email")}
            <div className="space-y-1.5">
              <Label htmlFor="signup-password">Senha</Label>
              <CampoSenha id="signup-password" autoComplete="new-password" placeholder="Mínimo de 6 caracteres" minLength={6}
                value={password} onChange={setPassword} invalido={!!erro} />
            </div>
            <AuthErro mensagem={erro} />
            {botao("Criar conta", "Criando conta…")}
          </form>
        </>
      )}

      {modo === "link" && (
        <>
          {voltar}
          <AuthTitulo titulo="Entrar sem senha" apoio="Mandamos um link para o seu e-mail. É só abrir para entrar." />
          <form onSubmit={handleMagicLink} className="space-y-4">
            {campoEmail("magic-email")}
            <AuthErro mensagem={erro} />
            {botao("Enviar link de acesso", "Enviando…")}
          </form>
        </>
      )}

      {modo === "recuperar" && (
        <>
          {voltar}
          <AuthTitulo titulo="Recuperar senha" apoio="Informe o e-mail da conta. Enviamos um link para você criar uma nova senha." />
          <form onSubmit={handleRecuperar} className="space-y-4">
            {campoEmail("reset-email")}
            <AuthErro mensagem={erro} />
            {botao("Enviar link de recuperação", "Enviando…")}
          </form>
        </>
      )}
    </AuthShell>
  );
}
