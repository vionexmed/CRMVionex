import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      /**
       * Os três degraus ABAIXO de `text-xs`, que o Tailwind não oferece.
       *
       * O projeto tinha 487 tamanhos arbitrários em px, e a leitura óbvia era
       * "a escala está quebrada". Medindo, o quadro é outro: `text-xs` (546
       * usos) e `text-sm` (379) seguem sendo os cavalos de batalha, e quase
       * todo arbitrário está no extremo PEQUENO -- 10px (262), 9px (107),
       * 11px (78), 8px (24). O Tailwind simplesmente não tem nome para eles,
       * porque assume corpo de 16px, e aqui o corpo é 13px.
       *
       * Por isso a escala é ADITIVA, não substitutiva: trocar o valor de
       * `text-xs` mexeria em 546 lugares de uma vez. Aqui nada muda de tamanho
       * -- os nomes só param de ser inventados.
       *
       * 8px foi absorvido em `micro`: um pixel a mais é imperceptível nas
       * iniciais de avatar, e 8px está abaixo do mínimo legível de qualquer
       * jeito. Uma medida a menos na régua.
       *
       * A entrelinha vem junto de propósito. Tamanho sem entrelinha declarada
       * herda a do contexto, e é daí que vem a sensação de texto "apertado" em
       * umas telas e "solto" em outras usando o mesmo tamanho.
       */
      /**
       * TRÊS degraus abaixo do corpo, não seis.
       *
       * Havia 9 / 10 / 11 / 12 / 13 / 14px em uso simultâneo -- seis tamanhos
       * num intervalo de cinco pixels. Isso não forma hierarquia: a diferença
       * entre 10 e 11px não é perceptível como "um é mais importante", só como
       * "algo está desalinhado". E o piso de 9px é menor que o mínimo legível
       * confortável.
       *
       *   label   11px   rótulo, meta, selo, contagem
       *   xs      12px   corpo secundário  (510 usos, o mais praticado)
       *   sm      14px   corpo             (260 usos)
       *
       * `micro`, `meta` e `corpo` continuam existindo como APELIDO dos três
       * acima, porque são 199 chamadas espalhadas -- reescrevê-las de uma vez
       * misturaria a mudança de escala com a de código. O teste proíbe uso
       * NOVO deles.
       */
      fontSize: {
        /*
         * DOIS degraus próprios abaixo do padrão do Tailwind, e mais nenhum.
         *
         * Havia CINCO nomes para TRÊS valores: `micro` e `meta` eram 11px, o
         * mesmo que `label`, e `corpo` era 14px, o mesmo que `sm`. Deu 190 usos
         * repartidos entre apelidos idênticos -- e quatro telas (Inbox, MyEmail,
         * Team e marketing/Overview) usavam os três nomes de 11px no MESMO
         * arquivo.
         *
         * O custo não é estético. Com um tamanho atendendo por três nomes,
         * "mudar o rótulo pequeno" vira três buscas, e esquecer uma delas deixa
         * a tela com dois tamanhos onde deveria haver um -- sem erro, sem aviso.
         */
        label: ["0.6875rem", { lineHeight: "1rem" }],     // 11px / 16
        xs: ["0.75rem", { lineHeight: "1.125rem" }],      // 12px / 18 — era 12/16
      },
      fontFamily: {
        /*
         * UMA FAMÍLIA SÓ, e é o que a referência da lateral faz.
         *
         * Eram duas -- Nunito no corpo, Poppins nos títulos. A referência usa a
         * mesma em tudo, e misturar duas grotescas daria duas fontes discutindo:
         * parecidas o bastante para não contrastar, diferentes o bastante para
         * incomodar.
         *
         * A família é Roboto, a do print de referência.
         *
         * `heading` CONTINUA EXISTINDO como apelido. São 12 usos de
         * `font-heading` mais `.vx-titulo-*` no CSS, e apontar o apelido para a
         * mesma família troca tudo de uma vez sem reescrever chamada nenhuma --
         * e deixa o caminho aberto para voltar a ter uma display própria.
         */
        sans: ['var(--font-ui)'],
        heading: ['var(--font-ui)'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))", hover: "var(--primary-hover)", active: "var(--primary-active)" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))", soft: "hsl(var(--destructive-soft))", border: "hsl(var(--destructive-border))", fill: "hsl(var(--destructive-fill))" },
        // Vermelho vivo dos avisos da casca (selo da lateral, ponto do sino). Ver index.css.
        alerta: "hsl(var(--alerta))",
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))", soft: "hsl(var(--success-soft))", border: "hsl(var(--success-border))", fill: "hsl(var(--success-fill))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))", soft: "hsl(var(--warning-soft))", border: "hsl(var(--warning-border))", fill: "hsl(var(--warning-fill))" },
        info: { DEFAULT: "hsl(var(--info))", foreground: "hsl(var(--info-foreground))", soft: "hsl(var(--info-soft))", border: "hsl(var(--info-border))", fill: "hsl(var(--info-fill))" },
        neutral: { DEFAULT: "hsl(var(--neutral))", soft: "hsl(var(--neutral-soft))" },
        "surface-2": "hsl(var(--surface-2))",
        chart: {
          1: "hsl(var(--chart-1))", 2: "hsl(var(--chart-2))", 3: "hsl(var(--chart-3))", 4: "hsl(var(--chart-4))", 5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))", 7: "hsl(var(--chart-7))", 8: "hsl(var(--chart-8))",
        },
        pastel: {
          1: { DEFAULT: "hsl(var(--pastel-1))", fg: "hsl(var(--pastel-1-fg))" },
          2: { DEFAULT: "hsl(var(--pastel-2))", fg: "hsl(var(--pastel-2-fg))" },
          3: { DEFAULT: "hsl(var(--pastel-3))", fg: "hsl(var(--pastel-3-fg))" },
          4: { DEFAULT: "hsl(var(--pastel-4))", fg: "hsl(var(--pastel-4-fg))" },
          5: { DEFAULT: "hsl(var(--pastel-5))", fg: "hsl(var(--pastel-5-fg))" },
          6: { DEFAULT: "hsl(var(--pastel-6))", fg: "hsl(var(--pastel-6-fg))" },
          7: { DEFAULT: "hsl(var(--pastel-7))", fg: "hsl(var(--pastel-7-fg))" },
          8: { DEFAULT: "hsl(var(--pastel-8))", fg: "hsl(var(--pastel-8-fg))" },
        },
        stage: {
          1: "var(--stage-1)", 2: "var(--stage-2)", 3: "var(--stage-3)",
          4: "var(--stage-4)", 5: "var(--stage-5)", 6: "var(--stage-6)",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
          muted: "hsl(var(--sidebar-muted))",
        },
      },
      // Superfícies 8 px, controles 6 px; `rounded` (4 px) fica para o selo.
      borderRadius: {
        xl: "var(--radius)",
        "2xl": "var(--radius)",
        "3xl": "var(--radius)",
        lg: "var(--radius)",                 /* 8px — superfícies */
        md: "var(--radius-control)",   /* 6px — controles */
        sm: "var(--radius-control)",   /* 6px — pequenos elementos */
      },
      /*
       * Sombras do padrão da plataforma. `card` é a do cartão branco sem borda,
       * `card-hover` um degrau acima (cartão clicável sob o cursor), `pop` a do
       * que flutua (menu, janela, gaveta). Os valores moram em index.css, com
       * par no tema escuro.
       */
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        pop: "var(--shadow-pop)",
      },
      height: { control: "var(--control-h)", row: "var(--row-h)" },
      transitionDuration: { 180: "180ms", 240: "240ms" },
      transitionTimingFunction: { DEFAULT: "cubic-bezier(.2,.8,.2,1)" },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
