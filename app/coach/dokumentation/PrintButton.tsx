"use client";

export function PrintButton() {
  return <button type="button" className="btn" onClick={() => window.print()}>Drucken oder als PDF sichern</button>;
}
