import {
  useRef,
  useState,
  useEffect,
  useCallback,
  ImgHTMLAttributes,
} from "react";

interface PausableImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Whether this image is animated (e.g. GIF). When true, renders a
   *  canvas-based freeze frame and a pause/play toggle button. */
  isAnimated?: boolean;
}

/**
 * Drop-in replacement for <img> that adds a pause/play toggle for animated
 * images. Pass `isAnimated` to enable the pause UI — animation detection
 * is handled upstream (e.g. server-side Content-Type check during sync).
 *
 * Accessibility:
 *  - Auto-pauses when prefers-reduced-motion: reduce is active (SC 2.2.2)
 *  - Pause button meets 24x24px minimum target size (SC 2.5.8)
 *  - Decorative images (alt="") get aria-hidden on the canvas
 */
const PausableImage: React.FC<PausableImageProps> = ({
  src,
  alt,
  className,
  style,
  onLoad,
  isAnimated = false,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [paused, setPaused] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [frameCaptured, setFrameCaptured] = useState(false);

  const captureFrame = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")?.drawImage(img, 0, 0);
    setFrameCaptured(true);
  }, []);

  // Auto-pause when prefers-reduced-motion is active
  useEffect(() => {
    if (!isAnimated) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) setPaused(true);
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setPaused(true);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [isAnimated]);

  if (!isAnimated) {
    return (
      <img src={src} alt={alt} className={className} style={style} {...props} />
    );
  }

  const showPauseUI = frameCaptured;
  const isDecorative = alt === "";

  return (
    <div style={{ position: "relative" }}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={className}
        style={{
          ...style,
          ...(showPauseUI && paused ? { display: "none" } : {}),
        }}
        onLoad={(e) => {
          captureFrame();
          onLoad?.(e);
        }}
        {...props}
      />
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          ...style,
          ...(!(showPauseUI && paused) ? { display: "none" } : {}),
        }}
        {...(isDecorative
          ? { "aria-hidden": true as const }
          : { role: "img", "aria-label": alt })}
      />
      {showPauseUI && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPaused((p) => !p);
          }}
          aria-label={paused ? "Play animation" : "Pause animation"}
          className="absolute bottom-2 right-2 flex items-center justify-center
            min-w-6 min-h-6 w-8 h-8 rounded-full
            bg-black/60 text-white
            hover:bg-black/80
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          {paused ? "\u25B6" : "\u23F8"}
        </button>
      )}
    </div>
  );
};

export default PausableImage;
