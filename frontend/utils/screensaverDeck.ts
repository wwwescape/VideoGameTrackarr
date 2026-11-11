// The Screensaver's running order. The server sends each sample already shuffled; these keep
// it fresh when the carousel wraps around.

// A Fisher–Yates shuffle that never puts `avoidFirstId` first, so the cover on screen when the
// carousel wraps doesn't come straight back.
export function shuffleDeck<T extends { id: number }>(
  items: readonly T[],
  avoidFirstId: number | null,
  random: () => number = Math.random
): T[] {
  const deck = [...items];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return avoidRepeat(deck, avoidFirstId);
}

// Moves `avoidFirstId` off the front (to the end), if it's there and anything else is.
export function avoidRepeat<T extends { id: number }>(deck: T[], avoidFirstId: number | null): T[] {
  if (deck.length > 1 && avoidFirstId !== null && deck[0].id === avoidFirstId) {
    return [...deck.slice(1), deck[0]];
  }
  return deck;
}

// Whether the deck already holds every cover, so wrapping can reshuffle it locally instead of
// asking the server for a new sample.
export function hasEveryCover(deckLength: number, total: number): boolean {
  return total <= deckLength;
}
