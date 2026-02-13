import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { CONFIG } from "../config";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode;
}

export function LazyImage({ src, alt, className, fallback, ...props }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) { setIsInView(true); observer.disconnect(); } },
      { rootMargin: CONFIG.LAZY_LOAD_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (hasError && fallback) return <>{fallback}</>;

  return (
    <div ref={imgRef} className={cn("relative overflow-hidden", className)}>
      {!isLoaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-purple-100 via-pink-100 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-blue-900/20" />}
      {isInView && (
        <img src={src} alt={alt}
          className={cn("h-full w-full object-cover transition-opacity duration-[400ms]", isLoaded ? "opacity-100" : "opacity-0")}
          onLoad={() => setIsLoaded(true)} onError={() => setHasError(true)} {...props} />
      )}
    </div>
  );
}
