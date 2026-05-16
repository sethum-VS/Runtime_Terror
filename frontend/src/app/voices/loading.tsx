export default function VoicesLoading() {
  return (
    <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop max-w-[1280px] mx-auto">
      <header className="mb-10 flex flex-col gap-3">
        <div className="h-4 w-44 rounded-full shimmer" />
        <div className="h-10 w-52 rounded-xl shimmer" />
        <div className="h-5 w-72 rounded-lg shimmer" />
        <div className="mt-3 h-12 w-80 rounded-full shimmer" />
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-card-gap">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-panel bg-surface/50 rounded-xl p-6 h-32 shimmer" />
        ))}
      </div>
    </main>
  );
}
