// Platzhalter bis zur Einstiegsseite. Zeigt, dass Tokens und Schriften greifen.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col justify-between bg-night-bg px-4 py-6 text-night-t1 md:px-20 md:py-10">
      <span className="text-[15px] font-extrabold tracking-tight">Selectorz</span>
      <div className="flex flex-col gap-5">
        <span className="label-mono text-night-t2">Coming soon · selectorz.art</span>
        <h1 className="text-[46px] font-extrabold leading-[0.86] tracking-[-0.06em] md:text-[100px]">
          Show how
          <br />
          you play.
        </h1>
        <p className="max-w-md text-[15px] leading-[1.45] text-night-t2 md:text-[18px]">
          A DJ page that plays. Two DJs, six tracks, back and forth.
        </p>
      </div>
      <span className="label-mono text-night-t3">Selection over technique</span>
    </main>
  );
}
