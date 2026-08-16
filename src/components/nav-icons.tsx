import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { RootTab } from '@/types';

/**
 * Nav glyphs drawn for Mentra rather than pulled from a generic icon font.
 *
 * Each has an outline and a solid state so the active tab reads as filled.
 * Geometry sits on a 24x24 grid with a 1.9 stroke, which keeps the weight
 * consistent with the rest of the chrome.
 */

const STROKE = 1.9;

export function NavIcon({ tab, active, color, size = 24 }: { tab: RootTab; active: boolean; color: string; size?: number }) {
  const line = { stroke: color, strokeWidth: STROKE, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const solid = { fill: color };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {tab === 'Home' ? (
        active ? (
          <>
            {/* Arched roof rather than the usual triangle */}
            <Path d="M4 11.2a8 8 0 0 1 16 0V19a2 2 0 0 1-2 2h-3.4v-4.6a2.6 2.6 0 0 0-5.2 0V21H6a2 2 0 0 1-2-2Z" {...solid} />
          </>
        ) : (
          <>
            <Path d="M4 11.2a8 8 0 0 1 16 0V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" {...line} />
            <Path d="M9.4 21v-4.6a2.6 2.6 0 0 1 5.2 0V21" {...line} />
          </>
        )
      ) : null}

      {tab === 'Library' ? (
        active ? (
          <>
            <Rect x="3.5" y="5" width="4.6" height="14.5" rx="1.6" {...solid} />
            <Rect x="9.6" y="7" width="4.6" height="12.5" rx="1.6" {...solid} opacity={0.85} />
            <Path d="M16.6 6.2l3.4.9a1.6 1.6 0 0 1 1.1 2l-2.6 9.6a1.6 1.6 0 0 1-2 1.1l-1.1-.3Z" {...solid} opacity={0.7} />
          </>
        ) : (
          <>
            <Rect x="3.5" y="5" width="4.6" height="14.5" rx="1.6" {...line} />
            <Rect x="9.6" y="7" width="4.6" height="12.5" rx="1.6" {...line} />
            <Path d="M16.6 6.2l3.4.9a1.6 1.6 0 0 1 1.1 2l-2.6 9.6a1.6 1.6 0 0 1-2 1.1l-1.1-.3" {...line} />
          </>
        )
      ) : null}

      {tab === 'Practice' ? (
        active ? (
          <>
            {/* Target: practice as taking aim, not another clipboard */}
            <Circle cx="12" cy="12" r="8.6" {...solid} opacity={0.22} />
            <Circle cx="12" cy="12" r="5.2" {...solid} opacity={0.5} />
            <Circle cx="12" cy="12" r="2.2" {...solid} />
          </>
        ) : (
          <>
            <Circle cx="12" cy="12" r="8.6" {...line} />
            <Circle cx="12" cy="12" r="4.6" {...line} />
            <Circle cx="12" cy="12" r="1.4" {...solid} />
          </>
        )
      ) : null}

      {tab === 'Planner' ? (
        active ? (
          <>
            <Rect x="3.4" y="5.4" width="17.2" height="15.2" rx="3.4" {...solid} />
            <Rect x="7" y="2.6" width="2" height="4.6" rx="1" {...solid} />
            <Rect x="15" y="2.6" width="2" height="4.6" rx="1" {...solid} />
            <Circle cx="12" cy="14.6" r="2.1" fill="#FFFFFF" opacity={0.92} />
          </>
        ) : (
          <>
            <Rect x="3.4" y="5.4" width="17.2" height="15.2" rx="3.4" {...line} />
            <Path d="M3.4 10.2h17.2" {...line} />
            <Path d="M8 3.4v3.2M16 3.4v3.2" {...line} />
            <Circle cx="12" cy="15" r="1.5" {...solid} />
          </>
        )
      ) : null}

      {tab === 'Settings' ? (
        active ? (
          <>
            {/* Sliders read faster at this size than a cog's teeth */}
            <Path d="M4 7h16M4 12h16M4 17h16" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
            <Circle cx="9" cy="7" r="2.9" {...solid} />
            <Circle cx="15.5" cy="12" r="2.9" {...solid} />
            <Circle cx="8" cy="17" r="2.9" {...solid} />
          </>
        ) : (
          <>
            <Path d="M4 7h16M4 12h16M4 17h16" {...line} />
            <Circle cx="9" cy="7" r="2.6" fill="none" stroke={color} strokeWidth={STROKE} />
            <Circle cx="15.5" cy="12" r="2.6" fill="none" stroke={color} strokeWidth={STROKE} />
            <Circle cx="8" cy="17" r="2.6" fill="none" stroke={color} strokeWidth={STROKE} />
          </>
        )
      ) : null}
    </Svg>
  );
}
