"use client";

import { AuthProvider } from "@/context/AuthContext";
import { ReadingLibraryProvider } from "@/context/ReadingLibraryContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ReadingLibraryProvider>{children}</ReadingLibraryProvider>
    </AuthProvider>
  );
}
