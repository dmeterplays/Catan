// Five original audio assets stored in /public/sounds.
// Playback is triggered by authoritative Socket.IO gameSound events.
// Local recordings plus a CC0 handbell recording (two strikes for ship departure).
// Source: https://sfxmint.com/sounds/instrument-bell-42
const sources = {
  dice: '/sounds/dice.mp3',
  sail: 'https://sfxmint.com/dl/instrument-bell-42.mp3',
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
  playOnce();
  // A pair of handbell chimes evokes a ship's departure rather than a church alarm.
  if (name === 'sail') setTimeout(() => playOnce(.83), 860);
}
