import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Moon, Sun, Monitor, type LucideIcon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

/**
 * Cada opção carrega o HSL do próprio tom (o mesmo `light` do ThemeContext) e o
 * da lateral. Como a prévia mostra uma cor que NÃO é a atual, `hsl(var(--primary))`
 * não serve: o estilo inline é de propósito, só para esses miniaturas.
 */
const DIRECOES = [
  { value: "blue", nome: "A · Azul Vionex", hex: "#2F5BEA", lateral: "lateral navy",
    desc: "Confiança e clareza, com contraste forte na navegação.",
    cor: "hsl(226 82% 55%)", barra: "hsl(222 55% 12%)" },
  { value: "violet", nome: "B · Violeta", hex: "#6D4AFF", lateral: "lateral grafite",
    desc: "Moderna e tecnológica, com um tom mais jovem.",
    cor: "hsl(252 100% 62%)", barra: "hsl(250 25% 11%)" },
  { value: "emerald", nome: "C · Esmeralda", hex: "#0B8A6B", lateral: "lateral verde-escura",
    desc: "Saúde e cuidado, próxima do universo das clínicas.",
    cor: "hsl(165 85% 25%)", barra: "hsl(165 55% 9%)" },
] as const;

const OUTRAS = [
  { value: "teal", label: "Teal", cor: "hsl(187 100% 25%)" },
  { value: "orange", label: "Laranja", cor: "hsl(25 95% 34%)" },
  { value: "rose", label: "Rosa", cor: "hsl(347 77% 45%)" },
] as const;

const TEMAS: { value: "light" | "dark" | "system"; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

const DENSIDADES = [
  { value: "compact" as const, label: "Compacta", desc: "Menos espaçamento, mais dados visíveis" },
  { value: "normal" as const, label: "Normal", desc: "Espaçamento padrão" },
  { value: "comfortable" as const, label: "Confortável", desc: "Mais espaçamento, leitura facilitada" },
];

const opcao = (ativa: boolean) =>
  cn(
    "rounded-lg border bg-card text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    ativa ? "border-primary ring-1 ring-primary" : "border-border hover:bg-accent/50",
  );

export function AppearanceTab() {
  const { theme, setTheme, density, setDensity, accentColor, setAccentColor } = useTheme();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="vx-titulo-secao">Direções visuais</CardTitle>
          <CardDescription>Escolha a cor de destaque. Vale para você em todas as telas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {DIRECOES.map((d) => {
              const ativa = accentColor === d.value;
              return (
                <button key={d.value} type="button" aria-pressed={ativa} onClick={() => setAccentColor(d.value)}
                  className={cn(opcao(ativa), "overflow-hidden")}>
                  <div className="flex h-28 bg-surface-2" aria-hidden="true">
                    <div className="w-1/3 space-y-1.5 p-3" style={{ backgroundColor: d.barra }}>
                      <div className="h-4 w-4 rounded-sm" style={{ backgroundColor: d.cor }} />
                      <div className="h-1.5 rounded-full" style={{ backgroundColor: d.cor }} />
                      <div className="h-1.5 rounded-full bg-white/20" />
                      <div className="h-1.5 rounded-full bg-white/20" />
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-3">
                      <span className="text-xl font-semibold text-foreground">Aa 123</span>
                      <span className="w-fit rounded-md px-2.5 py-1 text-label font-medium text-white" style={{ backgroundColor: d.cor }}>
                        Novo negócio
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{d.nome}</span>
                      {ativa && <Badge variant="success">Em uso</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{d.hex} · {d.lateral}</p>
                    <p className="text-xs">{d.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="mr-1 text-label font-semibold uppercase tracking-wider text-muted-foreground">Outras cores</span>
            {OUTRAS.map((o) => {
              const ativa = accentColor === o.value;
              return (
                <button key={o.value} type="button" aria-pressed={ativa} onClick={() => setAccentColor(o.value)}
                  className={cn(opcao(ativa), "flex min-h-8 items-center gap-2 px-3 text-xs font-medium")}>
                  <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: o.cor }} aria-hidden="true" />
                  {o.label}
                  {ativa && <Badge variant="success">Em uso</Badge>}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="vx-titulo-secao">Tema</CardTitle>
          <CardDescription>Escolha entre modo claro, escuro ou automático</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {TEMAS.map((t) => {
              const Icon = t.icon;
              const ativa = theme === t.value;
              return (
                <button key={t.value} type="button" aria-pressed={ativa} onClick={() => setTheme(t.value)}
                  className={cn(opcao(ativa), "flex flex-col items-center gap-2 p-4")}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="vx-titulo-secao">Densidade</CardTitle>
          <CardDescription>Espaçamento de tabelas e listas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {DENSIDADES.map((d) => (
              <button key={d.value} type="button" aria-pressed={density === d.value} onClick={() => setDensity(d.value)}
                className={cn(opcao(density === d.value), "p-3")}>
                <p className="text-xs font-semibold">{d.label}</p>
                <p className="mt-0.5 text-label text-muted-foreground">{d.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
