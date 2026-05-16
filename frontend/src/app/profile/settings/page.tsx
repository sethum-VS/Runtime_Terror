"use client";

import { useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [progressNotifs, setProgressNotifs] = useState(true);
  const [newStoryNotifs, setNewStoryNotifs] = useState(false);

  return (
    <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop max-w-[720px] mx-auto">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors mb-4"
      >
        <span className="material-symbols-outlined text-[16px]">
          arrow_back
        </span>
        Profile
      </Link>

      <div className="glass-panel bg-surface/60 rounded-xl p-8 md:p-10">
        <h1 className="font-headline-lg text-headline-lg text-primary mb-8">
          Settings
        </h1>

        <section className="mb-8">
          <h2 className="font-title-lg text-title-lg text-primary mb-4">
            Notifications
          </h2>
          <div className="flex flex-col gap-4">
            <ToggleRow
              label="Email notifications"
              description="Receive updates about your stories via email"
              checked={emailNotifs}
              onChange={setEmailNotifs}
            />
            <ToggleRow
              label="Reading progress reminders"
              description="Get reminded to continue unfinished stories"
              checked={progressNotifs}
              onChange={setProgressNotifs}
            />
            <ToggleRow
              label="New story alerts"
              description="Be notified when new showcase stories are added"
              checked={newStoryNotifs}
              onChange={setNewStoryNotifs}
            />
          </div>
        </section>

        <p className="font-body-md text-on-surface-variant">
          More settings coming soon.
        </p>
      </div>
    </main>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-white/10">
      <div>
        <p className="font-label-md text-label-md text-on-surface">{label}</p>
        <p className="font-label-sm text-label-sm text-on-surface-variant">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-surface-container-high"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
