export const REACTIONS = [
  { id: "krass", label: "Krass" },
  { id: "sorge", label: "Macht mir Sorgen" },
  { id: "hype", label: "Übertrieben" },
  { id: "testen", label: "Will ich ausprobieren" },
] as const;
export type ReactionId = (typeof REACTIONS)[number]["id"];
