"use client";

import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";

export function getOfflineImageSrc(value?: string | null) {
  const src = value?.trim();
  if (!src) return "";
  if (src.startsWith("data:image/") || src.startsWith("blob:")) return src;
  if (src.startsWith("/") && !src.startsWith("//")) return src;
  return "";
}

export function OfflineProductImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  const offlineSrc = getOfflineImageSrc(src);

  useEffect(() => {
    setFailed(false);
  }, [offlineSrc]);

  if (!offlineSrc || failed) {
    return (
      <div
        aria-label={alt}
        className={`${className} flex items-center justify-center bg-gray-100 text-gray-500`}
      >
        <div className="flex flex-col items-center justify-center gap-1 px-2 text-center">
          <ImageOff className="h-5 w-5" aria-hidden="true" />
          {/* <span className="text-[10px] font-medium leading-tight">No Image</span> */}
        </div>
      </div>
    );
  }

  return (
    <img
      src={offlineSrc}
      alt={alt}
      className={`${className} object-cover`}
      onError={() => setFailed(true)}
    />
  );
}
