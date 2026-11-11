import type { ReactElement } from "react";

export interface PhotoThumbnail {
  /** The full image; opens in the same tab. */
  href: string;
  /** The image shown small; usually the same URL as `href`. */
  src: string;
  /** Shown under the thumbnail and read by screen readers, for example the sanitized file name. */
  caption: string;
  /** Link text for assistive technology, for example "Otwórz zdjęcie: front.jpg". */
  linkLabel: string;
}

export interface PhotoThumbnailsProps {
  /** Accessible name of the list, for example "Zdjęcia do zgłoszenia". */
  label: string;
  items: PhotoThumbnail[];
}

/** A read-only row of photo thumbnails, each a link to the full image in the same tab. No state and no upload. */
export function PhotoThumbnails({ label, items }: PhotoThumbnailsProps): ReactElement {
  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <li key={item.href}>
          <a
            href={item.href}
            aria-label={item.linkLabel}
            className="block rounded-md border border-border bg-card p-1.5 text-xs text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* A plain img: the source is our own download route, never an optimised remote image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.src} alt="" loading="lazy" width={160} height={120} className="aspect-[4/3] w-full rounded object-cover" />
            <span className="mt-1 block truncate">{item.caption}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
