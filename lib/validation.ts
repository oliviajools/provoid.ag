import { z } from "zod";

export const normalizeCode = (s: string) => s.toUpperCase().replace(/\s+/g, "").trim();

export const pseudonymSchema = z
  .string()
  .trim()
  .min(3, "Dein Pseudonym braucht mindestens 3 Zeichen.")
  .max(20, "Dein Pseudonym darf höchstens 20 Zeichen haben.")
  .regex(/^[A-Za-z0-9ÄÖÜäöüß_.]+$/, "Erlaubt sind Buchstaben, Zahlen, Punkt und Unterstrich.");

export const passwordSchema = z
  .string()
  .min(8, "Das Passwort braucht mindestens 8 Zeichen.")
  .max(128, "Das Passwort ist zu lang.");

export type FormState = { error?: string; ok?: string; fields?: Record<string, string> } | undefined;
