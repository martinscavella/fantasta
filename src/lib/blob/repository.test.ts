import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlobPreconditionFailedError } from "@vercel/blob";
import { z } from "zod";
import { ConflictError, deleteAstaBlobs, readDoc, updateDoc, writeDoc } from "@/lib/blob/repository";

const { get, put, del } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@vercel/blob", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vercel/blob")>();
  return { ...actual, get, put, del };
});

const DocSchema = z.object({ count: z.number() });

function streamOf(data: unknown) {
  return new Response(JSON.stringify(data)).body!;
}

beforeEach(() => {
  get.mockReset();
  put.mockReset();
  del.mockReset();
});

describe("readDoc", () => {
  it("ritorna null quando il blob non esiste", async () => {
    get.mockResolvedValue(null);
    await expect(readDoc("x.json", DocSchema)).resolves.toBeNull();
  });

  it("legge con useCache:false e valida col schema", async () => {
    get.mockResolvedValue({ stream: streamOf({ count: 3 }), blob: { etag: "abc" } });
    const result = await readDoc("x.json", DocSchema);
    expect(result).toEqual({ data: { count: 3 }, etag: "abc" });
    expect(get).toHaveBeenCalledWith("x.json", { access: "private", useCache: false });
  });

  it("normalizza un ETag weak (prefisso W/) alla forma strong", async () => {
    // get() può restituire un ETag "weak" anche su una lettura fresca (capita
    // quando la risposta passa dal layer di compressione edge di Vercel), ma
    // il backend confronta ifMatch sulla forma strong: senza questa
    // normalizzazione ogni scrittura condizionale fallisce sempre, anche a
    // documento appena letto e invariato (visto in produzione).
    get.mockResolvedValue({ stream: streamOf({ count: 3 }), blob: { etag: 'W/"abc"' } });
    const result = await readDoc("x.json", DocSchema);
    expect(result?.etag).toBe('"abc"');
  });

  it("propaga l'errore di validazione zod su un documento corrotto", async () => {
    get.mockResolvedValue({ stream: streamOf({ count: "non un numero" }), blob: { etag: "abc" } });
    await expect(readDoc("x.json", DocSchema)).rejects.toThrow();
  });
});

describe("writeDoc", () => {
  it("scrive con allowOverwrite e passa ifMatch", async () => {
    put.mockResolvedValue({ etag: "new-etag" });
    const result = await writeDoc("x.json", DocSchema, { count: 1 }, { ifMatch: "old-etag" });
    expect(result).toEqual({ etag: "new-etag" });
    expect(put).toHaveBeenCalledWith(
      "x.json",
      JSON.stringify({ count: 1 }),
      expect.objectContaining({ access: "private", allowOverwrite: true, ifMatch: "old-etag" }),
    );
  });

  it("traduce BlobPreconditionFailedError in ConflictError", async () => {
    put.mockRejectedValue(new BlobPreconditionFailedError());
    await expect(writeDoc("x.json", DocSchema, { count: 1 })).rejects.toThrow(ConflictError);
  });

  it("rifiuta un documento che non passa lo schema prima ancora di chiamare put", async () => {
    // @ts-expect-error - dato volutamente invalido per il test
    await expect(writeDoc("x.json", DocSchema, { count: "no" })).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });
});

describe("updateDoc", () => {
  it("usa il fallback quando il documento non esiste ancora", async () => {
    get.mockResolvedValue(null);
    put.mockResolvedValue({ etag: "e1" });
    const result = await updateDoc("x.json", DocSchema, { count: 0 }, (c) => ({ count: c.count + 1 }));
    expect(result).toEqual({ count: 1 });
  });

  it("rilegge e riprova in caso di conflitto (412), convergendo sull'ultimo stato", async () => {
    get
      .mockResolvedValueOnce({ stream: streamOf({ count: 1 }), blob: { etag: "e1" } })
      .mockResolvedValueOnce({ stream: streamOf({ count: 5 }), blob: { etag: "e2" } }); // scritto da un'altra scheda nel frattempo
    put
      .mockRejectedValueOnce(new BlobPreconditionFailedError())
      .mockResolvedValueOnce({ etag: "e3" });

    const result = await updateDoc("x.json", DocSchema, { count: 0 }, (c) => ({ count: c.count + 1 }));

    expect(result).toEqual({ count: 6 }); // riparte da 5 (non da 1), non perde la scrittura concorrente
    expect(put).toHaveBeenCalledTimes(2);
  });

  it("rilancia il conflitto oltre il numero massimo di retry", async () => {
    // mockImplementation (non mockResolvedValue): ogni retry rilegge, e uno
    // ReadableStream già consumato non è rileggibile — serve un body fresco a ogni chiamata.
    get.mockImplementation(() =>
      Promise.resolve({ stream: streamOf({ count: 1 }), blob: { etag: "e1" } }),
    );
    put.mockRejectedValue(new BlobPreconditionFailedError());

    await expect(
      updateDoc("x.json", DocSchema, { count: 0 }, (c) => ({ count: c.count + 1 }), { maxRetries: 2 }),
    ).rejects.toThrow(ConflictError);
    expect(put).toHaveBeenCalledTimes(3); // 1 tentativo iniziale + 2 retry
  });
});

describe("deleteAstaBlobs", () => {
  it("cancella tutti i documenti dell'asta in un'unica chiamata a del", async () => {
    del.mockResolvedValue(undefined);
    await deleteAstaBlobs("asta-1");
    expect(del).toHaveBeenCalledWith([
      "aste/asta-1/setup.json",
      "aste/asta-1/strategy.json",
      "aste/asta-1/board.json",
      "aste/asta-1/debrief.json",
      "aste/asta-1/analisi-live.json",
    ]);
  });
});
