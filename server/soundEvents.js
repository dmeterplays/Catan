// Public sound triggers are independent of the action-history text.
// These names correspond to original audio assets in client/public/sounds.
export function soundEventsForTransition(previous, next) {
  if (!previous) return [];
  const events = [];
  if (next.rollId && next.rollId !== previous.rollId) {
    events.push(next.rollTotal === 7 ? 'seven' : 'dice');
  }
  if ((next.longestRoad !== previous.longestRoad && next.longestRoad != null) ||
      (next.largestArmy !== previous.largestArmy && next.largestArmy != null)) {
    events.push('milestone');
  }
  if (previous.phase !== 'finished' && next.phase === 'finished' && next.winner) {
    events.push('victory');
  }
  return events;
}
