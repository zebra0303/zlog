import { cn } from "../lib/cn";

interface DefaultAvatarProps { size?: number; className?: string; }

export function DefaultAvatar({ size = 64, className }: DefaultAvatarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn("shrink-0 rounded-full", className)} aria-label="기본 아바타">
      <defs>
        <linearGradient id="avatarBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#E8E5FF" /><stop offset="100%" stopColor="#D4D0FB" /></linearGradient>
        <clipPath id="circleClip"><circle cx="128" cy="128" r="128" /></clipPath>
      </defs>
      <g clipPath="url(#circleClip)">
        <circle cx="128" cy="128" r="128" fill="url(#avatarBg)" />
        <ellipse cx="128" cy="150" rx="65" ry="75" fill="white" />
        <ellipse cx="85" cy="70" rx="18" ry="25" fill="white" transform="rotate(-15 85 70)" />
        <ellipse cx="85" cy="70" rx="11" ry="18" fill="#FFB6C1" transform="rotate(-15 85 70)" />
        <ellipse cx="171" cy="70" rx="18" ry="25" fill="white" transform="rotate(15 171 70)" />
        <ellipse cx="171" cy="70" rx="11" ry="18" fill="#FFB6C1" transform="rotate(15 171 70)" />
        <circle cx="106" cy="130" r="12" fill="#333" /><circle cx="150" cy="130" r="12" fill="#333" />
        <circle cx="110" cy="126" r="4" fill="white" /><circle cx="154" cy="126" r="4" fill="white" />
        <ellipse cx="128" cy="168" rx="15" ry="10" fill="#333" />
        <path d="M112 180 Q128 194 144 180" stroke="#333" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
