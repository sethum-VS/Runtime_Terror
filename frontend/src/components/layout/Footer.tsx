"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAV_LINKS, isNavActive } from "@/lib/siteNav";

export function Footer() {
  const pathname = usePathname() || "/";

  return (
    <footer className="mt-auto w-full border-t border-on-surface-variant/15 bg-surface/30">
      <div className="w-full px-container-padding-mobile md:px-container-padding-desktop py-6 md:py-5 flex flex-col items-center justify-center text-center gap-3">
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 md:gap-x-8"
        >
          {SITE_NAV_LINKS.map(({ href, label }) => {
            const active = isNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "font-label-sm text-label-sm text-primary transition-colors"
                    : "font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <p className="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">
          © {new Date().getFullYear()} VoiceTale
        </p>
      </div>
    </footer>
  );
}
