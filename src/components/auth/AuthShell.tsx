import { useState, type ReactNode } from "react";
import { AlertCircle, Eye, EyeOff, Handshake, Inbox, Receipt } from "lucide-react";
import vionexLogo from "@/assets/vionex-logo-sidebar.png";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A casca das telas de ACESSO: entrar, nova senha e aceite de convite.
 *
 * Eram três layouts diferentes -- a entrada com painel de marca em verde
 * petróleo cravado em hex, e as outras duas com um ícone de aperto de mão num
 * quadrado e um cartão solto no meio da página. Quem clicava em "esqueci a
 * senha" saía do produto visualmente.
 *
 * O painel da marca usa os tokens da LATERAL (`--sidebar-*`): é o mesmo navy
 * que a pessoa vai ver ao entrar, então a transição da tela de acesso para o
 * CRM não troca de identidade. No celular o painel some e fica só o logo.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-card lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside
        aria-label="Vionex CRM"
        className="relative hidden flex-col justify-between gap-12 overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex xl:p-16"
      >
        <img src={vionexLogo} alt="VIONEX" className="h-10 w-auto self-start" />

        <div className="max-w-[460px]">
          <p className="text-label font-semibold uppercase tracking-[0.12em] text-sidebar-muted">CRM para o comercial da saúde</p>
          {/* Parágrafo, não título: o título da página é o do formulário. */}
          <p className="mt-4 text-3xl font-bold leading-[1.12] tracking-[-0.025em] text-white xl:text-4xl">
            Do primeiro contato ao contrato assinado.
          </p>
          <ul className="mt-10 space-y-5">
            <Destaque icone={Inbox} titulo="Uma fila de leads só">
              Evento, formulário, importação e WhatsApp chegam no mesmo lugar, com origem e responsável.
            </Destaque>
            <Destaque icone={Handshake} titulo="Funil com próximo passo">
              Cada negócio mostra valor, etapa e o que falta fazer, sem planilha paralela.
            </Destaque>
            <Destaque icone={Receipt} titulo="Orçamento por link">
              O cliente abre, revisa e aprova pelo navegador, e o negócio anda sozinho.
            </Destaque>
          </ul>
        </div>

        <p className="text-xs text-sidebar-muted">Vionex · Gestão de relacionamento comercial</p>
      </aside>

      <main className="flex min-h-dvh items-start justify-center px-5 py-10 sm:items-center sm:px-8">
        <div className="w-full max-w-[400px]">
          <img src={vionexLogo} alt="VIONEX" className="mb-10 h-9 w-auto lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}

function Destaque({ icone: Icone, titulo, children }: { icone: typeof Inbox; titulo: string; children: ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-foreground">
        <Icone aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">{titulo}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-sidebar-foreground/85">{children}</span>
      </span>
    </li>
  );
}

/** Título e linha de apoio do formulário: os mesmos nas três telas. */
export function AuthTitulo({ titulo, apoio }: { titulo: string; apoio?: ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="vx-titulo-tela">{titulo}</h1>
      {apoio && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{apoio}</p>}
    </div>
  );
}

/**
 * O erro DENTRO do formulário, junto do botão que falhou.
 *
 * Era só toast: some em cinco segundos, aparece no canto oposto ao foco e o
 * leitor de tela pode nem anunciar. Aqui ele fica até a próxima tentativa.
 */
export function AuthErro({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null;
  return (
    <div role="alert" className="flex gap-2.5 rounded-md border border-destructive/25 bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{mensagem}</span>
    </div>
  );
}

/**
 * Senha com mostrar/ocultar e aviso de Caps Lock.
 *
 * Os dois resolvem o erro mais comum de entrada que não é esquecimento: digitar
 * certo com a tecla errada travada, sem ver o que foi digitado.
 */
export function CampoSenha({
  id, value, onChange, autoComplete, placeholder, minLength, invalido,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  minLength?: number;
  invalido?: boolean;
}) {
  const [visivel, setVisivel] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const lerCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.("CapsLock") ?? false);
  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          type={visivel ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={lerCaps}
          onKeyDown={lerCaps}
          onBlur={() => setCapsLock(false)}
          aria-invalid={invalido || undefined}
          aria-describedby={capsLock ? `${id}-caps` : undefined}
          className="h-10 pr-11"
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visivel}
          className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {visivel ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
        </button>
      </div>
      {capsLock && <p id={`${id}-caps`} className={cn("mt-1.5 text-xs font-medium text-warning")}>Caps Lock está ativado.</p>}
    </div>
  );
}
