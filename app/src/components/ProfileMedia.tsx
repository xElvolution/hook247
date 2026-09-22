"use client";

import { useState } from "react";
import { ImagePlus, Video } from "lucide-react";

async function uploadFile(file: File) {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/uploads", { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Upload failed");
  return data as { url: string; kind: "image" | "video" };
}

function isVideo(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

export default function ProfileMedia({
  avatarUrl,
  photos,
  clips,
}: {
  avatarUrl: string;
  photos: string[];
  clips: string[];
}) {
  const [avatar, setAvatar] = useState(avatarUrl);
  const [gallery, setGallery] = useState(photos);
  const [videos, setVideos] = useState(clips);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function persist(next: { avatarUrl?: string; photos?: string[]; clips?: string[] }) {
    const response = await fetch("/api/me/media", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "Could not save media");
  }

  async function onAvatar(file: File) {
    setBusy(true);
    setError("");
    try {
      const uploaded = await uploadFile(file);
      if (uploaded.kind !== "image") throw new Error("Use a photo for your profile picture.");
      await persist({ avatarUrl: uploaded.url });
      setAvatar(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(file: File) {
    if (gallery.length >= 12) return;
    setBusy(true);
    setError("");
    try {
      const uploaded = await uploadFile(file);
      if (uploaded.kind !== "image") throw new Error("Photos must be images.");
      const next = [...gallery, uploaded.url];
      await persist({ photos: next });
      setGallery(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function addClip(file: File) {
    if (videos.length >= 6) return;
    setBusy(true);
    setError("");
    try {
      const uploaded = await uploadFile(file);
      if (uploaded.kind !== "video") throw new Error("Clips must be short videos (mp4/webm).");
      const next = [...videos, uploaded.url];
      await persist({ clips: next });
      setVideos(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(url: string) {
    setBusy(true);
    setError("");
    try {
      const next = gallery.filter((item) => item !== url);
      await persist({ photos: next });
      setGallery(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setBusy(false);
    }
  }

  async function removeClip(url: string) {
    setBusy(true);
    setError("");
    try {
      const next = videos.filter((item) => item !== url);
      await persist({ clips: next });
      setVideos(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove clip");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="profile-detail-section mt-5">
      <p className="section-kicker">Media</p>
      <h2 className="font-display mt-1.5 text-2xl font-bold">Photos and clips</h2>
      <p className="mt-2 text-sm text-muted">
        Add a real profile picture, extra photos, and short clips of what you offer.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-[180px_1fr]">
        <label className="relative block aspect-[3/4] cursor-pointer overflow-hidden rounded-2xl border border-line bg-black/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatar} alt="Profile" className="h-full w-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-center text-xs">
            Change picture
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onAvatar(file);
              event.target.value = "";
            }}
          />
        </label>

        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span>Photos</span>
              <label className="btn-ghost !px-3 !py-1.5 text-xs">
                <ImagePlus className="h-3.5 w-3.5" /> Add photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={busy || gallery.length >= 12}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void addPhoto(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {gallery.map((url) => (
                <div key={url} className="min-w-0">
                  <div className="aspect-square overflow-hidden rounded-xl bg-black/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </div>
                  <button
                    type="button"
                    className="mt-1 w-full rounded-lg border border-line py-1.5 text-[11px] font-semibold text-red-300"
                    onClick={() => void removePhoto(url)}
                    disabled={busy}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span>Short clips</span>
              <label className="btn-ghost !px-3 !py-1.5 text-xs">
                <Video className="h-3.5 w-3.5" /> Add clip
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  disabled={busy || videos.length >= 6}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void addClip(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {videos.map((url) => (
                <div key={url} className="min-w-0">
                  <div className="overflow-hidden rounded-xl bg-black/30">
                    <video src={url} className="aspect-video w-full object-cover" muted playsInline />
                  </div>
                  <button
                    type="button"
                    className="mt-1 w-full rounded-lg border border-line py-1.5 text-[11px] font-semibold text-red-300"
                    onClick={() => void removeClip(url)}
                    disabled={busy}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {busy && <p className="mt-2 text-xs text-muted">Uploading…</p>}
    </section>
  );
}
