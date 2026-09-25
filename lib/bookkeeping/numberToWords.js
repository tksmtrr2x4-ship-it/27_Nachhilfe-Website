// Betrag in Worten für die Quittung – auf Papierquittungen üblich, weil eine
// ausgeschriebene Summe nicht nachträglich um eine Null ergänzt werden kann.
// Eigene kleine Umsetzung statt einer weiteren Abhängigkeit.

const ONES = [
  "null",
  "ein",
  "zwei",
  "drei",
  "vier",
  "fünf",
  "sechs",
  "sieben",
  "acht",
  "neun",
  "zehn",
  "elf",
  "zwölf",
  "dreizehn",
  "vierzehn",
  "fünfzehn",
  "sechzehn",
  "siebzehn",
  "achtzehn",
  "neunzehn",
];

const TENS = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];

// 0 – 999
function underThousand(n) {
  if (n < 20) return ONES[n];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return ones ? `${ONES[ones]}und${TENS[tens]}` : TENS[tens];
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return `${ONES[hundreds]}hundert${rest ? underThousand(rest) : ""}`;
}

// 0 – 999.999
export function numberToWordsDe(n) {
  const value = Math.trunc(Math.abs(n));
  if (value === 0) return "null";
  if (value < 1000) return underThousand(value);
  if (value > 999_999) throw new Error("Betrag zu groß für die Ausschreibung.");
  const thousands = Math.floor(value / 1000);
  const rest = value % 1000;
  const thousandPart = thousands === 1 ? "eintausend" : `${underThousand(thousands)}tausend`;
  return rest ? `${thousandPart}${underThousand(rest)}` : thousandPart;
}

// 12550 -> "einhundertfünfundzwanzig Euro und fünfzig Cent"
export function amountInWordsDe(cents) {
  const total = Math.round(Math.abs(cents || 0));
  const euro = Math.floor(total / 100);
  const rest = total % 100;
  const euroWord = euro === 1 ? "ein Euro" : `${numberToWordsDe(euro)} Euro`;
  if (rest === 0) return euroWord;
  const centWord = rest === 1 ? "ein Cent" : `${numberToWordsDe(rest)} Cent`;
  return `${euroWord} und ${centWord}`;
}
