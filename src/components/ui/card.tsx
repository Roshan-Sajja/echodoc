/**
 * Reusable card primitives modeled after shadcn/ui. Gives us consistent spacing,
 * typography, and slot data attributes without repeating Tailwind classes.
 */
import * as React from "react";

import { cn } from "./utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border",
        className,
      )}
      {...props}
    />
  );
}

export { Card };
