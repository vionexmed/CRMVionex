import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACCENT_COLORS, FONTES, useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { TOKENS_CLARO, TOKENS_ESCURO, hslParaHex } from "./tokens";

/**
 * Cada direção carrega o HSL do próprio tom, lido de ACCENT_COLORS. A miniatura
 * mostra uma cor que NÃO é a atual, então `hsl(var(--primary))` não serve: o
 * estilo inline é de propósito, e nunca hex (o hex abaixo é só o rótulo).
 */
const DIRECOES = [
  { value: "blue", nome: "A · Azul Vionex", curto: "A — Azul Vionex", hex: hslParaHex(ACCENT_COLORS.blue.light) ?? "", lateral: "lateral navy",
    desc: "Confiança e clareza, com contraste forte na navegação.", barra: "hsl(222 55% 12%)", fundo: "hsl(220 23% 97%)" },
  { value: "violet", nome: "B · Violeta", curto: "B — Violeta", hex: hslParaHex(ACCENT_COLORS.violet.light) ?? "", lateral: "lateral grafite",
    desc: "Moderna e tecnológica, com um tom mais jovem.", barra: "hsl(250 25% 11%)", fundo: "hsl(250 23% 97%)" },
  { value: "emerald", nome: "C · Esmeralda", curto: "C — Esmeralda", hex: hslParaHex(ACCENT_COLORS.emerald.light) ?? "", lateral: "lateral verde-escura",
    desc: "Saúde e cuidado, próxima do universo das clínicas.", barra: "hsl(165 55% 9%)", fundo: "hsl(160 23% 96%)" },
] as const;

const NOMES_OUTRAS: Record<string, string> = { teal: "Teal", orange: "Laranja", rose: "Rosa" };
const NOMES_TEMA = { light: "Claro", dark: "Escuro", system: "Sistema" } as const;

const FONTES_CARTOES = [
  { value: "system", rotulo: "Fonte do sistema",
    nota: "A fonte nativa de cada computador. Onde ela não existe, o CRM usa a Inter, que tem o mesmo desenho limpo." },
  { value: "inter", rotulo: "Inter", nota: "A mesma fonte em qualquer computador ou celular." },
] as const;

const GRUPOS_TOKENS: { titulo: string; nomes: string[] }[] = [
  { titulo: "Neutros · superfícies", nomes: ["--background", "--surface-2", "--secondary", "--muted", "--card", "--popover"] },
  { titulo: "Neutros · linhas e texto", nomes: ["--border", "--input", "--muted-foreground", "--foreground"] },
  { titulo: "Marca", nomes: ["--primary", "--primary-hover", "--primary-active", "--ring", "--accent", "--accent-foreground", "--primary-foreground"] },
  { titulo: "Sucesso", nomes: ["--success", "--success-fill", "--success-soft", "--success-border", "--success-foreground"] },
  { titulo: "Atenção", nomes: ["--warning", "--warning-fill", "--warning-soft", "--warning-border", "--warning-foreground"] },
  { titulo: "Perigo", nomes: ["--destructive", "--destructive-fill", "--destructive-soft", "--destructive-border", "--destructive-foreground"] },
  { titulo: "Informação e neutro", nomes: ["--info", "--info-fill", "--info-soft", "--info-border", "--info-foreground", "--neutral", "--neutral-soft"] },
  { titulo: "Lateral", nomes: ["--sidebar-background", "--sidebar-foreground", "--sidebar-muted", "--sidebar-accent", "--sidebar-border"] },
];

const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 8];
const ETAPAS = [1, 2, 3, 4, 5, 6];

const ESCALA_TEXTO = [
  { classe: "text-label", rotulo: "label", px: "11px", uso: "rótulo, selo, legenda" },
  { classe: "text-xs", rotulo: "xs", px: "12px", uso: "corpo de tabela e formulário" },
  { classe: "text-sm", rotulo: "sm", px: "14px", uso: "título de bloco, subtítulo de tela" },
  { classe: "text-base", rotulo: "base", px: "16px", uso: "título de painel" },
  { classe: "text-lg", rotulo: "lg", px: "18px", uso: "título de seção em páginas de leitura" },
  { classe: "text-2xl", rotulo: "2xl", px: "24px", uso: "números de destaque" },
];

const RAIOS = [
  { classe: "rounded-md", rotulo: "controle", valor: "--radius-control" },
  { classe: "rounded-lg", rotulo: "superfície", valor: "--radius" },
];

const rotuloSecao = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

function Secao({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="vx-titulo-painel text-xl">{titulo}</h2>
        {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
      </div>
      {children}
    </section>
  );
}

function Amostra({ nome }: { nome: string }) {
  const claro = TOKENS_CLARO[nome], escuro = TOKENS_ESCURO[nome];
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className="h-8 w-8 shrink-0 rounded-md border border-border" style={{ backgroundColor: hslParaHex(claro) ? `hsl(var(${nome}))` : `var(${nome})` }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{nome}</p>
        <p className="truncate text-label text-muted-foreground">
          claro {hslParaHex(claro) ?? (claro?.startsWith("color-mix") ? "derivado da marca" : claro)} · escuro {hslParaHex(escuro) ?? (escuro?.startsWith("color-mix") ? "derivado da marca" : escuro)}
        </p>
      </div>
    </li>
  );
}

/** Página de leitura dos tokens em uso. Nada aqui é editado; o que muda é o ThemeContext. */
export function DesignSystemTab() {
  const { theme, accentColor, setAccentColor, font, setFont } = useTheme();
  const direcao = DIRECOES.find((d) => d.value === accentColor);
  const nomeDirecao = direcao?.curto ?? NOMES_OUTRAS[accentColor] ?? accentColor;

  return (
    <div className="space-y-6">
      <div className="grid items-center gap-6 rounded-[16px] bg-sidebar p-6 text-sidebar-foreground md:grid-cols-[minmax(0,1fr)_15rem] md:p-7">
        <div>
          <p className="text-label font-semibold uppercase tracking-widest text-sidebar-muted">Vionex Design System 2.0</p>
          <h2 className="vx-titulo-tela mt-3 text-white" style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.03em" }}>Um token muda, o CRM inteiro muda</h2>
          <p className="mt-4 max-w-[33rem] text-sm leading-5 text-sidebar-foreground">
            Esta página lê os valores em uso. Troque a direção, o tema ou a densidade em Aparência e todas as telas acompanham: Painel, Contatos, Negócios e o resto.
          </p>
        </div>
        <dl className="space-y-2.5">
          {[["Direção", nomeDirecao], ["Fontes", FONTES[font].nome], ["Tema", NOMES_TEMA[theme]]].map(([k, v]) => (
            <div key={k} className="flex h-[42px] items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-4">
              <dt className="text-sm text-sidebar-muted">{k}</dt>
              <dd className="text-sm font-semibold text-white">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <Secao titulo="Direções visuais" nota="Escolha em Aparência · vale para toda a empresa">
        <div className="grid gap-4 md:grid-cols-3">
          {DIRECOES.map((d) => {
            const ativa = accentColor === d.value;
            const cor = `hsl(${ACCENT_COLORS[d.value].light})`;
            return (
              <button key={d.value} type="button" aria-pressed={ativa} onClick={() => setAccentColor(d.value)}
                className={cn("overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "border-border hover:bg-accent/40")}>
                <div className="flex h-[7.5rem]" style={{ backgroundColor: d.fundo }} aria-hidden="true">
                  <div className="w-[30%] space-y-1.5 p-3" style={{ backgroundColor: d.barra }}>
                    <div className="mb-3 h-5 w-5 rounded" style={{ backgroundColor: cor }} />
                    <div className="h-1.5 rounded-full" style={{ backgroundColor: cor }} />
                    <div className="h-1.5 rounded-full bg-white/20" />
                    <div className="h-1.5 rounded-full bg-white/20" />
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-3.5">
                    <span className="font-semibold text-slate-900" style={{ fontSize: "1.75rem", lineHeight: "2rem" }}>Aa 123</span>
                    <span className="w-fit rounded-md px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: cor }}>Novo negócio</span>
                  </div>
                </div>
                <div className="space-y-1 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{d.nome}</span>
                    {ativa && <span className="text-label font-semibold text-success">Em uso</span>}
                  </div>
                  <p className="text-label text-muted-foreground">{d.hex} · {d.lateral}</p>
                  <p className="text-xs">{d.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Secao>

      <Secao titulo="Fonte" nota="Escolha em Aparência">
        <div className="grid gap-4 md:grid-cols-2">
          {FONTES_CARTOES.map((f) => {
            const ativa = font === f.value;
            return (
              <button key={f.value} type="button" aria-pressed={ativa} onClick={() => setFont(f.value)}
                style={{ fontFamily: FONTES[f.value].pilha }}
                className={cn("flex flex-col items-stretch justify-start rounded-lg border bg-card p-5 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "border-border hover:bg-accent/40")}>
                <div className="flex items-center justify-between gap-2">
                  <span className={rotuloSecao}>{f.rotulo}</span>
                  {ativa && <span className="text-label font-semibold text-success">Em uso</span>}
                </div>
                <p className="mt-3 font-semibold tracking-tight" style={{ fontSize: "1.95rem", lineHeight: "2.25rem" }}>R$ 418.600</p>
                <p className="mt-2.5 text-sm">Reunião marcada para segunda às 14:30 com o Dr. Henrique Prado.</p>
                <p className="mt-2 text-xs text-muted-foreground">{f.nota}</p>
              </button>
            );
          })}
        </div>
      </Secao>

      <Secao titulo="Cores" nota="Valores lidos do index.css">
        <div className="grid gap-4 md:grid-cols-2">
          {GRUPOS_TOKENS.map((g) => (
            <div key={g.titulo} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <p className={rotuloSecao}>{g.titulo}</p>
              <ul className="mt-2 divide-y divide-border">{g.nomes.map((n) => <Amostra key={n} nome={n} />)}</ul>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Gráficos" nota="chart-1 é a marca; 2 a 8 variam em luminosidade, não só em matiz">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className={rotuloSecao}>Categorias</p>
            <div className="mt-3 flex gap-2">
              {NUMEROS.map((n) => (
                <div key={n} className="min-w-0 flex-1 text-center">
                  <div className="h-10 rounded-md" style={{ backgroundColor: `hsl(var(--chart-${n}))` }} aria-hidden="true" />
                  <p className="mt-1 text-label text-muted-foreground">{n}</p>
                </div>
              ))}
            </div>
            <ul className="mt-3 divide-y divide-border">{["--chart-1", "--chart-2", "--chart-3", "--chart-4"].map((n) => <Amostra key={n} nome={n} />)}</ul>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className={rotuloSecao}>Escala do funil (segue a cor de destaque)</p>
            <div className="mt-3 flex gap-2">
              {ETAPAS.map((n) => (
                <div key={n} className="min-w-0 flex-1 text-center">
                  <div className="h-10 rounded-md" style={{ backgroundColor: `var(--stage-${n})` }} aria-hidden="true" />
                  <p className="mt-1 text-label text-muted-foreground">{n}</p>
                </div>
              ))}
            </div>
            <ul className="mt-3 divide-y divide-border">{["--chart-5", "--chart-6", "--chart-7", "--chart-8", "--stage-end"].map((n) => <Amostra key={n} nome={n} />)}</ul>
          </div>
        </div>
      </Secao>

      <Secao titulo="Pastéis" nota="avatar e selo: fundo pastel, texto escuro (no escuro, o inverso)">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {NUMEROS.map((n) => (
              <li key={n} className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                  style={{ backgroundColor: `hsl(var(--pastel-${n}))`, color: `hsl(var(--pastel-${n}-fg))` }}
                  aria-hidden="true"
                >
                  A
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium">pastel-{n}</p>
                  <p className="truncate text-label text-muted-foreground">
                    {hslParaHex(TOKENS_CLARO[`--pastel-${n}`])} · {hslParaHex(TOKENS_CLARO[`--pastel-${n}-fg`])}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Secao>

      <Secao titulo="Tipografia" nota="Base de 13px; o corpo é text-xs">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <ul className="divide-y divide-border">
            {ESCALA_TEXTO.map((t) => (
              <li key={t.classe} className="flex items-baseline gap-4 py-2">
                <span className="w-24 shrink-0 text-label text-muted-foreground">{t.rotulo} · {t.px}</span>
                <span className={cn(t.classe, "min-w-0 flex-1 truncate font-medium")}>Reunião com o Dr. Henrique Prado</span>
                <span className="hidden text-label text-muted-foreground sm:inline">{t.uso}</span>
              </li>
            ))}
          </ul>
        </div>
      </Secao>

      <Secao titulo="Raios e componentes">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className={rotuloSecao}>Raios</p>
            <div className="mt-3 flex gap-4">
              {RAIOS.map((r) => (
                <div key={r.classe} className="text-center">
                  <div className={cn(r.classe, "h-14 w-20 border border-border bg-muted")} />
                  <p className="mt-1.5 text-label font-medium">{r.rotulo}</p>
                  <p className="text-label text-muted-foreground">{TOKENS_CLARO[r.valor]}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
            <div>
              <p className={rotuloSecao}>Botões</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm">Novo negócio</Button>
                <Button size="sm" variant="outline">Cancelar</Button>
                <Button size="sm" variant="ghost">Ver mais</Button>
                <Button size="sm" variant="destructive">Excluir</Button>
              </div>
            </div>
            <div>
              <p className={rotuloSecao}>Selos</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="success">Ganho</Badge>
                <Badge variant="warning">Atrasada</Badge>
                <Badge variant="danger">Perdido</Badge>
                <Badge variant="info">Em negociação</Badge>
                <Badge variant="neutral">Rascunho</Badge>
              </div>
            </div>
            <div>
              <p className={rotuloSecao}>Campo</p>
              <Input className="mt-2 h-8 text-xs" placeholder="Buscar contatos, negócios, empresas…" aria-label="Exemplo de campo" />
            </div>
          </div>
        </div>
      </Secao>
    </div>
  );
}
