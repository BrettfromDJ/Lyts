/** Tiny line-art icons for panel group headers (stroke = currentColor). */
export type IconName =
  | 'camera'
  | 'screen'
  | 'focus'
  | 'color'
  | 'film'
  | 'crt'
  | 'ascii'
  | 'background'
  | 'export';

const P: Record<IconName, React.ReactNode> = {
  camera: (
    <>
      <path d="M3 7h3l1.5-2h9L18 7h3v12H3z" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
  screen: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16.5V20" />
    </>
  ),
  focus: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" />
    </>
  ),
  color: (
    <>
      <path d="M5 6h14M5 12h14M5 18h14" />
      <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="8" cy="18" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  film: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M7.5 4.5v15M16.5 4.5v15M3.5 9h4M3.5 14.5h4M16.5 9h4M16.5 14.5h4" />
    </>
  ),
  crt: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4M7 9h10M7 12h10" />
    </>
  ),
  ascii: (
    <>
      <path d="M6 8l3 4-3 4M18 8l-3 4 3 4M13.5 6l-3 12" />
    </>
  ),
  background: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="M5 17l4.5-4.5L13 16l3-3 3 3" />
    </>
  ),
  export: (
    <>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
    </>
  ),
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="grp-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {P[name]}
    </svg>
  );
}
