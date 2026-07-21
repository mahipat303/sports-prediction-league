import Image from "next/image";
import { cn } from "@/lib/utils";

const RATIO = 2171 / 800; // full wordmark aspect ratio

/**
 * OpsHub brand mark. The artwork is dark navy on transparency, which would be
 * unreadable on the app's dark theme, so it sits on a white surface — that
 * keeps the exact brand colours in both light and dark mode.
 */
export function OpsHubLogo({
  width = 132,
  className,
  href = "https://www.opshub.com",
}: {
  width?: number;
  className?: string;
  href?: string | null;
}) {
  const mark = (
    <span
      className={cn(
        "inline-flex items-center rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-black/5 transition-transform",
        href && "hover:scale-[1.03]",
        className
      )}
    >
      <Image
        src="/opshub-logo.png"
        alt="OpsHub — accelerating innovation"
        width={width}
        height={Math.round(width / RATIO)}
        className="h-auto w-auto"
        style={{ width, height: "auto" }}
      />
    </span>
  );

  if (!href) return mark;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label="OpsHub">
      {mark}
    </a>
  );
}

/** Compact icon-only mark, for tight spots like the hero badge. */
export function OpsHubIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-white p-1 ring-1 ring-black/5",
        className
      )}
    >
      <Image src="/opshub-icon.png" alt="" width={size} height={size} />
    </span>
  );
}
