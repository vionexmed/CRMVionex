import { mensagemErro } from "@/lib/erro-supabase";

/**
 * Erros do Supabase Auth em português, com o que fazer a seguir.
 *
 * A tela de entrada mostrava `error.message` cru: "Invalid login credentials"
 * em inglês, na primeira tela do produto. Pior que o idioma é a falta de
 * direção -- "credenciais inválidas" não diz se o problema é o e-mail, a senha
 * ou uma confirmação pendente, e cada um pede uma ação diferente.
 *
 * Casa por TRECHO da mensagem e não por código: o `code` do Auth só existe nas
 * versões novas do servidor, e a mensagem é o que todas devolvem.
 */
const TRECHOS: [RegExp, string][] = [
  [/invalid login credentials/i, "E-mail ou senha incorretos. Confira os dois ou recupere a senha."],
  [/email not confirmed/i, "Este e-mail ainda não foi confirmado. Abra o link que enviamos no cadastro."],
  [/user already registered|already been registered/i, "Já existe uma conta com este e-mail. Entre ou recupere a senha."],
  [/password should be at least (\d+)/i, "A senha precisa ter pelo menos $1 caracteres."],
  [/new password should be different/i, "A nova senha precisa ser diferente da atual."],
  [/for security purposes.*after (\d+) seconds?/i, "Aguarde $1 segundos antes de pedir outro e-mail."],
  [/email rate limit exceeded|rate limit/i, "Muitas tentativas seguidas. Aguarde um minuto e tente de novo."],
  [/unable to validate email address|invalid email/i, "Este e-mail não parece válido. Confira o endereço."],
  [/signups not allowed|signup is disabled/i, "O cadastro aberto está desativado. Peça um convite a quem administra o CRM."],
  [/auth session missing|session.*expired|token.*expired|otp.*expired/i, "O link expirou ou já foi usado. Peça um novo."],
  [/failed to fetch|network/i, "Sem conexão com o servidor. Verifique a internet e tente de novo."],
];

export function mensagemErroAuth(e: unknown): string {
  const original = mensagemErro(e);
  for (const [padrao, frase] of TRECHOS) {
    const m = original.match(padrao);
    if (m) return frase.replace("$1", m[1] ?? "");
  }
  return original;
}
