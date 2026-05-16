"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAV_LINKS, isNavActive } from "@/lib/siteNav";

export function Footer() {
  const pathname = usePathname() || "/";

  return (
    <footer className="mt-auto w-full px-container-padding-mobile md:px-container-padding-desktop pb-8 pt-section-margin">
      <div className="max-w-[1280px] mx-auto glass-panel bg-surface/50 backdrop-blur-[40px] border border-white/50 shadow-[0_20px_40px_rgba(0,0,0,0.06)] rounded-3xl overflow-hidden">
        <div className="px-6 py-10 md:px-10 md:py-12 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">
          <div className="md:col-span-5">
            <Link
              href="/"
              className="font-headline-md text-headline-md text-primary tracking-tight inline-block mb-4 hover:opacity-90 transition-opacity"
            >
              VoiceTale
            </Link>
            <p className="font-body-md text-on-surface-variant max-w-sm">
              Turn PDF storybooks into multi-voice audiobooks with read-along
              highlighting—built for immersive family reading.
            </p>
          </div>

          <div className="md:col-span-3">
            <p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary mb-4">
              Quick links
            </p>
            <ul className="space-y-3">
              {SITE_NAV_LINKS.map(({ href, label }) => {
                const active = isNavActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={
                        active
                          ? "font-label-md text-label-md text-secondary border-b border-secondary pb-0.5 inline-block"
                          : "font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
                      }
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="md:col-span-4">
            <p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary mb-4">
              Get started
            </p>
            <p className="font-body-md text-on-surface-variant mb-5 max-w-sm">
              Upload a PDF from the home page, follow processing in My Library,
              then listen page-by-page with character voices.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full font-label-md text-label-md hover:scale-[1.02] transition-transform"
            >
              <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
              Upload a story
            </Link>
          </div>
        </div>

        <div className="border-t border-white/40 px-6 py-4 md:px-10 flex items-center justify-center bg-surface/30">
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            © {new Date().getFullYear()} VoiceTale
          </p>
        </div>
      </div>
    </footer>
  );
}
