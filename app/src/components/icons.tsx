/* Shared inline SVG icons (stroke = currentColor). */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (props: P) => ({ viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, ...props });

export const Shield = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2l8 4v5c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V6l8-4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const ShieldCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2l8 4v5c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V6l8-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M8.5 12l2.3 2.3L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const ArrowRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const ArrowLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const Check = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const Upload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 16V4m0 0L8 8m4-4l4 4M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const X = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
export const Trash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0l1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const Link = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const QrIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);
export const Person = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M5.5 20a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
export const DocIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3h6l4 4v14H6V5a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M14 3v4h4M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
export const IdIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="8.5" cy="11" r="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M14 10h4M14 13h3M5.5 16.5c.6-1.6 4.4-1.6 5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
export const BankIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 10l9-5 9 5M5 10v8h14v-8M4 18h16M9 13v2M12 13v2M15 13v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IncomeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 3h9l3 3v15H6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M9 8h4M9 11h6M9 14h6M9 17h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
export const Info = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 8h.01M11 12h1v4h1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
