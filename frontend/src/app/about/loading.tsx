export default function AboutLoading() {
  return (
    <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop max-w-[960px] mx-auto">
      <header className="mb-10 flex flex-col gap-3">
        <div className="h-4 w-16 rounded-full shimmer" />
        <div className="h-10 w-72 rounded-xl shimmer" />
      </header>
      <div className="flex flex-col gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-panel bg-surface/50 rounded-xl p-8 h-40 shimmer" />
        ))}
      </div>
    </main>
  );
}
