import { requireSession } from "@/lib/auth";
import { getBoard, updateBoard } from "@/lib/blob/repository";
import { BoardEventSchema } from "@/lib/blob/schemas";

export async function GET(_request: Request, context: RouteContext<"/api/aste/[id]/board">) {
  if (!(await requireSession())) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }
  const { id } = await context.params;
  const board = await getBoard(id);
  return Response.json(board?.data ?? { astaId: id, events: [] });
}

export async function POST(request: Request, context: RouteContext<"/api/aste/[id]/board">) {
  if (!(await requireSession())) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }
  const { id } = await context.params;

  const body = await request.json();
  const parsed = BoardEventSchema.array().safeParse(body.events);
  if (!parsed.success) {
    return Response.json({ error: "events non valido" }, { status: 400 });
  }

  // updateDoc rilegge lo stato più fresco a ogni retry: unire per id converge
  // sempre all'unione dei due log, anche se un'altra scheda ha scritto nel
  // frattempo (vedi § Scritture condizionali nel piano).
  const board = await updateBoard(id, (current) => {
    const esistenti = new Set(current.events.map((e) => e.id));
    const nuovi = parsed.data.filter((e) => !esistenti.has(e.id));
    return { astaId: id, events: [...current.events, ...nuovi] };
  });

  return Response.json(board);
}
