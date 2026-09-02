import { AGB_SECTIONS, WIDERRUF_LINK_MARKER } from "@/lib/legal/agb";
import { WIDERRUF_SECTIONS, WIDERRUF_MUSTER } from "@/lib/legal/widerruf";

function renderSectionsPlain(sections) {
  return sections
    .map(({ heading, paragraphs }) => [heading, ...paragraphs].join("\n\n"))
    .join("\n\n");
}

// Vollständiger AGB-Text als Klartext für den E-Mail-Body (§ 312f Abs. 2
// BGB: ein bloßer Link genügt nicht). Der Widerrufsbelehrung-Linktext wird
// hier zu reinem Text, da es in einer E-Mail keinen Link auf die Website
// braucht.
export function renderAgbPlainText() {
  return renderSectionsPlain(AGB_SECTIONS).replaceAll(
    WIDERRUF_LINK_MARKER,
    "der Widerrufsbelehrung (siehe unten)"
  );
}

// Vollständige Widerrufsbelehrung inkl. Muster-Widerrufsformular als
// Klartext für den E-Mail-Body.
export function renderWiderrufPlainText() {
  const sections = renderSectionsPlain(WIDERRUF_SECTIONS);
  const muster = [
    WIDERRUF_MUSTER.heading,
    WIDERRUF_MUSTER.intro,
    WIDERRUF_MUSTER.to,
    WIDERRUF_MUSTER.declaration,
    "_______________________________________________",
    ...WIDERRUF_MUSTER.fields.flatMap((field) => [field, "_______________________________________________"]),
    WIDERRUF_MUSTER.footnote,
  ].join("\n");
  return `${sections}\n\n${muster}`;
}
