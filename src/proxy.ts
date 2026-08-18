import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

// Next.js 16: proxy.ts sostituisce middleware.ts, runtime nodejs di default.
// Controllo ottimistico (solo firma/scadenza del cookie): le Server Function
// e le Route Handler che toccano Blob ri-verificano da sole (requireSession).
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = await verifySessionToken(token);

  if (!valid) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // api/cron/* ha un'autenticazione propria (CRON_SECRET, vedi
    // api/cron/stats/route.ts): le chiamate di Vercel Cron non hanno un
    // cookie di sessione, quindi il proxy le rediretterebbe sempre a /login.
    "/((?!login|api/cron|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
