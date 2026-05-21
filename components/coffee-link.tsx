import { Coffee } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CoffeeLink({ className }: { className?: string }) {
  return (
    <a
      href="https://buymeacoffee.com/flanmorrison"
      target="_blank"
      rel="noopener noreferrer"
      title="Buy me a coffee"
      aria-label="Buy me a coffee"
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-9", className)}
    >
      <Coffee className="size-4" />
    </a>
  );
}
