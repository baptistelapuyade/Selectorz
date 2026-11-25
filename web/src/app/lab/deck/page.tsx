import type { Metadata } from "next";
import { DeckLab } from "@/components/lab/deck-lab";

// Testseite für den sichtbaren Player (Board „Kopf v5d“). Nicht verlinkt, nicht indexiert.
export const metadata: Metadata = {
  title: "Deck lab · Selectorz",
  robots: { index: false, follow: false },
};

export default function DeckLabPage() {
  return <DeckLab />;
}
