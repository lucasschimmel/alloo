import { useEffect, useRef, useState } from "react";

export function MediaVideo({
  stream,
  muted,
  className,
}: {
  stream: MediaStream;
  muted: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null),
    [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let canceled = false;
    setBlocked(false);
    video.srcObject = stream;
    void video
      .play()
      .then(() => {
        if (!canceled) setBlocked(false);
      })
      .catch(() => {
        if (!canceled) setBlocked(true);
      });
    return () => {
      canceled = true;
      video.srcObject = null;
    };
  }, [stream]);
  return (
    <>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={className}
        aria-label={muted ? "Votre caméra" : "Votre correspondant"}
      />
      {blocked && (
        <button
          type="button"
          onClick={() =>
            void ref.current
              ?.play()
              .then(() => setBlocked(false))
              .catch(() => setBlocked(true))
          }
        >
          Activer le son et la vidéo
        </button>
      )}
    </>
  );
}
