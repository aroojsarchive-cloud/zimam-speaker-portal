import { initials } from "@/lib/labels";

const SIZES = { sm: "h-10 w-10 text-sm", md: "h-14 w-14 text-base", lg: "h-20 w-20 text-xl", agenda: "h-16 w-16 text-lg md:h-[4.75rem] md:w-[4.75rem]", xl: "h-24 w-24 text-2xl ring-4 ring-surface shadow-[0_8px_24px_-12px_rgb(0_0_0/0.35)]" } as const;

export function Avatar({
  name,
  src,
  size = "md",
  placeholder = false,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  placeholder?: boolean;
}) {
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={`${SIZES[size]} shrink-0 rounded-full object-cover`} />;
  return (
    <span
      aria-hidden
      className={`${SIZES[size]} grid shrink-0 place-items-center rounded-full font-display font-semibold ${
        placeholder ? "border border-dashed border-line text-ink-muted" : "bg-brand-soft text-brand-strong"
      }`}
    >
      {placeholder ? "?" : initials(name)}
    </span>
  );
}
