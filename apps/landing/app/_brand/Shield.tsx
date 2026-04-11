import { BRAND_COLORS } from "./constants";

type ShieldProps = {
  size: number;
  strokeWidth: number;
};

/**
 * Canonical brand shield with scan lines and checkmark.
 * Used inside ImageResponse (opengraph-image, twitter-image, apple-icon).
 * Uses a 120x120 viewBox so callers control display size via the `size` prop.
 */
export function Shield({ size, strokeWidth }: ShieldProps): React.ReactElement {
  const color = BRAND_COLORS.teal;
  const lineWidth = strokeWidth - 1;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="AgentSec shield"
    >
      <path
        d="M 60 8 L 85 20 L 85 55 C 85 78 60 105 60 105 C 60 105 35 78 35 55 L 35 20 Z"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="45"
        y1="40"
        x2="75"
        y2="40"
        stroke={color}
        strokeWidth={lineWidth}
        strokeLinecap="round"
        opacity="0.9"
      />
      <line
        x1="42"
        y1="52"
        x2="78"
        y2="52"
        stroke={color}
        strokeWidth={lineWidth}
        strokeLinecap="round"
        opacity="0.7"
      />
      <line
        x1="45"
        y1="64"
        x2="75"
        y2="64"
        stroke={color}
        strokeWidth={lineWidth}
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M 50 60 L 57 68 L 70 48"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
