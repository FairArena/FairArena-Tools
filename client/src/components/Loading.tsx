import React from "react";

export const Spinner: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => {
  return (
    <svg
      className={`${className} animate-spin text-white/90`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-20" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
};

export const PageLoader: React.FC<{ message?: string }> = ({ message }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 p-6 bg-slate-900/80 rounded-lg border border-slate-700/60">
        <Spinner className="w-12 h-12" />
        <div className="text-sm text-slate-300">{message ?? "Loading…"}</div>
      </div>
    </div>
  );
};

export default PageLoader;
