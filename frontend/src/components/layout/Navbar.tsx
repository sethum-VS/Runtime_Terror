"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAV_LINKS, isNavActive } from "@/lib/siteNav";
import { ProfileMenu } from "./ProfileMenu";

export function Navbar() {
  const pathname = usePathname() || "/";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-container-padding-mobile md:px-container-padding-desktop h-20 bg-surface/40 backdrop-blur-[40px] rounded-full mt-4 mx-container-padding-mobile md:mx-container-padding-desktop w-[calc(100%-48px)] md:w-[calc(100%-160px)] border border-white/50 shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
      <Link
        href="/"
        className="font-headline-md text-headline-md text-primary tracking-tight"
      >
        VoiceTale
      </Link>

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

      <div className="flex items-center gap-4">
        <ProfileMenu />
      </div>
    </nav>
  );
}
