// M3's shape scale. "Expressive" M3 leans toward the larger end of this scale for
// prominent surfaces (cards, dialogs) rather than baseline M3's more conservative usage —
// that's where the "Expressive" feel in this app mostly lives, alongside motion/type.
export const m3ShapeScale = {
  none: 0,
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 28,
  full: 9999,
} as const;
