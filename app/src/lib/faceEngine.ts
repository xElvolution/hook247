import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Server-side face engine (no third-party KYC). Runs @vladmandic/human on the
 * TensorFlow WASM backend inside the Next server process, so it needs no native
 * build and no API keys. Everything the badge depends on is decided here, never
 * in the browser: one face per frame, head-turn angles, anti-spoof scores and
 * the embedding match against the member's reference photo.
 */

type Face = {
  score: number;
  real?: number;
  live?: number;
  embedding?: number[];
  box: [number, number, number, number];
  rotation?: { angle: { yaw: number; pitch: number; roll: number } } | null;
};

export type FaceRead = {
  count: number;
  score: number;
  yaw: number;
  pitch: number;
  real: number;
  live: number;
  sizeRatio: number;
  embedding: number[] | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HumanLike = any;

let enginePromise: Promise<HumanLike> | null = null;

function root(...parts: string[]) {
  return path.join(process.cwd(), "node_modules", ...parts);
}

function patchFileFetch() {
  // tfjs-wasm loads model JSON/weights through fetch(); Node's fetch has no
  // file:// support, so serve those URLs from disk.
  const g = globalThis as typeof globalThis & { __faceFetchPatched?: boolean };
  if (g.__faceFetchPatched) return;
  const original = g.fetch.bind(g);
  g.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (href.startsWith("file://")) {
      const body = await readFile(new URL(href));
      return new Response(body, { status: 200 });
    }
    return original(input, init);
  }) as typeof fetch;
  g.__faceFetchPatched = true;
}

async function engine(): Promise<HumanLike> {
  if (!enginePromise) {
    enginePromise = (async () => {
      patchFileFetch();
      const nodeRequire = createRequire(path.join(process.cwd(), "package.json"));
      const lib = nodeRequire(root("@vladmandic", "human", "dist", "human.node-wasm.js"));
      const human = new lib.Human({
        backend: "wasm",
        wasmPath: `file://${root("@tensorflow", "tfjs-backend-wasm", "dist")}/`,
        modelBasePath: `file://${root("@vladmandic", "human", "models")}/`,
        debug: false,
        cacheSensitivity: 0,
        face: {
          enabled: true,
          detector: { rotation: true, maxDetected: 3, minConfidence: 0.5 },
          mesh: { enabled: true },
          iris: { enabled: false },
          description: { enabled: true },
          emotion: { enabled: false },
          antispoof: { enabled: true },
          liveness: { enabled: true },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: false },
        segmentation: { enabled: false },
      });
      await human.load();
      await human.warmup().catch(() => undefined);
      return human;
    })().catch((err) => {
      enginePromise = null;
      throw err;
    });
  }
  return enginePromise;
}

/** Decode any JPG/PNG/WEBP, auto-rotate from EXIF, cap size, and read faces. */
export async function readFace(bytes: Buffer): Promise<FaceRead> {
  const human = await engine();
  const nodeRequire = createRequire(path.join(process.cwd(), "package.json"));
  const sharp = nodeRequire("sharp");
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const tensor = human.tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], "int32");
  try {
    const result = await human.detect(tensor);
    const faces = (result.face as Face[]).filter((f) => f.score >= 0.5);
    faces.sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3]);
    const f = faces[0];
    if (!f) return { count: 0, score: 0, yaw: 0, pitch: 0, real: 0, live: 0, sizeRatio: 0, embedding: null };
    return {
      count: faces.length,
      score: f.score,
      yaw: f.rotation?.angle.yaw ?? 0,
      pitch: f.rotation?.angle.pitch ?? 0,
      real: f.real ?? 0,
      live: f.live ?? 0,
      sizeRatio: Math.max(f.box[2] / info.width, f.box[3] / info.height),
      embedding: f.embedding && f.embedding.length ? Array.from(f.embedding) : null,
    };
  } finally {
    tensor.dispose();
  }
}

export async function similarity(a: number[], b: number[]): Promise<number> {
  const human = await engine();
  return human.match.similarity(a, b) as number;
}
