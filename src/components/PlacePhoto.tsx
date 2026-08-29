import Image from "next/image";
import { photoUrl } from "@/lib/photo-url";

type Props = {
  storagePath: string;
  alt: string;
  /** Fill the parent (which must be positioned + sized). */
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  priority?: boolean;
};

/** `next/image` wrapper for a photo stored in the place-photos bucket. */
export function PlacePhoto({
  storagePath,
  alt,
  fill,
  width,
  height,
  sizes,
  className,
  priority,
}: Props) {
  const src = photoUrl(storagePath);
  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? "100vw"}
        className={className}
        priority={priority}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 800}
      height={height ?? 600}
      sizes={sizes}
      className={className}
      priority={priority}
    />
  );
}
