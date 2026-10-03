import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Mail, Lock, User } from "lucide-react";
import vionexLogo from "@/assets/vionex-logo-sidebar.png";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { PageTabs } from "@/components/layout/PageTabs";
import { LogIn, UserPlus, Wand2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
    } else {
      navigate("/dashboard");
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
      } else if (data.session) {
        toast({ title: "Conta criada com sucesso!" });
        // Do NOT navigate manually — the useEffect([user]) will redirect to /dashboard
        // as soon as AuthContext sets the user (which has built-in profile retry).
      } else {
        toast({ title: "Conta criada!", description: "Verifique seu email para confirmar." });
      }
    } catch (err: any) {
      toast({ title: "Erro ao criar conta", description: err?.message || "Tente novamente", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setMagicLinkSent(true);
      toast({ title: "Link enviado!", description: "Verifique seu email." });
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: "Digite seu email", variant: "destructive" });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email enviado!", description: "Verifique seu email para redefinir a senha." });
    }
  };

  return (
    <div className="vx-login">
      <aside className="vx-login-brand" aria-label="Vionex CRM">
        <img src={vionexLogo} alt="VIONEX" />
        <div className="vx-login-story">
          <p className="!mb-5 !mt-0 text-xs uppercase tracking-[0.18em]">Comercial da saúde</p>
          <h2 className="vx-titulo-tela">Relacionamentos que<br />movem seu negócio.</h2>
          <p>Contatos, oportunidades e atendimento em um só lugar. Mais clareza para o próximo passo.</p>
        </div>
        <footer>Vionex · Gestão de relacionamentos</footer>
      </aside>
      <main className="vx-login-form">
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Seu espaço de trabalho</p>
          <h1 className="vx-titulo-tela">Acesse o CRM</h1>
          <p className="mt-2 text-sm text-muted-foreground">Entre para acompanhar sua operação comercial.</p>
          <Tabs defaultValue="login">

              <PageTabs
                abas={[
                  { valor: "login", rotulo: "Entrar", icone: LogIn },
                  { valor: "signup", rotulo: "Cadastrar", icone: UserPlus },
                  // "Magic Link" era a única expressão em inglês da tela de
                  // entrada -- a primeira coisa que alguém vê no produto.
                  { valor: "magic", rotulo: "Link por e-mail", icone: Wand2, rotuloCurto: "Link" },
                ]}
              />


            <div>
              <TabsContent value="login" className="mt-0 space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        autoComplete="email"
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        autoComplete="current-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-9"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0 space-y-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        placeholder="Seu nome"
                        className="pl-9"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        className="pl-9"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Criando conta..." : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="magic" className="mt-0 space-y-4">
                {magicLinkSent ? (
                  <div className="py-8 text-center">
                    <Mail className="mx-auto mb-4 h-12 w-12 text-primary" />
                    <h2 className="vx-titulo-painel mb-2">Verifique seu e-mail</h2>
                    <p className="text-sm text-muted-foreground">
                      Enviamos um link de acesso para <strong>{email}</strong>
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleMagicLink} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="magic-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="magic-email"
                          type="email"
                          placeholder="seu@email.com"
                          className="pl-9"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Enviando..." : "Enviar link de acesso"}
                    </Button>
                  </form>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
