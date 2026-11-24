import Image from "next/image";
import { Icon } from "./icons";

export function RecipeCover({ fileId, className }: { fileId: string | null; className: string }) {
  return (
    <div className={`relative isolate grid place-items-center overflow-hidden bg-tint text-brand ${className}`}>
      <Icon name="brand" className="size-8 opacity-60" />
      {fileId && (
        <Image src={`/api/images/${fileId}`} alt="" fill unoptimized className="object-cover" />
      )}
    </div>
  );
}
