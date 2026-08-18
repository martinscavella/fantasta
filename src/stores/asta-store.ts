import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import type { BoardEvent } from "@/lib/blob/schemas";

export type SyncStatus = "salvato" | "salvataggio" | "offline";

type AstaStoreState = {
  astaId: string | null;
  events: BoardEvent[];
  syncStatus: SyncStatus;
  init: (astaId: string, eventiUniti: BoardEvent[]) => void;
  aggiungiEvento: (event: BoardEvent) => void;
};

const DEBOUNCE_MS = 2000;
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function chiaveIndexedDb(astaId: string) {
  return `fantasta:asta:${astaId}:events`;
}

function unisciEventi(a: BoardEvent[], b: BoardEvent[]): BoardEvent[] {
  const perId = new Map(a.map((e) => [e.id, e]));
  for (const e of b) perId.set(e.id, e);
  return [...perId.values()].sort((x, y) => x.ts - y.ts);
}

export const useAstaStore = create<AstaStoreState>((set, get) => ({
  astaId: null,
  events: [],
  syncStatus: "salvato",

  init: (astaId, eventiUniti) => {
    set({ astaId, events: eventiUniti, syncStatus: "salvato" });
  },

  aggiungiEvento: (event) => {
    const { astaId, events } = get();
    if (!astaId) return;
    const nextEvents = unisciEventi(events, [event]);
    set({ events: nextEvents, syncStatus: "salvataggio" });
    // IndexedDB è immediato (~1ms): sopravvive a crash/refresh anche se il
    // sync col Blob (debounced) non è ancora partito.
    void idbSet(chiaveIndexedDb(astaId), nextEvents);
    scheduleSync(astaId);
  },
}));

function scheduleSync(astaId: string) {
  const existing = debounceTimers.get(astaId);
  if (existing) clearTimeout(existing);
  debounceTimers.set(
    astaId,
    setTimeout(() => void sincronizza(astaId), DEBOUNCE_MS),
  );
}

async function sincronizza(astaId: string) {
  const { events } = useAstaStore.getState();
  try {
    const res = await fetch(`/api/aste/${astaId}/board`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    });
    if (!res.ok) throw new Error(`sync fallita: ${res.status}`);
    const board: { events: BoardEvent[] } = await res.json();
    // Un'altra scheda potrebbe aver scritto eventi nel frattempo: unisco anziché sovrascrivere.
    const merged = unisciEventi(useAstaStore.getState().events, board.events);
    useAstaStore.setState({ events: merged, syncStatus: "salvato" });
    await idbSet(chiaveIndexedDb(astaId), merged);
  } catch {
    useAstaStore.setState({ syncStatus: "offline" });
  }
}

/**
 * Da chiamare al mount della schermata d'asta: unisce il log locale
 * (IndexedDB, può contenere eventi non ancora sincronizzati da un crash o da
 * una sessione offline) con quello remoto appena letto dal server, poi
 * inizializza lo store e — se il locale aveva eventi in più — li sincronizza.
 */
export async function caricaEIniziaAsta(astaId: string, eventiRemoti: BoardEvent[]): Promise<void> {
  const eventiLocali = (await idbGet<BoardEvent[]>(chiaveIndexedDb(astaId))) ?? [];
  const merged = unisciEventi(eventiRemoti, eventiLocali);
  useAstaStore.getState().init(astaId, merged);
  await idbSet(chiaveIndexedDb(astaId), merged);
  if (merged.length !== eventiRemoti.length) scheduleSync(astaId);
}
