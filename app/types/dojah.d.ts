// Ambient types for the Dojah Connect widget, which attaches `Connect` to
// `window` when https://widget.dojah.io/widget.js loads. See src/lib/dojah.ts
// and src/components/DojahVerify.tsx.

interface DojahConnectOptions {
  app_id: string;
  p_key: string;
  /** "custom" pairs with a dashboard-configured widget via config.widget_id. */
  type?: "custom" | "verification" | "identification" | "liveness";
  config?: { widget_id?: string; [key: string]: unknown };
  /** Arbitrary data echoed back on the webhook — we send { user_id }. */
  metadata?: Record<string, unknown>;
  user_data?: Record<string, unknown>;
  onSuccess?: (response: unknown) => void;
  onError?: (error: unknown) => void;
  onClose?: () => void;
}

interface DojahConnectInstance {
  setup: () => void;
  open: () => void;
}

interface DojahConnectConstructor {
  new (options: DojahConnectOptions): DojahConnectInstance;
}

interface Window {
  Connect?: DojahConnectConstructor;
}
