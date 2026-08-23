import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero' | 'custom';
  showSubtitle?: boolean;
  emblemOnly?: boolean;
  altText?: string;
  onClick?: () => void;
}

/**
 * High-definition Vector Logo for eKemaskini.
 * Accurately replicates the authentic ekemaskini.jpg design:
 * - Navy hexagon frame with top-right flame pass-through
 * - Blue looping 'e' in center with left tail swoop
 * - Dynamic fiery orange-to-gold flame swoosh arching top-right
 * - Full "eKemaskini - Portal Profil Pelanggan" typography
 */
export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showSubtitle = true,
  emblemOnly = false,
  altText = 'eKemaskini - Portal Profil Pelanggan',
  onClick,
}) => {
  // Height sizing classes based on requested scale
  const sizeClasses = {
    sm: emblemOnly ? 'h-7 w-7' : 'h-8 sm:h-9',
    md: emblemOnly ? 'h-9 w-9 sm:h-10 sm:w-10' : 'h-9 sm:h-10 md:h-11',
    lg: emblemOnly ? 'h-12 w-12 sm:h-14 sm:w-14' : 'h-11 sm:h-13 md:h-15 lg:h-16',
    xl: emblemOnly ? 'h-16 w-16 sm:h-20 sm:w-20' : 'h-16 sm:h-20 md:h-24',
    hero: emblemOnly ? 'h-20 w-20 sm:h-24 sm:w-24' : 'h-14 sm:h-16 md:h-20 lg:h-24',
    custom: '',
  }[size];

  if (emblemOnly) {
    return (
      <div 
        className={`inline-flex items-center justify-center select-none transition-all ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        title={altText}
      >
        <svg 
          viewBox="0 0 500 500" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className={`${sizeClasses} object-contain transition-transform duration-200`}
          aria-label={altText}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="emblemSwoosh" x1="10%" y1="70%" x2="90%" y2="20%">
              <stop offset="0%" stopColor="#1A5B9C" />
              <stop offset="35%" stopColor="#1E6CB8" />
              <stop offset="55%" stopColor="#D84315" />
              <stop offset="75%" stopColor="#E65100" />
              <stop offset="100%" stopColor="#FF9100" />
            </linearGradient>
            <linearGradient id="emblemFlameTop" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF9800" />
              <stop offset="100%" stopColor="#E65100" />
            </linearGradient>
            <linearGradient id="emblemBlueE" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2471A3" />
              <stop offset="100%" stopColor="#1A4A6E" />
            </linearGradient>
          </defs>

          {/* Hexagon frame */}
          <path 
            d="M 125 150 L 250 80 L 375 150" 
            fill="none" 
            stroke="#162E4F" 
            strokeWidth="36" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
          <path 
            d="M 425 240 L 425 350 L 250 450 L 125 350 L 125 150" 
            fill="none" 
            stroke="#162E4F" 
            strokeWidth="36" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />

          {/* Left Tail */}
          <path 
            d="M 75 245 C 75 300, 130 330, 200 310" 
            fill="none" 
            stroke="#1B5E99" 
            strokeWidth="28" 
            strokeLinecap="round" 
          />

          {/* Blue 'e' */}
          <path 
            d="M 245 175 C 190 175, 155 215, 155 270 C 155 325, 190 365, 245 365 C 285 365, 315 345, 330 315 L 290 295 C 282 310, 268 322, 245 322 C 218 322, 198 302, 195 275 L 335 275 C 336 270, 337 262, 337 255 C 337 210, 300 175, 245 175 Z M 195 245 C 198 220, 215 208, 243 208 C 270 208, 288 220, 292 245 L 195 245 Z" 
            fill="url(#emblemBlueE)" 
          />

          {/* Fiery Swoosh */}
          <path 
            d="M 175 305 C 210 360, 295 365, 355 305 C 395 265, 420 205, 440 135 C 410 160, 380 180, 345 190 C 375 210, 355 260, 310 285 C 265 310, 215 300, 175 305 Z" 
            fill="url(#emblemSwoosh)" 
          />

          {/* Top Flame Wing */}
          <path 
            d="M 345 115 C 375 115, 435 130, 465 175 C 460 140, 435 115, 395 105 C 375 100, 355 105, 345 115 Z" 
            fill="url(#emblemFlameTop)" 
          />
          <path 
            d="M 440 135 L 452 172 C 438 162, 418 160, 400 165 Z" 
            fill="#E65100" 
          />
        </svg>
      </div>
    );
  }

  return (
    <div 
      className={`inline-flex items-center select-none transition-all ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={altText}
    >
      <svg 
        viewBox="0 0 920 230" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={`w-auto max-w-full ${sizeClasses} object-contain transition-transform duration-200`}
        aria-label={altText}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Vibrant Gradient for Dynamic Orange Swoosh Arrow */}
          <linearGradient id="ekmSwooshGrad" x1="10%" y1="70%" x2="90%" y2="20%">
            <stop offset="0%" stopColor="#1A5B9C" />
            <stop offset="35%" stopColor="#1E6CB8" />
            <stop offset="55%" stopColor="#D84315" />
            <stop offset="75%" stopColor="#E65100" />
            <stop offset="100%" stopColor="#FF9100" />
          </linearGradient>
          
          <linearGradient id="ekmFlameTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF9800" />
            <stop offset="100%" stopColor="#E65100" />
          </linearGradient>

          <linearGradient id="ekmBlueEGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2471A3" />
            <stop offset="100%" stopColor="#1A4A6E" />
          </linearGradient>
        </defs>

        {/* 🔷 Left Hexagon Emblem (Matching ekemaskini.jpg exactly) */}
        <g id="ekemaskini-emblem" transform="translate(10, 10) scale(0.42)">
          {/* Hexagon Top Segments */}
          <path 
            d="M 125 150 L 250 80 L 375 150" 
            fill="none" 
            stroke="#162E4F" 
            strokeWidth="36" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />

          {/* Hexagon Bottom & Side Segments */}
          <path 
            d="M 425 240 L 425 350 L 250 450 L 125 350 L 125 150" 
            fill="none" 
            stroke="#162E4F" 
            strokeWidth="36" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />

          {/* Left Tail Swoop */}
          <path 
            d="M 75 245 C 75 300, 130 330, 200 310" 
            fill="none" 
            stroke="#1B5E99" 
            strokeWidth="28" 
            strokeLinecap="round" 
          />

          {/* Central Blue 'e' */}
          <path 
            d="M 245 175 C 190 175, 155 215, 155 270 C 155 325, 190 365, 245 365 C 285 365, 315 345, 330 315 L 290 295 C 282 310, 268 322, 245 322 C 218 322, 198 302, 195 275 L 335 275 C 336 270, 337 262, 337 255 C 337 210, 300 175, 245 175 Z M 195 245 C 198 220, 215 208, 243 208 C 270 208, 288 220, 292 245 L 195 245 Z" 
            fill="url(#ekmBlueEGrad)" 
          />

          {/* Dynamic Fiery Orange Swoosh */}
          <path 
            d="M 175 305 C 210 360, 295 365, 355 305 C 395 265, 420 205, 440 135 C 410 160, 380 180, 345 190 C 375 210, 355 260, 310 285 C 265 310, 215 300, 175 305 Z" 
            fill="url(#ekmSwooshGrad)" 
          />

          {/* Top Flame Wing */}
          <path 
            d="M 345 115 C 375 115, 435 130, 465 175 C 460 140, 435 115, 395 105 C 375 100, 355 105, 345 115 Z" 
            fill="url(#ekmFlameTopGrad)" 
          />
          <path 
            d="M 440 135 L 452 172 C 438 162, 418 160, 400 165 Z" 
            fill="#E65100" 
          />
        </g>

        {/* 🔶 Right Wordmark */}
        {/* Letter 'e' in bold vivid orange */}
        <text 
          x="228" 
          y="126" 
          fontFamily="'Plus Jakarta Sans', 'Outfit', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          fontSize="118" 
          fontWeight="900" 
          fill="#FF6E00" 
          letterSpacing="-1.5"
        >
          e
        </text>

        {/* Word 'Kemaskini' in dark navy */}
        <text 
          x="300" 
          y="126" 
          fontFamily="'Plus Jakarta Sans', 'Outfit', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          fontSize="118" 
          fontWeight="900" 
          fill="#162E4F" 
          letterSpacing="-2"
        >
          Kemaskini
        </text>

        {/* 📄 Subtitle: "- Portal Profil Pelanggan" */}
        {showSubtitle && (
          <text 
            x="228" 
            y="188" 
            fontFamily="'Plus Jakarta Sans', 'Outfit', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
            fontSize="42" 
            fontWeight="700" 
            fill="#162E4F" 
            letterSpacing="0.5"
          >
            - Portal Profil Pelanggan
          </text>
        )}
      </svg>
    </div>
  );
};
