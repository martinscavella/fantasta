"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, SkipForward, TrendingDown, TrendingUp } from "lucide-react";
import { useAstaStore, caricaEIniziaAsta } from "@/stores/asta-store";
import { reduceBoard } from "@/lib/asta/reducer";
import { costruisciRose, derivaInflazione, derivaSquadre } from "@/lib/asta/derive";
import { consigliaGiocatore, consigliaProssimo, type ContestoConsiglio } from "@/lib/asta/consiglio";
import {
  fasciaStandard,
  prezzoMassimoDefault,
  prezzoReattivo,
  FASCIA_BADGE_VARIANT,
  type FasciaStandard,
} from "@/lib/pricing";
import { AstaSubNav } from "@/components/asta/asta-sub-nav";
import { TeamsGrid } from "@/components/asta/teams-grid";
import { PannelloAssegnazione, type EsitoEleggibilita } from "@/components/asta/pannello-assegnazione";
import { StrisciaConsiglio } from "@/components/asta/striscia-consiglio";
import { EventLog, type VoceLog } from "@/components/asta/event-log";
import { ClubBadge } from "@/components/shared/club-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RUOLI, RUOLO_CLASSI, RUOLO_LABEL } from "@/lib/ruoli";
import { cn } from "@/lib/utils";
import type {
  BoardEvent,
  DossierEntry,
  Player,
  PlayerStats,
  Ruolo,
  SetupDoc,
  StrategyDoc,
} from "@/lib/blob/schemas";

const TUTTI = "_tutti";
const FASCE: FasciaStandard[] = ["Top", "Semitop", "Terza fascia", "Scommesse"];
const DURATA_FLASH_MS = 900;

type Ordinamento = "quotazione-desc" | "quotazione-asc" | "nome" | "fantamedia-desc" | "prezzo-reattivo-desc";

const ORDINAMENTI: { id: Ordinamento; label: string }[] = [
  { id: "quotazione-desc", label: "Quotazione ↓" },
  { id: "quotazione-asc", label: "Quotazione ↑" },
  { id: "nome", label: "Nome A-Z" },
  { id: "fantamedia-desc", label: "Fantamedia ↓" },
  { id: "prezzo-reattivo-desc", label: "Prezzo max ↓" },
];

function nuovoId(): string {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

// Filtri e posizione nella coda persistiti in localStorage per asta: senza
// questo, passare al tab Listone e tornare al Tracker azzera il ruolo
// selezionato e la posizione — "si perde il giro" a metà asta.
type FiltriSalvati = { ruolo?: string; fascia?: string; ordinamento?: Ordinamento; cursore?: number };

function chiaveFiltri(astaId: string): string {
  return `fantasta:asta:${astaId}:filtri`;
}

function caricaFiltriSalvati(astaId: string): FiltriSalvati {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(chiaveFiltri(astaId));
    return raw ? (JSON.parse(raw) as FiltriSalvati) : {};
  } catch {
    return {};
  }
}

// Niente casella di ricerca per filtrare: si scorre un giocatore alla volta
// nell'ordine deciso dai filtri (ruolo/fascia/ordinamento), con Assegna o
// Skippa per passare al successivo (§ Tracker d'asta nel piano). Due fasi
// sole: la coda, e il pannello di assegnazione dove prezzo e squadra si
// scelgono insieme.
type FaseAssegnazione = { tipo: "lista" } | { tipo: "assegna"; giocatore: Player };

export function AstaClient({
  setup,
  giocatori,
  eventiIniziali,
  strategy,
  statistiche,
  dossier,
}: {
  setup: SetupDoc;
  giocatori: Player[];
  eventiIniziali: BoardEvent[];
  strategy: StrategyDoc | null;
  statistiche: PlayerStats[];
  dossier: DossierEntry[];
}) {
  const events = useAstaStore((s) => s.events);
  const syncStatus = useAstaStore((s) => s.syncStatus);

  useEffect(() => {
    void caricaEIniziaAsta(setup.id, eventiIniziali);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al mount di questa asta
  }, [setup.id]);

  const [filtroRuolo, setFiltroRuolo] = useState<string>(() => caricaFiltriSalvati(setup.id).ruolo ?? TUTTI);
  const [filtroFascia, setFiltroFascia] = useState<string>(() => caricaFiltriSalvati(setup.id).fascia ?? TUTTI);
  const [ordinamento, setOrdinamento] = useState<Ordinamento>(() => caricaFiltriSalvati(setup.id).ordinamento ?? "nome");
  const [fase, setFase] = useState<FaseAssegnazione>({ tipo: "lista" });
  const [cursore, setCursore] = useState(() => caricaFiltriSalvati(setup.id).cursore ?? 0);
  const [querySalto, setQuerySalto] = useState("");
  const [flashTeamId, setFlashTeamId] = useState<string | null>(null);
  const saltoRef = useRef<HTMLInputElement>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);

  const giocatoriPerId = useMemo(() => new Map(giocatori.map((g) => [g.id, g])), [giocatori]);
  const statsPerPlayerId = useMemo(
    () => new Map(statistiche.filter((s) => s.playerId !== null).map((s) => [s.playerId!, s])),
    [statistiche],
  );
  const dossierPerId = useMemo(() => new Map(dossier.map((d) => [d.playerId, d])), [dossier]);
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

  const prezzoBasePerId = useMemo(
    () => new Map((strategy?.prezziMassimi ?? []).map((p) => [p.playerId, p.valore])),
    [strategy],
  );
  const prezzoReattivoPerId = useMemo(() => {
    const mappa = new Map<number, number>();
    for (const g of giocatori) {
      const base = prezzoBasePerId.get(g.id) ?? prezzoMassimoDefault(g.quotazioneAttuale, setup.creditiBase);
      mappa.set(g.id, prezzoReattivo(base, inflazione.effettiva));
    }
    return mappa;
  }, [giocatori, prezzoBasePerId, inflazione.effettiva, setup.creditiBase]);

  const assegnatiIds = useMemo(
    () => new Set(Object.values(astaState.assegnazioni).map((a) => a.playerId)),
    [astaState],
  );
  const giocatoriLiberi = useMemo(() => giocatori.filter((g) => !assegnatiIds.has(g.id)), [giocatori, assegnatiIds]);

  const liberiFiltrati = useMemo(() => {
    const filtrati = giocatoriLiberi.filter((g) => {
      if (filtroRuolo !== TUTTI && g.ruolo !== filtroRuolo) return false;
      if (filtroFascia !== TUTTI && fasciaStandard(g.quotazioneAttuale, setup.creditiBase) !== filtroFascia) return false;
      return true;
    });
    const ordinati = [...filtrati];
    switch (ordinamento) {
      case "quotazione-desc":
        ordinati.sort((a, b) => b.quotazioneAttuale - a.quotazioneAttuale);
        break;
      case "quotazione-asc":
        ordinati.sort((a, b) => a.quotazioneAttuale - b.quotazioneAttuale);
        break;
      case "nome":
        ordinati.sort((a, b) => a.nome.localeCompare(b.nome));
        break;
      case "fantamedia-desc":
        ordinati.sort((a, b) => (statsPerPlayerId.get(b.id)?.fantamedia ?? -Infinity) - (statsPerPlayerId.get(a.id)?.fantamedia ?? -Infinity));
        break;
      case "prezzo-reattivo-desc":
        ordinati.sort((a, b) => (prezzoReattivoPerId.get(b.id) ?? 0) - (prezzoReattivoPerId.get(a.id) ?? 0));
        break;
    }
    return ordinati;
  }, [giocatoriLiberi, filtroRuolo, filtroFascia, ordinamento, statsPerPlayerId, prezzoReattivoPerId, setup.creditiBase]);

  // Non si azzera mai a un cambio filtro con un effetto (vietato — vedi
  // AGENTS.md): si tronca alla lunghezza corrente calcolandolo qui, così
  // dopo un'assegnazione il cursore resta sullo stesso indice e mostra da
  // solo il giocatore "successivo" (quello appena assegnato è sparito dalla lista).
  const cursoreValido = liberiFiltrati.length === 0 ? 0 : Math.min(cursore, liberiFiltrati.length - 1);
  const giocatoreCorrente = liberiFiltrati[cursoreValido] ?? null;

  // Non filtra la coda: serve solo a saltare a un punto preciso di
  // liberiFiltrati (l'asta non parte sempre dalla A), poi si prosegue
  // normalmente nell'ordine scelto — vedi § Tracker d'asta nel piano.
  const suggerimentiSalto = useMemo(() => {
    const query = querySalto.trim().toLowerCase();
    if (!query) return [];
    return liberiFiltrati.filter((g) => g.nome.toLowerCase().includes(query)).slice(0, 8);
  }, [liberiFiltrati, querySalto]);

  const rose = useMemo(
    () => costruisciRose(astaState, giocatori, setup.squadre),
    [astaState, giocatori, setup.squadre],
  );

  // --- Consiglio (§ C del piano UX): tutto deterministico, nessuna IA -------

  const contestoConsiglio = useMemo<ContestoConsiglio | null>(() => {
    const mia = squadreDerivate.find((s) => s.teamId === setup.miaSquadraId);
    if (!mia) return null;

    const spesaPerRuolo: Record<Ruolo, number> = { P: 0, D: 0, C: 0, A: 0 };
    for (const riga of rose[setup.miaSquadraId] ?? []) spesaPerRuolo[riga.player.ruolo] += riga.price;

    return {
      setup,
      squadra: mia,
      strategy,
      spesaPerRuolo,
      inflazione: inflazione.effettiva,
      dossierPerId,
    };
  }, [squadreDerivate, setup, rose, strategy, inflazione.effettiva, dossierPerId]);

  // Il verdetto si valuta al prezzo massimo personale: è la domanda "vale la
  // pena arrivarci?", non "conviene a questa cifra?" — quella la risponde il
  // pannello di assegnazione mentre muovi il prezzo.
  const consiglioCorrente = useMemo(() => {
    if (!contestoConsiglio || !giocatoreCorrente) return null;
    const prezzo = prezzoReattivoPerId.get(giocatoreCorrente.id) ?? giocatoreCorrente.quotazioneAttuale;
    return consigliaGiocatore(giocatoreCorrente, prezzo, contestoConsiglio);
  }, [contestoConsiglio, giocatoreCorrente, prezzoReattivoPerId]);

  const consiglioProssimo = useMemo(
    () => (contestoConsiglio ? consigliaProssimo(contestoConsiglio) : null),
    [contestoConsiglio],
  );

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

  function annullaEvento(targetEventId: string) {
    dispatch({ id: nuovoId(), ts: Date.now(), type: "UNDO", targetEventId });
  }

  function modifica(targetEventId: string, cambio: { price?: number; teamId?: string }) {
    dispatch({ id: nuovoId(), ts: Date.now(), type: "EDIT", targetEventId, ...cambio });
  }

  function tornaAllaLista() {
    setFase({ tipo: "lista" });
    setQuerySalto("");
  }

  function skippa() {
    setCursore((i) => Math.min(liberiFiltrati.length - 1, i + 1));
  }

  function precedente() {
    setCursore((i) => Math.max(0, i - 1));
  }

  function saltaA(g: Player) {
    const indice = liberiFiltrati.findIndex((x) => x.id === g.id);
    if (indice !== -1) setCursore(indice);
    setQuerySalto("");
    saltoRef.current?.blur();
  }

  function assegnaASquadra(teamId: string, prezzo: number) {
    if (fase.tipo !== "assegna") return;
    dispatch({ id: nuovoId(), ts: Date.now(), type: "ASSIGN", playerId: fase.giocatore.id, teamId, price: prezzo });
    tornaAllaLista();

    setFlashTeamId(teamId);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashTeamId(null), DURATA_FLASH_MS);
  }

  // Idoneità di ogni squadra per l'assegnazione in corso. Il budget si valuta
  // sul prezzo proposto: nel pannello il prezzo può cambiare, ma una squadra
  // esclusa per slot pieno lo resta comunque, ed è il caso che conta.
  const eleggibilita = useMemo<Map<string, EsitoEleggibilita>>(() => {
    const mappa = new Map<string, EsitoEleggibilita>();
    if (fase.tipo !== "assegna") return mappa;
    for (const team of squadreDerivate) {
      if (team.slotResidui[fase.giocatore.ruolo] <= 0) {
        mappa.set(team.teamId, { ok: false, motivo: `${fase.giocatore.ruolo} al completo` });
      } else if (team.massimaOfferta !== null && team.massimaOfferta <= 0) {
        mappa.set(team.teamId, { ok: false, motivo: "crediti esauriti" });
      } else {
        mappa.set(team.teamId, { ok: true, motivo: null });
      }
    }
    return mappa;
  }, [fase, squadreDerivate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const filtri: FiltriSalvati = { ruolo: filtroRuolo, fascia: filtroFascia, ordinamento, cursore };
    window.localStorage.setItem(chiaveFiltri(setup.id), JSON.stringify(filtri));
  }, [setup.id, filtroRuolo, filtroFascia, ordinamento, cursore]);

  const statoLabel = {
    salvato: "dati salvati",
    salvataggio: "salvataggio…",
    offline: "offline — dati al sicuro in locale",
  }[syncStatus];
  const statoClasse = {
    salvato: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    salvataggio: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    offline: "bg-muted text-muted-foreground",
  }[syncStatus];
  const creditiTotaliLega = setup.squadre.length * setup.creditiBase;
  const fasciaCorrente = giocatoreCorrente ? fasciaStandard(giocatoreCorrente.quotazioneAttuale, setup.creditiBase) : null;
  const statsCorrente = giocatoreCorrente ? statsPerPlayerId.get(giocatoreCorrente.id) : undefined;

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <AstaSubNav astaId={setup.id} nome={setup.nome} />

      {/* Header scenografico: sfondo sfumato dell'accento, statistiche di lega in evidenza. */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 md:p-6">
        <div className="absolute -top-10 -right-10 size-40 rounded-full bg-primary/10 blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">Asta in corso</p>
            <h1 className="text-3xl font-bold tracking-tight">{setup.nome}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {setup.squadre.length} squadre · <span className="font-mono font-semibold text-foreground">{creditiTotaliLega}</span> crediti totali in lega
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {inflazione.effettiva !== null && (
              <span className="flex items-center gap-1 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium shadow-sm">
                {inflazione.effettiva >= 1 ? (
                  <TrendingUp className="size-3.5 text-rose-500" />
                ) : (
                  <TrendingDown className="size-3.5 text-emerald-500" />
                )}
                Inflazione <span className="font-mono font-bold">{inflazione.effettiva.toFixed(2)}×</span>
              </span>
            )}
            <Badge className={cn("gap-1.5 border-transparent px-3 py-1.5 text-xs font-medium", statoClasse)}>
              <span
                className={cn(
                  "size-2 rounded-full bg-current",
                  syncStatus === "salvataggio" && "animate-pulse",
                )}
              />
              {statoLabel}
            </Badge>
          </div>
        </div>
      </div>

      {fase.tipo === "assegna" ? (
        <PannelloAssegnazione
          giocatore={fase.giocatore}
          prezzoIniziale={prezzoReattivoPerId.get(fase.giocatore.id) ?? fase.giocatore.quotazioneAttuale}
          squadre={squadreDerivate}
          eleggibilita={eleggibilita}
          onAssegna={assegnaASquadra}
          onAnnulla={tornaAllaLista}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Input
              ref={saltoRef}
              placeholder="Vai a un giocatore…"
              value={querySalto}
              onChange={(e) => setQuerySalto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggerimentiSalto.length > 0) {
                  e.preventDefault();
                  saltaA(suggerimentiSalto[0]);
                } else if (e.key === "Escape") {
                  setQuerySalto("");
                }
              }}
            />
            {suggerimentiSalto.length > 0 && (
              <ul className="absolute top-full right-0 left-0 z-20 mt-1 flex flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                {suggerimentiSalto.map((g) => (
                  <li
                    key={g.id}
                    onClick={() => saltaA(g)}
                    className="flex h-8 cursor-pointer items-center gap-2 border-b border-border/60 px-3 text-sm last:border-b-0 hover:bg-accent"
                  >
                    <span
                      className={cn(
                        "w-5 shrink-0 rounded px-1 text-center font-mono text-[10px] font-semibold",
                        RUOLO_CLASSI[g.ruolo].badge,
                      )}
                    >
                      {g.ruolo}
                    </span>
                    <ClubBadge squadra={g.squadra} size="xs" />
                    <span className="flex-1 truncate">{g.nome}</span>
                    <span className="text-xs text-muted-foreground">{g.squadra}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  setFiltroRuolo(TUTTI);
                  setCursore(0);
                }}
                className={cn(
                  "flex h-8 items-center rounded-full border px-2.5 text-xs font-medium transition-colors",
                  filtroRuolo === TUTTI
                    ? "border-transparent bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                Tutti
              </button>
              {RUOLI.map((r) => (
                <button
                  key={r}
                  type="button"
                  title={RUOLO_LABEL[r]}
                  aria-label={RUOLO_LABEL[r]}
                  onClick={() => {
                    setFiltroRuolo(r);
                    setCursore(0);
                  }}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border font-mono text-xs font-semibold transition-colors active:scale-90",
                    filtroRuolo === r
                      ? cn(RUOLO_CLASSI[r].solid, "border-transparent")
                      : cn("border-border", RUOLO_CLASSI[r].badge),
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <Select
              value={filtroFascia}
              onValueChange={(v) => {
                setFiltroFascia(v ?? TUTTI);
                setCursore(0);
              }}
              items={{ [TUTTI]: "Tutte le fasce", ...Object.fromEntries(FASCE.map((f) => [f, f])) }}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue placeholder="Fascia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TUTTI}>Tutte le fasce</SelectItem>
                {FASCE.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={ordinamento}
              onValueChange={(v) => {
                setOrdinamento((v as Ordinamento) ?? "nome");
                setCursore(0);
              }}
              items={Object.fromEntries(ORDINAMENTI.map((o) => [o.id, o.label]))}
            >
              <SelectTrigger size="sm" className="w-40">
                <SelectValue placeholder="Ordina per" />
              </SelectTrigger>
              <SelectContent>
                {ORDINAMENTI.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-muted-foreground">{liberiFiltrati.length} disponibili</span>
          </div>

          {giocatoreCorrente === null ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nessun giocatore libero con questi filtri.
            </div>
          ) : (
            <div className="animate-in fade-in-0 flex flex-col gap-4 rounded-2xl border-2 border-primary/25 bg-card p-5 shadow-md duration-150">
              {consiglioCorrente && consiglioProssimo && (
                <StrisciaConsiglio consiglio={consiglioCorrente} prossimo={consiglioProssimo} />
              )}

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">
                    {cursoreValido + 1} di {liberiFiltrati.length}
                  </span>
                </span>
                {fasciaCorrente && <Badge variant={FASCIA_BADGE_VARIANT[fasciaCorrente]}>{fasciaCorrente}</Badge>}
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold",
                    RUOLO_CLASSI[giocatoreCorrente.ruolo].badge,
                  )}
                >
                  {giocatoreCorrente.ruolo}
                </span>
                <ClubBadge squadra={giocatoreCorrente.squadra} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xl font-bold">{giocatoreCorrente.nome}</p>
                  <p className="text-sm text-muted-foreground">{giocatoreCorrente.squadra}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-2xl font-bold">{giocatoreCorrente.quotazioneAttuale}</p>
                  <p className="text-xs text-muted-foreground">quotazione</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {statsCorrente?.fantamedia !== undefined && (
                  <span className="rounded-full bg-muted px-2.5 py-1">
                    Fantamedia <span className="font-mono font-semibold text-foreground">{statsCorrente.fantamedia.toFixed(2)}</span>
                  </span>
                )}
                {prezzoReattivoPerId.has(giocatoreCorrente.id) && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
                    Prezzo max consigliato{" "}
                    <span className="font-mono font-bold">{prezzoReattivoPerId.get(giocatoreCorrente.id)}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon-lg" onClick={precedente} disabled={cursoreValido === 0}>
                  <ChevronLeft />
                  <span className="sr-only">Precedente</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={skippa}
                  disabled={cursoreValido >= liberiFiltrati.length - 1}
                  className="flex-1 gap-1.5"
                >
                  <SkipForward className="size-3.5" />
                  Skippa
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={() => setFase({ tipo: "assegna", giocatore: giocatoreCorrente })}
                  className="flex-[2]"
                >
                  Assegna
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Squadre: contenuto centrale della pagina, sempre visibile. */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground">Squadre</h2>
        <TeamsGrid squadre={squadreDerivate} rose={rose} flashTeamId={flashTeamId} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground">Log assegnazioni</h2>
        <EventLog
          voci={vociLog}
          squadre={setup.squadre.map((s) => ({ teamId: s.id, nome: s.nome }))}
          onUndo={annullaEvento}
          onEdit={modifica}
        />
      </div>
    </div>
  );
}
