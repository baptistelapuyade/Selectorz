import { AlphaBar } from "@/components/alpha-bar";

// Profil-Bau: eigener Kopf mit Schrittleiste, Feedback bleibt über den Alpha-Streifen erreichbar.
export default function BuildLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AlphaBar />
      {children}
    </>
  );
}
