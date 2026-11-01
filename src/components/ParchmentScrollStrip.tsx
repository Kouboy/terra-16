import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PixelUiIcon } from './PixelIcons';

interface ParchmentScrollStripProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  fadeColorFrom?: 'vellum' | 'well' | 'spine';
  ariaLabel?: string;
}

/**
 * 16-Bit JRPG Horizontal Scroll Strip:
 * - Completely hides ugly native OS white/grey scrollbars (.no-scrollbar)
 * - Displays crisp 16-bit mahogany & brass pixel scroll buttons ONLY when content overflows
 * - Supports mouse wheel horizontal translation & touch inertia scrolling
 */
export const ParchmentScrollStrip: React.FC<ParchmentScrollStripProps> = ({
  children,
  className = '',
  innerClassName = 'gap-2',
  fadeColorFrom = 'well',
  ariaLabel,
}) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();

    const ro = new ResizeObserver(() => updateScrollState());
    ro.observe(el);
    window.addEventListener('resize', updateScrollState);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, children]);

  const nudgeScroll = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = Math.max(160, Math.round(el.clientWidth * 0.58));
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth + 2) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  };

  const leftGrad =
    fadeColorFrom === 'spine'
      ? 'from-[#28160d] via-[#28160d]/90 to-transparent'
      : fadeColorFrom === 'vellum'
      ? 'from-[#f8edd6] via-[#f8edd6]/90 to-transparent'
      : 'from-[#ecd8b1] via-[#ecd8b1]/90 to-transparent';

  const rightGrad =
    fadeColorFrom === 'spine'
      ? 'from-[#28160d] via-[#28160d]/90 to-transparent'
      : fadeColorFrom === 'vellum'
      ? 'from-[#f8edd6] via-[#f8edd6]/90 to-transparent'
      : 'from-[#ecd8b1] via-[#ecd8b1]/90 to-transparent';

  return (
    <div className={`relative flex items-center min-w-0 ${className}`} aria-label={ariaLabel}>
      {canScrollLeft && (
        <div
          className={`pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r ${leftGrad} z-10 flex items-center justify-start pl-0.5`}
        >
          <button
            type="button"
            onClick={() => nudgeScroll(-1)}
            aria-label="Faire défiler vers la gauche"
            className="pointer-events-auto w-7 h-7 flex items-center justify-center bg-[#28160d] text-amber-300 hover:bg-[#3f2416] hover:text-amber-200 border-2 border-[#d97706] shadow-sm transition-colors"
          >
            <PixelUiIcon name="arrow-left" className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div
        ref={scrollerRef}
        onScroll={updateScrollState}
        onWheel={handleWheel}
        className={`no-scrollbar overflow-x-auto flex items-center w-full min-w-0 scroll-smooth ${innerClassName}`}
      >
        {children}
      </div>

      {canScrollRight && (
        <div
          className={`pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l ${rightGrad} z-10 flex items-center justify-end pr-0.5`}
        >
          <button
            type="button"
            onClick={() => nudgeScroll(1)}
            aria-label="Faire défiler vers la droite"
            className="pointer-events-auto w-7 h-7 flex items-center justify-center bg-[#28160d] text-amber-300 hover:bg-[#3f2416] hover:text-amber-200 border-2 border-[#d97706] shadow-sm transition-colors"
          >
            <PixelUiIcon name="arrow-right" className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
