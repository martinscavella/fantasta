// Colore identificativo approssimativo (non lo stemma ufficiale, nessun asset
// grafico protetto) + sigla a 3 lettere per riconoscere a colpo d'occhio la
// squadra reale di un giocatore in liste dense (listone, asta). La rosa dei
// club di Serie A/B cambia ogni stagione con promozioni e retrocessioni: la
// mappa copre un superset di club recenti, con un fallback grigio a sigla
// derivata dal nome per qualunque squadra non censita, così non si rompe mai.
type ClubInfo = { abbr: string; colore: string };

const CLUB: Record<string, ClubInfo> = {
  ATALANTA: { abbr: "ATA", colore: "#1D3557" },
  BARI: { abbr: "BAR", colore: "#C8102E" },
  BOLOGNA: { abbr: "BOL", colore: "#7A1F27" },
  BRESCIA: { abbr: "BRE", colore: "#0033A0" },
  CAGLIARI: { abbr: "CAG", colore: "#C8102E" },
  COMO: { abbr: "COM", colore: "#0033A0" },
  CREMONESE: { abbr: "CRE", colore: "#8B1E3F" },
  EMPOLI: { abbr: "EMP", colore: "#1A3C8C" },
  FIORENTINA: { abbr: "FIO", colore: "#582C83" },
  FROSINONE: { abbr: "FRO", colore: "#FDB913" },
  GENOA: { abbr: "GEN", colore: "#C8102E" },
  HELLASVERONA: { abbr: "VER", colore: "#FFC72C" },
  VERONA: { abbr: "VER", colore: "#FFC72C" },
  INTER: { abbr: "INT", colore: "#0B4EA2" },
  INTERNAZIONALE: { abbr: "INT", colore: "#0B4EA2" },
  JUVENTUS: { abbr: "JUV", colore: "#1A1A1A" },
  LAZIO: { abbr: "LAZ", colore: "#6DB9E8" },
  LECCE: { abbr: "LEC", colore: "#E8B004" },
  MILAN: { abbr: "MIL", colore: "#C8102E" },
  ACMILAN: { abbr: "MIL", colore: "#C8102E" },
  MONZA: { abbr: "MON", colore: "#D91E36" },
  NAPOLI: { abbr: "NAP", colore: "#087DC2" },
  PALERMO: { abbr: "PAL", colore: "#C77DB0" },
  PARMA: { abbr: "PAR", colore: "#F4C430" },
  PISA: { abbr: "PIS", colore: "#1E3A5F" },
  ROMA: { abbr: "ROM", colore: "#8B1538" },
  ASROMA: { abbr: "ROM", colore: "#8B1538" },
  SAMPDORIA: { abbr: "SAM", colore: "#0F5EA8" },
  SASSUOLO: { abbr: "SAS", colore: "#00A651" },
  SPEZIA: { abbr: "SPE", colore: "#8A8D91" },
  SALERNITANA: { abbr: "SAL", colore: "#7B1E3A" },
  TORINO: { abbr: "TOR", colore: "#7B0323" },
  UDINESE: { abbr: "UDI", colore: "#1A1A1A" },
  VENEZIA: { abbr: "VEN", colore: "#FF8C00" },
};

// Range Unicode dei segni diacritici combinanti (U+0300-U+036F), costruito da
// code point invece che da caratteri letterali per evitare ambiguità di encoding.
const DIACRITICI = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

function normalizza(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(DIACRITICI, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
}

function siglaDaNome(nome: string): string {
  const parole = nome.trim().split(/\s+/).filter(Boolean);
  if (parole.length === 0) return "?";
  if (parole.length === 1) return parole[0].slice(0, 3).toUpperCase();
  return parole
    .slice(0, 3)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function clubInfo(nomeSquadra: string): ClubInfo {
  const trovato = CLUB[normalizza(nomeSquadra)];
  if (trovato) return trovato;
  return { abbr: siglaDaNome(nomeSquadra), colore: "#6B7280" };
}
