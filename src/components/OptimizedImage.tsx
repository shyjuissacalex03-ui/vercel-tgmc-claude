import React, { useEffect, useRef, useState } from "react";

export interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fill?: boolean;
  priority?: boolean;
  width?: number;
  height?: number;
  className?: string;
  aspectRatio?: string;
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  fallbackText?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  fill = false,
  priority = false,
  width,
  height,
  className = "",
  style,
  fallbackText,
  // Not valid <img> attributes — keep them out of the DOM.
  aspectRatio: _aspectRatio,
  objectFit: _objectFit,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Content from the CMS can be missing an image, so never assume a string.
  const safeSrc = typeof src === "string" ? src.trim() : "";

  // A new image (next slide, next gallery photo) starts with a clean slate,
  // otherwise one broken image would leave every following image hidden.
  useEffect(() => {
    setHasError(false);
    // An image served from cache can finish loading before React attaches onLoad.
    const img = imgRef.current;
    setIsLoaded(!!img && img.complete && img.naturalWidth > 0);
  }, [safeSrc]);

  // Use the smaller .webp twin for bundled /images/ assets (every bundled PNG/JPG has one).
  const isLocalImage = safeSrc.startsWith("/images/");
  const webpSrc = isLocalImage && /\.(png|jpe?g)$/i.test(safeSrc)
    ? safeSrc.replace(/\.(png|jpe?g)$/i, ".webp")
    : null;

  if (hasError || !safeSrc) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-slate-800 text-slate-400 p-4 text-center text-xs select-none ${
          fill ? "absolute inset-0 w-full h-full" : ""
        } ${className}`}
        style={style}
      >
        <span className="font-medium text-slate-300">{fallbackText || alt || "Image unavailable"}</span>
      </div>
    );
  }

  const imageElement = (
    <picture className={fill ? "contents" : "inline-block"}>
      {webpSrc && <source type="image/webp" srcSet={webpSrc} />}
      <img
        ref={imgRef}
        src={safeSrc}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`${
          fill ? "absolute inset-0 w-full h-full object-cover" : ""
        } transition-opacity duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        } ${className}`}
        style={style}
        {...props}
      />
    </picture>
  );

  if (fill) {
    return (
      <div className="relative w-full h-full overflow-hidden bg-slate-800/20">
        {!isLoaded && (
          <div className="absolute inset-0 bg-slate-800/30 animate-pulse" />
        )}
        {imageElement}
      </div>
    );
  }

  return imageElement;
};

export default OptimizedImage;
