import Link from "next/link";

// „No page here“ (Board ErrProfile): gleich für nie vergebene und zurückgezogene Adressen.
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col justify-between gap-10 bg-night-bg px-4 py-6 text-night-t1 md:px-20 md:py-10">
      <Link href="/" className="text-[18px] font-extrabold tracking-tight">Selectorz</Link>
      <div className="flex max-w-xl flex-col gap-5">
        <span className="label-mono text-night-t2">404 · Empty crate</span>
        <h1 className="text-[56px] font-extrabold leading-[0.86] tracking-[-0.06em] md:text-[100px]">No page<br />here.</h1>
        <p className="text-[16px] leading-[1.45] text-night-t2">Maybe the link has a typo, or the DJ took their page down.</p>
        <Link href="/" className="flex h-[58px] max-w-[360px] items-center justify-between rounded-full bg-night-t1 px-6 text-[16px] font-semibold text-ink">
          Make your own page <span aria-hidden>→</span>
        </Link>
      </div>
      <span />
    </main>
  );
}
