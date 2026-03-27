"use client";

type NivoraBrandProps = {
  subtitle?: string;
  compact?: boolean;
  className?: string;
};

export function NivoraBrand({ subtitle = "Radar operativo", compact = false, className }: NivoraBrandProps) {
  return (
    <div className={["nivora-brand", compact ? "nivora-brand-compact" : "", className].filter(Boolean).join(" ")}>
      <span className="nivora-brand-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="nivora-mark-glow" x1="12" y1="10" x2="39" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#E8FBF4" />
              <stop offset="0.58" stopColor="#C8F7EA" />
              <stop offset="1" stopColor="#1FB893" />
            </linearGradient>
            <linearGradient id="nivora-mark-ring" x1="8" y1="10" x2="40" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1FB893" stopOpacity="0.15" />
              <stop offset="1" stopColor="#1FB893" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          <rect x="1.5" y="1.5" width="45" height="45" rx="14" fill="#081421" />
          <rect x="1.5" y="1.5" width="45" height="45" rx="14" stroke="url(#nivora-mark-ring)" strokeWidth="1" />
          <circle cx="24" cy="24" r="13.5" stroke="rgba(31,184,147,0.22)" strokeWidth="1" />
          <path
            d="M13.75 30.5V17.5h5.08l9.24 10.72V17.5h5.18v13h-5.1l-9.24-10.72V30.5h-5.16Z"
            fill="url(#nivora-mark-glow)"
          />
          <path
            d="M14 31.2C18.2 20.9 29.2 16 35.8 17.9"
            stroke="#1FB893"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="34.8" cy="18.3" r="1.8" fill="#1FB893" />
        </svg>
      </span>
      <span className="nivora-brand-wordmark">
        <span className="nivora-brand-name">Nivora</span>
        <span className="nivora-brand-subtitle">{subtitle}</span>
      </span>
    </div>
  );
}
