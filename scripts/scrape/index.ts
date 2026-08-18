import { eseguiScraping } from "@/lib/scraping/esegui";
import { FONTI_ATTIVE } from "@/lib/scraping/registro";

async function main() {
  const stagione = process.argv[2];
  if (!stagione) {
    console.error("Uso: npm run scrape -- <stagione>");
    process.exitCode = 1;
    return;
  }

  console.log(`Scraping stagione ${stagione} — fonti: ${FONTI_ATTIVE.map((f) => f.id).join(", ")}`);
  const esito = await eseguiScraping(stagione, FONTI_ATTIVE);

  if (!esito.ok) {
    console.error("Fallito:", esito.errore);
    process.exitCode = 1;
    return;
  }

  console.log(`Versione ${esito.versionId}: ${esito.righe} righe, ${esito.daRivedere} da rivedere in coda.`);
  if (esito.fontiFallite.length > 0) {
    console.warn(`Fonti fallite (ignorate, le altre hanno comunque scritto): ${esito.fontiFallite.join(", ")}`);
  }
}

main();
