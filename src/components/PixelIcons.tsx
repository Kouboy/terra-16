import React from 'react';
import { ExplorationCategory, HistoricalStratum } from '../types';

interface IconBaseProps {
  className?: string;
}

/**
 * Crisp 16x16 pixel-art guild pictograms rendered with shapeRendering="crispEdges"
 */
export const PixelGuildIcon: React.FC<{ category: ExplorationCategory; className?: string }> = ({
  category,
  className = 'w-4 h-4',
}) => {
  switch (category) {
    case 'histoire':
      // 16-bit Golden Castle Tower / Battlements
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="2" width="2" height="3" fill="#fde047" />
          <rect x="7" y="2" width="2" height="3" fill="#fde047" />
          <rect x="12" y="2" width="2" height="3" fill="#fde047" />
          <rect x="2" y="4" width="12" height="3" fill="#fbbf24" />
          <rect x="3" y="7" width="10" height="7" fill="#d97706" />
          <rect x="4" y="7" width="3" height="6" fill="#fbbf24" />
          <rect x="6" y="10" width="4" height="4" fill="#451a03" />
          <rect x="7" y="8" width="2" height="1" fill="#fef3c7" />
          <rect x="2" y="14" width="12" height="1" fill="#78350f" />
        </svg>
      );
    case 'geographie':
      // 16-bit Cyan Crystal Geode & River Wave
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="7" y="1" width="2" height="2" fill="#e0f2fe" />
          <rect x="6" y="3" width="4" height="3" fill="#7dd3fc" />
          <rect x="5" y="6" width="6" height="4" fill="#38bdf8" />
          <rect x="3" y="5" width="2" height="5" fill="#0284c7" />
          <rect x="11" y="5" width="2" height="5" fill="#0284c7" />
          <rect x="6" y="4" width="1" height="4" fill="#ffffff" />
          <rect x="1" y="11" width="14" height="2" fill="#0ea5e9" />
          <rect x="2" y="11" width="3" height="1" fill="#e0f2fe" />
          <rect x="9" y="11" width="3" height="1" fill="#e0f2fe" />
          <rect x="1" y="13" width="14" height="2" fill="#1d4ed8" />
        </svg>
      );
    case 'legende':
      // 16-bit Mystic Violet Rune Menhir & Will-o'-the-Wisp
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="6" y="2" width="4" height="2" fill="#d8b4fe" />
          <rect x="5" y="4" width="6" height="9" fill="#9333ea" />
          <rect x="6" y="4" width="2" height="8" fill="#c084fc" />
          <rect x="7" y="6" width="2" height="1" fill="#fef08a" />
          <rect x="6" y="8" width="4" height="1" fill="#fef08a" />
          <rect x="7" y="10" width="2" height="1" fill="#fef08a" />
          <rect x="2" y="4" width="2" height="2" fill="#f0abfc" />
          <rect x="12" y="6" width="2" height="2" fill="#fde047" />
          <rect x="3" y="13" width="10" height="2" fill="#581c87" />
        </svg>
      );
    case 'etrange':
      // 16-bit Crimson Flaming Dungeon Torch / Cavern Arch
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="7" y="1" width="2" height="2" fill="#fef08a" />
          <rect x="6" y="3" width="4" height="2" fill="#fb923c" />
          <rect x="5" y="5" width="6" height="3" fill="#f43f5e" />
          <rect x="7" y="4" width="2" height="3" fill="#fde047" />
          <rect x="6" y="8" width="4" height="1" fill="#78716c" />
          <rect x="7" y="9" width="2" height="6" fill="#92400e" />
          <rect x="7" y="9" width="1" height="5" fill="#b45309" />
        </svg>
      );
    case 'ecosysteme':
      // 16-bit Emerald Sprouting Leaf & Berry
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="8" y="2" width="5" height="2" fill="#86efac" />
          <rect x="6" y="4" width="7" height="3" fill="#34d399" />
          <rect x="4" y="6" width="7" height="4" fill="#10b981" />
          <rect x="3" y="8" width="6" height="3" fill="#059669" />
          <rect x="7" y="5" width="4" height="1" fill="#dcfce7" />
          <rect x="6" y="11" width="2" height="3" fill="#78350f" />
          <rect x="11" y="10" width="2" height="2" fill="#fbbf24" />
        </svg>
      );
  }
};

/**
 * Crisp 16x16 pixel-art historical stratum pictograms
 */
export const PixelStratumIcon: React.FC<{ stratum: HistoricalStratum; className?: string }> = ({
  stratum,
  className = 'w-3.5 h-3.5',
}) => {
  switch (stratum) {
    case 'temps_profond':
      // Ammonite spiral fossil
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="5" y="2" width="6" height="2" fill="#7dd3fc" />
          <rect x="3" y="4" width="10" height="8" fill="#38bdf8" />
          <rect x="5" y="12" width="6" height="2" fill="#0284c7" />
          <rect x="6" y="5" width="4" height="1" fill="#0c4a6e" />
          <rect x="9" y="6" width="1" height="4" fill="#0c4a6e" />
          <rect x="6" y="9" width="3" height="1" fill="#0c4a6e" />
          <rect x="6" y="7" width="1" height="2" fill="#0c4a6e" />
          <rect x="7" y="7" width="2" height="1" fill="#e0f2fe" />
        </svg>
      );
    case 'prehistoire':
      // Megalithic Dolmen
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="4" width="12" height="3" fill="#d6d3d1" />
          <rect x="3" y="3" width="10" height="1" fill="#f5f5f4" />
          <rect x="3" y="7" width="3" height="6" fill="#a8a29e" />
          <rect x="10" y="7" width="3" height="6" fill="#78716c" />
          <rect x="1" y="13" width="14" height="1" fill="#4ade80" />
        </svg>
      );
    case 'antiquite':
      // Classical Column
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="3" y="2" width="10" height="2" fill="#fef3c7" />
          <rect x="2" y="4" width="2" height="2" fill="#fde68a" />
          <rect x="12" y="4" width="2" height="2" fill="#fde68a" />
          <rect x="5" y="4" width="6" height="8" fill="#fcd34d" />
          <rect x="7" y="4" width="1" height="8" fill="#d97706" />
          <rect x="9" y="4" width="1" height="8" fill="#d97706" />
          <rect x="3" y="12" width="10" height="2" fill="#f59e0b" />
        </svg>
      );
    case 'moyen_age':
      // Knight Sword
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="7" y="1" width="2" height="9" fill="#e2e8f0" />
          <rect x="7" y="2" width="1" height="7" fill="#ffffff" />
          <rect x="4" y="10" width="8" height="2" fill="#fbbf24" />
          <rect x="7" y="12" width="2" height="2" fill="#92400e" />
          <rect x="6" y="14" width="4" height="1" fill="#fbbf24" />
        </svg>
      );
    case 'moderne':
      // Sun / Compass Rose
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="7" y="1" width="2" height="3" fill="#fde047" />
          <rect x="7" y="12" width="2" height="3" fill="#fde047" />
          <rect x="1" y="7" width="3" height="2" fill="#fde047" />
          <rect x="12" y="7" width="3" height="2" fill="#fde047" />
          <rect x="5" y="5" width="6" height="6" fill="#f59e0b" />
          <rect x="6" y="6" width="4" height="4" fill="#fef08a" />
        </svg>
      );
    case 'contemporain':
      // Industrial Iron Gear
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="6" y="2" width="4" height="2" fill="#cbd5e1" />
          <rect x="6" y="12" width="4" height="2" fill="#64748b" />
          <rect x="2" y="6" width="2" height="4" fill="#94a3b8" />
          <rect x="12" y="6" width="2" height="4" fill="#94a3b8" />
          <rect x="4" y="4" width="8" height="8" fill="#94a3b8" />
          <rect x="6" y="6" width="4" height="4" fill="#1a1529" />
        </svg>
      );
    case 'vivant_folklore':
      // Red Spotted Mushroom
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="4" y="3" width="8" height="2" fill="#ef4444" />
          <rect x="2" y="5" width="12" height="4" fill="#dc2626" />
          <rect x="5" y="4" width="2" height="2" fill="#ffffff" />
          <rect x="10" y="6" width="2" height="2" fill="#ffffff" />
          <rect x="6" y="9" width="4" height="5" fill="#fef3c7" />
        </svg>
      );
  }
};

export type UiPixelIconName =
  | 'map'
  | 'book'
  | 'scroll'
  | 'shield'
  | 'gps'
  | 'boot'
  | 'radar'
  | 'camera'
  | 'quill'
  | 'sound-on'
  | 'sound-off'
  | 'search'
  | 'warning'
  | 'water'
  | 'bedrock'
  | 'cursor'
  | 'arrow-up'
  | 'arrow-down'
  | 'arrow-left'
  | 'arrow-right'
  | 'star'
  | 'trash'
  | 'link'
  | 'lantern'
  | 'sun-cloud'
  | 'moon-stars'
  | 'archive'
  | 'mountain'
  | 'fullscreen-enter'
  | 'fullscreen-exit'
  | 'sliders'
  | 'close'
  | 'install'
  | 'rain'
  | 'snow'
  | 'cairn'
  | 'stamp'
  | 'backpack'
  | 'constellation'
  | 'pocket-compass'
  | 'ui-fold'
  | 'ui-unfold'
  | 'dpad'
  | 'chevron-up'
  | 'chevron-down'
  | 'sidebar-toggle'
  | 'user-profile'
  | 'hat'
  | 'relic'
  | 'dungeon'
  | 'paw'
  | 'rumor'
  | 'ambience-on'
  | 'ambience-off'
  | 'leaf'
  | 'mineral'
  | 'postcard'
  | 'chest'
  | 'capsule'
  | 'trophy'
  | 'screen-awake'
  | 'haptic';

export const PixelUiIcon: React.FC<{ name: UiPixelIconName; className?: string }> = ({
  name,
  className = 'w-4 h-4',
}) => {
  switch (name) {
    case 'map':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="1" y="2" width="14" height="12" fill="#2b1d12" />
          <rect x="2" y="3" width="4" height="10" fill="#fde68a" />
          <rect x="6" y="4" width="4" height="9" fill="#d97706" />
          <rect x="10" y="3" width="4" height="10" fill="#fcd34d" />
          <rect x="3" y="5" width="2" height="3" fill="#22c55e" />
          <rect x="7" y="7" width="2" height="3" fill="#38bdf8" />
          <rect x="11" y="6" width="2" height="2" fill="#e11d48" />
        </svg>
      );
    case 'book':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="1" width="12" height="14" fill="#2b1d12" />
          <rect x="3" y="2" width="10" height="12" fill="#991b1b" />
          <rect x="4" y="3" width="8" height="9" fill="#fef3c7" />
          <rect x="5" y="4" width="6" height="6" fill="#dc2626" />
          <rect x="7" y="5" width="2" height="4" fill="#fde047" />
          <rect x="9" y="12" width="2" height="3" fill="#fbbf24" />
        </svg>
      );
    case 'scroll':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="2" width="12" height="3" fill="#b45309" />
          <rect x="3" y="2" width="10" height="2" fill="#fbbf24" />
          <rect x="4" y="4" width="8" height="8" fill="#fef3c7" />
          <rect x="2" y="12" width="12" height="2" fill="#92400e" />
          <rect x="3" y="12" width="10" height="1" fill="#f59e0b" />
          <rect x="5" y="6" width="5" height="1" fill="#78350f" />
          <rect x="5" y="8" width="4" height="1" fill="#78350f" />
          <rect x="9" y="9" width="2" height="2" fill="#e11d48" />
        </svg>
      );
    case 'shield':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="1" width="12" height="8" fill="#2b1d12" />
          <rect x="3" y="2" width="10" height="6" fill="#fbbf24" />
          <rect x="4" y="8" width="8" height="3" fill="#d97706" />
          <rect x="6" y="11" width="4" height="3" fill="#b45309" />
          <rect x="5" y="4" width="6" height="4" fill="#b91c1c" />
          <rect x="7" y="3" width="2" height="7" fill="#fef3c7" />
        </svg>
      );
    case 'gps':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="5" y="2" width="6" height="12" fill="#451a03" />
          <rect x="2" y="5" width="12" height="6" fill="#451a03" />
          <rect x="3" y="3" width="10" height="10" fill="#d97706" />
          <rect x="4" y="4" width="8" height="8" fill="#fef3c7" />
          <rect x="7" y="4" width="2" height="4" fill="#dc2626" />
          <rect x="7" y="8" width="2" height="4" fill="#0284c7" />
        </svg>
      );
    case 'boot':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="4" y="3" width="5" height="6" fill="#b45309" />
          <rect x="4" y="2" width="5" height="2" fill="#fde68a" />
          <rect x="4" y="9" width="9" height="3" fill="#92400e" />
          <rect x="3" y="12" width="10" height="2" fill="#451a03" />
        </svg>
      );
    case 'radar':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="7" y="1" width="2" height="3" fill="#fbbf24" />
          <rect x="7" y="12" width="2" height="3" fill="#fbbf24" />
          <rect x="1" y="7" width="3" height="2" fill="#fbbf24" />
          <rect x="12" y="7" width="3" height="2" fill="#fbbf24" />
          <rect x="5" y="5" width="6" height="6" fill="#e11d48" />
          <rect x="7" y="7" width="2" height="2" fill="#ffffff" />
        </svg>
      );
    case 'camera':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="5" y="3" width="6" height="2" fill="#78350f" />
          <rect x="2" y="5" width="12" height="8" fill="#451a03" />
          <rect x="3" y="6" width="10" height="6" fill="#92400e" />
          <rect x="6" y="7" width="4" height="4" fill="#38bdf8" />
          <rect x="7" y="8" width="2" height="2" fill="#e0f2fe" />
          <rect x="11" y="6" width="2" height="1" fill="#fde047" />
        </svg>
      );
    case 'quill':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="9" y="1" width="5" height="4" fill="#991b1b" />
          <rect x="10" y="2" width="3" height="2" fill="#ef4444" />
          <rect x="7" y="4" width="5" height="4" fill="#dc2626" />
          <rect x="5" y="7" width="4" height="3" fill="#b91c1c" />
          <rect x="4" y="10" width="2" height="2" fill="#d97706" />
          <rect x="2" y="12" width="2" height="2" fill="#2b1d12" />
        </svg>
      );
    case 'sound-on':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="6" y="2" width="7" height="2" fill="#d97706" />
          <rect x="6" y="4" width="2" height="7" fill="#d97706" />
          <rect x="11" y="4" width="2" height="6" fill="#b45309" />
          <rect x="3" y="10" width="5" height="3" fill="#f59e0b" />
          <rect x="9" y="9" width="4" height="3" fill="#d97706" />
        </svg>
      );
    case 'sound-off':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="6" y="2" width="6" height="2" fill="#78716c" />
          <rect x="6" y="4" width="2" height="7" fill="#78716c" />
          <rect x="3" y="10" width="5" height="3" fill="#a8a29e" />
          <rect x="10" y="9" width="2" height="2" fill="#dc2626" />
          <rect x="12" y="7" width="2" height="2" fill="#dc2626" />
          <rect x="12" y="11" width="2" height="2" fill="#dc2626" />
        </svg>
      );
    case 'search':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="4" y="2" width="6" height="2" fill="#fde68a" />
          <rect x="2" y="4" width="2" height="6" fill="#fde68a" />
          <rect x="10" y="4" width="2" height="6" fill="#d97706" />
          <rect x="4" y="10" width="6" height="2" fill="#d97706" />
          <rect x="4" y="4" width="6" height="6" fill="#7dd3fc" />
          <rect x="10" y="10" width="2" height="2" fill="#fbbf24" />
          <rect x="12" y="12" width="2" height="2" fill="#92400e" />
        </svg>
      );
    case 'warning':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="7" y="2" width="2" height="2" fill="#dc2626" />
          <rect x="5" y="4" width="6" height="4" fill="#ef4444" />
          <rect x="3" y="8" width="10" height="5" fill="#dc2626" />
          <rect x="7" y="5" width="2" height="4" fill="#ffffff" />
          <rect x="7" y="10" width="2" height="2" fill="#fde047" />
        </svg>
      );
    case 'water':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="7" y="2" width="2" height="3" fill="#7dd3fc" />
          <rect x="5" y="5" width="6" height="4" fill="#38bdf8" />
          <rect x="4" y="9" width="8" height="4" fill="#0284c7" />
          <rect x="6" y="7" width="1" height="3" fill="#e0f2fe" />
        </svg>
      );
    case 'bedrock':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="1" y="4" width="14" height="3" fill="#a8a29e" />
          <rect x="1" y="7" width="14" height="3" fill="#d97706" />
          <rect x="1" y="10" width="14" height="4" fill="#57534e" />
          <rect x="4" y="8" width="2" height="1" fill="#fde047" />
          <rect x="10" y="11" width="3" height="1" fill="#38bdf8" />
        </svg>
      );
    case 'cursor':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="1" width="3" height="14" fill="#2b1d12" />
          <rect x="5" y="3" width="3" height="10" fill="#2b1d12" />
          <rect x="8" y="5" width="3" height="6" fill="#2b1d12" />
          <rect x="11" y="6" width="3" height="4" fill="#2b1d12" />
          <rect x="3" y="2" width="2" height="12" fill="#b91c1c" />
          <rect x="5" y="4" width="3" height="8" fill="#ef4444" />
          <rect x="8" y="6" width="3" height="4" fill="#fbbf24" />
          <rect x="11" y="7" width="2" height="2" fill="#fde047" />
        </svg>
      );
    case 'arrow-up':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="7" y="3" width="2" height="2" fill="currentColor" />
          <rect x="5" y="5" width="6" height="2" fill="currentColor" />
          <rect x="3" y="7" width="10" height="2" fill="currentColor" />
          <rect x="6" y="9" width="4" height="4" fill="currentColor" />
        </svg>
      );
    case 'arrow-down':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="6" y="3" width="4" height="4" fill="currentColor" />
          <rect x="3" y="7" width="10" height="2" fill="currentColor" />
          <rect x="5" y="9" width="6" height="2" fill="currentColor" />
          <rect x="7" y="11" width="2" height="2" fill="currentColor" />
        </svg>
      );
    case 'arrow-left':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="3" y="7" width="2" height="2" fill="currentColor" />
          <rect x="5" y="5" width="2" height="6" fill="currentColor" />
          <rect x="7" y="3" width="2" height="10" fill="currentColor" />
          <rect x="9" y="6" width="4" height="4" fill="currentColor" />
        </svg>
      );
    case 'arrow-right':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="3" y="6" width="4" height="4" fill="currentColor" />
          <rect x="7" y="3" width="2" height="10" fill="currentColor" />
          <rect x="9" y="5" width="2" height="6" fill="currentColor" />
          <rect x="11" y="7" width="2" height="2" fill="currentColor" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="7" y="1" width="2" height="3" fill="#fef08a" />
          <rect x="2" y="5" width="12" height="3" fill="#fbbf24" />
          <rect x="4" y="8" width="8" height="3" fill="#f59e0b" />
          <rect x="3" y="11" width="3" height="3" fill="#d97706" />
          <rect x="10" y="11" width="3" height="3" fill="#d97706" />
          <rect x="6" y="5" width="4" height="3" fill="#ffffff" />
        </svg>
      );
    case 'trash':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="5" y="2" width="6" height="2" fill="currentColor" />
          <rect x="3" y="4" width="10" height="2" fill="currentColor" />
          <rect x="4" y="6" width="8" height="8" fill="currentColor" />
        </svg>
      );
    case 'link':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="9" y="2" width="5" height="2" fill="currentColor" />
          <rect x="12" y="4" width="2" height="5" fill="currentColor" />
          <rect x="9" y="5" width="3" height="2" fill="currentColor" />
          <rect x="7" y="7" width="2" height="2" fill="currentColor" />
          <rect x="2" y="6" width="4" height="2" fill="currentColor" />
          <rect x="2" y="8" width="2" height="6" fill="currentColor" />
          <rect x="4" y="12" width="6" height="2" fill="currentColor" />
          <rect x="8" y="10" width="2" height="2" fill="currentColor" />
        </svg>
      );
    case 'lantern':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="6" y="1" width="4" height="2" fill="#92400e" />
          <rect x="4" y="3" width="8" height="2" fill="#451a03" />
          <rect x="4" y="5" width="8" height="7" fill="#fbbf24" />
          <rect x="6" y="6" width="4" height="5" fill="#fef9c3" />
          <rect x="7" y="7" width="2" height="3" fill="#ffffff" />
          <rect x="4" y="5" width="1" height="7" fill="#78350f" />
          <rect x="11" y="5" width="1" height="7" fill="#78350f" />
          <rect x="3" y="12" width="10" height="2" fill="#451a03" />
        </svg>
      );
    case 'sun-cloud':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="3" y="2" width="6" height="6" fill="#f59e0b" />
          <rect x="4" y="3" width="4" height="4" fill="#fde047" />
          <rect x="5" y="1" width="2" height="1" fill="#fde047" />
          <rect x="1" y="4" width="2" height="2" fill="#fde047" />
          <rect x="6" y="7" width="7" height="2" fill="#ffffff" />
          <rect x="4" y="9" width="11" height="3" fill="#fffbeb" />
          <rect x="4" y="12" width="11" height="1" fill="#d6d3d1" />
        </svg>
      );
    case 'moon-stars':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="5" y="2" width="5" height="2" fill="#fde047" />
          <rect x="3" y="4" width="4" height="7" fill="#fbbf24" />
          <rect x="5" y="11" width="6" height="2" fill="#f59e0b" />
          <rect x="4" y="5" width="2" height="5" fill="#fef9c3" />
          <rect x="11" y="3" width="2" height="2" fill="#fef08a" />
          <rect x="13" y="8" width="2" height="2" fill="#ffffff" />
        </svg>
      );
    case 'archive':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="3" width="3" height="11" fill="#991b1b" />
          <rect x="5" y="2" width="4" height="12" fill="#b45309" />
          <rect x="9" y="4" width="3" height="10" fill="#1e40af" />
          <rect x="12" y="3" width="2" height="11" fill="#065f46" />
          <rect x="3" y="5" width="1" height="2" fill="#fde047" />
          <rect x="6" y="4" width="2" height="2" fill="#fde68a" />
          <rect x="10" y="6" width="1" height="2" fill="#bae6fd" />
          <rect x="1" y="14" width="14" height="1" fill="#451a03" />
        </svg>
      );
    case 'mountain':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="6" y="2" width="2" height="2" fill="#fef3c7" />
          <rect x="5" y="4" width="4" height="2" fill="#fde68a" />
          <rect x="4" y="6" width="6" height="3" fill="#b45309" />
          <rect x="4" y="6" width="3" height="3" fill="#d97706" />
          <rect x="10" y="5" width="2" height="2" fill="#fef3c7" />
          <rect x="9" y="7" width="4" height="3" fill="#92400e" />
          <rect x="2" y="9" width="12" height="3" fill="#78350f" />
          <rect x="2" y="9" width="7" height="1" fill="#4ade80" />
          <rect x="9" y="10" width="5" height="1" fill="#22c55e" />
          <rect x="1" y="12" width="14" height="2" fill="#451a03" />
        </svg>
      );
    case 'fullscreen-enter':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="1" y="1" width="5" height="2" fill="currentColor" />
          <rect x="1" y="3" width="2" height="3" fill="currentColor" />
          <rect x="10" y="1" width="5" height="2" fill="currentColor" />
          <rect x="13" y="3" width="2" height="3" fill="currentColor" />
          <rect x="1" y="10" width="2" height="3" fill="currentColor" />
          <rect x="1" y="13" width="5" height="2" fill="currentColor" />
          <rect x="13" y="10" width="2" height="3" fill="currentColor" />
          <rect x="10" y="13" width="5" height="2" fill="currentColor" />
          <rect x="6" y="6" width="4" height="4" fill="#d97706" />
        </svg>
      );
    case 'fullscreen-exit':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="4" y="1" width="2" height="5" fill="currentColor" />
          <rect x="1" y="4" width="5" height="2" fill="currentColor" />
          <rect x="10" y="1" width="2" height="5" fill="currentColor" />
          <rect x="10" y="4" width="5" height="2" fill="currentColor" />
          <rect x="4" y="10" width="2" height="5" fill="currentColor" />
          <rect x="1" y="10" width="5" height="2" fill="currentColor" />
          <rect x="10" y="10" width="2" height="5" fill="currentColor" />
          <rect x="10" y="10" width="5" height="2" fill="currentColor" />
          <rect x="7" y="7" width="2" height="2" fill="#ef4444" />
        </svg>
      );
    case 'sliders':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="1" y="3" width="14" height="2" fill="currentColor" />
          <rect x="4" y="1" width="3" height="6" fill="#f59e0b" />
          <rect x="1" y="10" width="14" height="2" fill="currentColor" />
          <rect x="9" y="8" width="3" height="6" fill="#dc2626" />
        </svg>
      );
    case 'close':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="2" width="3" height="3" fill="currentColor" />
          <rect x="5" y="5" width="2" height="2" fill="currentColor" />
          <rect x="7" y="7" width="2" height="2" fill="currentColor" />
          <rect x="9" y="9" width="2" height="2" fill="currentColor" />
          <rect x="11" y="11" width="3" height="3" fill="currentColor" />
          <rect x="11" y="2" width="3" height="3" fill="currentColor" />
          <rect x="9" y="5" width="2" height="2" fill="currentColor" />
          <rect x="5" y="9" width="2" height="2" fill="currentColor" />
          <rect x="2" y="11" width="3" height="3" fill="currentColor" />
        </svg>
      );
    case 'install':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="7" y="1" width="2" height="6" fill="#fde047" />
          <rect x="5" y="5" width="6" height="2" fill="#fbbf24" />
          <rect x="6" y="7" width="4" height="2" fill="#f59e0b" />
          <rect x="7" y="9" width="2" height="1" fill="#d97706" />
          <rect x="2" y="11" width="2" height="3" fill="currentColor" />
          <rect x="12" y="11" width="2" height="3" fill="currentColor" />
          <rect x="2" y="13" width="12" height="2" fill="currentColor" />
        </svg>
      );
    case 'rain':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="4" y="2" width="7" height="2" fill="#cbd5e1" />
          <rect x="2" y="4" width="12" height="4" fill="#94a3b8" />
          <rect x="3" y="4" width="6" height="2" fill="#f1f5f9" />
          <rect x="4" y="10" width="1" height="3" fill="#38bdf8" />
          <rect x="8" y="9" width="1" height="4" fill="#7dd3fc" />
          <rect x="11" y="10" width="1" height="3" fill="#38bdf8" />
          <rect x="6" y="12" width="1" height="3" fill="#0284c7" />
        </svg>
      );
    case 'snow':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="7" y="2" width="2" height="12" fill="#bae6fd" />
          <rect x="2" y="7" width="12" height="2" fill="#bae6fd" />
          <rect x="4" y="4" width="2" height="2" fill="#ffffff" />
          <rect x="10" y="4" width="2" height="2" fill="#ffffff" />
          <rect x="4" y="10" width="2" height="2" fill="#ffffff" />
          <rect x="10" y="10" width="2" height="2" fill="#ffffff" />
          <rect x="6" y="6" width="4" height="4" fill="#38bdf8" />
        </svg>
      );
    case 'cairn':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="6" y="2" width="4" height="2" fill="#e7e5e4" />
          <rect x="5" y="4" width="6" height="3" fill="#a8a29e" />
          <rect x="5" y="4" width="3" height="2" fill="#d6d3d1" />
          <rect x="4" y="7" width="8" height="3" fill="#78716c" />
          <rect x="4" y="7" width="4" height="2" fill="#a8a29e" />
          <rect x="2" y="10" width="12" height="4" fill="#57534e" />
          <rect x="3" y="10" width="5" height="2" fill="#78716c" />
          <rect x="7" y="1" width="2" height="1" fill="#fde047" />
        </svg>
      );
    case 'stamp':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="6" y="1" width="4" height="3" fill="#b45309" />
          <rect x="7" y="4" width="2" height="4" fill="#92400e" />
          <rect x="3" y="8" width="10" height="3" fill="#78350f" />
          <rect x="2" y="11" width="12" height="2" fill="#be123c" />
          <rect x="3" y="13" width="10" height="2" fill="#881337" />
        </svg>
      );
    case 'backpack':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="5" y="1" width="6" height="2" fill="#78350f" />
          <rect x="3" y="3" width="10" height="11" fill="#92400e" />
          <rect x="4" y="4" width="8" height="4" fill="#b45309" />
          <rect x="5" y="9" width="6" height="4" fill="#78350f" />
          <rect x="7" y="6" width="2" height="3" fill="#fbbf24" />
        </svg>
      );
    case 'constellation':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="3" y="4" width="5" height="1" fill="#d97706" />
          <rect x="8" y="5" width="4" height="1" fill="#d97706" />
          <rect x="6" y="6" width="1" height="5" fill="#d97706" />
          <rect x="2" y="3" width="3" height="3" fill="#fde047" />
          <rect x="11" y="4" width="3" height="3" fill="#38bdf8" />
          <rect x="5" y="11" width="3" height="3" fill="#f43f5e" />
        </svg>
      );
    case 'pocket-compass':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="6" y="1" width="4" height="2" fill="#fbbf24" />
          <rect x="3" y="3" width="10" height="11" fill="#d97706" />
          <rect x="4" y="4" width="8" height="9" fill="#fef3c7" />
          <rect x="7" y="5" width="2" height="4" fill="#dc2626" />
          <rect x="7" y="9" width="2" height="3" fill="#1d4ed8" />
          <rect x="1" y="6" width="1" height="4" fill="#fde047" />
          <rect x="14" y="6" width="1" height="4" fill="#fde047" />
        </svg>
      );
    case 'ui-fold':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="1" y="2" width="14" height="2" fill="currentColor" />
          <rect x="1" y="12" width="14" height="2" fill="currentColor" />
          <rect x="5" y="5" width="6" height="1" fill="#fbbf24" />
          <rect x="6" y="6" width="4" height="1" fill="#fbbf24" />
          <rect x="7" y="7" width="2" height="2" fill="#fde047" />
          <rect x="6" y="9" width="4" height="1" fill="#fbbf24" />
          <rect x="5" y="10" width="6" height="1" fill="#fbbf24" />
        </svg>
      );
    case 'ui-unfold':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="1" y="1" width="14" height="2" fill="currentColor" />
          <rect x="1" y="13" width="14" height="2" fill="currentColor" />
          <rect x="7" y="4" width="2" height="1" fill="#fde047" />
          <rect x="5" y="5" width="6" height="2" fill="#fbbf24" />
          <rect x="5" y="9" width="6" height="2" fill="#fbbf24" />
          <rect x="7" y="11" width="2" height="1" fill="#fde047" />
        </svg>
      );
    case 'dpad':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="6" y="1" width="4" height="14" fill="#2b1d12" />
          <rect x="1" y="6" width="14" height="4" fill="#2b1d12" />
          <rect x="7" y="2" width="2" height="12" fill="currentColor" />
          <rect x="2" y="7" width="12" height="2" fill="currentColor" />
          <rect x="7" y="7" width="2" height="2" fill="#fde047" />
        </svg>
      );
    case 'chevron-up':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="7" y="4" width="2" height="2" fill="currentColor" />
          <rect x="5" y="6" width="6" height="2" fill="currentColor" />
          <rect x="3" y="8" width="3" height="2" fill="currentColor" />
          <rect x="10" y="8" width="3" height="2" fill="currentColor" />
        </svg>
      );
    case 'chevron-down':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="3" y="6" width="3" height="2" fill="currentColor" />
          <rect x="10" y="6" width="3" height="2" fill="currentColor" />
          <rect x="5" y="8" width="6" height="2" fill="currentColor" />
          <rect x="7" y="10" width="2" height="2" fill="currentColor" />
        </svg>
      );
    case 'sidebar-toggle':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="1" y="2" width="14" height="12" fill="#2b1d12" />
          <rect x="2" y="3" width="7" height="10" fill="#fde68a" />
          <rect x="10" y="3" width="4" height="10" fill="#d97706" />
          <rect x="11" y="5" width="2" height="2" fill="#2b1d12" />
          <rect x="11" y="9" width="2" height="2" fill="#2b1d12" />
        </svg>
      );
    case 'user-profile':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="3" y="2" width="10" height="2" fill="#d97706" />
          <rect x="2" y="4" width="12" height="1" fill="#78350f" />
          <rect x="7" y="3" width="2" height="1" fill="#fef08a" />
          <rect x="5" y="5" width="6" height="4" fill="#fed7aa" />
          <rect x="6" y="6" width="1" height="2" fill="#1a1008" />
          <rect x="9" y="6" width="1" height="2" fill="#1a1008" />
          <rect x="4" y="9" width="8" height="2" fill="#dc2626" />
          <rect x="3" y="11" width="10" height="4" fill="#15803d" />
          <rect x="5" y="11" width="4" height="3" fill="#22c55e" />
        </svg>
      );
    case 'hat':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="1" y="10" width="14" height="2" fill="#78350f" />
          <rect x="3" y="5" width="10" height="5" fill="#b45309" />
          <rect x="4" y="5" width="6" height="3" fill="#f59e0b" />
          <rect x="3" y="9" width="10" height="1" fill="#451a03" />
          <rect x="7" y="8" width="2" height="2" fill="#fde047" />
          <rect x="11" y="2" width="2" height="4" fill="#fef08a" />
          <rect x="12" y="1" width="2" height="2" fill="#ffffff" />
        </svg>
      );
    case 'relic':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="6" y="1" width="4" height="2" fill="#d97706" />
          <rect x="4" y="4" width="8" height="8" fill="#0284c7" />
          <rect x="5" y="5" width="6" height="6" fill="#38bdf8" />
          <rect x="6" y="6" width="3" height="3" fill="#fef08a" />
          <rect x="7" y="7" width="1" height="1" fill="#ffffff" />
          <rect x="5" y="12" width="6" height="2" fill="#78350f" />
        </svg>
      );
    case 'dungeon':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="3" y="1" width="10" height="2" fill="#78716c" />
          <rect x="1" y="3" width="14" height="12" fill="#44403c" />
          <rect x="2" y="3" width="3" height="11" fill="#a8a29e" />
          <rect x="11" y="3" width="3" height="11" fill="#78716c" />
          <rect x="4" y="2" width="8" height="2" fill="#a8a29e" />
          <rect x="5" y="4" width="6" height="11" fill="#140c08" />
          <rect x="5" y="9" width="6" height="2" fill="#57534e" />
          <rect x="5" y="11" width="6" height="2" fill="#78716c" />
          <rect x="5" y="13" width="6" height="2" fill="#a8a29e" />
          <rect x="2" y="6" width="2" height="2" fill="#fbbf24" />
          <rect x="2" y="5" width="1" height="1" fill="#fef08a" />
          <rect x="12" y="6" width="2" height="2" fill="#fbbf24" />
          <rect x="13" y="5" width="1" height="1" fill="#fef08a" />
        </svg>
      );
    case 'paw':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="4" width="3" height="3" fill="#92400e" />
          <rect x="2" y="4" width="2" height="2" fill="#f59e0b" />
          <rect x="6" y="2" width="3" height="3" fill="#92400e" />
          <rect x="6" y="2" width="2" height="2" fill="#fbbf24" />
          <rect x="10" y="3" width="3" height="3" fill="#92400e" />
          <rect x="10" y="3" width="2" height="2" fill="#fbbf24" />
          <rect x="12" y="7" width="3" height="3" fill="#92400e" />
          <rect x="12" y="7" width="2" height="2" fill="#f59e0b" />
          <rect x="5" y="7" width="6" height="6" fill="#78350f" />
          <rect x="4" y="9" width="8" height="4" fill="#92400e" />
          <rect x="5" y="8" width="5" height="3" fill="#d97706" />
        </svg>
      );
    case 'rumor':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="2" width="11" height="12" fill="#2b1d12" />
          <rect x="3" y="3" width="9" height="10" fill="#fde68a" />
          <rect x="4" y="5" width="6" height="1" fill="#78350f" />
          <rect x="4" y="7" width="5" height="1" fill="#78350f" />
          <rect x="4" y="9" width="4" height="1" fill="#78350f" />
          <rect x="9" y="8" width="5" height="5" fill="#991b1b" />
          <rect x="10" y="9" width="3" height="3" fill="#ef4444" />
          <rect x="11" y="10" width="1" height="1" fill="#fef08a" />
        </svg>
      );
    case 'ambience-on':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="4" width="8" height="2" fill="#38bdf8" />
          <rect x="9" y="2" width="3" height="2" fill="#7dd3fc" />
          <rect x="1" y="8" width="11" height="2" fill="#34d399" />
          <rect x="11" y="6" width="3" height="2" fill="#6ee7b7" />
          <rect x="3" y="12" width="7" height="2" fill="#fbbf24" />
          <rect x="9" y="13" width="3" height="2" fill="#fde047" />
        </svg>
      );
    case 'ambience-off':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="4" width="8" height="2" fill="#78716c" />
          <rect x="1" y="8" width="10" height="2" fill="#78716c" />
          <rect x="3" y="12" width="6" height="2" fill="#78716c" />
          <rect x="10" y="9" width="2" height="2" fill="#ef4444" />
          <rect x="12" y="11" width="2" height="2" fill="#ef4444" />
          <rect x="12" y="9" width="2" height="2" fill="#ef4444" />
          <rect x="10" y="11" width="2" height="2" fill="#ef4444" />
        </svg>
      );
    case 'leaf':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="9" y="1" width="5" height="3" fill="#4ade80" />
          <rect x="6" y="3" width="7" height="4" fill="#22c55e" />
          <rect x="4" y="5" width="7" height="5" fill="#16a34a" />
          <rect x="3" y="8" width="5" height="4" fill="#15803d" />
          <rect x="9" y="3" width="2" height="2" fill="#bef264" />
          <rect x="7" y="5" width="2" height="2" fill="#86efac" />
          <rect x="5" y="7" width="2" height="2" fill="#4ade80" />
          <rect x="2" y="12" width="2" height="3" fill="#78350f" />
          <rect x="3" y="11" width="2" height="2" fill="#92400e" />
        </svg>
      );
    case 'mineral':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="7" y="1" width="3" height="3" fill="#e0f2fe" />
          <rect x="5" y="4" width="6" height="4" fill="#38bdf8" />
          <rect x="3" y="6" width="3" height="5" fill="#0284c7" />
          <rect x="10" y="5" width="3" height="6" fill="#0ea5e9" />
          <rect x="6" y="4" width="2" height="4" fill="#ffffff" />
          <rect x="2" y="11" width="12" height="3" fill="#78716c" />
          <rect x="3" y="11" width="5" height="2" fill="#d6d3d1" />
          <rect x="3" y="14" width="10" height="1" fill="#44403c" />
        </svg>
      );
    case 'postcard':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="1" y="2" width="14" height="12" fill="#2b1d12" />
          <rect x="2" y="3" width="12" height="10" fill="#fef3c7" />
          <rect x="3" y="4" width="5" height="8" fill="#38bdf8" />
          <rect x="3" y="8" width="5" height="4" fill="#22c55e" />
          <rect x="4" y="6" width="2" height="2" fill="#fde047" />
          <rect x="8" y="4" width="1" height="8" fill="#c89d62" />
          <rect x="11" y="4" width="2" height="3" fill="#dc2626" />
          <rect x="9" y="8" width="4" height="1" fill="#78350f" />
          <rect x="9" y="10" width="3" height="1" fill="#78350f" />
        </svg>
      );
    case 'chest':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="2" y="3" width="12" height="11" fill="#2b1d12" />
          <rect x="3" y="4" width="10" height="3" fill="#b45309" />
          <rect x="3" y="4" width="10" height="1" fill="#f59e0b" />
          <rect x="3" y="7" width="10" height="1" fill="#2b1d12" />
          <rect x="3" y="8" width="10" height="5" fill="#92400e" />
          <rect x="4" y="4" width="1" height="9" fill="#fbbf24" />
          <rect x="11" y="4" width="1" height="9" fill="#fbbf24" />
          <rect x="7" y="6" width="2" height="4" fill="#fde047" />
          <rect x="7" y="7" width="2" height="1" fill="#ffffff" />
        </svg>
      );
    case 'capsule':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="5" y="1" width="6" height="2" fill="#fbbf24" />
          <rect x="4" y="3" width="8" height="10" fill="#2b1d12" />
          <rect x="5" y="4" width="6" height="8" fill="#059669" />
          <rect x="5" y="4" width="2" height="8" fill="#34d399" />
          <rect x="6" y="6" width="4" height="3" fill="#fef08a" />
          <rect x="7" y="7" width="2" height="1" fill="#ffffff" />
          <rect x="4" y="12" width="8" height="2" fill="#d97706" />
          <rect x="2" y="13" width="12" height="2" fill="#78350f" />
        </svg>
      );
    case 'trophy':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="4" y="1" width="8" height="2" fill="#fde047" />
          <rect x="2" y="2" width="2" height="4" fill="#d97706" />
          <rect x="12" y="2" width="2" height="4" fill="#d97706" />
          <rect x="4" y="3" width="8" height="5" fill="#f59e0b" />
          <rect x="5" y="3" width="3" height="4" fill="#fef08a" />
          <rect x="7" y="4" width="2" height="2" fill="#e11d48" />
          <rect x="5" y="8" width="6" height="2" fill="#b45309" />
          <rect x="7" y="10" width="2" height="2" fill="#fbbf24" />
          <rect x="5" y="12" width="6" height="2" fill="#92400e" />
          <rect x="4" y="14" width="8" height="1" fill="#451a03" />
        </svg>
      );
    case 'screen-awake':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="7" y="1" width="2" height="2" fill="#fde047" />
          <rect x="7" y="13" width="2" height="2" fill="#fde047" />
          <rect x="1" y="7" width="2" height="2" fill="#fde047" />
          <rect x="13" y="7" width="2" height="2" fill="#fde047" />
          <rect x="3" y="3" width="2" height="2" fill="#f59e0b" />
          <rect x="11" y="3" width="2" height="2" fill="#f59e0b" />
          <rect x="3" y="11" width="2" height="2" fill="#f59e0b" />
          <rect x="11" y="11" width="2" height="2" fill="#f59e0b" />
          <rect x="5" y="5" width="6" height="6" fill="#fbbf24" />
          <rect x="6" y="6" width="4" height="4" fill="#fef9c3" />
          <rect x="7" y="7" width="2" height="2" fill="#ffffff" />
        </svg>
      );
    case 'haptic':
      return (
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={`pixelated shrink-0 ${className}`} aria-hidden="true">
          <rect x="5" y="2" width="6" height="12" fill="#2b1d12" />
          <rect x="6" y="3" width="4" height="8" fill="#38bdf8" />
          <rect x="6" y="3" width="2" height="4" fill="#bae6fd" />
          <rect x="7" y="12" width="2" height="1" fill="#fde047" />
          <rect x="2" y="4" width="1" height="8" fill="#fbbf24" />
          <rect x="0" y="6" width="1" height="4" fill="#fde047" />
          <rect x="13" y="4" width="1" height="8" fill="#fbbf24" />
          <rect x="15" y="6" width="1" height="4" fill="#fde047" />
        </svg>
      );
  }
};

/**
 * 16-bit Ornate Brass & Sepia Filigree Corner Clasps for JRPG Grimoire Windows
 */
export const PixelCornerRivets: React.FC<IconBaseProps> = ({ className = 'bg-[#d97706]' }) => (
  <>
    <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 w-2.5 h-2.5 bg-[#2b1d12]">
      <span className={`block w-1.5 h-1.5 m-0.5 ${className}`} />
    </span>
    <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 w-2.5 h-2.5 bg-[#2b1d12]">
      <span className={`block w-1.5 h-1.5 m-0.5 ${className}`} />
    </span>
    <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 w-2.5 h-2.5 bg-[#2b1d12]">
      <span className={`block w-1.5 h-1.5 m-0.5 ${className}`} />
    </span>
    <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#2b1d12]">
      <span className={`block w-1.5 h-1.5 m-0.5 ${className}`} />
    </span>
  </>
);
