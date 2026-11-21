import { useTranslations } from "next-intl";
import { Coffee } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CoffeeLink({ className }: { className?: string }) {
  const t = useTranslations("ui");
  return (
    <a
      href="https://buymeacoffee.com/flanmorrison"
      target="_blank"
      rel="noopener noreferrer"
      title={t("coffee")}
      aria-label={t("coffee")}
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-9", className)}
    >
      <Coffee className="size-4" />
    </a>
  );
}
