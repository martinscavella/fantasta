import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "fantasta_session";

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET mancante o troppo corto (minimo 32 caratteri) — impostalo in .env.local",
    );
  }
  return new TextEncoder().encode(secret);
}

export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    throw new Error("APP_PASSWORD mancante — impostalo in .env.local");
  }
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  // Lunghezze diverse: niente confronto a tempo costante possibile, ma non c'è
  // nulla da proteggere in quel bit (la lunghezza non è il segreto).
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

/**
 * Ri-verifica la sessione dentro una Route Handler o Server Function.
 * Il proxy fa solo un controllo ottimistico (vedi src/proxy.ts) — la doc
 * Vercel sconsiglia di affidargli da solo la protezione di contenuti privati.
 */
export async function requireSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}
