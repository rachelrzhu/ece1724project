import type { ReactNode } from "react";

const paths = {
  moon: <path d="M20.2 13.1a8.3 8.3 0 0 1-9.3-9.3 8.4 8.4 0 1 0 9.3 9.3Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  home: <><path d="m3 10 9-7 9 7M5 9v11h14V9" /><path d="M9.5 20v-7h5v7" /></>,
  brand: <><path d="M12 6v13M12 6C9 4 6 4 3 5v13c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z" /><path d="M6 8.5c1-.1 2 0 3 .4m-3 3c1-.1 2 0 3 .4m6-3.4c1-.4 2-.5 3-.4m-3 3.8c1-.4 2-.5 3-.4" /></>,
  search: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4 4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M20 12H5m6-6-6 6 6 6" />,
  forward: <path d="M4 12h15m-6-6 6 6-6 6" />,
  diagonal: <path d="M6 18 18 6M7 6h11v11" />,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  filters: <><path d="M3 7h4m5 0h9M3 17h9m5 0h4" /><circle cx="9.5" cy="7" r="2.5" /><circle cx="14.5" cy="17" r="2.5" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
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
