"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pending: pendingLabel, className = "btn block" }:
  { children: React.ReactNode; pending?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending}>
      {pending ? pendingLabel ?? "Einen Moment" : children}
    </button>
  );
}
