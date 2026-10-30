// Five original audio assets stored in /public/sounds.
// Playback is triggered by authoritative Socket.IO gameSound events.
// Original locally hosted recordings, including the two-chime departure bell.
const sources = {
  dice: '/sounds/dice.mp3',
  sail: '/sounds/sail.wav',
  seven: '/sounds/seven.wav',
  milestone: '/sounds/milestone.wav',
  victory: '/sounds/victory.wav'
};
const allowed = new Set(Object.keys(sources));
const audioCache = new Map();
function getAudio(name) {
  if (!allowed.has(name) || typeof Audio === 'undefined') return null;
  if (!audioCache.has(name)) {
    const audio = new Audio(sources[name]);
    audio.preload = 'auto';
    audioCache.set(name, audio);
  }
  return audioCache.get(name);
}
export function preloadGameAudio() {
  for (const type of allowed) getAudio(type)?.load();
}
export function playGameAudio(name, volume = .45) {
  const source = getAudio(name);
  if (!source) return;
  // Multiple dice throws in close succession should not interrupt each other.
  const loudness = Math.max(0, Math.min(1, Number(volume) || 0));
  const playOnce = (level = 1) => {
    const sound = source.cloneNode(true);
    sound.volume = Math.min(1, loudness * level);
    const promise = sound.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch(error => {
        if (error?.name !== 'NotAllowedError') console.debug('[Catan] audio:', error);
      });
    }
    sound.addEventListener('ended', () => { sound.removeAttribute('src'); sound.load(); }, {once:true});
  };
  // Dice recording was quieter than the other effects; give it a modest boost.
  playOnce(name === 'dice' ? 1.3 : 1);
  // The locally hosted bell already contains both departure chimes.
}
