// §10 della spec — rilegge lo storico di StatoAsta persistito da
// registraStatoAsta() (src/lib/analisi-live/log.ts) e propone nuovi
// moltiplicatori per fascia da confrontare con FASCE_QUOTAZIONE in config.ts.
//
// Non aggiorna config.ts automaticamente: è un punto di partenza da rivedere
// a mano dopo più aste reali, non un tuning loop. Uso: npm run calibra:analisi-live

import { CAMPIONE_MINIMO_AFFIDABILE, FASCE_QUOTAZIONE } from "@/lib/analisi-live/config";
import { leggiStorico } from "@/lib/analisi-live/log";
import { calcolaMercato, costruisciRegistro, derivaSquadra } from "@/lib/analisi-live/motore";

async function main() {
  const storico = await leggiStorico();
  if (storico.length === 0) {
    console.log("Nessuno storico ancora registrato in .data/analisi-live/storico/ — nulla da calibrare.");
    return;
  }

  // La stessa asta manda molti snapshot via via che avanza (una chiamata per
  // reparto, spesso di più): si tiene solo l'ULTIMO per ciascuna combinazione
  // di nomi-squadra, altrimenti gli stessi acquisti verrebbero contati più
  // volte con peso diverso a seconda di quanti snapshot ha prodotto quell'asta.
  const ultimoPerAsta = new Map<string, (typeof storico)[number]>();
  for (const voce of storico) {
    const chiave = [voce.stato.miaSquadra.nome, ...voce.stato.avversari.map((a) => a.nome)].sort().join("|");
    const precedente = ultimoPerAsta.get(chiave);
    if (!precedente || voce.ricevutoAt > precedente.ricevutoAt) ultimoPerAsta.set(chiave, voce);
  }

  // Nota sull'approssimazione: calcolaMercato() restituisce già il rapporto
  // sommaPrezzi/sommaQuot per fascia, non i due addendi separati. Per
  // aggregare più aste si fa una media dei moltiplicatori pesata per
  // campione — non è identica al rapporto-delle-somme complessivo (§4.2), ma
  // è la stessa idea applicata su più aste invece che su una sola, ed è
  // sufficiente per un primo confronto con i valori di config.ts.
  const perFascia = new Map<string, { sommaPesata: number; campione: number }>(
    FASCE_QUOTAZIONE.map((f) => [f.fascia, { sommaPesata: 0, campione: 0 }]),
  );

  for (const { stato, registro: registroGrezzo } of ultimoPerAsta.values()) {
    const registro = costruisciRegistro(registroGrezzo);
    const squadre = [stato.miaSquadra, ...stato.avversari].map((s) => ({ squadra: s, derivata: derivaSquadra(s, stato.lega, registro) }));
    const mercato = calcolaMercato(registro, squadre);
    for (const f of mercato.moltiplicatorePerFascia) {
      const acc = perFascia.get(f.fascia);
      if (!acc || f.campione === 0) continue;
      acc.sommaPesata += f.moltiplicatore * f.campione;
      acc.campione += f.campione;
    }
  }

  console.log(`Storico letto: ${storico.length} snapshot, ${ultimoPerAsta.size} aste distinte.\n`);
  console.log("Moltiplicatori osservati per fascia (confronta con FASCE_QUOTAZIONE in config.ts):\n");
  for (const f of FASCE_QUOTAZIONE) {
    const acc = perFascia.get(f.fascia)!;
    const osservato = acc.campione > 0 ? acc.sommaPesata / acc.campione : null;
    const affidabile = acc.campione >= CAMPIONE_MINIMO_AFFIDABILE;
    const etichetta = affidabile ? "" : "  (campione insufficiente — non usare per calibrare)";
    console.log(`  ${f.fascia.padEnd(10)} campione=${acc.campione}\tosservato=${osservato?.toFixed(3) ?? "n/d"}${etichetta}`);
  }

  console.log(
    "\nRicorda: questo confronta solo il moltiplicatore per fascia (§4.2). I coefficienti di\n" +
      "fattoreScarsita (SCARSITA_COEFF_RIVALI, SCARSITA_COEFF_ALTERNATIVE) richiedono di confrontare\n" +
      "prezzoStimato con il prezzo REALMENTE pagato sugli stessi giocatori — non ancora automatizzato qui.",
  );
}

main().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
