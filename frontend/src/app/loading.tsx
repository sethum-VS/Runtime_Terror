export default function HomeLoading() {
  return (
    <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop max-w-[1920px] mx-auto">
      {/* Hero skeleton */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-gutter min-h-0 md:min-h-[760px] items-center">
        <div className="col-span-1 md:col-span-5 flex flex-col gap-6">
          <div className="h-6 w-56 rounded-full shimmer" />
          <div className="flex flex-col gap-3">
            <div className="h-10 w-full rounded-xl shimmer" />
            <div className="h-10 w-4/5 rounded-xl shimmer" />
            <div className="h-10 w-3/5 rounded-xl shimmer" />
          </div>
          <div className="h-5 w-full rounded-lg shimmer" />
          <div className="h-5 w-4/5 rounded-lg shimmer" />
          <div className="glass-panel bg-surface/40 rounded-xl p-6 h-24 shimmer" />
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 w-32 rounded-full shimmer" />
            ))}
          </div>
        </div>
        <div className="hidden md:block col-span-7 h-[600px] rounded-xl shimmer" />
      </section>

      {/* BentoGrid skeleton */}
      <section className="mt-section-margin">
        <div className="text-center mb-12 flex flex-col items-center gap-3">
          <div className="h-8 w-64 rounded-xl shimmer" />
          <div className="h-5 w-96 rounded-lg shimmer" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-card-gap">
          <div className="col-span-1 md:col-span-2 h-64 rounded-xl shimmer" />
          <div className="h-64 rounded-xl shimmer" />
          <div className="h-48 rounded-xl shimmer" />
          <div className="col-span-1 md:col-span-2 h-48 rounded-xl shimmer" />
        </div>
      </section>
    </main>
  );
}
