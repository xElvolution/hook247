"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

/**
 * One socket per tab, shared by every component. Returns null when realtime
 * is unavailable (signed out, demo account) so callers fall back to polling.
 */
let socketPromise: Promise<Socket | null> | null = null;
let current: Socket | null = null;
const statusListeners = new Set<(connected: boolean) => void>();

async function fetchToken(): Promise<{ token: string; url: string } | null> {
  try {
    const res = await fetch("/api/realtime/token", { method: "POST", cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function getRealtime(): Promise<Socket | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!socketPromise) {
    socketPromise = (async () => {
      const first = await fetchToken();
      if (!first) {
        socketPromise = null;
        return null;
      }
      const socket = io(first.url || undefined, {
        path: "/socket.io",
        transports: ["websocket", "polling"],
        auth: (cb) => {
          // Fresh token on every (re)connect; the first one is reused once.
          if (first.token) {
            const token = first.token;
            first.token = "";
            cb({ token });
            return;
          }
          fetchToken().then((t) => cb({ token: t?.token ?? "" }));
        },
      });
      socket.on("connect", () => statusListeners.forEach((l) => l(true)));
      socket.on("disconnect", () => statusListeners.forEach((l) => l(false)));
      current = socket;
      return socket;
    })();
  }
  return socketPromise;
}

export function realtimeConnected() {
  return Boolean(current?.connected);
}

/** Subscribe to a realtime event for the lifetime of a component. */
export function useRealtimeEvent<T>(event: string, handler: (payload: T) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    let socket: Socket | null = null;
    let cancelled = false;
    const listener = (payload: T) => ref.current(payload);
    getRealtime().then((s) => {
      if (cancelled || !s) return;
      socket = s;
      s.on(event, listener);
    });
    return () => {
      cancelled = true;
      socket?.off(event, listener);
    };
  }, [event]);
}

/** Whether the socket is connected right now (drives polling fallbacks). */
export function useRealtimeStatus() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let alive = true;
    const listener = (c: boolean) => alive && setConnected(c);
    statusListeners.add(listener);
    getRealtime().then((s) => alive && setConnected(Boolean(s?.connected)));
    return () => {
      alive = false;
      statusListeners.delete(listener);
    };
  }, []);
  return connected;
}

/** Run a callback every time the socket (re)connects, e.g. to rejoin rooms. */
export function useOnRealtimeConnect(handler: (socket: Socket) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    let socket: Socket | null = null;
    let cancelled = false;
    const onConnect = () => socket && ref.current(socket);
    getRealtime().then((s) => {
      if (cancelled || !s) return;
      socket = s;
      s.on("connect", onConnect);
      if (s.connected) onConnect();
    });
    return () => {
      cancelled = true;
      socket?.off("connect", onConnect);
    };
  }, []);
}
