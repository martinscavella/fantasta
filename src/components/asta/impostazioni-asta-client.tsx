"use client";

import { useRef, useState } from "react";
import { Heart, ShieldAlert, Star, Users } from "lucide-react";
import { AstaSubNav } from "@/components/asta/asta-sub-nav";
import { EliminaAstaButton } from "@/components/asta/elimina-asta-button";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { aggiornaSquadre, impostaMiaSquadra } from "@/lib/actions/aste";
import type { SetupDoc, Squadra } from "@/lib/blob/schemas";

// Personalizzazioni per squadra (§ Impostazioni asta nel piano): allenatore e
// note sono solo un promemoria, la squadra del cuore no — l'Analisi live la
// legge come segnale di bias ("un tifoso della squadra X tende a
// sovrapagare i suoi giocatori", vedi src/lib/analisi-live/prompt.ts). Non si
// possono rinominare/aggiungere/rimuovere squadre da qui: quello resta fisso
// dalla creazione dell'asta, per non rompere gli event log del board che le
// referenziano per id.

type CampoModificabile = "allenatore" | "squadraDelCuore" | "note";
type Modifiche = Record<string, Pick<Squadra, CampoModificabile>>;

export function ImpostazioniAstaClient({ setup }: { setup: SetupDoc }) {
  const [squadre, setSquadre] = useState(setup.squadre);
  const [salvata, setSalvata] = useState(true);
  const [pending, setPending] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // "La tua squadra" cambia con un'azione a sé, separata dal salvataggio
  // batched dei campi di personalizzazione: è una scelta singola, non testo
  // che si accumula prima di premere Salva.
  const [miaSquadraId, setMiaSquadraId] = useState(setup.miaSquadraId);
  const [pendingMiaSquadra, setPendingMiaSquadra] = useState(false);
  const [erroreMiaSquadra, setErroreMiaSquadra] = useState<string | null>(null);
  // Un ref, non lo state `pendingMiaSquadra`: aggiorna sincrono, quindi
  // blocca anche due onValueChange che il Select potesse emettere nello
  // stesso giro prima che React applichi il primo setPendingMiaSquadra —
  // due scritture così ravvicinate su setup.json sono la causa più probabile
  // di un ConflictError che esaurisce i retry di updateDoc.
  const inVoloMiaSquadra = useRef(false);

  async function cambiaMiaSquadra(teamId: string) {
    if (inVoloMiaSquadra.current || teamId === miaSquadraId) return;
    inVoloMiaSquadra.current = true;
    const precedente = miaSquadraId;
    setMiaSquadraId(teamId);
    setErroreMiaSquadra(null);
    setPendingMiaSquadra(true);
    const esito = await impostaMiaSquadra(setup.id, teamId);
    inVoloMiaSquadra.current = false;
    setPendingMiaSquadra(false);
    if (!esito.ok) {
      setMiaSquadraId(precedente);
      setErroreMiaSquadra(esito.error);
    }
  }

  function aggiorna(id: string, campo: CampoModificabile, valore: string) {
    setSquadre((prev) => prev.map((s) => (s.id === id ? { ...s, [campo]: valore } : s)));
    setSalvata(false);
  }

  async function salva() {
    setErrore(null);
    setPending(true);
    const modifiche: Modifiche = Object.fromEntries(
      squadre.map((s) => [s.id, { allenatore: s.allenatore, squadraDelCuore: s.squadraDelCuore, note: s.note }]),
    );
    const esito = await aggiornaSquadre(setup.id, modifiche);
    setPending(false);
    if (esito.ok) setSalvata(true);
    else setErrore(esito.error);
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <AstaSubNav astaId={setup.id} nome={setup.nome} />

      <PageHeader
        title="Impostazioni"
        description="Personalizzazioni per squadra: un promemoria su chi c'è dietro ogni fantasquadra, oltre al nome."
        actions={
          <>
            <Badge variant={salvata ? "secondary" : "outline"}>{salvata ? "salvato" : "modifiche non salvate"}</Badge>
            <Button size="sm" onClick={() => void salva()} disabled={pending || salvata}>
              {pending ? "Salvataggio…" : "Salva"}
            </Button>
          </>
        }
      />
      {errore && <p className="text-sm text-destructive">{errore}</p>}

      <SectionCard title="La tua squadra" description="Determina di chi Strategia e Riepilogo calcolano scostamento e prezzi massimi." icon={Star}>
        <div className="flex flex-col gap-1.5 sm:w-64">
          <Select value={miaSquadraId} onValueChange={(v) => v && void cambiaMiaSquadra(v)}>
            <SelectTrigger size="sm" disabled={pendingMiaSquadra}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {squadre.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {erroreMiaSquadra && <p className="text-sm text-destructive">{erroreMiaSquadra}</p>}
        </div>
      </SectionCard>

      <SectionCard
        title="Squadre"
        description="Allenatore e note sono solo un promemoria. La squadra del cuore no: l'Analisi live la usa per prevedere un possibile sovrapprezzo sui giocatori di quel club."
        icon={Users}
      >
        <div className="flex flex-col gap-4">
          {squadre.map((s) => (
            <div key={s.id} className="flex flex-col gap-3 rounded-xl border border-border/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.nome}</span>
                {s.id === miaSquadraId && <Badge variant="outline">la tua squadra</Badge>}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`allenatore-${s.id}`}>Allenatore</Label>
                  <Input
                    id={`allenatore-${s.id}`}
                    placeholder="es. Marco"
                    value={s.allenatore ?? ""}
                    onChange={(e) => aggiorna(s.id, "allenatore", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`cuore-${s.id}`} className="flex items-center gap-1.5">
                    <Heart className="size-3.5 text-muted-foreground" />
                    Squadra del cuore
                  </Label>
                  <Input
                    id={`cuore-${s.id}`}
                    placeholder="es. Milan"
                    value={s.squadraDelCuore ?? ""}
                    onChange={(e) => aggiorna(s.id, "squadraDelCuore", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`note-${s.id}`}>Note (tendenze, stile d&apos;asta…)</Label>
                <Textarea
                  id={`note-${s.id}`}
                  rows={2}
                  placeholder="es. spende tutto sui primi 5 giocatori, poi sparisce"
                  value={s.note ?? ""}
                  onChange={(e) => aggiorna(s.id, "note", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Zona pericolosa"
        description="Cancella definitivamente questa asta: setup, rose, strategia e ogni altro dato collegato. Non si può annullare."
        icon={ShieldAlert}
      >
        <EliminaAstaButton astaId={setup.id} nomeAsta={setup.nome} variant="destructive" />
      </SectionCard>
    </div>
  );
}
