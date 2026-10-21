import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type Density = "compact" | "normal" | "comfortable";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  density: Density;
  setDensity: (d: Density) => void;
  accentColor: string;
  setAccentColor: (c: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  setTheme: () => {},
  density: "normal",
  setDensity: () => {},
  accentColor: "blue",
  setAccentColor: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const ACCENT_COLORS: Record<string, { light: string; dark: string }> = {
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
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (theme === "system") { applyTheme("system"); applyAccent(accentColor); } };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, accentColor]);

  const setTheme = (t: Theme) => { setThemeState(t); localStorage.setItem("fc-theme", t); };
  const setDensity = (d: Density) => { setDensityState(d); localStorage.setItem("fc-density", d); };
  const setAccentColor = (c: string) => { setAccentState(c); localStorage.setItem("fc-accent", c); };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, density, setDensity, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}
