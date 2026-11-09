/**
 * Light-mode brand mark.
 *
 * Vector reconstruction of the supplied light-theme logo: the grey canvas is dropped
 * entirely, so the mark is transparent and scales to any density without a raster asset.
 */
export default function AuraMark({
  size = 36,
  className = "",
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="auraMarkBadge" x1="14" y1="6" x2="82" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F2FBFF" />
          <stop offset="0.55" stopColor="#E3F5FF" />
          <stop offset="1" stopColor="#CFEBFF" />
        </linearGradient>
        <linearGradient id="auraMarkPageBack" x1="24" y1="30" x2="52" y2="74" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5CC8F2" />
          <stop offset="1" stopColor="#1E9BD7" />
        </linearGradient>
        <linearGradient id="auraMarkPageMid" x1="26" y1="28" x2="56" y2="74" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7DD8F5" />
          <stop offset="1" stopColor="#2BAEDF" />
        </linearGradient>
        <linearGradient id="auraMarkFold" x1="58" y1="22" x2="74" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3FCBF3" />
          <stop offset="1" stopColor="#14A8E0" />
        </linearGradient>
        <filter id="auraMarkShadow" x="8" y="16" width="80" height="76" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="3" stdDeviation="3.2" floodColor="#0B4A6F" floodOpacity="0.18" />
        </filter>
      </defs>

      <rect x="4" y="4" width="88" height="88" rx="24" fill="url(#auraMarkBadge)" />
      <rect x="4" y="4" width="88" height="88" rx="24" stroke="#BFE3F7" strokeWidth="1.2" />

      {/* Scaled up about the badge centre: the reference has the page filling roughly
          two thirds of the tile, which is what keeps it legible at 32-36px. */}
      <g filter="url(#auraMarkShadow)" transform="translate(48 48) scale(1.3) translate(-48 -48)">
        <rect x="22" y="30" width="42" height="46" rx="6" transform="rotate(-9 22 30)" fill="url(#auraMarkPageBack)" opacity="0.95" />
        <rect x="24" y="27" width="42" height="47" rx="6" transform="rotate(-4 24 27)" fill="url(#auraMarkPageMid)" opacity="0.95" />
        <path
          d="M34 46.5a5 5 0 0 1 5-5h22.5l9.5 9.5V71a5 5 0 0 1-5 5H39a5 5 0 0 1-5-5V46.5Z"
          fill="#FFFFFF"
        />
        <path d="M61.5 41.5v8.2a3.3 3.3 0 0 0 3.3 3.3h6.2l-9.5-11.5Z" fill="url(#auraMarkFold)" />
        <rect x="44" y="52.5" width="20" height="5.4" rx="2.7" fill="#2A3A56" />
        <rect x="44" y="62" width="14.6" height="5.4" rx="2.7" fill="#22C3F0" />
        <path d="M44 72.6h5.6V78a1.4 1.4 0 0 1-1.4 1.4h-2.8A1.4 1.4 0 0 1 44 78v-5.4Z" fill="#2A3A56" />
        <rect x="45.4" y="72.6" width="5.6" height="5.4" rx="0" fill="#B9C4D4" />
      </g>
    </svg>
  )
}
