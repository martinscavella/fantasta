import { costruisciSetup, salvaNuovaAsta, type NuovaAstaInput } from "@/lib/asta/crea";
import { getListone, getListoneIndex, updateBoard } from "@/lib/blob/repository";
import type { RegoleSforo, SetupDoc } from "@/lib/blob/schemas";
import {
  costruisciAnteprima,
  problemiBloccanti,
  problemiDaConfermare,
  type AnteprimaRose,
} from "@/lib/rose/importa";
import { parseRoseFantaleghe } from "@/lib/rose/parser-fantaleghe";

// Import di un'asta già conclusa dal "file per fantaleghe" di Fantacalcio.it:
// stessa forma di /api/listone/import (multipart + mode preview|commit), così
// il client può ricalcolare l'anteprima a ogni modifica del regolamento prima
// di scrivere alcunché. Il file è di pochi KB: ri-caricarlo a ogni anteprima
// costa meno che tenerne uno stato server-side.

type Configurazione = {
  nome: string;
  stagione: string;
  creditiBase: number;
  slot: { P: number; D: number; C: number; A: number };
  sforo: RegoleSforo;
  miaSquadraIndex: number;
  forza: boolean;
};

type ParsedRequest = Configurazione & {
  mode: "preview" | "commit";
  testo: string;
};

function numero(form: FormData, campo: string, fallback: number): number {
  const raw = form.get(campo);
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

async function parseRequest(request: Request): Promise<ParsedRequest | { error: string }> {
  const form = await request.formData();
  const file = form.get("file");
  const stagione = form.get("stagione");
  const mode = form.get("mode");

  if (!(file instanceof File)) return { error: "File mancante" };
  if (typeof stagione !== "string" || stagione.trim() === "") return { error: "Stagione mancante" };
  if (mode !== "preview" && mode !== "commit") return { error: "mode deve essere 'preview' o 'commit'" };

  const sforoTipo = form.get("sforoTipo");
  const euroPerCredito = numero(form, "euroPerCredito", 0);

  return {
    mode,
    testo: await file.text(),
    nome: String(form.get("nome") ?? "").trim(),
    stagione: stagione.trim(),
    // I default coincidono con quelli del form "Nuova asta": la prima
    // anteprima è utile anche prima che l'utente tocchi il regolamento.
    creditiBase: numero(form, "creditiBase", 500),
    slot: {
      P: numero(form, "slotP", 3),
      D: numero(form, "slotD", 8),
      C: numero(form, "slotC", 8),
      A: numero(form, "slotA", 6),
    },
    sforo:
      sforoTipo === "a-pagamento" && euroPerCredito > 0
        ? { tipo: "a-pagamento", euroPerCredito }
        : { tipo: "nessuno" },
    miaSquadraIndex: numero(form, "miaSquadraIndex", 0),
    forza: form.get("forza") === "true",
  };
}

function inputAsta(config: Configurazione, listoneVersionId: string, nomiSquadre: string[]): NuovaAstaInput {
  return {
    nome: config.nome,
    stagione: config.stagione,
    listoneVersionId,
    creditiBase: config.creditiBase,
    slot: config.slot,
    nomiSquadre,
    miaSquadraIndex: config.miaSquadraIndex,
    sforo: config.sforo,
  };
}

export async function POST(request: Request) {
  const parsed = await parseRequest(request);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  const { mode, testo, ...config } = parsed;

  const index = await getListoneIndex(config.stagione);
  if (!index?.data.current) {
    return Response.json(
      {
        error: `Nessun listone importato per la stagione "${config.stagione}": importalo da /impostazioni/listone prima di caricare le rose.`,
      },
      { status: 400 },
    );
  }
  const listone = await getListone(config.stagione, index.data.current);
  if (!listone) {
    return Response.json({ error: "Il listone corrente della stagione non è leggibile" }, { status: 400 });
  }

  const rose = parseRoseFantaleghe(testo);
  if (rose.squadre.length < 2) {
    return Response.json(
      { error: "Il file non contiene almeno due squadre: verifica che sia l'export \"file per fantaleghe\"." },
      { status: 400 },
    );
  }
  if (config.miaSquadraIndex < 0 || config.miaSquadraIndex >= rose.squadre.length) {
    config.miaSquadraIndex = 0;
  }

  // Un solo setup per entrambe le modalità: in preview serve a valutare le
  // regole scelte e poi si butta, in commit è esattamente quello che si scrive.
  // Costruirne due significherebbe rimappare i teamId degli eventi.
  let setup: SetupDoc;
  try {
    setup = costruisciSetup(inputAsta(config, index.data.current, rose.squadre));
  } catch {
    return Response.json(
      { error: "Regolamento non valido: crediti e slot devono essere numeri interi positivi." },
      { status: 400 },
    );
  }

  const anteprima = costruisciAnteprima(rose, listone.data.giocatori, setup);
  const risposta = rispostaAnteprima(anteprima, rose.squadre);

  if (mode === "preview") return Response.json(risposta);

  // --- commit ---------------------------------------------------------------
  if (!config.nome) {
    return Response.json({ error: "Dai un nome all'asta prima di importarla" }, { status: 400 });
  }
  const bloccanti = problemiBloccanti(anteprima.problemi);
  if (bloccanti.length > 0) {
    return Response.json(
      {
        error:
          "Il regolamento scelto non regge il file: correggi crediti o slot (l'anteprima indica i minimi compatibili).",
        ...risposta,
      },
      { status: 409 },
    );
  }
  if (!config.forza && problemiDaConfermare(anteprima.problemi).length > 0) {
    return Response.json(
      { error: "Ci sono righe che verrebbero scartate: confermale esplicitamente per procedere.", ...risposta },
      { status: 409 },
    );
  }

  const eventi = anteprima.eventi;

  await salvaNuovaAsta(setup);
  await updateBoard(setup.id, (current) => {
    const esistenti = new Set(current.events.map((ev) => ev.id));
    return { astaId: setup.id, events: [...current.events, ...eventi.filter((ev) => !esistenti.has(ev.id))] };
  });

  return Response.json({ astaId: setup.id, eventiScritti: eventi.length, ...risposta });
}

// Gli eventi non servono al client (li riscrive il server in commit) e sono la
// parte più voluminosa dell'anteprima: fuori dalla risposta.
function rispostaAnteprima(anteprima: AnteprimaRose, nomiSquadre: string[]) {
  const { eventi, ...resto } = anteprima;
  return {
    ...resto,
    nomiSquadre,
    eventiTotali: eventi.length,
    bloccanti: problemiBloccanti(anteprima.problemi),
    daConfermare: problemiDaConfermare(anteprima.problemi),
  };
}
