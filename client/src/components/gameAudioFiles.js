// Five original audio assets stored in /public/sounds.
// Playback is triggered by authoritative Socket.IO gameSound events.
const allowed = new Set(['dice','sail','seven','milestone','victory']);
const audioCache = new Map();
function getAudio(name) {
  if (!allowed.has(name) || typeof Audio === 'undefined') return null;
  if (!audioCache.has(name)) {
    const audio = new Audio('/sounds/' + name + '.wav');
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
  const sound = source.cloneNode(true);
  sound.volume = Math.max(0, Math.min(1, Number(volume) || 0));
  const promise = sound.play();
  if (promise && typeof promise.catch === 'function') {
    promise.catch(error => {
      // Autoplay policies differ between browsers. Preview buttons provide
      // a direct user gesture for enabling playback.
      if (error?.name !== 'NotAllowedError') console.debug('[Catan] audio:', error);
    });
  }
  sound.addEventListener('ended', () => { sound.src = ''; }, {once:true});
}
