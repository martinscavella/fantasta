"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <div className="flex min-h-svh items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <form
        action={formAction}
        className="flex w-full max-w-xs flex-col gap-3 rounded-xl border border-border bg-background p-6"
      >
        <h1 className="text-lg font-semibold">Fantasta</h1>
        <Input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          required
        />
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Accesso…" : "Accedi"}
        </Button>
      </form>
    </div>
  );
}
