import { z } from "zod";
import { StrategiaGeneratasSchema } from "@/lib/ai/schemas";
import type { Player, SetupDoc } from "@/lib/blob/schemas";

// Le scelte del generatore sono opzioni predefinite invece di testo libero:
// compilare quattro textarea era il modo piu' lento di rispondere a domande
// che hanno quasi sempre le stesse risposte. Le etichette qui sono la fonte di
// verita' — la UI le mostra come checkbox e il prompt le riusa alla lettera,
// cosi' non possono divergere.

export type OpzioneScelta = { id: string; label: string; descrizione?: string };

export const STILI: OpzioneScelta[] = [
  { id: "corazzata-difensiva", label: "Corazzata difensiva", descrizione: "difesa e portiere della stessa big" },
  { id: "attacco-stellare", label: "Attacco stellare", descrizione: "uno o due bomber da top di listone" },
  { id: "budget-diffuso", label: "Budget diffuso", descrizione: "nessun big, tanti titolari di fascia media" },
  { id: "centrocampo-dominante", label: "Centrocampo dominante", descrizione: "spesa concentrata sui centrocampisti da bonus" },
  { id: "coppia-gol", label: "Coppia gol della stessa squadra", descrizione: "due attaccanti dello stesso club" },
  { id: "portiere-titolare-big", label: "Portiere titolare di una big", descrizione: "invece di risparmiare sul reparto" },
];

export const RISCHI: OpzioneScelta[] = [
  { id: "prudente", label: "Prudente", descrizione: "quasi solo certezze, al massimo 1-2 scommesse" },
  { id: "equilibrato", label: "Equilibrato", descrizione: "3-4 scommesse, il resto titolari affidabili" },
  { id: "aggressivo", label: "Aggressivo", descrizione: "molte scommesse a basso costo, punto sull'upside" },
];

export const REGOLE_PUNTEGGIO: OpzioneScelta[] = [
  { id: "mod-difesa", label: "Modificatore di difesa" },
  { id: "mod-centrocampo", label: "Modificatore di centrocampo" },
  { id: "portiere-imbattuto", label: "Bonus portiere imbattuto" },
  { id: "assist", label: "Gli assist danno bonus" },
  { id: "porta-inviolata-mod", label: "Bonus per la porta inviolata di squadra" },
  { id: "malus-pesanti", label: "Malus pesanti (ammonizioni ed espulsioni contano parecchio)" },
];

export const PREFERENZE: OpzioneScelta[] = [
  { id: "rigoristi", label: "Privilegia i rigoristi designati" },
  { id: "evita-infortunati", label: "Evita chi ha alto rischio infortuni" },
  { id: "evita-neopromosse", label: "Evita i giocatori delle neopromosse" },
  { id: "evita-trasferiti", label: "Evita chi ha appena cambiato squadra" },
  { id: "giovani", label: "Punta sui giovani in crescita" },
  { id: "titolarita-su-talento", label: "Preferisci la titolarità certa al talento discontinuo" },
  { id: "max-due-per-club", label: "Non più di due giocatori dello stesso club" },
  { id: "evita-coppe", label: "Occhio a chi gioca le coppe europee (turnover)" },
];

export type InputGeneratoreStrategia = {
  // id da STILI: piu' di uno e' legittimo ("corazzata difensiva" + "rigoristi").
  stili: string[];
  // id da RISCHI: scelta singola.
  rischio: string;
  regolePunteggio: string[];
  preferenze: string[];
  // L'unico campo libero rimasto: nomi specifici, tetti, tutto ciò che le
  // caselle non possono prevedere.
  note: string;
};

// Limite ai giocatori elencati nel prompt: l'IA fa ricerca sul web per il
// resto, qui serve solo l'ossatura del listone (ruolo, squadra, quotazione)
// per calibrare le soglie sul budget reale della lega — non l'intero listone
// da ~600 righe, che gonfierebbe il prompt senza aggiungere informazione.
const MAX_GIOCATORI_ELENCATI = 150;

/** Etichette (con descrizione) degli id selezionati, nell'ordine di `opzioni`. */
function etichette(opzioni: OpzioneScelta[], selezionati: string[]): string[] {
  return opzioni
    .filter((o) => selezionati.includes(o.id))
    .map((o) => (o.descrizione ? `${o.label} (${o.descrizione})` : o.label));
}

function elenco(voci: string[], seVuoto: string): string {
  return voci.length > 0 ? voci.map((v) => `- ${v}`).join("\n") : `- ${seVuoto}`;
}

export function buildPromptStrategia(setup: SetupDoc, giocatori: Player[], input: InputGeneratoreStrategia): string {
  const rilevanti = [...giocatori]
    .sort((a, b) => b.quotazioneAttuale - a.quotazioneAttuale)
    .slice(0, MAX_GIOCATORI_ELENCATI);

  const listaGiocatori = rilevanti
    .map((g) => `${g.id}\t${g.ruolo}\t${g.nome}\t${g.squadra}\t${g.quotazioneAttuale}`)
    .join("\n");

  const sforo =
    setup.sforo.tipo === "a-pagamento"
      ? `A sforo: i crediti oltre il budget base si pagano a ${setup.sforo.euroPerCredito} € ciascuno, senza penalità di gioco.`
      : "Budget chiuso: nessun credito extra disponibile oltre il budget base.";

  const rischio = RISCHI.find((r) => r.id === input.rischio);

  return `Sei un assistente per la preparazione di un'asta del fantacalcio (Serie A, modalità Classic — solo ruoli P/D/C/A).

Fai ricerca sul web per informarti sullo stato attuale della Serie A (mercato estivo, infortuni, cambi di allenatore, gerarchie nei rigori) prima di rispondere: la strategia deve riflettere la stagione in corso, non dati generici.

## Regole della lega
- Squadre partecipanti: ${setup.squadre.length}
- Crediti base per squadra: ${setup.creditiBase}
- Slot da riempire: P ${setup.slot.P}, D ${setup.slot.D}, C ${setup.slot.C}, A ${setup.slot.A}
- ${sforo}

### Regole di punteggio attive
${elenco(etichette(REGOLE_PUNTEGGIO, input.regolePunteggio), "nessuna particolare: usa le regole standard del fantacalcio classico")}

## Stile di rosa desiderato
${elenco(etichette(STILI, input.stili), "nessuna preferenza: scegli tu l'impostazione più sensata per queste regole")}

## Propensione al rischio
${rischio ? `${rischio.label} — ${rischio.descrizione}` : "equilibrata"}

## Preferenze sui giocatori
${elenco(etichette(PREFERENZE, input.preferenze), "nessuna preferenza particolare")}

## Note libere
${input.note.trim() || "nessuna"}

## Giocatori rilevanti del listone (id, ruolo, nome, squadra, quotazione attuale)
${listaGiocatori}

## Cosa produrre
Costruisci una strategia d'asta completa e motivata:
1. Soglie delle fasce di prezzo, calibrate su questo budget (non la convenzione generica).
2. Ripartizione del budget per reparto (P/D/C/A) in crediti, che deve sommare esattamente a ${setup.creditiBase}.
3. Obiettivi primari e alternative ordinate per ogni slot (usa gli id dei giocatori elencati sopra).
4. Prezzo massimo consigliato per i giocatori più rilevanti (usa i loro id).
5. Una sintesi in prosa: cosa stiamo facendo e perché, incluse le scelte che discendono dalle preferenze qui sopra.

Rispondi SOLO con un blocco JSON conforme a questo schema (nessun testo dopo il blocco):

\`\`\`json
${JSON.stringify(z.toJSONSchema(StrategiaGeneratasSchema), null, 2)}
\`\`\`
`;
}
