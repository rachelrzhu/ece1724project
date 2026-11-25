"use client";

import { makeTranslator } from "@/lib/i18n";
import { coverMessages } from "@/lib/i18n/discovery";
import { useLocale } from "./language-provider";
import Image from "next/image";
import { Icon } from "./icons";

export function RecipeCover({ fileId, className, showPlaceholderLabel = false }: {
  fileId: string | null;
  className: string;
  showPlaceholderLabel?: boolean;
}) {
  const t = makeTranslator(useLocale(), coverMessages);
  return (
    <div className={`relative isolate grid place-items-center overflow-hidden bg-tint text-brand ${className}`}>
      <div className="flex flex-col items-center gap-2">
        <Icon name="brand" className="size-8 opacity-60" />
        {!fileId && showPlaceholderLabel && <span className="text-sm text-subtle">{t("No cover photo")}</span>}
      </div>
      {fileId && (
        <Image src={`/api/images/${fileId}`} alt="" fill unoptimized className="object-cover" />
      )}
    </div>
  );
}
