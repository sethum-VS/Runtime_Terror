"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAV_LINKS, isNavActive } from "@/lib/siteNav";
import { ProfileMenu } from "./ProfileMenu";

export function Navbar() {
  const pathname = usePathname() || "/";
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-container-padding-mobile md:px-container-padding-desktop h-20 bg-surface/40 backdrop-blur-[40px] rounded-full mt-4 mx-container-padding-mobile md:mx-container-padding-desktop w-[calc(100%-48px)] md:w-[calc(100%-160px)] border border-white/50 shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
        <Link
          href="/"
          className="font-headline-md text-headline-md text-primary tracking-tight"
        >
          VoiceTale
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          {SITE_NAV_LINKS.map((tab) => {
            const isActive = isNavActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={
                  isActive
                    ? "text-secondary border-b-2 border-secondary pb-1 font-label-md text-label-md hover:scale-105 transition-transform duration-300"
                    : "text-on-surface-variant hover:text-primary font-label-md text-label-md hover:scale-105 transition-transform duration-300"
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          {/* Mobile hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden flex items-center justify-center w-11 h-11 rounded-full hover:bg-primary/10 transition-colors"
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
          >
            <span className="material-symbols-outlined text-primary">menu</span>
          </button>

          <ProfileMenu />
        </div>
      </nav>

      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden transition-opacity duration-300 ${
          drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Right-slide drawer */}
      <div
        role="dialog"
        aria-label="Navigation menu"
        aria-modal="true"
        className={`fixed top-0 right-0 bottom-0 z-[70] w-72 bg-surface/95 backdrop-blur-[40px] border-l border-white/30 shadow-[-20px_0_60px_rgba(0,0,0,0.18)] flex flex-col md:hidden transition-transform duration-300 ease-in-out ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/20">
          <Link
            href="/"
            className="font-headline-md text-headline-md text-primary tracking-tight"
          >
            VoiceTale
          </Link>
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex items-center justify-center w-11 h-11 rounded-full hover:bg-primary/10 transition-colors"
            aria-label="Close menu"
          >
            <span className="material-symbols-outlined text-primary">close</span>
          </button>
        </div>

        {/* Drawer nav links */}
        <nav className="flex-1 px-4 py-6 flex flex-col gap-1 overflow-y-auto">
          {SITE_NAV_LINKS.map((tab) => {
            const isActive = isNavActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-label-md text-label-md transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:bg-primary/5 hover:text-primary"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
