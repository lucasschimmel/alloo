import { durationLabel } from "@alloo/shared/message-label";
import { useEffect, useRef, useState } from "react";

export function CallTimer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span role="timer" aria-label="Durée de l’appel">
      {durationLabel(Math.max(0, Math.floor((now - startedAt) / 1000)))}
    </span>
  );
}

// Incoming ring and outgoing ringback use a single context per mounted provider.
// Browser autoplay denial is surfaced as an explicit activation control.
export function useCallSound(mode: "incoming" | "outgoing" | null) {
  const context = useRef<AudioContext | null>(null);
  const [blocked, setBlocked] = useState(false);
  const enable = () => {
    const audio = context.current;
    if (audio)
      void audio
        .resume()
        .then(() => setBlocked(audio.state !== "running"))
        .catch(() => setBlocked(true));
  };
  useEffect(() => {
    if (!mode) {
      setBlocked(false);
      return;
    }
    if (typeof AudioContext === "undefined") {
      setBlocked(true);
      return;
    }
    const audio = new AudioContext();
    context.current = audio;
    let stopped = false;
    const ring = () => {
      if (stopped || audio.state !== "running") return;
      const gain = audio.createGain();
      gain.connect(audio.destination);
      const duration = mode === "incoming" ? 0.8 : 0.4;
      gain.gain.setValueAtTime(0, audio.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, audio.currentTime + 0.03);
      gain.gain.setValueAtTime(0.08, audio.currentTime + duration - 0.03);
      gain.gain.linearRampToValueAtTime(0, audio.currentTime + duration);
      const oscillator = audio.createOscillator();
      oscillator.frequency.value = mode === "incoming" ? 480 : 440;
      oscillator.connect(gain);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    };
    audio.onstatechange = () => {
      if (!stopped) {
        setBlocked(audio.state !== "running");
        if (audio.state === "running") ring();
      }
    };
    setBlocked(audio.state !== "running");
    void audio
      .resume()
      .then(() => {
        if (!stopped) {
          setBlocked(audio.state !== "running");
          ring();
        }
      })
      .catch(() => {
        if (!stopped) setBlocked(true);
      });
    const timer = setInterval(ring, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
      audio.onstatechange = null;
      context.current = null;
      void audio.close().catch(() => {
        /* A closed context owns no live sound resources. */
      });
    };
  }, [mode]);
  return { blocked, enable };
}
