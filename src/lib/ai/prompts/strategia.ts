import { z } from "zod";
import { StrategiaGeneratasSchema } from "@/lib/ai/schemas";
import type { Player, SetupDoc } from "@/lib/blob/schemas";

// Le scelte del generatore sono opzioni predefinite invece di testo libero:
// compilare quattro textarea era il modo piu' lento di rispondere a domande
// che hanno quasi sempre le stesse risposte. Le etichette qui sono la fonte di
// verita' — la UI le mostra come checkbox e il prompt le riusa alla lettera,
// cosi' non possono divergere.

export type OpzioneScelta = { id: string; label: string; descrizione?: string };

// Nessuno stile propone piu' "il blocco della stessa big": prendere mezza rosa
// da un solo club e' rischio correlato (una domenica storta, un cambio di
// allenatore, il turnover delle coppe affondano tutto insieme). La
// diversificazione e' una regola del prompt, non una preferenza da spuntare.
export const STILI: OpzioneScelta[] = [
  { id: "corazzata-difensiva", label: "Corazzata difensiva", descrizione: "portiere e difensori titolari di squadre che subiscono poco" },
  { id: "attacco-stellare", label: "Attacco stellare", descrizione: "uno o due bomber da top di listone" },
  { id: "budget-diffuso", label: "Budget diffuso", descrizione: "nessun big, tanti titolari di fascia media" },
  { id: "centrocampo-dominante", label: "Centrocampo dominante", descrizione: "spesa concentrata sui centrocampisti da bonus" },
  { id: "doppia-punta", label: "Doppia punta di peso", descrizione: "due attaccanti da bonus, meglio se di club diversi" },
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

  return `Sei il mio collega d'asta per il fantacalcio (Serie A, modalità Classic — solo ruoli P/D/C/A). Prepariamo insieme il piano con cui mi siedo al tavolo.

Fai ricerca sul web sullo stato attuale della Serie A (mercato estivo, infortuni, cambi di allenatore, gerarchie nei rigori) prima di rispondere: il piano deve riflettere la stagione in corso, non dati generici.

## Come ragionare
- L'asta si gioca con altre persone, che hanno i loro piani e i loro crediti. Il mio piano non sopravviverà intatto, ed è normale: costruiscilo perché regga quando le cose vanno diversamente, non perché sia perfetto sulla carta.
- Per ogni slot conta più la profondità delle alternative che il nome dell'obiettivo principale. Se il primo salta a un prezzo fuori scala devo già sapere chi prendere al suo posto e a quanto.
- La ripartizione del budget è una bussola, non un vincolo contabile. Dimmi quali numeri sono davvero intoccabili e quali possono muoversi — e a scapito di quale reparto — se l'asta si scalda da una parte.
- Diversifica i club: più di due giocatori dello stesso club è rischio correlato — una brutta domenica di quella squadra, un cambio di allenatore o il turnover delle coppe affondano mezza rosa in una volta. Tre dello stesso club solo con una ragione forte e dichiarata; il reparto difensivo tutto della stessa squadra non è un piano, è una scommessa singola travestita da rosa, e vale anche col modificatore di difesa attivo.
- I prezzi vanno espressi nella scala di QUESTA lega (budget ${setup.creditiBase} a squadra): se la quotazione di listino è tarata su un'altra scala, riportala prima di usarla.

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
3. Obiettivi primari e alternative ordinate per ogni slot (usa gli id dei giocatori elencati sopra). Le alternative sono la parte che userò davvero: almeno due per ogni slot che conta, su fasce di prezzo diverse, e non tutte dello stesso club dell'obiettivo principale.
4. Prezzo massimo consigliato per i giocatori più rilevanti (usa i loro id).
5. Una sintesi in prosa: cosa stiamo facendo e perché, quali scelte discendono dalle preferenze qui sopra, e i due o tre bivi in cui mi troverò con ogni probabilità — un reparto che va a prezzi folli, un obiettivo che sparisce nei primi giri — con la mossa da fare in ciascuno.

Prima del blocco JSON puoi scrivermi qualche riga di commento: dove il piano è fragile, cosa cambieresti, cosa ti convince poco dei parametri che ti ho dato. L'app le ignora e importa solo il JSON, quindi non costano nulla — e se preferisci discutere una scelta prima di produrre il piano, chiedimelo invece di indovinare.

Il JSON dev'essere l'unico blocco di codice della risposta, conforme a questo schema:

\`\`\`json
${JSON.stringify(z.toJSONSchema(StrategiaGeneratasSchema), null, 2)}
\`\`\`
`;
}
