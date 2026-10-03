import type { CSSProperties } from 'react';

const paths: Record<string, React.ReactNode> = {
  shield: <path d="M12 3 4 6.5v5.5c0 4.6 3.2 8.4 8 9.5 4.8-1.1 8-4.9 8-9.5V6.5L12 3Z" />,
  chart: (
    <>
      <path d="M4 20h16" />
      <path d="M6 16V10" />
      <path d="M10 16V6" />
      <path d="M14 16v-4" />
      <path d="M18 16V8" />
    </>
  ),
  bolt: <path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" />,
  trending: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h2.5l1.2-1.8a1 1 0 0 1 .8-.2h5a1 1 0 0 1 .8.2L16.5 6H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
      <path d="M6.5 6.5l3 3M14.5 14.5l3 3M17.5 6.5l-3 3M9.5 14.5l-3 3" />
    </>
  ),
  chat: (
    <>
      <path d="M21 12a8 8 0 1 1-3.2-6.4L21 4l-1.4 3.2A8 8 0 0 1 21 12Z" />
      <path d="M3 21l1.5-4.5A8 8 0 0 1 4 12" />
    </>
  ),
  check: <path d="M5 13l4 4L19 7" />,
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </>
  ),
  refresh: (
    <>
      <path d="M4 4v6h6" />
      <path d="M20 20v-6h-6" />
      <path d="M4 10a8 8 0 0 1 14-4l2 2" />
      <path d="M20 14a8 8 0 0 1-14 4l-2-2" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <path d="M12 17v.01" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 10h16" />
      <path d="M9 3v4M15 3v4" />
    </>
  ),
  money: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 8h6M12 8v8M9 12h6M9 16h6" />
    </>
  ),
  package: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16" />
      <path d="M5 8h14" />
      <path d="M7 8l-4 7a4 4 0 0 0 8 0L7 8Z" />
      <path d="M17 8l-4 7a4 4 0 0 0 8 0l-4-7Z" />
    </>
  ),
  message: <path d="M4 5h16v11H8l-4 4V5Z" />,
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.01" />
      <path d="M11 12h1v4h1" />
    </>
  ),
  home: (
    <>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
  externalLink: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  ),
};

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 16,
  className,
  style,
  strokeWidth = 1.5,
}: {
  name: IconName | string;
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}) {
  const node = paths[name] ?? paths.info;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
      aria-hidden="true"
    >
      {node}
    </svg>
  );
}