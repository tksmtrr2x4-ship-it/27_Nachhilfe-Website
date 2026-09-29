// Stellt das Maskottchen aus dem Logo frei: weißer Hintergrund und der
// Schriftzug „Lernsprung VS" fallen weg, übrig bleibt das Monster mit
// durchsichtigem Hintergrund.
//
// Warum nicht von Hand in einem Bildprogramm: So bleibt der Schritt
// nachvollziehbar und lässt sich nach jedem Austausch des Logos wiederholen:
//   npm run monster:freistellen
//
// Verfahren:
//   1. „Tinte" = alles, was deutlich von Weiß abweicht.
//   2. Hintergrund = alles, was vom Bildrand aus erreichbar ist, ohne durch
//      Tinte zu laufen. Was übrig bleibt, gehört zu einer Figur – damit bleibt
//      auch das weiße Auge innen erhalten.
//   3. Die größte zusammenhängende Figur ist das Monster.
//   4. Der Schriftzug ist dunkelblau wie die Konturlinie und berührt das
//      Monster – über die Farbe allein ist er nicht zu trennen. Also über den
//      Abstand: Behalten wird nur, was höchstens eine Konturbreite von der
//      orangen Fläche entfernt liegt. Buchstaben haben kein Orange in der
//      Nähe und fallen damit weg.
import sharp from "sharp";
import path from "node:path";

const QUELLE = path.join(process.cwd(), "public", "logo.png");
const ZIEL = path.join(process.cwd(), "public", "monster");
const BREITE = 640; // reicht für die Anzeige mit ~160 CSS-Pixeln auf Retina
// Abstand von Weiß, ab dem ein Bildpunkt als Tinte gilt (0–255).
const SCHWELLE = 40;

const bild = sharp(QUELLE).ensureAlpha();
const { width: w, height: h } = await bild.metadata();
const { data } = await bild.raw().toBuffer({ resolveWithObject: true });

const istTinte = new Uint8Array(w * h);
const istOrange = new Uint8Array(w * h);
for (let i = 0; i < w * h; i += 1) {
  const r = data[i * 4];
  const g = data[i * 4 + 1];
  const b = data[i * 4 + 2];
  const a = data[i * 4 + 3];
  const abstandVonWeiss = Math.max(255 - r, 255 - g, 255 - b);
  istTinte[i] = a > 24 && abstandVonWeiss > SCHWELLE ? 1 : 0;
  // Das Warmorange des Monsters – klar unterscheidbar von Weiß und vom
  // Dunkelblau der Kontur und der Schrift.
  istOrange[i] = a > 24 && r > 150 && b < 130 && r - b > 70 ? 1 : 0;
}

// Hintergrund vom Rand aus fluten (4er-Nachbarschaft, iterativ – eine
// Rekursion über 16 Millionen Punkte sprengt den Stapel).
const istHintergrund = new Uint8Array(w * h);
const stapel = [];
for (let x = 0; x < w; x += 1) {
  stapel.push(x, (h - 1) * w + x);
}
for (let y = 0; y < h; y += 1) {
  stapel.push(y * w, y * w + w - 1);
}
while (stapel.length) {
  const i = stapel.pop();
  if (istHintergrund[i] || istTinte[i]) continue;
  istHintergrund[i] = 1;
  const x = i % w;
  const y = (i - x) / w;
  if (x > 0) stapel.push(i - 1);
  if (x < w - 1) stapel.push(i + 1);
  if (y > 0) stapel.push(i - w);
  if (y < h - 1) stapel.push(i + w);
}

// Figuren = alles, was nicht Hintergrund ist. Größte behalten.
const figur = new Int32Array(w * h).fill(-1);
let groesste = -1;
let groessteAnzahl = 0;
let nummer = 0;
for (let start = 0; start < w * h; start += 1) {
  if (istHintergrund[start] || figur[start] !== -1) continue;
  const aktuelle = nummer;
  nummer += 1;
  let anzahl = 0;
  const offen = [start];
  figur[start] = aktuelle;
  while (offen.length) {
    const i = offen.pop();
    anzahl += 1;
    const x = i % w;
    const y = (i - x) / w;
    const nachbarn = [];
    if (x > 0) nachbarn.push(i - 1);
    if (x < w - 1) nachbarn.push(i + 1);
    if (y > 0) nachbarn.push(i - w);
    if (y < h - 1) nachbarn.push(i + w);
    for (const n of nachbarn) {
      if (!istHintergrund[n] && figur[n] === -1) {
        figur[n] = aktuelle;
        offen.push(n);
      }
    }
  }
  if (anzahl > groessteAnzahl) {
    groessteAnzahl = anzahl;
    groesste = aktuelle;
  }
}

// Was von der orangen Fläche umschlossen wird, gehört immer dazu – sonst
// fiele die dunkle Pupille weg: Sie liegt mitten im weißen Auge und damit
// weit von jedem orangen Punkt entfernt.
const ausserhalbOrange = new Uint8Array(w * h);
const randStapel = [];
for (let x = 0; x < w; x += 1) randStapel.push(x, (h - 1) * w + x);
for (let y = 0; y < h; y += 1) randStapel.push(y * w, y * w + w - 1);
while (randStapel.length) {
  const i = randStapel.pop();
  if (ausserhalbOrange[i] || istOrange[i]) continue;
  ausserhalbOrange[i] = 1;
  const x = i % w;
  const y = (i - x) / w;
  if (x > 0) randStapel.push(i - 1);
  if (x < w - 1) randStapel.push(i + 1);
  if (y > 0) randStapel.push(i - w);
  if (y < h - 1) randStapel.push(i + w);
}

// Abstand jedes Punktes zur nächsten orangen Fläche (Chamfer 3/4, zwei
// Durchläufe). Damit lässt sich „gehört zur Kontur" von „ist ein Buchstabe in
// der Nähe" unterscheiden.
const FERN = 1 << 28;
const abstand = new Int32Array(w * h).fill(FERN);
for (let i = 0; i < w * h; i += 1) if (istOrange[i]) abstand[i] = 0;
for (let y = 0; y < h; y += 1) {
  for (let x = 0; x < w; x += 1) {
    const i = y * w + x;
    let d = abstand[i];
    if (x > 0) d = Math.min(d, abstand[i - 1] + 3);
    if (y > 0) d = Math.min(d, abstand[i - w] + 3);
    if (x > 0 && y > 0) d = Math.min(d, abstand[i - w - 1] + 4);
    if (x < w - 1 && y > 0) d = Math.min(d, abstand[i - w + 1] + 4);
    abstand[i] = d;
  }
}
for (let y = h - 1; y >= 0; y -= 1) {
  for (let x = w - 1; x >= 0; x -= 1) {
    const i = y * w + x;
    let d = abstand[i];
    if (x < w - 1) d = Math.min(d, abstand[i + 1] + 3);
    if (y < h - 1) d = Math.min(d, abstand[i + w] + 3);
    if (x < w - 1 && y < h - 1) d = Math.min(d, abstand[i + w + 1] + 4);
    if (x > 0 && y < h - 1) d = Math.min(d, abstand[i + w - 1] + 4);
    abstand[i] = d;
  }
}
// Zwei Prozent der Bildbreite: großzügig für die Konturlinie, zu wenig für
// einen Buchstaben, der nur zufällig anstößt.
const ANTEIL = Number(process.env.MONSTER_ABSTAND || 0.02);
const MAX_ABSTAND = Math.round(w * ANTEIL) * 3;

// Maske bauen und zugleich den Ausschnitt bestimmen.
const maske = Buffer.alloc(w * h, 0);
let links = w;
let oben = h;
let rechts = 0;
let unten = 0;
for (let i = 0; i < w * h; i += 1) {
  if (figur[i] !== groesste) continue;
  if (abstand[i] > MAX_ABSTAND && ausserhalbOrange[i]) continue;
  maske[i] = 255;
  const x = i % w;
  const y = (i - x) / w;
  if (x < links) links = x;
  if (x > rechts) rechts = x;
  if (y < oben) oben = y;
  if (y > unten) unten = y;
}

let behalten = 0;
let verworfen = 0;
for (let i = 0; i < w * h; i += 1) {
  if (figur[i] !== groesste) continue;
  if (abstand[i] > MAX_ABSTAND && ausserhalbOrange[i]) verworfen += 1;
  else behalten += 1;
}
console.log(
  `Abstandsgrenze ${Math.round(MAX_ABSTAND / 3)} Punkte (${(ANTEIL * 100).toFixed(2)} % der Breite): ` +
    `${behalten} behalten, ${verworfen} verworfen`
);

const ausschnitt = { left: links, top: oben, width: rechts - links + 1, height: unten - oben + 1 };
console.log(
  `Monster gefunden: ${ausschnitt.width}×${ausschnitt.height} Punkte ` +
    `(${Math.round((groessteAnzahl / (w * h)) * 100)} % der Fläche), ${nummer} Figuren insgesamt`
);

// Die Maske eine Spur weichzeichnen, damit die Kante beim Verkleinern nicht
// ausfranst.
// toColourspace("b-w") ist nötig: Ohne diese Angabe liefert sharp die
// einkanalige Maske als RGB zurück – der Alphakanal war dann um zwei Bytes
// verschoben und das Ergebnis halbdurchsichtiger Matsch.
const weicheMaske = await sharp(maske, { raw: { width: w, height: h, channels: 1 } })
  .blur(1.2)
  .toColourspace("b-w")
  .raw()
  .toBuffer();
if (weicheMaske.length !== w * h) {
  throw new Error(`Maske hat ${weicheMaske.length} statt ${w * h} Bytes – Kanalzahl prüfen.`);
}

// Alphakanal von Hand setzen statt über joinChannel: Dort ging der Kanal beim
// Kodieren verloren – das Ergebnis hatte drei Kanäle und keinerlei
// Durchsichtigkeit.
const mitAlpha = Buffer.alloc(w * h * 4);
for (let i = 0; i < w * h; i += 1) {
  mitAlpha[i * 4] = data[i * 4];
  mitAlpha[i * 4 + 1] = data[i * 4 + 1];
  mitAlpha[i * 4 + 2] = data[i * 4 + 2];
  mitAlpha[i * 4 + 3] = weicheMaske[i];
}

// In zwei Schritten: Erst das maskierte Vollbild erzeugen, dann zuschneiden.
// In einer Kette wirkt extract() nach Rohdaten nicht zuverlässig.
const maskiert = await sharp(mitAlpha, { raw: { width: w, height: h, channels: 4 } })
  .png()
  .toBuffer();

const freigestellt = sharp(maskiert).extract(ausschnitt).resize({ width: BREITE, withoutEnlargement: true });

await freigestellt.clone().png({ compressionLevel: 9 }).toFile(`${ZIEL}.png`);
await freigestellt.clone().webp({ quality: 88 }).toFile(`${ZIEL}.webp`);
await freigestellt.clone().avif({ quality: 68 }).toFile(`${ZIEL}.avif`);

const fertig = await sharp(`${ZIEL}.png`).metadata();
console.log(`Geschrieben: public/monster.{png,webp,avif} – ${fertig.width}×${fertig.height}`);
