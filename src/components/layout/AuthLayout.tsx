import { useId, type ReactNode } from "react";
import vionexLogo from "@/assets/vionex-logo-sidebar.png";

/** Formulário livre no mesmo eixo da marca, sem cartão ou conteúdo promocional. */
export function AuthLayout({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <main className="flex min-h-dvh flex-col bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-sm"><img src={vionexLogo} alt="Vionex" className="h-auto w-32" /></div>
      <section aria-labelledby={titleId} className="mx-auto my-auto w-full max-w-sm py-8">
        <header className="mb-6"><h1 id={titleId} className="vx-titulo-tela">{title}</h1>{description && <p className="vx-subtitulo-tela">{description}</p>}</header>
        {children}
      </section>
    </main>
  );
}
