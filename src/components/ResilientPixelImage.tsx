import React, { useState } from 'react';
import { PixelUiIcon } from './PixelIcons';

interface ResilientPixelImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const ResilientPixelImage: React.FC<ResilientPixelImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel,
}) => {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`bg-[#efe2c6] border-2 border-[#2b1d12] flex flex-col items-center justify-center text-[#23170e] p-2 select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <PixelUiIcon name="gps" className="w-6 h-6 mb-1" />
        {fallbackLabel && (
          <span className="text-xs font-display font-bold text-amber-900 text-center truncate max-w-full">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`pixelated object-cover ${className}`}
    />
  );
};
