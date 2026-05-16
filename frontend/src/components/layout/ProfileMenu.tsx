"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const MENU_ITEMS = [
  { href: "/profile", icon: "person", label: "View Profile" },
  { href: "/profile/edit", icon: "edit", label: "Edit Profile" },
  { href: "/profile/saved", icon: "bookmark", label: "Saved Books" },
  { href: "/profile/progress", icon: "trending_up", label: "Reading Progress" },
  { href: "/profile/settings", icon: "settings", label: "Settings" },
];

function isProfileLinkActive(pathname: string, href: string) {
  if (href === "/profile") return pathname === "/profile";
  return pathname.startsWith(href);
}

const rowBase =
  "flex min-h-[44px] items-center gap-3 rounded-xl px-4 py-2.5 font-label-md text-label-md transition-colors";

export function ProfileMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const desktopPanelRef = useRef<HTMLDivElement>(null);

  // Portal target only available client-side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Desktop: close on outside click
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (
        triggerRef.current?.contains(t) ||
        desktopPanelRef.current?.contains(t)
      )
        return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Lock body scroll while mobile panel open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await signOut();
    router.push("/");
  }

  const initials = user?.email?.charAt(0).toUpperCase() ?? "?";

  // ── Shared menu content ──────────────────────────────────────────────────
  function MenuContent() {
    if (!user) {
      return (
        <div className="flex flex-col">
          <div className="border-b border-white/20 px-4 py-3">
            <p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">
              Account
            </p>
            <p className="mt-1 text-[12px] text-on-surface-variant leading-snug">
              Sign in to sync library, bookmarks, and reading progress.
            </p>
          </div>
          <div className="flex flex-col gap-2 px-4 pb-3 pt-2">
            <Link
              href="/auth/sign-in"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`${rowBase} ${
                pathname.startsWith("/auth/sign-in")
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-primary/5 hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-[20px] shrink-0">
                login
              </span>
              Sign in
            </Link>
            <Link
              href="/auth/sign-up"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 font-label-md text-label-md text-on-primary shadow-[0_10px_20px_rgba(3,31,65,0.2)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[20px] shrink-0">
                person_add
              </span>
              Create account
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col">
        <div className="border-b border-white/20 px-4 py-4">
          <p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">
            Signed in
          </p>
          <p className="mt-1 font-label-md text-label-md text-primary truncate">
            {user.email}
          </p>
        </div>
        <nav
          role="menu"
          aria-orientation="vertical"
          className="flex max-h-[min(60vh,22rem)] flex-col gap-1 overflow-y-auto p-2"
        >
          {MENU_ITEMS.map((item) => {
            const active = isProfileLinkActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`${rowBase} ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:bg-primary/5 hover:text-primary"
                }`}
              >
                <span className="material-symbols-outlined text-[20px] shrink-0">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/20 p-2">
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className={`${rowBase} w-full text-error hover:bg-error/10`}
          >
            <span className="material-symbols-outlined text-[20px] shrink-0">
              logout
            </span>
            Log out
          </button>
        </div>
      </div>
    );
  }

  // ── Mobile portal (right-slide panel) ───────────────────────────────────
  // Rendered into document.body via createPortal to escape Navbar's
  // backdrop-blur stacking context (which breaks fixed positioning).
  const mobilePortal =
    mounted &&
    createPortal(
      <>
        {/* Dimming overlay */}
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className={`fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm md:hidden transition-opacity duration-300 ${
            open
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
        />

        {/* Right-slide panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Account menu"
          className={`fixed top-0 right-0 bottom-0 z-[130] w-72 flex flex-col md:hidden
            border-l border-white/30
            shadow-[-20px_0_60px_rgba(0,0,0,0.18)]
            transition-transform duration-300 ease-in-out
            ${open ? "translate-x-0" : "translate-x-full"}`}
          style={{ backgroundColor: "rgba(252,249,248,0.98)" }}
        >
          {/* Panel header with close button */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/20">
            <p className="font-headline-sm text-headline-sm text-primary tracking-tight">
              {user ? "My Account" : "Account"}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center w-11 h-11 rounded-full hover:bg-primary/10 transition-colors"
              aria-label="Close menu"
            >
              <span className="material-symbols-outlined text-primary">
                close
              </span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <MenuContent />
          </div>
        </div>
      </>,
      document.body
    );

  return (
    <>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center justify-center w-11 h-11 rounded-full hover:bg-primary/10 transition-colors duration-300"
        aria-label="Profile menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {user ? (
          <span className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-md text-label-md">
            {initials}
          </span>
        ) : (
          <span className="material-symbols-outlined text-primary text-[28px]">
            account_circle
          </span>
        )}
      </button>

      {/* Desktop: floating dropdown */}
      {open && (
        <div
          ref={desktopPanelRef}
          role="menu"
          aria-orientation="vertical"
          className="hidden md:block absolute right-0 top-full z-[80] mt-3 w-80 overflow-hidden rounded-2xl border border-white/30 shadow-[0_24px_48px_rgba(0,0,0,0.18)]"
          style={{ backgroundColor: "rgba(252,249,248,0.97)" }}
        >
          <MenuContent />
        </div>
      )}

      {/* Mobile: portal → escapes Navbar stacking context */}
      {mobilePortal}
    </>
  );
}
