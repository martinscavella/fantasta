"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { eliminaAsta } from "@/lib/actions/aste";

// Bottone di cancellazione riusato da /asta (elenco) e da /asta/[id]/impostazioni
// (danger zone): azione distruttiva e irreversibile — cancella setup, strategy,
// board, debrief e analisi-live da Blob (vedi eliminaAsta in actions/aste.ts) —
// quindi passa sempre da una conferma esplicita, mai da un solo click.
export function EliminaAstaButton({
  astaId,
  nomeAsta,
  variant = "outline",
  size = "sm",
}: {
  astaId: string;
  nomeAsta: string;
  variant?: "outline" | "destructive" | "ghost";
  size?: "sm" | "default" | "icon-sm";
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [pending, setPending] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function conferma() {
    setPending(true);
    setErrore(null);
    const esito = await eliminaAsta(astaId);
    setPending(false);
    if (!esito.ok) {
      setErrore(esito.error);
      return;
    }
    setAperto(false);
    // Copre sia il caso "elimino dall'elenco aste" (serve un refresh dei dati)
    // sia "elimino dalle impostazioni dell'asta stessa" (serve anche navigare via).
    router.push("/asta");
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => {
          setErrore(null);
          setAperto(true);
        }}
      >
        <Trash2 className="size-3.5 text-destructive" />
        {size !== "icon-sm" && "Elimina"}
      </Button>

      <Dialog open={aperto} onOpenChange={setAperto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminare &laquo;{nomeAsta}&raquo;?</DialogTitle>
            <DialogDescription>
              Cancella definitivamente setup, rose, strategia e ogni altro dato di questa asta. Non si può
              annullare.
            </DialogDescription>
          </DialogHeader>
          {errore && <p className="text-sm text-destructive">{errore}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAperto(false)} disabled={pending}>
              Annulla
            </Button>
            <Button type="button" variant="destructive" onClick={() => void conferma()} disabled={pending}>
              {pending ? "Eliminazione…" : "Elimina definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
