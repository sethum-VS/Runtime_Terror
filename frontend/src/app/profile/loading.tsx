export default function ProfileLoading() {
  return (
    <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop max-w-[1280px] mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-card-gap">
        <div className="glass-panel bg-surface/50 rounded-xl p-8 h-80 shimmer" />
        <div className="md:col-span-2 flex flex-col gap-card-gap">
          <div className="glass-panel bg-surface/50 rounded-xl p-6 h-44 shimmer" />
          <div className="glass-panel bg-surface/50 rounded-xl p-6 h-44 shimmer" />
        </div>
      </div>
    </main>
  );
}
