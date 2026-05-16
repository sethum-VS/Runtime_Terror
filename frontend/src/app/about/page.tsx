import { MotionItem } from "@/components/ui/MotionItem";

export default function AboutPage() {
  return (
    <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop max-w-[960px] mx-auto">
      <MotionItem>
        <header className="mb-10">
          <p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary mb-2">
            About
          </p>
          <h1 className="font-headline-lg text-headline-lg text-primary">
            The story behind VoiceTale
          </h1>
        </header>
      </MotionItem>

      <article className="prose max-w-none">
        <MotionItem>
          <div className="glass-panel bg-surface/60 rounded-xl p-8 mb-6">
            <h2 className="font-title-lg text-title-lg text-primary mb-3">
              What it is
            </h2>
            <p className="font-body-lg text-on-surface-variant">
              VoiceTale is an AI-powered audiobook engine. Upload any PDF — a
              fairy tale, a drama script, a novel chapter — and we&apos;ll cast a
              unique voice for every character, narrate it page by page, and let
              you read along with word-level highlighting.
            </p>
          </div>
        </MotionItem>

        <MotionItem>
          <div className="glass-panel bg-surface/60 rounded-xl p-8 mb-6">
            <h2 className="font-title-lg text-title-lg text-primary mb-3">
              How it works
            </h2>
            <ol className="font-body-md text-on-surface-variant space-y-2 list-decimal pl-5">
              <li>
                <strong>Parse.</strong> An LLM reads your PDF and identifies every
                character, scene, and line of dialogue.
              </li>
              <li>
                <strong>Cast.</strong> Each character gets a personality-matched
                voice via the ElevenLabs Voice Library or Voice Design API.
              </li>
              <li>
                <strong>Narrate.</strong> Pages are generated lazily using
                ElevenLabs Text-to-Dialogue with word-level timestamps.
              </li>
              <li>
                <strong>Listen &amp; read.</strong> The player highlights words in
                sync with audio. The next page is buffered before the current
                one ends.
              </li>
            </ol>
          </div>
        </MotionItem>

        <MotionItem>
          <div className="glass-panel bg-surface/60 rounded-xl p-8">
            <h2 className="font-title-lg text-title-lg text-primary mb-3">
              Built for the buildathon
            </h2>
            <p className="font-body-md text-on-surface-variant">
              VoiceTale was built by team <strong>Runtime Terror</strong> for the
              Cursor Colombo Buildathon 2026 — ElevenLabs Audio &amp; Voice AI
              track. Stack: Next.js, FastAPI, Gemini, Llama 4 Scout, Supabase,
              ElevenLabs.
            </p>
          </div>
        </MotionItem>
      </article>
    </main>
  );
}
