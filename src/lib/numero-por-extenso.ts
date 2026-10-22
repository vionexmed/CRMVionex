/*
 * Valor por extenso, em português, para o documento de orçamento.
 *
 * Funções puras: o extenso impresso ao lado do número é o que o cliente
 * confere antes de assinar, então o texto precisa estar certo nas regras que
 * o brasileiro percebe ("mil" e não "um mil"; "cem" mas "cento e um").
 */

const UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
  "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

/** 1..999 por extenso. "e" entre centena e dezena e entre dezena e unidade. */
function ate999(n: number): string {
  if (n === 100) return "cem";
  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c) partes.push(CENTENAS[c]);
  if (resto) {
    if (resto < 20) partes.push(UNIDADES[resto]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(" e ");
}

const ESCALAS: [number, string, string][] = [
  [1e12, "trilhão", "trilhões"],
  [1e9, "bilhão", "bilhões"],
  [1e6, "milhão", "milhões"],
];

/** Inteiro >= 0 por extenso (até a casa dos trilhões). */
export function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  // `k` é o valor 1..999 de cada parte: é ele que decide o "e" (não o total).
  const partes: { texto: string; k: number }[] = [];
  let resto = n;
  for (const [valor, singular, plural] of ESCALAS) {
    const q = Math.floor(resto / valor);
    if (q > 0) {
      partes.push({ texto: `${inteiroPorExtenso(q)} ${q === 1 ? singular : plural}`, k: q % 1000 });
      resto -= q * valor;
    }
  }
  const milhares = Math.floor(resto / 1000);
  if (milhares > 0) {
    // "mil", nunca "um mil": só acima de 1.000 o número aparece antes.
    partes.push({ texto: milhares === 1 ? "mil" : `${ate999(milhares)} mil`, k: milhares });
    resto -= milhares * 1000;
  }
  if (resto > 0) partes.push({ texto: ate999(resto), k: resto });

  // "e" só antes da última parte, e só quando ela é < 100 ou centena redonda:
  // "mil e um", "um milhão e quinhentos mil", mas "mil duzentos e três".
  const ult = partes[partes.length - 1];
  const ligaComE = partes.length > 1 && (ult.k < 100 || ult.k % 100 === 0);
  return partes.reduce(
    (acc, p, i) => (i === 0 ? p.texto : `${acc}${i === partes.length - 1 && ligaComE ? " e " : " "}${p.texto}`), "");
}

const MOEDAS: Record<string, [string, string]> = {
  BRL: ["real", "reais"],
  USD: ["dólar americano", "dólares americanos"],
  EUR: ["euro", "euros"],
};

/**
 * "Quarenta e oito mil reais"; "mil e um reais e cinquenta centavos".
 *
 * Moeda desconhecida cai no genérico "<extenso> <CÓDIGO>": inventar o nome
 * por extenso de uma moeda que não conhecemos seria pior que não traduzir.
 * Centavos arredondados (não truncados) para bater com o número impresso.
 */
export function numeroPorExtenso(valor: number, moeda = "BRL"): string {
  const v = Number.isFinite(valor) ? Math.abs(valor) : 0;
  const totalCentavos = Math.round(v * 100);
  const inteiro = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;
  const codigo = (moeda || "BRL").toUpperCase();
  const nomes = MOEDAS[codigo];

  const nomeDaMoeda = (n: number) => {
    if (!nomes) return codigo;
    const base = n <= 1 ? nomes[0] : nomes[1]; // "zero real", como se fala
    // "um milhão DE reais": milhões/bilhões redondos pedem "de".
    return n >= 1e6 && n % 1e6 === 0 ? `de ${base}` : base;
  };

  const partes: string[] = [];
  if (inteiro > 0 || centavos === 0) partes.push(`${inteiroPorExtenso(inteiro)} ${nomeDaMoeda(inteiro)}`);
  if (centavos > 0) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  const texto = partes.join(" e ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
