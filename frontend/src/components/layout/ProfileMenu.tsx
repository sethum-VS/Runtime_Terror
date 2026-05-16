"use client";

import { useState, useRef, useEffect } from "react";
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

export function ProfileMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await signOut();
    router.push("/");
  }

  const initials = user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center justify-center hover:scale-105 transition-transform duration-300"
        aria-label="Profile menu"
      >
        {user ? (
          <span className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-md text-label-md">
            {initials}
          </span>
        ) : (
          <span className="material-symbols-outlined text-primary cursor-pointer">
            account_circle
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-3 w-56 glass-panel bg-surface/80 backdrop-blur-[40px] rounded-xl border border-white/30 shadow-[0_20px_40px_rgba(0,0,0,0.12)] py-2 z-50">
          {!user ? (
            <>
              <Link
                href="/auth/sign-in"
                className="flex items-center gap-3 px-4 py-3 font-label-md text-label-md text-on-surface-variant hover:bg-primary/10 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">
                  login
                </span>
                Sign In
              </Link>
              <Link
                href="/auth/sign-up"
                className="flex items-center gap-3 px-4 py-3 font-label-md text-label-md text-on-surface-variant hover:bg-primary/10 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">
                  person_add
                </span>
                Sign Up
              </Link>
            </>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-white/10">
                <p className="font-label-md text-label-md text-primary truncate">
                  {user.email}
                </p>
              </div>
              {MENU_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 font-label-md text-label-md text-on-surface-variant hover:bg-primary/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
              <div className="border-t border-white/10 mt-1">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 w-full font-label-md text-label-md text-error hover:bg-error/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    logout
                  </span>
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
