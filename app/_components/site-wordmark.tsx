import Link from "next/link";
import { appName } from "@/lib/brand";
import { Icon } from "./icons";

export function SiteWordmark({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-base font-bold tracking-tight whitespace-nowrap min-[23rem]:text-lg sm:gap-2.5 sm:text-xl ${inverse ? "text-white" : "text-ink"}`}>
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg sm:size-9 ${inverse ? "bg-white text-brand" : "bg-brand text-white"}`}>
        <Icon name="brand" className="size-5 sm:size-6" />
      </span>
      {appName}
    </Link>
  );
}
