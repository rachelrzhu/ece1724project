import { accountText } from "@/lib/i18n/account";
import { useLocale } from "@/app/_components/language-provider";
import type { Ref } from "react";
import { MAX_IMAGE_BYTES } from "@/lib/storage/limits";

export default function AvatarUploadField({ id, label, inputRef, onSelect }: {
  id: string;
  label: string;
  inputRef?: Ref<HTMLInputElement>;
  onSelect?: (file?: File) => void;
}) {
  const t = accountText(useLocale());
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input id={id} ref={inputRef} name="photo" type="file" accept="image/jpeg,image/png,image/webp"
        className="site-field" aria-describedby={`${id}-hint`} onChange={event => {
          const input = event.currentTarget;
          const file = input.files?.[0];
          let error = "";
          if (file && (!file.size || file.size > MAX_IMAGE_BYTES)) error = "Choose a nonempty photo up to 3 MiB.";
          else if (file?.type && !["image/jpeg", "image/png", "image/webp"].includes(file.type))
            error = "Choose a JPEG, PNG or WebP photo.";
          input.setCustomValidity(t(error));
          if (error) input.reportValidity();
          onSelect?.(file);
        }} />
      <p id={`${id}-hint`} className="text-sm text-subtle">{t("Still JPEG, PNG or WebP, up to 3 MiB and 16 megapixels. Your avatar appears on your public recipe page.")}</p>
    </div>
  );
}
