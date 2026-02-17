import { Link } from "react-router";
import { Badge } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

export function CategoryBadge({
  slug,
  name,
  isActive = false,
}: {
  slug: string;
  name: string;
  isActive?: boolean;
}) {
  return (
    <Link to={slug === "all" ? "/" : `/?category=${slug}`}>
      <Badge
        variant={isActive ? "default" : "outline"}
        className={cn(
          "cursor-pointer transition-colors hover:bg-[var(--color-primary)] hover:text-white",
          isActive && "bg-[var(--color-primary)]",
        )}
      >
        {name}
      </Badge>
    </Link>
  );
}
