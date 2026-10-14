import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib";

export interface ModalCloseButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  iconClassName?: string;
}

export const ModalCloseButton = React.forwardRef<
  HTMLButtonElement,
  ModalCloseButtonProps
>(({ className, iconClassName, ...props }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      aria-label="Закрыть"
      className={cn(
        "absolute right-4 top-4 z-10 rounded-full border border-border/60 bg-background/80 p-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none",
        className
      )}
      {...props}
    >
      <X className={cn("h-4 w-4", iconClassName)} />
      <span className="sr-only">Закрыть</span>
    </button>
  );
});

ModalCloseButton.displayName = "ModalCloseButton";
