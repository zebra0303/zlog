import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { CONFIG } from "../config";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode;
  objectFit?: "cover" | "contain" | "contain-mobile";
  priority?: boolean; // LCP optimization: skip lazy loading
}

export function LazyImage({
  src,
  alt,
  className,
  fallback,
  objectFit = "cover",
  priority = false,
  srcSet,
  sizes,
  style,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority); // If priority, consider in view immediately
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (priority || isInView) return; // Skip observer if priority or already triggered

    const el = imgRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: CONFIG.LAZY_LOAD_MARGIN },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [priority, isInView]);

  if (hasError && fallback) return <>{fallback}</>;

  return (
    <div
      ref={imgRef}
      className={cn("relative overflow-hidden bg-gray-100 dark:bg-gray-800", className)}
      style={style}
    >
      {isInView && (
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          fetchPriority={priority ? "high" : "auto"}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          className={cn(
            "block w-full transition-opacity duration-500",
            style?.aspectRatio ? "h-full" : "h-auto",
            objectFit === "contain"
              ? "object-contain"
              : objectFit === "contain-mobile"
                ? "object-contain md:object-cover"
                : "object-cover",
            isLoaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => {
            setIsLoaded(true);
          }}
          onError={() => {
            setHasError(true);
          }}
          {...props}
        />
      )}
    </div>
  );
}
