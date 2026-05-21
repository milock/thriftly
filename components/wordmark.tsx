import Link from "next/link";
import { MapPin } from "lucide-react";

export function Wordmark({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 transition-opacity hover:opacity-80 ${className ?? ""}`}
    >
      <span className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background">
        <MapPin className="size-4" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Goodwill Locator</span>
    </Link>
  );
}
