import type { z, ZodType } from "zod";

// § Ponte IA nel piano: "copi il blocco JSON, incolli nell'app, validazione
// zod → atterra nella strategia". Il testo incollato da una chat non è mai
// JSON puro: prosa attorno, fence markdown, a volte troncato a metà se la
// copia è andata storta. Questo modulo è il punto più critico del ponte —
// il piano lo segnala come "il test che conta di più".

/**
 * Estrae il testo JSON dal blocco incollato: prima un fence markdown
 * (```json ... ``` o ``` ... ```), altrimenti la sezione dalla prima `{` alla
 * ultima `}` (copre la prosa che chat come Claude aggiungono prima/dopo il
 * JSON). null se non si trova nessuna delle due forme.
 */
export function estraiJson(testo: string): string | null {
  const fence = testo.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();

  const start = testo.indexOf("{");
  const end = testo.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return testo.slice(start, end + 1);

  return null;
}

export type RisultatoImport<T> = { ok: true; data: T } | { ok: false; errore: string };

/**
 * Estrae, fa il parse JSON e valida contro lo schema zod atteso. L'errore è
 * sempre puntuale (nomina il campo) così si può rigirare in chat e farlo
 * correggere (§ Ponte IA nel piano: "l'errore è puntuale... lo rigiri in chat").
 */
export function importaRisposta<S extends ZodType>(testo: string, schema: S): RisultatoImport<z.infer<S>> {
  const jsonText = estraiJson(testo);
  if (jsonText === null) {
    return { ok: false, errore: "Nessun blocco JSON trovato nel testo incollato." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      ok: false,
      errore: "JSON non valido — probabilmente troncato. Controlla di aver copiato l'intera risposta.",
    };
  }

  const risultato = schema.safeParse(parsed);
  if (!risultato.success) {
    const primo = risultato.error.issues[0];
    const path = primo.path.join(".");
    return { ok: false, errore: path ? `Campo non valido: "${path}" — ${primo.message}` : primo.message };
  }

  return { ok: true, data: risultato.data };
}
