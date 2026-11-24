import type { ReactNode } from "react";

const paths = {
  brand: <><path d="M4 12a8 8 0 0 0 16 0H4Z" /><path d="M8 20h8M12 12c0-4 2-7 6-8M12 10C9 10 7 8 7 5c3 0 5 2 5 5Z" /></>,
  search: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4 4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  back: <path d="M20 12H5m6-6-6 6 6 6" />,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 19v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m2-14a3 3 0 0 1 0 6m4 8v-2a4 4 0 0 0-3-4" /></>,
  bookmark: <path d="M6 4h12v16l-6-4-6 4V4Z" />,
  account: <><circle cx="12" cy="8" r="3" /><path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" /></>,
} satisfies Record<string, ReactNode>;

export function Icon({ name, className = "size-5" }: {
  name: keyof typeof paths;
  className?: string;
}) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}
