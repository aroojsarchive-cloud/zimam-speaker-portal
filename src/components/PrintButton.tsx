"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="h-11 rounded-xl bg-brand-strong px-5 font-semibold text-white">
      Print / Save as PDF
    </button>
  );
}
