import type { RigaRosa } from "@/lib/riepilogo/scostamento";

function escapeCsvField(value: string | number): string {
  const testo = String(value);
  if (/[",\n]/.test(testo)) return `"${testo.replace(/"/g, '""')}"`;
  return testo;
}

/** CSV della rosa finale — ruolo, nome, squadra, prezzo pagato. */
export function esportaRosaCsv(rosa: RigaRosa[]): string {
  const intestazione = ["ruolo", "nome", "squadra", "prezzo"];
  const righe = rosa.map((r) => [r.player.ruolo, r.player.nome, r.player.squadra, r.price]);
  return [intestazione, ...righe].map((riga) => riga.map(escapeCsvField).join(",")).join("\n");
}

export type EsportazioneAsta = {
  nomeAsta: string;
  esportatoAt: number;
  rosa: { ruolo: string; nome: string; squadra: string; prezzo: number }[];
};

export function esportaAstaJson(nomeAsta: string, rosa: RigaRosa[]): string {
  const dato: EsportazioneAsta = {
    nomeAsta,
    esportatoAt: Date.now(),
    rosa: rosa.map((r) => ({ ruolo: r.player.ruolo, nome: r.player.nome, squadra: r.player.squadra, prezzo: r.price })),
  };
  return JSON.stringify(dato, null, 2);
}

/** Avvia il download di un file testuale dal browser (nessuna route API). */
export function scaricaFile(nomeFile: string, contenuto: string, mimeType: string): void {
  const blob = new Blob([contenuto], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeFile;
  link.click();
  URL.revokeObjectURL(url);
}
