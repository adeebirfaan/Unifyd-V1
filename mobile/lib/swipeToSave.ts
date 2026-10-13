/** Share of the thumb's usable travel that counts as a completed swipe when the finger is lifted. */
export const SWIPE_COMPLETE_RATIO = 0.9;
/** Horizontal movement (pt) before a drag is treated as a swipe rather than a tap or a scroll. */
export const SWIPE_SLOP = 6;

/** How far the thumb can move inside the track: the track minus the thumb and the inset on both sides. */
export function swipeTravel(trackWidth: number, thumbSize: number, inset: number): number {
  return Math.max(0, trackWidth - thumbSize - inset * 2);
}

/** The thumb's position for a drag of `dx`, kept inside the track. */
export function swipePosition(dx: number, travel: number): number {
  return Math.min(Math.max(dx, 0), travel);
}

/** True when a released thumb has gone far enough to save. A track that is not measured yet never completes. */
export function swipeCompletes(position: number, travel: number, ratio = SWIPE_COMPLETE_RATIO): boolean {
  return travel > 0 && position >= travel * ratio;
}

/**
 * True when a move should become a swipe: clearly sideways, to the right, and past the slop. A mostly
 * vertical move is left to the page's scroll view, so scrolling never drags (or saves) anything.
 */
export function isHorizontalSwipe(dx: number, dy: number, slop = SWIPE_SLOP): boolean {
  return dx > slop && Math.abs(dx) > Math.abs(dy) * 1.5;
}

/** Radius a circle centred at (x, y) needs to cover a width × height screen: the distance to the farthest corner. */
export function coverRadius(x: number, y: number, width: number, height: number): number {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}
