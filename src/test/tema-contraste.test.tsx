// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

const css = readFileSync("src/index.css", "utf8");
function luminance(hsl: string) {
  const [h, saturation, lightness] = hsl.match(/[\d.]+/g)!.map(Number);
  const s = saturation / 100, l = lightness / 100;
  const a = s * Math.min(l, 1 - l);
  const channels = [0, 8, 4].map((n) => {
    const k = (n + h / 30) % 12;
    const channel = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
function Controls() {
  const { setTheme, setAccentColor } = useTheme();
  return <>
    <button onClick={() => setTheme("dark")}>Escuro</button>
    {["teal", "blue", "violet", "emerald", "orange", "rose"].map((color) =>
      <button key={color} onClick={() => setAccentColor(color)}>{color}</button>)}
  </>;
}
afterEach(() => { cleanup(); localStorage.clear(); document.documentElement.removeAttribute("style"); });

describe("contraste de cada cor personalizada", () => {
  it.each(["light", "dark"])("mantém texto, ações e foco legíveis no tema %s", (theme) => {
    render(<ThemeProvider><Controls /></ThemeProvider>);
    if (theme === "dark") fireEvent.click(screen.getByText("Escuro"));
    const block = css.split(theme === "dark" ? ".dark {" : ":root {")[1].split("}")[0];
    const token = (name: string) => block.match(new RegExp(`${name}:\\s*([^;]+)`))![1];
    for (const color of ["teal", "blue", "violet", "emerald", "orange", "rose"]) {
      fireEvent.click(screen.getByText(color));
      const inline = document.documentElement.style;
      const primary = inline.getPropertyValue("--primary");
      const foreground = inline.getPropertyValue("--primary-foreground") || token("--primary-foreground");
      expect(contrast(primary, foreground), `${theme}/${color} botão`).toBeGreaterThanOrEqual(4.5);
      for (const surface of ["--background", "--card", "--muted"]) {
        expect(contrast(primary, token(surface)), `${theme}/${color} texto em ${surface}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(inline.getPropertyValue("--ring"), token(surface)), `${theme}/${color} foco em ${surface}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
