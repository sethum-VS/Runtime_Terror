/** Primary routes — shared by Navbar and Footer so links stay aligned. */
export const SITE_NAV_LINKS = [
  { href: "/", label: "Upload" },
  { href: "/library", label: "My Library" },
  { href: "/voices", label: "Explore Voices" },
  { href: "/about", label: "About" },
] as const;

export function isNavActive(pathname: string, href: string): boolean {
  const p = pathname || "/";
  if (href === "/") return p === "/";
  if (href === "/library") return p.startsWith("/library") || p.startsWith("/story");
  if (href === "/voices") return p.startsWith("/voices");
  if (href === "/about") return p.startsWith("/about");
  return p.startsWith(href);
}
