import { clubInfo } from "@/lib/club-colors";
import { cn } from "@/lib/utils";

const SIZE = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-7 text-[11px]",
} as const;

export function ClubBadge({
  squadra,
  size = "sm",
  className,
}: {
  squadra: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const { abbr, colore } = clubInfo(squadra);
  return (
    <span
      title={squadra}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white uppercase select-none",
        SIZE[size],
        className,
      )}
      style={{ backgroundColor: colore }}
    >
      {abbr.slice(0, 3)}
    </span>
  );
}
