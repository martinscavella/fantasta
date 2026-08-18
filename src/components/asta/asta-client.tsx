"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAstaStore, caricaEIniziaAsta } from "@/stores/asta-store";
import { reduceBoard } from "@/lib/asta/reducer";
import { derivaInflazione, derivaSquadre } from "@/lib/asta/derive";
import { fasciaStandard, prezzoMassimoDefault, prezzoReattivo } from "@/lib/pricing";
import { CommandBar } from "@/components/asta/command-bar";
import { TeamsGrid, type RigaRosa } from "@/components/asta/teams-grid";
import { EventLog, type VoceLog } from "@/components/asta/event-log";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BoardEvent, Player, PrezzoMassimo, Ruolo, SetupDoc } from "@/lib/blob/schemas";

const TUTTI = "_tutti";

function nuovoId(): string {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function AstaClient({
  setup,
  giocatori,
  eventiIniziali,
  prezziMassimi,
}: {
  setup: SetupDoc;
  giocatori: Player[];
  eventiIniziali: BoardEvent[];
  prezziMassimi: PrezzoMassimo[];
}) {
  const events = useAstaStore((s) => s.events);
  const syncStatus = useAstaStore((s) => s.syncStatus);

  useEffect(() => {
    void caricaEIniziaAsta(setup.id, eventiIniziali);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al mount di questa asta
  }, [setup.id]);

  const [filtroRuolo, setFiltroRuolo] = useState<string>(TUTTI);
  const [filtroTesto, setFiltroTesto] = useState("");

  const giocatoriPerId = useMemo(() => new Map(giocatori.map((g) => [g.id, g])), [giocatori]);
  const ruoloPerGiocatore = useMemo(
    () => Object.fromEntries(giocatori.map((g) => [g.id, g.ruolo])) as Record<number, Ruolo>,
    [giocatori],
  );

  const astaState = useMemo(() => reduceBoard(events, setup, ruoloPerGiocatore), [events, setup, ruoloPerGiocatore]);
  const squadreDerivate = useMemo(() => derivaSquadre(astaState, setup, giocatori), [astaState, setup, giocatori]);
  const inflazione = useMemo(
    () => derivaInflazione(astaState, setup, giocatori, events),
    [astaState, setup, giocatori, events],
  );

  const prezzoBasePerId = useMemo(() => new Map(prezziMassimi.map((p) => [p.playerId, p.valore])), [prezziMassimi]);
  const prezzoReattivoPerId = useMemo(() => {
    const mappa = new Map<number, number>();
    for (const g of giocatori) {
      const base = prezzoBasePerId.get(g.id) ?? prezzoMassimoDefault(g.quotazioneAttuale);
      mappa.set(g.id, prezzoReattivo(base, inflazione.effettiva));
    }
    return mappa;
  }, [giocatori, prezzoBasePerId, inflazione.effettiva]);

  const assegnatiIds = useMemo(
    () => new Set(Object.values(astaState.assegnazioni).map((a) => a.playerId)),
    [astaState],
  );
  const giocatoriLiberi = useMemo(() => giocatori.filter((g) => !assegnatiIds.has(g.id)), [giocatori, assegnatiIds]);

  const liberiFiltrati = useMemo(() => {
    const query = filtroTesto.trim().toLowerCase();
    return giocatoriLiberi.filter((g) => {
      if (filtroRuolo !== TUTTI && g.ruolo !== filtroRuolo) return false;
      if (query && !g.nome.toLowerCase().includes(query) && !g.squadra.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [giocatoriLiberi, filtroRuolo, filtroTesto]);

  const rose = useMemo(() => {
    const risultato: Record<string, RigaRosa[]> = {};
    for (const squadra of setup.squadre) risultato[squadra.id] = [];
    for (const [eventId, a] of Object.entries(astaState.assegnazioni)) {
      const player = giocatoriPerId.get(a.playerId);
      if (!player) continue;
      (risultato[a.teamId] ??= []).push({ player, price: a.price, eventId });
    }
    return risultato;
  }, [astaState, giocatoriPerId, setup.squadre]);

  const squadrePerId = useMemo(() => new Map(setup.squadre.map((s) => [s.id, s.nome])), [setup.squadre]);
  const vociLog: VoceLog[] = useMemo(() => {
    const tsPerEvento = new Map(events.filter((e) => e.type === "ASSIGN").map((e) => [e.id, e.ts]));
    return Object.entries(astaState.assegnazioni).flatMap(([eventId, a]) => {
      const player = giocatoriPerId.get(a.playerId);
      if (!player) return [];
      return [
        {
          eventId,
          ts: tsPerEvento.get(eventId) ?? 0,
          player,
          teamId: a.teamId,
          teamNome: squadrePerId.get(a.teamId) ?? a.teamId,
          price: a.price,
        },
      ];
    });
  }, [astaState, giocatoriPerId, squadrePerId, events]);

  function dispatch(event: BoardEvent) {
    useAstaStore.getState().aggiungiEvento(event);
  }

  function assegna(playerId: number, teamId: string, price: number) {
    dispatch({ id: nuovoId(), ts: Date.now(), type: "ASSIGN", playerId, teamId, price });
  }

  function annulla(targetEventId: string) {
    dispatch({ id: nuovoId(), ts: Date.now(), type: "UNDO", targetEventId });
  }

  function modifica(targetEventId: string, cambio: { price?: number; teamId?: string }) {
    dispatch({ id: nuovoId(), ts: Date.now(), type: "EDIT", targetEventId, ...cambio });
  }

  const statoLabel = { salvato: "salvato", salvataggio: "salvataggio…", offline: "offline — dati al sicuro in locale" }[
    syncStatus
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{setup.nome}</h1>
        <div className="flex items-center gap-3">
          {inflazione.teorica !== null && (
            <span className="text-xs text-muted-foreground">
              Inflazione teorica: <span className="font-mono">{inflazione.teorica.toFixed(2)}×</span>
            </span>
          )}
          {inflazione.osservata !== null && (
            <span className="text-xs text-muted-foreground">
              osservata: <span className="font-mono">{inflazione.osservata.toFixed(2)}×</span>
            </span>
          )}
          <Link href={`/strategia/${setup.id}`} className="text-sm text-muted-foreground hover:text-foreground">
            Strategia
          </Link>
          <Badge variant={syncStatus === "offline" ? "outline" : "secondary"}>{statoLabel}</Badge>
        </div>
      </div>

      <CommandBar
        giocatoriLiberi={giocatoriLiberi}
        squadre={squadreDerivate}
        prezzoReattivoPerId={prezzoReattivoPerId}
        onAssegna={assegna}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              placeholder="Filtra liberi…"
              value={filtroTesto}
              onChange={(e) => setFiltroTesto(e.target.value)}
              className="flex-1"
            />
            <Select value={filtroRuolo} onValueChange={(v) => setFiltroRuolo(v ?? TUTTI)}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TUTTI}>Tutti</SelectItem>
                {(["P", "D", "C", "A"] as Ruolo[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border">
            <ul className="flex flex-col">
              {liberiFiltrati.slice(0, 150).map((g) => {
                const fascia = fasciaStandard(g.quotazioneAttuale);
                return (
                  <li key={g.id} className="flex items-center gap-2 border-b border-border/60 px-2 py-1.5 text-sm">
                    <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">{g.ruolo}</span>
                    <span className="flex-1 truncate">{g.nome}</span>
                    <span className="text-xs text-muted-foreground">{g.squadra}</span>
                    {fascia && (
                      <Badge variant="outline" className="text-[10px]">
                        {fascia}
                      </Badge>
                    )}
                    <span className="w-8 text-right font-mono">{g.quotazioneAttuale}</span>
                    <span className="w-10 text-right font-mono text-xs text-muted-foreground" title="Prezzo max reattivo">
                      →{prezzoReattivoPerId.get(g.id)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {liberiFiltrati.length > 150 && (
              <p className="p-2 text-xs text-muted-foreground">
                Mostrati 150 di {liberiFiltrati.length} — affina il filtro.
              </p>
            )}
          </div>
        </div>

        <TeamsGrid squadre={squadreDerivate} rose={rose} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Log assegnazioni</h2>
        <EventLog
          voci={vociLog}
          squadre={setup.squadre.map((s) => ({ teamId: s.id, nome: s.nome }))}
          onUndo={annulla}
          onEdit={modifica}
        />
      </div>
    </div>
  );
}
