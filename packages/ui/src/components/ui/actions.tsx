import { Plus } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "./button";
import { DropdownMenuItem } from "./dropdown-menu";

type Attention = "primary" | "secondary" | "quiet";
/** One primary action per area; secondary is explicit, quiet is a toolbar option. */
export function AddButton({
  attention = "secondary",
  label = "添加",
  iconOnly = false,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant" | "children" | "asChild"> & {
  attention?: Attention;
  label?: string;
  iconOnly?: boolean;
}) {
  return (
    <Button
      {...props}
      data-attention={attention}
      variant={
        { primary: "default", secondary: "outline", quiet: iconOnly ? "ghost" : "outline" }[
          attention
        ] as "default" | "outline" | "ghost"
      }
      size={iconOnly ? "icon" : props.size}
      aria-label={label}
    >
      <Plus className="size-4" />
      {!iconOnly && label}
    </Button>
  );
}
export function AddMenuItem({
  children = "添加",
  ...props
}: ComponentProps<typeof DropdownMenuItem>) {
  return (
    <DropdownMenuItem {...props}>
      <Plus className="size-4" />
      {children}
    </DropdownMenuItem>
  );
}
