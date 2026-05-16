"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/sign-in");
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-card-gap">
          <div className="glass-panel bg-surface/50 rounded-xl p-6 h-60 shimmer" />
          <div className="md:col-span-2 glass-panel bg-surface/50 rounded-xl p-6 h-60 shimmer" />
        </div>
      </main>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
