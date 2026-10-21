import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type Fonte = "system" | "inter";
type Density = "compact" | "normal" | "comfortable";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  density: Density;
  setDensity: (d: Density) => void;
  accentColor: string;
  setAccentColor: (c: string) => void;
  font: Fonte;
  setFont: (f: Fonte) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  setTheme: () => {},
  density: "normal",
  setDensity: () => {},
  accentColor: "blue",
  setAccentColor: () => {},
  font: "system",
  setFont: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ACCENT_COLORS: Record<string, { light: string; dark: string }> = {
  // Cada variante mantém 4,5:1 para texto sobre superfícies e dentro do botão.
  // Azul Vionex, Violeta e Esmeralda são as três direções do Visual 01.
  blue: { light: "226 82% 55%", dark: "225 100% 74%" },
  // Violeta e Esmeralda um pouco mais escuros que o hex de referência: no tom
  // original, texto da cor sobre a coluna cinza ficava abaixo de 4,5:1.
  violet: { light: "252 100% 62%", dark: "250 100% 78%" },
  emerald: { light: "165 85% 25%", dark: "164 63% 51%" },
  teal: { light: "187 100% 25%", dark: "187 100% 35%" },
  orange: { light: "25 95% 34%", dark: "25 95% 53%" },
  rose: { light: "347 77% 45%", dark: "347 77% 63%" },
};

/** Pilhas de fonte. A do sistema é a mesma do index.css; Inter só vale depois de carregada. */
export const FONTES: Record<Fonte, { nome: string; pilha: string }> = {
  system: {
    nome: "SF Pro Text",
    pilha: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Inter, system-ui, sans-serif",
  },
  inter: {
    nome: "Inter",
    pilha: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  },
};

/** Inter vem do Google Fonts SÓ quando alguém a escolhe: o index.html não paga por ela. */
function carregarInter() {
  if (document.getElementById("fc-font-inter")) return;
  const link = document.createElement("link");
  link.id = "fc-font-inter";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem("fc-theme") as Theme) || "light");
  const [density, setDensityState] = useState<Density>(() => (localStorage.getItem("fc-density") as Density) || "normal");
  /*
   * O Visual 01 tem o Azul Vionex como marca. Quem tinha o teal antigo salvo
   * (era o padrão, então quase todo mundo) é levado UMA vez para o azul; depois
   * disso a escolha volta a ser respeitada. A marca `fc-visual` registra que a
   * migração já aconteceu.
   */
  const [accentColor, setAccentState] = useState(() => {
    try {
      if (localStorage.getItem("fc-visual") !== "v1") {
        localStorage.setItem("fc-visual", "v1");
        localStorage.setItem("fc-accent", "blue");
        return "blue";
      }
      return localStorage.getItem("fc-accent") || "blue";
    } catch {
      return "blue";
    }
  });

  const [font, setFontState] = useState<Fonte>(() => {
    try { return localStorage.getItem("fc-font") === "inter" ? "inter" : "system"; } catch { return "system"; }
  });

  const applyTheme = (t: Theme) => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (t === "system") {
      const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(sys);
    } else {
      root.classList.add(t);
    }
  };

  /**
   * A DENSIDADE ERA UM CONTROLE MORTO.
   *
   * `density` era guardada no localStorage e desenhada em Configurações →
   * Aparência com três opções — e NADA no CSS lia o valor. Não existia
   * `data-density` em lugar nenhum: escolher "compacto" ou "confortável" não
   * mudava um pixel, e o único jeito de descobrir era medir.
   *
   * Agora ela é o eixo do respiro: o CSS lê `data-density` na raiz e ajusta os
   * tokens de espaçamento. É o que permite arejar o produto sem tirar de quem
   * prefere a densidade antiga.
   */
  const applyDensity = (d: Density) => {
    document.documentElement.dataset.density = d;
  };

  const applyAccent = (color: string) => {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    const palette = ACCENT_COLORS[color] || ACCENT_COLORS.blue;
    const val = isDark ? palette.dark : palette.light;
    root.style.setProperty("--primary", val);
    root.style.setProperty("--primary-foreground", isDark ? "211 68% 7%" : "0 0% 100%");
    root.style.setProperty("--ring", val);
    root.style.setProperty("--sidebar-primary", val);
    root.style.setProperty("--sidebar-primary-foreground", isDark ? "211 68% 7%" : "0 0% 100%");
    root.style.setProperty("--sidebar-ring", val);
  };

  useEffect(() => {
    applyTheme(theme);
    applyAccent(accentColor);
  }, [theme, accentColor]);

  useEffect(() => { applyDensity(density); }, [density]);

  useEffect(() => {
    const root = document.documentElement;
    if (font === "inter") carregarInter();
    root.dataset.font = font;
    root.classList.toggle("font-inter", font === "inter");
    root.style.setProperty("--font-ui", FONTES[font].pilha);
  }, [font]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (theme === "system") { applyTheme("system"); applyAccent(accentColor); } };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, accentColor]);

  const setTheme = (t: Theme) => { setThemeState(t); localStorage.setItem("fc-theme", t); };
  const setDensity = (d: Density) => { setDensityState(d); localStorage.setItem("fc-density", d); };
  const setAccentColor = (c: string) => { setAccentState(c); localStorage.setItem("fc-accent", c); };

  const setFont = (f: Fonte) => { setFontState(f); try { localStorage.setItem("fc-font", f); } catch { /* sem armazenamento */ } };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, density, setDensity, accentColor, setAccentColor, font, setFont }}>
      {children}
    </ThemeContext.Provider>
  );
}
