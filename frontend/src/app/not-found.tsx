import Link from "next/link";

export default function NotFound() {
  return (
    <main className="pt-[200px] px-container-padding-mobile md:px-container-padding-desktop max-w-[640px] mx-auto text-center">
      <div className="glass-panel bg-surface/70 rounded-xl p-12">
        <span className="material-symbols-outlined text-[64px] text-primary mb-4 block">
          search_off
        </span>
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          Page not found
        </h1>
        <p className="font-body-md text-on-surface-variant mb-6">
          The story you&apos;re looking for has wandered off.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-full font-label-md text-label-md hover:scale-105 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">home</span>
          Back to home
        </Link>
      </div>
    </main>
  );
}
