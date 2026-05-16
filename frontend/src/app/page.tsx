import { HeroSection } from "@/components/landing/HeroSection";
import { BentoGrid } from "@/components/landing/BentoGrid";

export default function HomePage() {
  return (
    <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop max-w-[1920px] mx-auto">
      <HeroSection />
      <BentoGrid />
    </main>
  );
}
