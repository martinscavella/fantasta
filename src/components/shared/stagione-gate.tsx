"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALTRA = "__altra__";

// Gate d'ingresso condiviso dalle pagine legate a una stagione (Listone,
// Importa listone, Statistiche, Dossier). Prima ognuna chiedeva di
// digitare la stagione a mano, alla cieca — causa diretta della lamentela
// "non si capisce come si usa": qui si sceglie tra le stagioni già in uso
// in almeno un'asta (da getAsteIndex), col testo libero solo come opzione
// esplicita "Altra stagione…", o come unico campo se non ne esiste ancora
// nessuna (primo avvio).
export function StagioneGate({
  stagioni,
  title,
  description,
}: {
  stagioni: string[];
  title: string;
  description?: string;
}) {
  const [scelta, setScelta] = useState<string>(stagioni[0] ?? ALTRA);
  const testoLibero = stagioni.length === 0 || scelta === ALTRA;

  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="mb-1 text-xl font-semibold">{title}</h1>
      {description && <p className="mb-5 text-sm text-muted-foreground">{description}</p>}
      <form className="flex flex-col gap-3">
        <Label htmlFor="stagione">Stagione</Label>

        {stagioni.length > 0 && (
          <>
            {!testoLibero && <input type="hidden" name="stagione" value={scelta} />}
            <Select value={scelta} onValueChange={(v) => setScelta(v ?? ALTRA)}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stagioni.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
                <SelectItem value={ALTRA}>Altra stagione…</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}

        {testoLibero && (
          <Input id="stagione" name="stagione" placeholder="es. 2026-27" autoFocus={stagioni.length > 0} required />
        )}

        <Button type="submit">Apri</Button>
      </form>
    </div>
  );
}
