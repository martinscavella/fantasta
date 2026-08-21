import { z } from "zod";
import { DossierBloccoGeneratoSchema } from "@/lib/ai/schemas";
import type { Player } from "@/lib/blob/schemas";

const DIMENSIONE_BLOCCO = 25;

export type BloccoDossier = { blockId: string; giocatori: Player[] };

/**
 * Divide i giocatori rilevanti in blocchi da 25 (§ Dossier giocatori nel
 * piano: "250 dossier non entrano in un singolo messaggio di chat"). blockId
 * è stabile (indice nel nome) così un blocco rigenerato ricade sempre nello
 * stesso slot.
 */
export function costruisciBlocchi(giocatori: Player[], dimensioneBlocco = DIMENSIONE_BLOCCO): BloccoDossier[] {
  const ordinati = [...giocatori].sort((a, b) => b.quotazioneAttuale - a.quotazioneAttuale);
  const blocchi: BloccoDossier[] = [];
  for (let i = 0; i < ordinati.length; i += dimensioneBlocco) {
    const indice = blocchi.length + 1;
    blocchi.push({ blockId: `blocco-${indice}`, giocatori: ordinati.slice(i, i + dimensioneBlocco) });
  }
  return blocchi;
}

// Rubrica ripetuta identica in ogni prompt: senza, il blocco 8 valuta
// "rischio infortuni" con criteri diversi dal blocco 1 (§ piano: "due
// accorgimenti perché i blocchi restino coerenti tra loro").
const RUBRICA = `Rubrica di valutazione (usa questi criteri per ogni giocatore, per restare coerente tra un blocco e l'altro):
- rischioInfortuni: "alto" se ha avuto infortuni ricorrenti o lunghi negli ultimi 12 mesi, "medio" se occasionali, "basso" altrimenti.
- rischioTitolarita: "alto" se non è titolare fisso o rischia la panchina, "medio" se in ballottaggio ma favorito, "basso" se titolare inamovibile.
- prezzoConsigliato: il prezzo a cui lo prenderei volentieri in un'asta normale, motivato in motivazionePrezzo (non ripetere semplicemente la quotazione ufficiale). Non è un tetto invalicabile: in motivazionePrezzo dimmi anche fin dove ha senso spingersi se l'asta è più cara del previsto, e sotto quale prezzo diventa invece un affare da non lasciarsi scappare.
- alternative: 2-3 id di giocatori comparabili per ruolo e fascia di prezzo, tra quelli elencati in questo stesso blocco o nei blocchi precedenti se li conosci. Sono la parte più usata del dossier: in asta il giocatore salta e serve sapere subito su chi ripiegare. A parità di valore preferisci alternative di un club diverso dal suo, così ripiegare non concentra la rosa su una sola squadra.`;

export function buildPromptDossier(blocco: BloccoDossier): string {
  const listaGiocatori = blocco.giocatori
    .map((g) => `${g.id}\t${g.ruolo}\t${g.nome}\t${g.squadra}\t${g.quotazioneAttuale}`)
    .join("\n");

  return `Sei il mio collega d'asta per il fantacalcio (Serie A, modalità Classic). Questi dossier li leggo mentre l'asta corre, con pochi secondi per decidere: servono a farmi cambiare idea in fretta e con cognizione, non a certificare una graduatoria. Fai ricerca sul web per ogni giocatore: notizie recenti (mercato, ballottaggi, cambi di allenatore), infortuni, gerarchie nei rigori.

${RUBRICA}

Scrivi asciutto: ogni punto di forza o debolezza è una riga secca, non un paragrafo. Dove i dati sono pochi o vecchi dillo in noteRecenti invece di riempire il vuoto con una supposizione.

## Giocatori di questo blocco (id, ruolo, nome, squadra, quotazione attuale)
${listaGiocatori}

Per ciascuno produci: punti di forza, punti di debolezza, rischio infortuni, rischio titolarità, note recenti, prezzo consigliato motivato, alternative comparabili.

Includi "blockId": "${blocco.blockId}" esattamente come scritto qui — serve all'app per verificare che questa risposta vada nello slot giusto.

Il JSON dev'essere l'unico blocco di codice della risposta, conforme a questo schema (eventuali commenti tuoi vanno prima del blocco, l'app li ignora):

\`\`\`json
${JSON.stringify(z.toJSONSchema(DossierBloccoGeneratoSchema), null, 2)}
\`\`\`
`;
}
