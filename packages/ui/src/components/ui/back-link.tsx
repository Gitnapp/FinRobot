import { ArrowLeft } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";

/** A page-level return action; asChild preserves the host router's navigation. */
export function BackLink({
  asChild = false,
  className,
  children,
  ...props
}: ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a";
  return (
    <Comp
      data-slot="back-link"
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "mb-4 -ml-2.5 text-muted-foreground hover:text-foreground cursor-default pointer-coarse:min-h-11",
        className,
      )}
      {...props}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      <Slot.Slottable>{children}</Slot.Slottable>
    </Comp>
  );
}
