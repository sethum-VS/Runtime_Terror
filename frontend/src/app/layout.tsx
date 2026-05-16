import type { Metadata } from "next";
import { Manrope, Libre_Caslon_Text } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AppProviders } from "@/components/providers/AppProviders";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

const libreCaslon = Libre_Caslon_Text({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-libre-caslon",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VoiceTale — AI Multi-Character Storybook Narrator",
  description:
    "Transform any PDF story into an immersive audio experience. Each character gets a unique AI-generated voice, with read-along highlighting and lazy page-by-page generation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${libreCaslon.variable}`} suppressHydrationWarning>
      <head>
        {/* Speed up Google Fonts handshake */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Material Symbols — display=block hides ligature text until glyph ready */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
        {/* Mark <html> with .fonts-ready once Material Symbols actually loaded.
            CSS hides icon text until then — no raw ligature flash. */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(document.fonts&&document.fonts.load){document.fonts.load("24px 'Material Symbols Outlined'").then(function(){document.documentElement.classList.add('fonts-ready');}).catch(function(){document.documentElement.classList.add('fonts-ready');});setTimeout(function(){document.documentElement.classList.add('fonts-ready');},3000);}else{document.documentElement.classList.add('fonts-ready');}}catch(e){document.documentElement.classList.add('fonts-ready');}})();`,
          }}
        />
      </head>
      <body className="bg-background text-on-background font-body-md overflow-x-hidden cinematic-bg min-h-screen flex flex-col">
        <AppProviders>
          <Navbar />
          <div className="flex-1 flex flex-col">{children}</div>
          <Footer />
        </AppProviders>
      </body>
    </html>
  );
}
