import { z } from "zod";
import { StrategiaGeneratasSchema } from "@/lib/ai/schemas";
import type { Player, SetupDoc } from "@/lib/blob/schemas";

export type InputGeneratoreStrategia = {
  stile: string;
  rischio: string;
  vincoli: string;
  regolePunteggio: string;
};

// Limite ai giocatori elencati nel prompt: l'IA fa ricerca sul web per il
// resto, qui serve solo l'ossatura del listone (ruolo, squadra, quotazione)
// per calibrare le soglie sul budget reale della lega — non l'intero listone
// da ~600 righe, che gonfierebbe il prompt senza aggiungere informazione.
const MAX_GIOCATORI_ELENCATI = 150;

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

  return `Sei un assistente per la preparazione di un'asta del fantacalcio (Serie A, modalità Classic — solo ruoli P/D/C/A).

Fai ricerca sul web per informarti sullo stato attuale della Serie A (mercato estivo, infortuni, cambi di allenatore, gerarchie nei rigori) prima di rispondere: la strategia deve riflettere la stagione in corso, non dati generici.

## Regole della lega
- Squadre partecipanti: ${setup.squadre.length}
- Crediti base per squadra: ${setup.creditiBase}
- Slot da riempire: P ${setup.slot.P}, D ${setup.slot.D}, C ${setup.slot.C}, A ${setup.slot.A}
- ${sforo}
- Regole di punteggio particolari: ${input.regolePunteggio || "nessuna indicata, usa le regole standard del fantacalcio classico"}

## Stile e rischio
- Stile di squadra desiderato: ${input.stile}
- Propensione al rischio (scommesse ad alto potenziale contro certezze più care): ${input.rischio}

## Vincoli personali
${input.vincoli || "nessuno"}

## Giocatori rilevanti del listone (id, ruolo, nome, squadra, quotazione attuale)
${listaGiocatori}

## Cosa produrre
Costruisci una strategia d'asta completa e motivata:
1. Soglie delle fasce di prezzo, calibrate su questo budget (non la convenzione generica).
2. Ripartizione del budget per reparto (P/D/C/A) in crediti, che deve sommare esattamente a ${setup.creditiBase}.
3. Obiettivi primari e alternative ordinate per ogni slot (usa gli id dei giocatori elencati sopra).
4. Prezzo massimo consigliato per i giocatori più rilevanti (usa i loro id).
5. Una sintesi in prosa: cosa stiamo facendo e perché.

Rispondi SOLO con un blocco JSON conforme a questo schema (nessun testo dopo il blocco):

\`\`\`json
${JSON.stringify(z.toJSONSchema(StrategiaGeneratasSchema), null, 2)}
\`\`\`
`;
}
