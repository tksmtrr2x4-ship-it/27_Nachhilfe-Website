// Briefpapier für alle Mails an Familien (und die Hinweise an Jill).
//
// Grundsatz: Der Klartext ist das Original. Die HTML-Fassung wird aus genau
// diesem Text gesetzt – kein zweiter, abweichender Wortlaut. Das zählt vor
// allem bei Bestellbestätigung, Widerruf und Rechnung (dauerhafter
// Datenträger), und bei der Rechnungsmail, deren Text im Admin-Bereich
// bearbeitet wird und trotzdem ordentlich aussehen soll.
//
// Aus dem Text wird erkannt:
// - Absätze (Leerzeile dazwischen)
// - mindestens zwei aufeinanderfolgende Zeilen „Bezeichnung: Wert“ → Tabelle
// - Zeilen mit „- “ → Aufzählung
// - eine Zeile, die nur aus einer Adresse besteht und in `knoepfe` steht →
//   Knopf (darunter die Adresse klein zum Kopieren)
// - der Gruß ab „Herzliche Grüße“ bzw. „Jill Manuel Hils“ → Unterschrift
//
// Gestaltung wie die Website: Sand, Papierkarte mit Akten-Reiter, Petrol und
// Orange. Mailprogramme laden keine Webfonts verlässlich (und Google Fonts
// würden die IP der Familie weitergeben), daher Systemschriften mit
// passender Anmutung. Gedimmt wird über prefers-color-scheme, wo das
// Mailprogramm es kann; sonst bleibt der helle Brief.

const FARBE = {
  papier: "#f3eadc",
  karte: "#fbf6ee",
  mulde: "#ebdfcc",
  tinte: "#18324a",
  text: "#384757",
  leise: "#5d5953",
  linie: "#ddcdb5",
  blau: "#1f4e6e",
  mappe: "#2b5d80",
  orange: "#f08a2c",
  orangeTief: "#9a4b08",
  knopfText: "#1a2a38",
  etikett: "#f8f1e4",
};

const SERIF = `'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif`;
const SANS = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;

export function siteOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.lernsprung-vs.de").replace(/\/$/, "");
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const URL_RE = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?]/g;
// Telefonnummern nur in internationaler Schreibweise („+49 179 4328302“) –
// so wird nie eine IBAN oder Rechnungsnummer zum Anruf-Link.
const TEL_RE = /\+49(?:[ /-]?\d){6,14}/g;
const MAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const NUR_URL_RE = /^https?:\/\/\S+$/;
// Doppelpunkte ohne folgendes Leerzeichen gehören zur Bezeichnung
// („Schüler:in: Lena“).
const BEZEICHNUNG_RE = /^((?:[^:]|:(?=\S)){2,40}):\s+(.+)$/;

// Escapen und dabei Adressen, E-Mails und Telefonnummern klickbar machen.
// „E-Mail“ und Telefonnummern brechen nicht mitten im Wort um.
function inline(text) {
  const teile = [];
  const rest = String(text ?? "");
  const treffer = [...rest.matchAll(new RegExp(`${URL_RE.source}|${MAIL_RE.source}|${TEL_RE.source}`, "g"))];
  const fliesstext = (s) => escapeHtml(s).replace(/E-Mail/g, "E&#8209;Mail");
  let pos = 0;
  for (const t of treffer) {
    teile.push(fliesstext(rest.slice(pos, t.index)));
    const wert = t[0];
    const tel = !wert.startsWith("http") && !wert.includes("@");
    const href = wert.startsWith("http") ? wert : tel ? `tel:${wert.replace(/[^\d+]/g, "")}` : `mailto:${wert}`;
    const anzeige = tel ? escapeHtml(wert).replace(/ /g, "&nbsp;") : escapeHtml(wert);
    teile.push(`<a href="${escapeHtml(href)}" style="color:${FARBE.blau};text-decoration:underline" class="lnk">${anzeige}</a>`);
    pos = t.index + wert.length;
  }
  teile.push(fliesstext(rest.slice(pos)));
  return teile.join("");
}

function istBezeichnung(zeile) {
  const m = BEZEICHNUNG_RE.exec(zeile);
  return Boolean(m) && !/https?:\/\//.test(m[1]);
}

function absatz(zeilen) {
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${FARBE.text}" class="txt">${zeilen.map(inline).join("<br>")}</p>`;
}

function tabelle(zeilen) {
  const reihen = zeilen
    .map((z, i) => {
      const [, k, v] = BEZEICHNUNG_RE.exec(z);
      const rand = i < zeilen.length - 1 ? `border-bottom:1px dashed ${FARBE.linie};` : "";
      return `<tr>
<td valign="top" width="36%" style="${rand}width:36%;padding:9px 14px 9px 0;font-family:${SANS};font-size:13px;line-height:1.4;color:${FARBE.leise}" class="leise rnd zk">${escapeHtml(k)}</td>
<td valign="top" style="${rand}padding:9px 0;font-family:${SANS};font-size:15px;line-height:1.45;color:${FARBE.tinte};font-weight:600" class="tinte rnd zw">${inline(v)}</td>
</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;background:${FARBE.etikett};border:1px solid ${FARBE.linie};border-radius:12px" class="etikett">
<tr><td style="padding:6px 18px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${reihen}</table>
</td></tr></table>`;
}

function liste(zeilen) {
  const punkte = zeilen
    .map((z) => `<tr><td valign="top" style="padding:0 10px 6px 2px;font-family:${SANS};font-size:16px;line-height:1.55;color:${FARBE.orange}">•</td><td style="padding:0 0 6px;font-family:${SANS};font-size:16px;line-height:1.55;color:${FARBE.text}" class="txt">${inline(z.replace(/^-\s+/, ""))}</td></tr>`)
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px">${punkte}</table>`;
}

function knopf(url, beschriftung) {
  const href = escapeHtml(url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 10px">
<tr><td align="center" bgcolor="${FARBE.orange}" style="border-radius:999px;background:${FARBE.orange}">
<a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;font-weight:700;line-height:1.2;color:${FARBE.knopfText};text-decoration:none;border-radius:999px">${escapeHtml(beschriftung)}&nbsp;→</a>
</td></tr></table>
<p style="margin:0 0 20px;font-family:${SANS};font-size:12px;line-height:1.5;color:${FARBE.leise}" class="leise">Falls der Knopf nicht reagiert, diese Adresse in den Browser kopieren:<br><a href="${href}" style="color:${FARBE.leise};word-break:break-all" class="leise">${escapeHtml(url)}</a></p>`;
}

function notiz(zeilen) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px">
<tr><td style="background:${FARBE.etikett};border-left:4px solid ${FARBE.orange};border-radius:4px 12px 12px 4px;padding:16px 20px;font-family:${SERIF};font-size:18px;line-height:1.55;color:${FARBE.tinte}" class="etikett tinte">${zeilen.map(inline).join("<br>")}</td></tr></table>`;
}

function unterschrift(zeilen) {
  const teile = [];
  for (const z of zeilen) {
    if (/^Jill Manuel Hils$/.test(z.trim())) {
      teile.push(`<div style="margin:6px 0 4px;font-family:${SERIF};font-style:italic;font-size:22px;line-height:1.2;color:${FARBE.tinte}" class="tinte">Jill Manuel Hils</div>`);
    } else if (/^(Herzliche|Viele|Liebe|Beste) Grüße/.test(z.trim())) {
      teile.push(`<div style="font-family:${SANS};font-size:16px;line-height:1.6;color:${FARBE.text}" class="txt">${inline(z)}</div>`);
    } else {
      teile.push(`<div style="font-family:${SANS};font-size:13px;line-height:1.55;color:${FARBE.leise}" class="leise">${inline(z)}</div>`);
    }
  }
  return `<div style="margin:24px 0 0;padding-top:18px;border-top:1px solid ${FARBE.linie}" class="rnd">${teile.join("")}</div>`;
}

// Zerlegt einen Absatz in Zeilenläufe: Text, Tabelle, Liste, Knopf.
function setzeAbsatz(zeilen, knoepfe) {
  const bloecke = [];
  let text = [];
  const textAbschliessen = () => {
    if (text.length) bloecke.push(absatz(text));
    text = [];
  };
  for (let i = 0; i < zeilen.length; ) {
    const z = zeilen[i];
    if (NUR_URL_RE.test(z.trim()) && knoepfe[z.trim()]) {
      textAbschliessen();
      bloecke.push(knopf(z.trim(), knoepfe[z.trim()]));
      i += 1;
      continue;
    }
    if (/^-\s+/.test(z)) {
      textAbschliessen();
      const lauf = [];
      while (i < zeilen.length && /^-\s+/.test(zeilen[i])) lauf.push(zeilen[i++]);
      bloecke.push(liste(lauf));
      continue;
    }
    if (istBezeichnung(z)) {
      let j = i;
      while (j < zeilen.length && istBezeichnung(zeilen[j])) j += 1;
      if (j - i >= 2) {
        textAbschliessen();
        bloecke.push(tabelle(zeilen.slice(i, j)));
        i = j;
        continue;
      }
    }
    text.push(z);
    i += 1;
  }
  textAbschliessen();
  return bloecke.join("\n");
}

function istGruss(zeilen) {
  const erste = zeilen[0]?.trim() || "";
  return /^(Herzliche|Viele|Liebe|Beste) Grüße/.test(erste) || erste === "Jill Manuel Hils";
}

// Setzt den Text als Brief. Optionen:
//   titel    – Überschrift in der Karte (steht der Titel als erste Zeile im
//              Text, wird er dort nicht doppelt gesetzt)
//   reiter   – Beschriftung des Akten-Reiters über der Karte
//   vorschau – Vorschauzeile im Posteingang
//   knoepfe  – { [adresse]: "Beschriftung" }
//   notiz    – genau dieser Textteil wird als hervorgehobene Notiz gesetzt
export function briefHtml(text, { titel = "", reiter = "", vorschau = "", knoepfe = {}, notiz: notizText = "" } = {}) {
  let quelle = String(text ?? "").replace(/\r\n?/g, "\n");
  if (titel && quelle.split("\n")[0].trim() === titel.trim()) quelle = quelle.split("\n").slice(1).join("\n");

  const MARKE = "\u0000NOTIZ\u0000";
  if (notizText && quelle.includes(notizText)) quelle = quelle.replace(notizText, MARKE);

  const absaetze = quelle
    .split(/\n\s*\n/)
    .map((a) => a.split("\n").filter((z) => z.trim() !== ""))
    .filter((a) => a.length);

  const inhalt = absaetze
    .map((zeilen) => {
      if (zeilen.length === 1 && zeilen[0] === MARKE) return notiz(notizText.split("\n"));
      if (istGruss(zeilen)) return unterschrift(zeilen);
      return setzeAbsatz(zeilen.map((z) => (z === MARKE ? notizText : z)), knoepfe);
    })
    .join("\n");

  return rahmen({ titel, reiter, vorschau, inhalt });
}

function rahmen({ titel, reiter, vorschau, inhalt }) {
  const origin = siteOrigin();
  const logo = `${origin}/mail-logo.png`;
  const kopf = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="padding-right:12px"><a href="${escapeHtml(origin)}" style="text-decoration:none"><img src="${escapeHtml(logo)}" width="52" height="52" alt="Lernsprung" style="display:block;width:52px;height:52px;border:0;border-radius:14px;background:${FARBE.etikett};padding:4px"></a></td>
<td valign="middle"><div style="font-family:${SERIF};font-size:24px;font-weight:600;line-height:1.1;color:${FARBE.tinte}" class="tinte">Lernsprung</div>
<div style="font-family:${SANS};font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${FARBE.orangeTief};padding-top:3px" class="orange">Nachhilfe in Villingen-Schwenningen</div></td>
</tr></table>`;

  const reiterZeile = reiter
    ? `<tr><td style="padding:0 0 0 28px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${FARBE.mappe};border-radius:10px 10px 0 0;padding:7px 16px 6px;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${FARBE.etikett}" class="reiter">${escapeHtml(reiter)}</td></tr></table></td></tr>`
    : "";

  const ueberschrift = titel
    ? `<h1 style="margin:0 0 18px;font-family:${SERIF};font-size:27px;font-weight:600;line-height:1.2;color:${FARBE.tinte}" class="tinte">${escapeHtml(titel)}</h1>`
    : "";

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(titel || "Lernsprung")}</title>
<style>
  a { color: ${FARBE.blau}; }
  @media (max-width: 600px) {
    .karte-innen { padding: 26px 20px 24px !important; }
    .huelle { padding: 18px 10px 28px !important; }
    .zk, .zw { display: block !important; width: auto !important; }
    .zk { border-bottom: 0 !important; padding: 10px 0 1px !important; }
    .zw { padding: 0 0 10px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .bg-papier { background: #26221d !important; }
    .karte { background: #2f2a24 !important; border-color: #433b33 !important; }
    .etikett { background: #26221d !important; border-color: #433b33 !important; }
    .tinte { color: #f4ebdd !important; }
    .txt { color: #d8cdbd !important; }
    .leise { color: #a89b8a !important; }
    .orange { color: #f6b06c !important; }
    .lnk { color: #8fb8d2 !important; }
    .rnd { border-color: #433b33 !important; }
    .reiter { background: #24506f !important; color: #e9dfcf !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${FARBE.papier}" class="bg-papier">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(vorschau)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${FARBE.papier}" class="bg-papier">
<tr><td align="center" style="padding:28px 16px 40px" class="huelle">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
<tr><td style="padding:0 6px 22px">${kopf}</td></tr>
${reiterZeile}
<tr><td style="background:${FARBE.karte};border:1px solid ${FARBE.linie};border-radius:${reiter ? "4px" : "18px"} 18px 18px 18px;box-shadow:0 10px 30px -18px rgba(24,50,74,.35)" class="karte">
<div style="padding:34px 36px 30px" class="karte-innen">
${ueberschrift}
${inhalt}
</div>
</td></tr>
<tr><td style="padding:22px 8px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${FARBE.leise};text-align:center" class="leise">
Lernsprung · Jill Manuel Hils · Aixheimer Straße 2, 78056 Villingen-Schwenningen<br>
<a href="${escapeHtml(origin)}" style="color:${FARBE.leise}" class="leise">lernsprung-vs.de</a> · <a href="${escapeHtml(origin)}/konto" style="color:${FARBE.leise}" class="leise">Meine Schülerakte</a> · <a href="${escapeHtml(origin)}/datenschutz" style="color:${FARBE.leise}" class="leise">Datenschutz</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
