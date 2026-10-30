// Original procedural sound effects. No third-party audio files or dependencies.
let audioContext;
function getContext() {
  const Constructor = window.AudioContext || window.webkitAudioContext;
  if (!Constructor) return null;
  if (!audioContext) audioContext = new Constructor();
  return audioContext;
}
export async function unlockSound() {
  const ctx = getContext();
  if (ctx?.state === 'suspended') {
    try { await ctx.resume(); } catch { /* Browser may require user interaction. */ }
  }
}
function tone(ctx, frequency, start, length, gain, type = 'sine', ending = frequency) {
  const osc = ctx.createOscillator();
  const envelope = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, frequency), start);
  if (ending !== frequency) osc.frequency.exponentialRampToValueAtTime(Math.max(1, ending), start + length);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(Math.max(.0001, gain), start + .012);
  envelope.gain.exponentialRampToValueAtTime(.0001, start + length);
  osc.connect(envelope);
  envelope.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + .03);
}
function noise(ctx, start, length, gain, lowPass = 1800) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowPass;
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(.0001, start);
  envelope.gain.exponentialRampToValueAtTime(Math.max(.0001, gain), start + .01);
  envelope.gain.exponentialRampToValueAtTime(.0001, start + length);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(ctx.destination);
  source.start(start);
  source.stop(start + length + .02);
}
function bell(ctx, frequency, start, gain, decay = 1.4) {
  [1, 2.01, 2.72, 3.91].forEach((multiple, i) => {
    tone(ctx, frequency * multiple, start, decay * (i ? .66 : 1), gain / (1 + i * 1.75), 'sine');
  });
}
function fanfare(ctx, start, gain, victory = false) {
  // Original brief ceremonial melody; notes are not from an existing composition.
  const notes = victory
    ? [[392,0,.19],[494,.2,.19],[587,.4,.19],[784,.6,.4],[587,1.06,.16],[784,1.25,.55]]
    : [[392,0,.16],[523,.2,.16],[659,.4,.2],[784,.68,.52]];
  notes.forEach(([freq, offset, duration]) => {
    tone(ctx, freq, start + offset, duration, gain * .72, 'triangle');
    tone(ctx, freq / 2, start + offset, duration * .95, gain * .28, 'sawtooth');
  });
}
export function playGameSound(name, volume = .5) {
  if (typeof window === 'undefined' || volume <= 0) return false;
  try {
    const ctx = getContext();
    if (!ctx || ctx.state !== 'running') return false;
    const now = ctx.currentTime + .025;
    const gain = Math.max(0, Math.min(1, Number(volume) || 0)) * .16;
    switch (name) {
      case 'dice':
        for (let i = 0; i < 7; i++) {
          const t = now + i * .067 + Math.random() * .023;
          noise(ctx, t, .047, gain * .58, 900 + Math.random() * 2300);
          tone(ctx, 175 + Math.random() * 180, t, .045, gain * .38, 'triangle');
        }
        break;
      case 'sail':
        bell(ctx, 370, now, gain * .72, 1.8);
        bell(ctx, 370, now + .63, gain * .56, 2.0);
        break;
      case 'seven':
        bell(ctx, 155, now, gain * 1.15, 1.25);
        tone(ctx, 92, now, .54, gain * .65, 'sawtooth', 65);
        break;
      case 'milestone':
        fanfare(ctx, now, gain);
        break;
      case 'victory':
        fanfare(ctx, now, gain, true);
        bell(ctx, 587, now + 1.35, gain * .38, 1.5);
        break;
      default: return false;
    }
    return true;
  } catch (error) {
    console.debug('Sound effect unavailable:', error);
    return false;
  }
}
