"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Check,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Lock,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  Sun,
  UserRound,
  XCircle,
} from "lucide-react";

type Status = {
  verified: boolean;
  state: "PENDING" | "PASSED" | "FAILED";
  hasReference: boolean;
  referencePublic: boolean;
  lastError: string;
  attemptsLeft: number;
};
type Dir = "left" | "right";
type Stage = "loading" | "upload" | "ready" | "camera" | "checking" | "passed" | "failed";
type StepKey = "center" | "blink" | "first" | "second";

const TURN_YAW = 0.26; // a bit stricter than the server's 0.22
const CENTER_YAW = 0.12;
const SESSION_MS = 60_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HumanLike = any;
let humanPromise: Promise<HumanLike> | null = null;

function loadHuman(): Promise<HumanLike> {
  if (!humanPromise) {
    humanPromise = (async () => {
      const mod = await import("@vladmandic/human");
      const human = new mod.Human({
        modelBasePath: "/face-models/",
        wasmPath: "/face-models/",
        backend: "webgl",
        debug: false,
        cacheSensitivity: 0,
        filter: { enabled: true, equalization: false, flip: false },
        face: {
          enabled: true,
          detector: { rotation: true, maxDetected: 2, minConfidence: 0.5 },
          mesh: { enabled: true },
          iris: { enabled: true },
          description: { enabled: false },
          emotion: { enabled: false },
          antispoof: { enabled: false },
          liveness: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        segmentation: { enabled: false },
        gesture: { enabled: true },
      });
      await human.load();
      return human;
    })().catch((err) => {
      humanPromise = null;
      throw err;
    });
  }
  return humanPromise;
}

function stepLabel(step: StepKey, order: Dir[]) {
  if (step === "center") return "Look straight at the camera";
  if (step === "blink") return "Blink your eyes";
  const dir = step === "first" ? order[0] : order[1];
  return `Slowly turn your head ${dir}`;
}

export default function FaceVerify({ initial }: { initial: Status }) {
  const [status, setStatus] = useState<Status | null>(initial);
  const [stage, setStage] = useState<Stage>(initial.verified ? "passed" : initial.hasReference ? "ready" : "upload");
  const [file, setFile] = useState<File | null>(null);
  const changeInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">(initial.referencePublic ? "public" : "private");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failMessage, setFailMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/me/face", { cache: "no-store" });
    const data: Status = await res.json();
    setStatus(data);
    return data;
  }, []);

  useEffect(() => {
    // Warm the face models while the member is still choosing a photo.
    if (stage === "upload" || stage === "ready") loadHuman().catch(() => undefined);
  }, [stage]);

  useEffect(() => () => {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  function pick(next: File | null): boolean {
    setError("");
    if (!next) return false;
    if (!/^image\/(jpeg|png|webp)$/.test(next.type)) {
      setError("Use a JPG, PNG or WEBP photo. On iPhone choose Most Compatible, not HEIC.");
      return false;
    }
    if (next.size > 15 * 1024 * 1024) {
      setError("Photos must be 15 MB or smaller.");
      return false;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
    return true;
  }

  async function uploadReference() {
    if (!file) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("visibility", visibility);
    const res = await fetch("/api/me/face/reference", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save your photo. Try again.");
      return;
    }
    setFile(null);
    await load().catch(() => undefined);
    setStage("camera");
  }

  const attemptsLeft = status?.attemptsLeft ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/premium" className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted hover:text-ink" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Verification</p>
          <h1 className="font-display text-2xl font-extrabold leading-tight md:text-3xl">
            Verify your <span className="text-gradient">account</span>
          </h1>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_320px] md:items-start">
        <section className="glass relative overflow-hidden rounded-3xl p-5 md:p-7">
          <Progress stage={stage} />

          <AnimatePresence mode="wait">
            {stage === "loading" && (
              <motion.div key="loading" className="grid min-h-[18rem] place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Loader2 className="h-6 w-6 animate-spin text-muted" />
              </motion.div>
            )}

            {stage === "upload" && (
              <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <h2 className="font-display text-lg font-bold">Upload a clear photo of your face</h2>
                <p className="mt-1 text-sm text-muted">We&apos;ll compare it with a quick live selfie. No ID card or NIN needed.</p>

                <label
                  className={`face-drop mt-5 ${preview ? "has-preview" : ""}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    pick(event.dataTransfer.files?.[0] ?? null);
                  }}
                >
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { pick(event.target.files?.[0] ?? null); event.target.value = ""; }} />
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="Your selected photo" className="face-drop-img" />
                  ) : (
                    <span className="flex flex-col items-center gap-2 text-center">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#df3a6a]/15 text-[#f0648e]">
                        <ImagePlus className="h-6 w-6" />
                      </span>
                      <span className="font-semibold">Choose a photo</span>
                      <span className="text-xs text-muted">JPG, PNG or WEBP · only your face · good light</span>
                    </span>
                  )}
                  {preview && <span className="face-drop-change">Change photo</span>}
                </label>

                <fieldset className="mt-5">
                  <legend className="mb-2 text-[11px] uppercase tracking-wide text-muted">Who can see this photo?</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <VisibilityOption
                      checked={visibility === "public"}
                      onChange={() => setVisibility("public")}
                      icon={<Eye className="h-4 w-4" />}
                      title="Show this photo on my profile"
                      body="It's added to your profile photos."
                    />
                    <VisibilityOption
                      checked={visibility === "private"}
                      onChange={() => setVisibility("private")}
                      icon={<EyeOff className="h-4 w-4" />}
                      title="Use only for verification"
                      body="Kept private. Only used to match your selfie."
                    />
                  </div>
                </fieldset>

                <ErrorNote message={error} />

                <button type="button" className="btn-primary mt-5 w-full" disabled={!file || busy} onClick={() => void uploadReference()}>
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking your photo…</> : <>Continue to live check <Camera className="h-4 w-4" /></>}
                </button>
              </motion.div>
            )}

            {stage === "ready" && status && (
              <motion.div key="ready" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/me/face/photo?v=${status.referencePublic ? 1 : 0}`} alt="Your verification photo" className="h-20 w-20 rounded-2xl object-cover ring-1 ring-white/10" />
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold">Your photo is ready</h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      {status.referencePublic ? <><Eye className="h-3.5 w-3.5" /> Shown on your profile</> : <><Lock className="h-3.5 w-3.5" /> Private, verification only</>}
                    </p>
                  </div>
                </div>
                <input
                  ref={changeInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-label="Choose a new verification photo"
                  onChange={(event) => {
                    const next = event.target.files?.[0] ?? null;
                    event.target.value = "";
                    if (next && pick(next)) setStage("upload");
                  }}
                />
                <button type="button" className="face-change-btn mt-4" onClick={() => changeInput.current?.click()}>
                  <ImagePlus className="h-4 w-4" /> Change photo
                </button>
                {status.lastError ? <ErrorNote message={`Last try: ${status.lastError}`} /> : null}
                <div className="privacy-note mt-5"><Lock className="h-5 w-5 shrink-0" aria-hidden /><p><strong>Private:</strong> your verification video is never posted or shown to anyone. It&apos;s only used to confirm it&apos;s you.</p></div>
                <button type="button" className="btn-primary mt-6 w-full" disabled={attemptsLeft <= 0} onClick={() => setStage("camera")}>
                  <ScanFace className="h-4 w-4" /> Start live check
                </button>
                <p className="mt-2 text-center text-xs text-muted">{attemptsLeft > 0 ? `${attemptsLeft} tries left today` : "No tries left today. Come back in 24 hours."}</p>
              </motion.div>
            )}

            {stage === "camera" && (
              <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="privacy-note mb-3 !mt-0">
                  <Lock className="h-5 w-5 shrink-0" aria-hidden />
                  <p><strong>Private:</strong> this live check is never posted or shown to anyone. It&apos;s only used to confirm it&apos;s you.</p>
                </div>
                <LiveCheck
                  onCancel={() => setStage("ready")}
                  onSubmitting={() => setStage("checking")}
                  onResult={async (passed, message) => {
                    await load().catch(() => undefined);
                    if (passed) setStage("passed");
                    else {
                      setFailMessage(message);
                      setStage("failed");
                    }
                  }}
                />
              </motion.div>
            )}

            {stage === "checking" && (
              <motion.div key="checking" className="grid min-h-[22rem] place-items-center text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div>
                  <span className="face-pulse mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#df3a6a]/15 text-[#f0648e]">
                    <ScanFace className="h-9 w-9" />
                  </span>
                  <h2 className="font-display mt-5 text-lg font-bold">Matching your face…</h2>
                  <p className="mt-1 text-sm text-muted">This takes a few seconds.</p>
                </div>
              </motion.div>
            )}

            {stage === "passed" && (
              <motion.div key="passed" className="py-6 text-center" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16 }}
                  className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-sky-400/15 text-sky-400"
                >
                  <BadgeCheck className="h-10 w-10" />
                </motion.span>
                <h2 className="font-display mt-5 text-2xl font-extrabold">You&apos;re verified</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted">Your live face matched your photo. The blue badge now shows on your profile and every card you appear in.</p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Link href="/profile" className="btn-primary">View my profile</Link>
                  <Link href="/referrals" className="btn-ghost">Welcome reward</Link>
                </div>
              </motion.div>
            )}

            {stage === "failed" && (
              <motion.div key="failed" className="py-6 text-center" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-red-500/10 text-red-400">
                  <XCircle className="h-10 w-10" />
                </span>
                <h2 className="font-display mt-5 text-xl font-extrabold">We couldn&apos;t verify you this time</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-red-300">{failMessage}</p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <button type="button" className="btn-primary" disabled={attemptsLeft <= 0} onClick={() => setStage("camera")}>
                    <RefreshCw className="h-4 w-4" /> Try again
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setStage("upload")}>Use a different photo</button>
                </div>
                <p className="mt-3 text-xs text-muted">{attemptsLeft > 0 ? `${attemptsLeft} tries left today` : "No tries left today. Come back in 24 hours."}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-line bg-card p-5">
            <h3 className="font-display flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-sky-400" /> How it works</h3>
            <ol className="mt-3 space-y-3 text-sm text-muted">
              <li className="flex gap-3"><Num n={1} /> Upload a clear photo of your face.</li>
              <li className="flex gap-3"><Num n={2} /> Do a short live selfie: look ahead, blink and turn your head.</li>
              <li className="flex gap-3"><Num n={3} /> We match your live face to the photo and add your badge.</li>
            </ol>
          </div>
          <div className="rounded-2xl border border-line bg-card p-5">
            <h3 className="font-display text-sm font-bold">Tips for a quick pass</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li className="flex gap-2"><Sun className="h-4 w-4 shrink-0 text-amber-300" /> Face a light or window.</li>
              <li className="flex gap-2"><UserRound className="h-4 w-4 shrink-0 text-[#f0648e]" /> Only you in the frame, no sunglasses or mask.</li>
              <li className="flex gap-2"><Lock className="h-4 w-4 shrink-0 text-emerald-300" /> Your selfie is never shown publicly.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Num({ n }: { n: number }) {
  return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/5 text-xs font-bold text-ink">{n}</span>;
}

function Progress({ stage }: { stage: Stage }) {
  const index = stage === "upload" || stage === "loading" ? 0 : stage === "ready" || stage === "camera" ? 1 : 2;
  const labels = ["Photo", "Live check", "Result"];
  return (
    <ol className="mb-6 flex items-center gap-2">
      {labels.map((label, i) => (
        <li key={label} className="flex flex-1 items-center gap-2">
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${i < index || stage === "passed" ? "bg-[#df3a6a] text-white" : i === index ? "bg-[#df3a6a]/20 text-[#f0648e] ring-1 ring-[#df3a6a]/50" : "bg-white/5 text-muted"}`}>
            {i < index || stage === "passed" ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={`hidden text-xs font-semibold sm:inline ${i === index ? "text-ink" : "text-muted"}`}>{label}</span>
          {i < labels.length - 1 && <span className={`h-px flex-1 ${i < index ? "bg-[#df3a6a]/60" : "bg-white/10"}`} />}
        </li>
      ))}
    </ol>
  );
}

function VisibilityOption({ checked, onChange, icon, title, body }: { checked: boolean; onChange: () => void; icon: React.ReactNode; title: string; body: string }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition ${checked ? "border-[#df3a6a]/70 bg-[#df3a6a]/10" : "border-line bg-white/[0.02] hover:border-white/20"}`}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${checked ? "border-[#df3a6a] bg-[#df3a6a] text-white" : "border-white/25"}`}>
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-semibold">{icon} {title}</span>
        <span className="mt-0.5 block text-xs text-muted">{body}</span>
      </span>
    </label>
  );
}

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="mt-4 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
      {message}
    </motion.p>
  );
}

/* ------------------------------------------------------------------ */
/* Live camera + liveness challenge                                     */
/* ------------------------------------------------------------------ */

function LiveCheck({
  onCancel,
  onSubmitting,
  onResult,
}: {
  onCancel: () => void;
  onSubmitting: () => void;
  onResult: (passed: boolean, message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<"starting" | "running" | "error">("starting");
  const [cameraError, setCameraError] = useState("");
  const [order, setOrder] = useState<Dir[]>(["left", "right"]);
  const [step, setStep] = useState<StepKey>("center");
  const [done, setDone] = useState<StepKey[]>([]);
  const [hint, setHint] = useState("Position your face in the circle");
  const [faceOk, setFaceOk] = useState(false);
  const [remaining, setRemaining] = useState(SESSION_MS / 1000);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let timer = 0;
    const shots: Partial<Record<"center" | "first" | "second", Blob>> = {};
    let current: StepKey = "center";
    let steady = 0;
    let blinked = false;
    let eyesOpenSince = 0;
    let challengeId = "";
    let dirs: Dir[] = ["left", "right"];
    const started = Date.now();

    // Grab the current video frame into a canvas. Detection runs on this exact
    // canvas, so the still we upload is the frame that passed the step.
    const grab = (): HTMLCanvasElement | null => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return null;
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = canvas;
      const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas;
    };
    const snap = (): Promise<Blob | null> =>
      new Promise((resolve) => {
        const canvas = canvasRef.current;
        if (!canvas) return resolve(null);
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
      });

    const advance = (next: StepKey | null) => {
      setDone((prev) => [...prev, current]);
      steady = 0;
      if (next) {
        current = next;
        setStep(next);
      }
    };

    const submit = async () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
      onSubmitting();
      const form = new FormData();
      form.append("challengeId", challengeId);
      form.append("blink", blinked ? "1" : "0");
      form.append("center", shots.center!, "center.jpg");
      form.append("first", shots.first!, "first.jpg");
      form.append("second", shots.second!, "second.jpg");
      const res = await fetch("/api/me/face/verify", { method: "POST", body: form }).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      if (res?.ok && data.passed) onResult(true, "");
      else onResult(false, data.message ?? data.error ?? "Verification failed. Please try again.");
    };

    const loop = async (human: HumanLike) => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        raf = requestAnimationFrame(() => void loop(human));
        return;
      }
      const frame = grab();
      if (!frame) {
        raf = requestAnimationFrame(() => void loop(human));
        return;
      }
      const result = await human.detect(frame);
      if (cancelled) return;
      const faces = (result.face ?? []).filter((f: { score: number }) => f.score > 0.6);
      if (faces.length === 0) {
        setFaceOk(false);
        setHint("We can't see your face. Move into the circle.");
        steady = 0;
      } else if (faces.length > 1) {
        setFaceOk(false);
        setHint("Only one person, please.");
        steady = 0;
      } else {
        const face = faces[0];
        const yaw: number = face.rotation?.angle?.yaw ?? 0;
        const size = Math.max(face.box[2] / frame.width, face.box[3] / frame.height);
        setFaceOk(true);
        if (size < 0.28) {
          setHint("Move a little closer");
          steady = 0;
        } else if (current === "center") {
          if (Math.abs(yaw) < CENTER_YAW) {
            steady += 1;
            setHint("Hold still…");
            if (steady > 8) {
              const blob = await snap();
              if (blob) {
                shots.center = blob;
                advance("blink");
                setHint("Now blink");
                eyesOpenSince = Date.now();
              }
            }
          } else {
            steady = 0;
            setHint("Look straight at the camera");
          }
        } else if (current === "blink") {
          const gestures: string[] = (result.gesture ?? []).map((g: { gesture: string }) => g.gesture);
          const closed = gestures.some((g) => g.startsWith("blink"));
          if (closed && Date.now() - eyesOpenSince > 250) {
            blinked = true;
            advance("first");
            setHint(stepLabel("first", dirs));
          }
        } else {
          const dir = current === "first" ? dirs[0] : dirs[1];
          const ok = dir === "left" ? yaw <= -TURN_YAW : yaw >= TURN_YAW;
          if (ok) {
            steady += 1;
            if (steady > 3) {
              const blob = await snap();
              if (blob) {
                if (current === "first") {
                  shots.first = blob;
                  advance("second");
                  setHint(stepLabel("second", dirs));
                } else {
                  shots.second = blob;
                  advance(null);
                  setHint("Done");
                  void submit();
                  return;
                }
              }
            }
          } else {
            steady = 0;
            setHint(stepLabel(current, dirs));
          }
        }
      }
      raf = requestAnimationFrame(() => void loop(human));
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("unsupported"), { name: "NotSupportedError" });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        const [human, challenge] = await Promise.all([
          loadHuman(),
          fetch("/api/me/face/challenge", { method: "POST" }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw Object.assign(new Error(data.error ?? "Could not start the check."), { name: "ChallengeError" });
            return data as { id: string; order: Dir[] };
          }),
        ]);
        if (cancelled) return;
        challengeId = challenge.id;
        dirs = challenge.order;
        setOrder(challenge.order);
        setPhase("running");
        timer = window.setInterval(() => {
          const left = Math.max(0, Math.ceil((SESSION_MS - (Date.now() - started)) / 1000));
          setRemaining(left);
          if (left <= 0) {
            cancelled = true;
            cancelAnimationFrame(raf);
            window.clearInterval(timer);
            onResult(false, "Time ran out. Follow each prompt as it appears, then try again.");
          }
        }, 500);
        void loop(human);
      } catch (err) {
        const name = (err as Error).name;
        setPhase("error");
        setCameraError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera for this site in your browser settings, then try again."
            : name === "NotFoundError"
            ? "No camera found on this device."
            : name === "NotSupportedError"
            ? "This browser can't open the camera. Try Chrome or Safari."
            : name === "ChallengeError"
            ? (err as Error).message
            : "We couldn't start the camera. Close other apps using it and try again."
        );
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const steps: StepKey[] = ["center", "blink", "first", "second"];
  const progress = done.length / steps.length;

  return (
    <div>
      <div className="face-stage">
        <div className={`face-ring ${faceOk ? "is-ok" : ""}`} style={{ ["--p" as string]: progress }}>
          <video ref={videoRef} playsInline muted className="face-video" />
          {phase === "starting" && (
            <div className="face-overlay">
              <Loader2 className="h-7 w-7 animate-spin" />
              <span className="mt-2 text-sm">Starting camera…</span>
            </div>
          )}
          {phase === "error" && (
            <div className="face-overlay">
              <Camera className="h-7 w-7 text-red-300" />
            </div>
          )}
          {phase === "running" && (step === "first" || step === "second") && (
            <span className={`face-arrow ${(step === "first" ? order[0] : order[1]) === "left" ? "is-left" : "is-right"}`} aria-hidden>
              ›
            </span>
          )}
        </div>
        {phase === "running" && <span className="face-timer">{remaining}s</span>}
      </div>

      {phase === "error" ? (
        <>
          <ErrorNote message={cameraError} />
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn-primary flex-1" onClick={() => { setPhase("starting"); setCameraError(""); setDone([]); setStep("center"); setAttempt((a) => a + 1); }}>
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
            <button type="button" className="btn-ghost flex-1" onClick={onCancel}>Back</button>
          </div>
        </>
      ) : (
        <>
          <p className="font-display mt-5 text-center text-lg font-bold" aria-live="polite">{hint}</p>
          <ul className="mx-auto mt-4 grid max-w-md grid-cols-2 gap-2 sm:grid-cols-4">
            {steps.map((key) => {
              const isDone = done.includes(key);
              const isNow = key === step && !isDone;
              return (
                <li key={key} className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs ${isDone ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : isNow ? "border-[#df3a6a]/60 bg-[#df3a6a]/10 text-ink" : "border-line text-muted"}`}>
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${isDone ? "bg-emerald-400 text-black" : isNow ? "bg-[#df3a6a]" : "bg-white/10"}`}>
                    {isDone ? <Check className="h-3 w-3" /> : null}
                  </span>
                  {key === "center" ? "Look ahead" : key === "blink" ? "Blink" : `Turn ${key === "first" ? order[0] : order[1]}`}
                </li>
              );
            })}
          </ul>
          <button type="button" className="mx-auto mt-4 block text-xs font-semibold text-muted hover:text-ink" onClick={onCancel}>
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
