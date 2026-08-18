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
- prezzoConsigliato: prezzo in crediti che pagheresti tu, motivato in motivazionePrezzo (non ripetere semplicemente la quotazione ufficiale).
- alternative: 2-3 id di giocatori comparabili per ruolo e fascia di prezzo, tra quelli elencati in questo stesso blocco o nei blocchi precedenti se li conosci.`;

export function buildPromptDossier(blocco: BloccoDossier): string {
  const listaGiocatori = blocco.giocatori
    .map((g) => `${g.id}\t${g.ruolo}\t${g.nome}\t${g.squadra}\t${g.quotazioneAttuale}`)
    .join("\n");

  return `Sei un assistente per la preparazione di un'asta del fantacalcio (Serie A, modalità Classic). Fai ricerca sul web per ogni giocatore: notizie recenti (mercato, ballottaggi, cambi di allenatore), infortuni, gerarchie nei rigori.

${RUBRICA}

## Giocatori di questo blocco (id, ruolo, nome, squadra, quotazione attuale)
${listaGiocatori}

Per ciascuno produci: punti di forza, punti di debolezza, rischio infortuni, rischio titolarità, note recenti, prezzo consigliato motivato, alternative comparabili.

Includi "blockId": "${blocco.blockId}" esattamente come scritto qui — serve all'app per verificare che questa risposta vada nello slot giusto.

Rispondi SOLO con un blocco JSON conforme a questo schema (nessun testo dopo il blocco):

\`\`\`json
${JSON.stringify(z.toJSONSchema(DossierBloccoGeneratoSchema), null, 2)}
\`\`\`
`;
}
