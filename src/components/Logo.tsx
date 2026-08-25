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
 * Official eKemaskini Logo component matching GG.jpg.
 * Pure vector SVG with transparent background and crisp responsive rendering across all screen sizes.
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
          viewBox="0 0 210 210" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className={`${sizeClasses} object-contain transition-transform duration-200`}
          aria-label={altText}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="ggEmblemSwoosh" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#D84315" />
              <stop offset="30%" stopColor="#F4511E" />
              <stop offset="65%" stopColor="#FF6D00" />
              <stop offset="100%" stopColor="#FFA000" />
            </linearGradient>
            <linearGradient id="ggEmblemWing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFA726" />
              <stop offset="100%" stopColor="#E65100" />
            </linearGradient>
          </defs>

          {/* Hexagon Frame */}
          <path 
            d="M 96 18 L 174 62 L 174 152 L 96 196 L 18 152 L 18 62 Z" 
            fill="none" 
            stroke="#0E2A54" 
            strokeWidth="16" 
            strokeLinejoin="round" 
            strokeLinecap="round"
          />

          {/* Bottom-left Loop */}
          <path 
            d="M 8 116 C 6 138, 24 156, 52 146 C 76 138, 92 122, 102 104" 
            fill="none" 
            stroke="#0E2A54" 
            strokeWidth="13" 
            strokeLinecap="round" 
          />

          {/* Inner Navy 'e' */}
          <path 
            d="M 96 68 C 75 68, 60 82, 60 102 C 60 122, 75 136, 96 136 C 112 136, 124 128, 129 116 L 113 108 C 110 114, 104 118, 96 118 C 85 118, 77 110, 76 99 L 131 99 C 131.5 97, 132 94, 132 91 C 132 78, 118 68, 96 68 Z M 76 88 C 79 79, 86 75, 96 75 C 105 75, 112 79, 114 88 L 76 88 Z" 
            fill="#0E2A54"
          />

          {/* Dynamic Orange Arrow Swoosh */}
          <path 
            d="M 28 126 C 42 152, 88 158, 124 130 C 154 106, 172 66, 186 26 C 172 38, 156 46, 142 48 C 156 58, 144 86, 120 102 C 92 120, 60 114, 42 98 Z" 
            fill="url(#ggEmblemSwoosh)" 
          />
          <path 
            d="M 186 26 L 191 52 C 182 46, 170 45, 158 48 Z" 
            fill="url(#ggEmblemSwoosh)" 
          />
          <path 
            d="M 186 26 L 158 48 C 166 42, 176 36, 186 26 Z" 
            fill="#BF360C" 
            opacity="0.8"
          />
          <path 
            d="M 148 38 C 160 38, 180 44, 192 60 C 190 48, 180 38, 166 34 Z" 
            fill="url(#ggEmblemWing)" 
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
        viewBox="0 0 940 230" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={`w-auto max-w-full ${sizeClasses} object-contain transition-transform duration-200`}
        aria-label={altText}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="ggOrangeGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D84315" />
            <stop offset="30%" stopColor="#F4511E" />
            <stop offset="65%" stopColor="#FF6D00" />
            <stop offset="100%" stopColor="#FFA000" />
          </linearGradient>

          <linearGradient id="ggTopWingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFA726" />
            <stop offset="100%" stopColor="#E65100" />
          </linearGradient>
        </defs>

        {/* 🔷 Left Hexagon Emblem */}
        <g id="emblem-gg" transform="translate(10, 8)">
          <path 
            d="M 96 18 L 174 62 L 174 152 L 96 196 L 18 152 L 18 62 Z" 
            fill="none" 
            stroke="#0E2A54" 
            strokeWidth="16" 
            strokeLinejoin="round" 
            strokeLinecap="round"
          />

          <path 
            d="M 8 116 C 6 138, 24 156, 52 146 C 76 138, 92 122, 102 104" 
            fill="none" 
            stroke="#0E2A54" 
            strokeWidth="13" 
            strokeLinecap="round" 
          />

          <path 
            d="M 96 68 C 75 68, 60 82, 60 102 C 60 122, 75 136, 96 136 C 112 136, 124 128, 129 116 L 113 108 C 110 114, 104 118, 96 118 C 85 118, 77 110, 76 99 L 131 99 C 131.5 97, 132 94, 132 91 C 132 78, 118 68, 96 68 Z M 76 88 C 79 79, 86 75, 96 75 C 105 75, 112 79, 114 88 L 76 88 Z" 
            fill="#0E2A54"
          />

          <path 
            d="M 28 126 C 42 152, 88 158, 124 130 C 154 106, 172 66, 186 26 C 172 38, 156 46, 142 48 C 156 58, 144 86, 120 102 C 92 120, 60 114, 42 98 Z" 
            fill="url(#ggOrangeGrad)" 
          />
          
          <path 
            d="M 186 26 L 191 52 C 182 46, 170 45, 158 48 Z" 
            fill="url(#ggOrangeGrad)" 
          />
          <path 
            d="M 186 26 L 158 48 C 166 42, 176 36, 186 26 Z" 
            fill="#BF360C" 
            opacity="0.8"
          />
          <path 
            d="M 148 38 C 160 38, 180 44, 192 60 C 190 48, 180 38, 166 34 Z" 
            fill="url(#ggTopWingGrad)" 
          />
        </g>

        {/* 🔶 Right Wordmark */}
        {/* Letter 'e' in bold vivid orange */}
        <text 
          x="235" 
          y="126" 
          fontFamily="'Plus Jakarta Sans', 'Outfit', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          fontSize="118" 
          fontWeight="900" 
          fill="#FF6D00" 
          letterSpacing="-1"
        >
          e
        </text>

        {/* Word 'Kemaskini' in dark navy */}
        <text 
          x="308" 
          y="126" 
          fontFamily="'Plus Jakarta Sans', 'Outfit', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          fontSize="118" 
          fontWeight="900" 
          fill="#0E2A54" 
          letterSpacing="-1.8"
        >
          Kemaskini
        </text>

        {/* 📄 Subtitle: "- Portal Profil Pelanggan" */}
        {showSubtitle && (
          <text 
            x="235" 
            y="188" 
            fontFamily="'Plus Jakarta Sans', 'Outfit', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
            fontSize="43" 
            fontWeight="700" 
            fill="#0E2A54" 
            letterSpacing="0.5"
          >
            - Portal Profil Pelanggan
          </text>
        )}
      </svg>
    </div>
  );
};
