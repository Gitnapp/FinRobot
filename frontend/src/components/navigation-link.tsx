import { OverflowText } from "@gitnapp/ui/components/ui/overflow-text";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

/** Only forward page navigation animates; wrapped titles keep the last word with the arrow. */
export function NavigationLink({
  to,
  label,
  wrap = false,
  className = "",
}: {
  to: string;
  label: string;
  wrap?: boolean;
  className?: string;
}) {
  const name = label.trim(),
    space = name.lastIndexOf(" ");
  const prefix =
    space >= 0
      ? name.slice(0, space + 1)
      : Array.from(name).slice(0, -1).join("");
  const ending =
    space >= 0 ? name.slice(space + 1) : Array.from(name).at(-1) || "";
  return (
    <Link to={to} className={className} data-page-link aria-label={label}>
      {wrap ? (
        <>
          {prefix}
          <span className="title-ending">
            {ending}
            <ArrowRight size={18} aria-hidden="true" />
          </span>
        </>
      ) : (
        <>
          <OverflowText text={label}>
            <span>{label}</span>
          </OverflowText>
          <ArrowRight size={16} aria-hidden="true" />
        </>
      )}
    </Link>
  );
}
