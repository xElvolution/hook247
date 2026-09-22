export default function LoadingScreen({
  label = "Loading",
  fill = true,
}: {
  label?: string;
  fill?: boolean;
}) {
  return (
    <div className={fill ? "app-loading" : "app-loading app-loading-inline"} role="status" aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="app-loading-mark" />
      <p className="app-loading-brand">
        Hooks<span>247</span>
      </p>
      <div className="app-loading-ring" aria-hidden />
      <span className="app-loading-label">{label}</span>
    </div>
  );
}
