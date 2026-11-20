import { AlphaBar } from "@/components/alpha-bar";
import { SiteFooter } from "@/components/site-footer";

// App- und Infoseiten: Alpha-Streifen oben, rechtliche Links unten.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AlphaBar />
      {children}
      <SiteFooter />
    </>
  );
}
