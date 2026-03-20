"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageSquare, Users, Sparkles, ArrowRight } from "lucide-react";

const slides = [
  {
    icon: MessageSquare,
    title: "Juste discuter",
    description:
      "Alloo, c'est du chat pur. Messages privés et groupes, dans ton navigateur. Pas de bots, pas de channels, pas de bruit.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Users,
    title: "Invite tes amis",
    description:
      "Partage un lien ou un QR code pour inviter tes amis. Ils s'inscrivent et rejoignent le groupe en quelques secondes.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    icon: Sparkles,
    title: "C'est tout. Vraiment.",
    description:
      "Pas de features inutiles, pas de bloat. Une seule chose, faite parfaitement. Bienvenue sur Alloo.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
];

export default function OnboardingPage() {
  const { user, isLoading } = useCurrentUser();
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Skip if already onboarded
  if (!isLoading && user?.onboardingCompleted) {
    router.replace("/chat");
    return null;
  }

  // Redirect to profile setup if no username
  if (!isLoading && user && !user.username) {
    router.replace("/setup-profile");
    return null;
  }

  const handleNext = async () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      await completeOnboarding();
      router.replace("/chat");
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
    router.replace("/chat");
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const slide = slides[currentSlide];
  const Icon = slide.icon;
  const isLast = currentSlide === slides.length - 1;

  return (
    <div className="flex h-screen flex-col items-center justify-between px-6 py-12">
      {/* Skip button */}
      <div className="flex w-full max-w-sm justify-end">
        <button
          onClick={handleSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Passer
        </button>
      </div>

      {/* Slide content */}
      <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center text-center"
          >
            <div
              className={`mb-8 flex h-24 w-24 items-center justify-center rounded-3xl ${slide.bg}`}
            >
              <Icon className={`h-12 w-12 ${slide.color}`} />
            </div>
            <h2 className="text-2xl font-bold">{slide.title}</h2>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        {/* Dots */}
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-2 rounded-full transition-all ${
                i === currentSlide
                  ? "w-6 bg-primary"
                  : "w-2 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        {/* CTA */}
        <Button onClick={handleNext} className="w-full" size="lg">
          {isLast ? (
            "Commencer à discuter"
          ) : (
            <>
              Suivant
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
