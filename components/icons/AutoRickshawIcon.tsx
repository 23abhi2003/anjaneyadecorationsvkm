import React from "react";

interface AutoRickshawIconProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Indian Three-Wheeler Auto Rickshaw Icon (Bajaj / Mahindra passenger auto)
 */
export default function AutoRickshawIcon({
  size = 20,
  className = "",
  style,
}: AutoRickshawIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {/* Canopy / Roof */}
      <path d="M4 6.5C4 5.12 5.12 4 6.5 4h9C17 4 18.5 5 19 6.5l2 4.5v3.5a1 1 0 0 1-1 1h-1" />
      {/* Front Windshield */}
      <path d="M15 4.5l2.2 4.5H13" />
      {/* Cabin Body & Passenger Door Open Cutout */}
      <path d="M4 6.5v8a1 1 0 0 0 1 1h2" />
      <path d="M7 9h4v6" />
      <path d="M13 14.5v-5h4" />
      {/* Front Fork / Wheel (single front wheel) */}
      <circle cx="18" cy="18" r="2.5" />
      <path d="M18 14.5v1" />
      {/* Rear Wheel */}
      <circle cx="7" cy="18" r="2.5" />
      {/* Chassis connecting line */}
      <path d="M9.5 18h6" />
      {/* Front Headlight beam accent */}
      <path d="M21.5 12h.5" />
    </svg>
  );
}
