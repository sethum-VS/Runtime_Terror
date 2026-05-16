"use client";

export function BentoGrid() {
  return (
    <section className="mt-section-margin">
      <div className="text-center mb-12">
        <h2 className="font-headline-lg text-headline-lg text-primary">
          The Narrative Ecosystem
        </h2>
        <p className="font-body-lg text-on-surface-variant mt-4 max-w-2xl mx-auto">
          Discover the tools designed to elevate every story into a cinematic
          listening experience.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-card-gap">
        {/* Card 1 - spans 2 cols */}
        <div className="col-span-1 md:col-span-2 glass-panel bg-surface/50 rounded-xl p-8 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-fixed/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col h-full justify-between min-h-[300px]">
            <div>
              <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-[24px]">
                  record_voice_over
                </span>
              </div>
              <h3 className="font-title-lg text-title-lg text-primary mb-3">
                Generative Voice Engine
              </h3>
              <p className="font-body-md text-on-surface-variant max-w-md">
                Each character receives a personality-matched voice generated
                via ElevenLabs Voice Design — no two stories sound the same.
              </p>
            </div>
            <div className="flex items-end gap-1 h-12 mt-6">
              {[20, 50, 80, 100, 70, 40, 20, 90, 60].map((h, i) => (
                <div
                  key={i}
                  className={`w-2 rounded-full ${
                    i === 7 ? "bg-secondary" : "bg-primary"
                  }`}
                  style={{
                    height: `${h}%`,
                    opacity: i === 3 || i === 7 ? 1 : 0.4 + h / 200,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="col-span-1 glass-panel bg-surface-container-lowest rounded-xl p-8 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-all duration-300">
          <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[24px]">
              import_contacts
            </span>
          </div>
          <h3 className="font-title-lg text-title-lg text-primary mb-3">
            Read-Along Sync
          </h3>
          <p className="font-body-md text-on-surface-variant">
            Word-by-word highlighting tied to ElevenLabs audio timestamps. Read
            and listen in perfect step.
          </p>
        </div>

        {/* Card 3 */}
        <div className="col-span-1 glass-panel bg-surface-container-lowest rounded-xl p-8 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-all duration-300">
          <div className="w-12 h-12 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[24px]">
              memory
            </span>
          </div>
          <h3 className="font-title-lg text-title-lg text-primary mb-3">
            Story Memory
          </h3>
          <p className="font-body-md text-on-surface-variant">
            Voices and pronunciations stay consistent across pages. Resume
            exactly where you left off — even after a refresh.
          </p>
        </div>

        {/* Card 4 - spans 2 cols */}
        <div className="col-span-1 md:col-span-2 glass-panel bg-surface/50 rounded-xl p-8 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center h-full">
            <div className="flex-1">
              <div className="w-12 h-12 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-[24px]">
                  bolt
                </span>
              </div>
              <h3 className="font-title-lg text-title-lg text-primary mb-3">
                Lazy Page Generation
              </h3>
              <p className="font-body-md text-on-surface-variant">
                Pages are generated only as you read. The next page is ready
                before the current one ends — no upfront wait, no wasted
                credits.
              </p>
            </div>
            <div className="w-full md:w-1/3 h-32 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 shimmer" />
              <span className="material-symbols-outlined text-on-surface-variant text-[48px] relative z-10">
                queue_music
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
