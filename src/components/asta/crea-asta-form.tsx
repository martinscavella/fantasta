"use client";

import { useActionState, useState } from "react";
import { creaAsta } from "@/lib/actions/aste";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CreaAstaForm() {
  const [state, formAction, pending] = useActionState(creaAsta, undefined);
  const [sforoTipo, setSforoTipo] = useState<"nessuno" | "a-pagamento">("nessuno");
  const [squadreTesto, setSquadreTesto] = useState("");
  const [miaSquadraIndex, setMiaSquadraIndex] = useState("0");

  const righeSquadre = squadreTesto
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const indiceValido = Number(miaSquadraIndex) < righeSquadre.length ? miaSquadraIndex : "0";

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nome">Nome asta</Label>
          <Input id="nome" name="nome" placeholder="es. Lega degli amici" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stagione">Stagione</Label>
          <Input id="stagione" name="stagione" placeholder="es. 2026-27" required />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="creditiBase">Crediti per squadra</Label>
        <Input id="creditiBase" name="creditiBase" type="number" min={1} defaultValue={500} required />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slotP">P</Label>
          <Input id="slotP" name="slotP" type="number" min={1} defaultValue={3} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slotD">D</Label>
          <Input id="slotD" name="slotD" type="number" min={1} defaultValue={8} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slotC">C</Label>
          <Input id="slotC" name="slotC" type="number" min={1} defaultValue={8} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slotA">A</Label>
          <Input id="slotA" name="slotA" type="number" min={1} defaultValue={6} required />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Modalità sforo</Label>
        <input type="hidden" name="sforoTipo" value={sforoTipo} />
        <Select value={sforoTipo} onValueChange={(v) => setSforoTipo((v as typeof sforoTipo) ?? "nessuno")}>
          <SelectTrigger size="sm" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nessuno">Nessuno (budget chiuso)</SelectItem>
            <SelectItem value="a-pagamento">A sforo (crediti extra a pagamento)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sforoTipo === "a-pagamento" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="euroPerCredito">€ per credito extra</Label>
          <Input
            id="euroPerCredito"
            name="euroPerCredito"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0.1}
            required
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="squadre">Squadre (una per riga, almeno due)</Label>
        <Textarea
          id="squadre"
          name="squadre"
          rows={6}
          placeholder={"Squadra 1\nSquadra 2\nSquadra 3"}
          value={squadreTesto}
          onChange={(e) => setSquadreTesto(e.target.value)}
          required
        />
      </div>

      {righeSquadre.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="miaSquadraIndex">La tua squadra</Label>
          {/* Se righeSquadre si accorcia dopo la selezione, l'indice scelto potrebbe
              non esistere più: si ricade sulla prima riga invece di uno stato invalido. */}
          <input type="hidden" name="miaSquadraIndex" value={indiceValido} />
          <Select value={indiceValido} onValueChange={(v) => setMiaSquadraIndex(v ?? "0")}>
            <SelectTrigger size="sm" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {righeSquadre.map((nome, i) => (
                <SelectItem key={i} value={String(i)}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creazione…" : "Crea asta"}
      </Button>
    </form>
  );
}
