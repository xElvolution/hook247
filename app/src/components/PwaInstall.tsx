"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIos() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

const DISMISS_KEY = "hooks247-install-dismissed";

export function usePwaInstall() {
  const [installed, setInstalled] = useState(true);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setPromptEvent(null);
        setInstalled(true);
      }
      return;
    }
    if (isIos()) setIosHelp(true);
  }

  return {
    canOffer: !installed,
    install,
    iosHelp,
    closeIosHelp: () => setIosHelp(false),
  };
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}

export function PwaBanner({
  canOffer,
  onInstall,
}: {
  canOffer: boolean;
  onInstall: () => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!canOffer) return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    const timer = window.setTimeout(() => setShow(true), 2500);
    return () => window.clearTimeout(timer);
  }, [canOffer]);

  if (!show || !canOffer) return null;

  return (
    <div className="pwa-banner" role="dialog" aria-label="Install Hooks247">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" />
      <div>
        <strong>Install Hooks247</strong>
        <span>Add it to your home screen and open it like an app.</span>
      </div>
      <button type="button" className="btn-primary !px-3 !py-1.5 text-xs" onClick={onInstall}>
        Install
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Dismiss"
        onClick={() => {
          window.localStorage.setItem(DISMISS_KEY, "1");
          setShow(false);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function IosInstallHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="pwa-ios-backdrop" onClick={onClose}>
      <section className="pwa-ios-sheet" onClick={(event) => event.stopPropagation()}>
        <h2 className="font-display text-lg font-bold">Install on iPhone</h2>
        <p className="mt-2 text-sm text-muted">
          Safari does not show the usual install popup. Tap the share icon, then <strong>Add to Home Screen</strong>.
        </p>
        <p className="mt-3 flex items-center gap-2 text-sm">
          <Share className="h-4 w-4 text-[#ef789a]" /> Share → Add to Home Screen
        </p>
        <button type="button" className="btn-primary mt-5 w-full text-sm" onClick={onClose}>
          Got it
        </button>
      </section>
    </div>
  );
}

export function InstallAppButton({
  canOffer,
  onInstall,
  className,
}: {
  canOffer: boolean;
  onInstall: () => void;
  className?: string;
}) {
  if (!canOffer) return null;
  return (
    <button type="button" className={className} onClick={onInstall}>
      <Download className="h-4 w-4" />
      Install app
    </button>
  );
}
