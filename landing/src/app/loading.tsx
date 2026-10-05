export default function Loading() {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="app-loading-mark" />
      <p className="app-loading-brand">
        Flirta<span>247</span>
      </p>
      <div className="app-loading-ring" aria-hidden />
      <span className="app-loading-label">Loading Flirta247</span>
    </div>
  );
}
