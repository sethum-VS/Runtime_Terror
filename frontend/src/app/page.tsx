import { HeroSection } from "@/components/landing/HeroSection";
import { BentoGrid } from "@/components/landing/BentoGrid";
import { MotionItem } from "@/components/ui/MotionItem";

export default function HomePage() {
  return (
    <main className="pt-[160px] pb-section-margin px-container-padding-mobile md:px-container-padding-desktop max-w-[1920px] mx-auto">
      <MotionItem>
        <HeroSection />
      </MotionItem>
      <MotionItem>
        <BentoGrid />
      </MotionItem>
    </main>
  );
}
