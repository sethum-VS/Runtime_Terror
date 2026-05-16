"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type { UserProfile } from "@/lib/types";

export default function EditProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [narratorVoice, setNarratorVoice] = useState("");
  const [readingTheme, setReadingTheme] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api
      .getProfile()
      .then((p) => {
        setProfile(p);
        setFullName(p.full_name || "");
        setBio(p.bio || "");
        setNarratorVoice(p.preferred_narrator_voice || "");
        setReadingTheme(p.preferred_reading_theme || "");
        setAvatarUrl(p.avatar_url);
      })
      .catch(() => {});
  }, []);

  async function handleAvatarUpload(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const sb = getSupabaseClient();
      const { error: uploadError } = await sb.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = sb.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(publicUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Avatar upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      await api.updateProfile({
        full_name: fullName || null,
        bio: bio || null,
        avatar_url: avatarUrl,
        preferred_narrator_voice: narratorVoice || null,
        preferred_reading_theme: readingTheme || null,
      });
      setSuccess(true);
      setTimeout(() => router.push("/profile"), 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const initials =
    fullName?.charAt(0).toUpperCase() ||
    user?.email?.charAt(0).toUpperCase() ||
    "?";

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
          Edit Profile
        </h1>

        {error && (
          <div className="bg-error-container text-on-error-container rounded-xl px-4 py-3 mb-6 font-body-md">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-primary-container text-on-primary-container rounded-xl px-4 py-3 mb-6 font-body-md">
            Profile saved! Redirecting…
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex items-center gap-6">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary text-on-primary flex items-center justify-center text-2xl font-headline-lg">
                {initials}
              </div>
            )}
            <div>
              <label className="inline-flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-full cursor-pointer hover:bg-primary/10 transition-colors font-label-md text-label-md text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">
                  upload
                </span>
                {uploading ? "Uploading…" : "Change Avatar"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAvatarUpload(f);
                  }}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant mb-1.5 block">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-surface-container-high rounded-xl px-4 py-3 font-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          <div>
            <label className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant mb-1.5 block">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ""}
              readOnly
              className="w-full bg-surface-container-high rounded-xl px-4 py-3 font-body-md text-on-surface/50 outline-none cursor-not-allowed"
            />
          </div>

          <div>
            <label className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant mb-1.5 block">
              Short Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full bg-surface-container-high rounded-xl px-4 py-3 font-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
              placeholder="Tell us about yourself…"
            />
          </div>

          <div>
            <label className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant mb-1.5 block">
              Preferred Narrator Voice
            </label>
            <select
              value={narratorVoice}
              onChange={(e) => setNarratorVoice(e.target.value)}
              className="w-full bg-surface-container-high rounded-xl px-4 py-3 font-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            >
              <option value="">Default</option>
              <option value="warm">Warm</option>
              <option value="dramatic">Dramatic</option>
              <option value="calm">Calm</option>
              <option value="energetic">Energetic</option>
            </select>
          </div>

          <div>
            <label className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant mb-1.5 block">
              Preferred Reading Theme
            </label>
            <select
              value={readingTheme}
              onChange={(e) => setReadingTheme(e.target.value)}
              className="w-full bg-surface-container-high rounded-xl px-4 py-3 font-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            >
              <option value="">Default</option>
              <option value="sepia">Sepia</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary text-on-primary rounded-full px-8 py-3 font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <Link
              href="/profile"
              className="text-on-surface-variant hover:text-primary font-label-md text-label-md transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
