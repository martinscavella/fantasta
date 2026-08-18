import { eseguiScraping } from "@/lib/scraping/esegui";
import { FONTI_ATTIVE } from "@/lib/scraping/registro";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET non configurato" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const stagione = new URL(request.url).searchParams.get("stagione");
  if (!stagione) {
    return Response.json({ error: "Parametro 'stagione' mancante" }, { status: 400 });
  }

  const esito = await eseguiScraping(stagione, FONTI_ATTIVE);
  return Response.json(esito, { status: esito.ok ? 200 : 502 });
}
