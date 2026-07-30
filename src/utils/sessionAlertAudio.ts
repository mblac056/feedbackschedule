/** Web Audio tones for judge session alerts. Requires a user gesture to unlock. */

let audioContext: AudioContext | null = null;
let masterInput: GainNode | null = null;

/** Just-intonation barbershop (harmonic) seventh: 1 : 5/4 : 3/2 : 7/4 */
const BARBERSHOP_SEVENTH_RATIOS = [1, 5 / 4, 3 / 2, 7 / 4] as const;

/** Higher root (approx. Bb4) so the chord sits in a cutting midrange. */
const BARBERSHOP_ROOT_HZ = 466.16;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;

  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextCtor();
    masterInput = null;
  }

  return audioContext;
}

/** Shared bus: mild saturation via compressor so chords stay loud and present. */
function getMasterInput(ctx: AudioContext): GainNode {
  if (masterInput && masterInput.context === ctx) {
    return masterInput;
  }

  const input = ctx.createGain();
  input.gain.value = 1;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 6;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.12;

  const output = ctx.createGain();
  output.gain.value = 1.35;

  input.connect(compressor);
  compressor.connect(output);
  output.connect(ctx.destination);

  masterInput = input;
  return input;
}

/** Call from a click handler so browsers unlock audio playback. */
export async function unlockSessionAlertAudio(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // Ignore unlock failures; playback will no-op later.
    }
  }
}

/**
 * Bright, pointed voice: square fundamental + octave triangle, fast attack.
 * Cuts through a room better than soft sines.
 */
function playVoice(
  ctx: AudioContext,
  {
    frequency,
    startAt,
    endAt,
    gain = 0.14,
  }: {
    frequency: number;
    startAt: number;
    endAt: number;
    gain?: number;
  }
): void {
  const duration = endAt - startAt;
  if (duration <= 0) return;

  const master = getMasterInput(ctx);
  const voiceGain = ctx.createGain();

  // Hard, percussive onset then solid sustain.
  const attack = 0.008;
  const release = Math.min(0.18, duration * 0.15);
  const peak = Math.max(0.0001, gain);
  const sustain = peak * 0.85;

  voiceGain.gain.setValueAtTime(0.0001, startAt);
  voiceGain.gain.exponentialRampToValueAtTime(peak, startAt + attack);
  voiceGain.gain.exponentialRampToValueAtTime(sustain, startAt + attack + 0.05);
  voiceGain.gain.setValueAtTime(sustain, Math.max(startAt + attack + 0.05, endAt - release));
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  // Fundamental — square for edge / "point".
  const fundamental = ctx.createOscillator();
  fundamental.type = 'square';
  fundamental.frequency.value = frequency;

  const fundamentalGain = ctx.createGain();
  fundamentalGain.gain.value = 0.55;

  // Soft low-pass so it stays piercing without harsh digital buzz.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = Math.min(4200, frequency * 6);
  filter.Q.value = 0.7;

  // Octave up — adds brilliance and room cut-through.
  const octave = ctx.createOscillator();
  octave.type = 'triangle';
  octave.frequency.value = frequency * 2;

  const octaveGain = ctx.createGain();
  octaveGain.gain.value = 0.35;

  // Fifth harmonic hint for extra "ring".
  const fifthPartial = ctx.createOscillator();
  fifthPartial.type = 'sine';
  fifthPartial.frequency.value = frequency * 3;

  const fifthGain = ctx.createGain();
  fifthGain.gain.value = 0.12;

  fundamental.connect(fundamentalGain);
  fundamentalGain.connect(filter);
  octave.connect(octaveGain);
  octaveGain.connect(filter);
  fifthPartial.connect(fifthGain);
  fifthGain.connect(filter);
  filter.connect(voiceGain);
  voiceGain.connect(master);

  const stopAt = endAt + 0.03;
  fundamental.start(startAt);
  octave.start(startAt);
  fifthPartial.start(startAt);
  fundamental.stop(stopAt);
  octave.stop(stopAt);
  fifthPartial.stop(stopAt);
}

/**
 * Arpeggiates a just barbershop seventh; each voice rings through the end
 * so the chord locks as notes are added.
 */
function playBarbershopSeventhArpeggio(
  ctx: AudioContext,
  {
    direction,
    totalDuration,
    rootHz = BARBERSHOP_ROOT_HZ,
  }: {
    direction: 'ascending' | 'descending';
    totalDuration: number;
    rootHz?: number;
  }
): void {
  const now = ctx.currentTime;
  const endAt = now + totalDuration;
  const ratios =
    direction === 'ascending'
      ? [...BARBERSHOP_SEVENTH_RATIOS]
      : [...BARBERSHOP_SEVENTH_RATIOS].reverse();

  // Stagger note entries across the first ~70% so the rest is a ringing chord.
  const staggerWindow = totalDuration * 0.7;
  const step = staggerWindow / Math.max(1, ratios.length - 1);

  for (let i = 0; i < ratios.length; i++) {
    playVoice(ctx, {
      frequency: rootHz * ratios[i],
      startAt: now + i * step,
      endAt,
      gain: 0.16,
    });
  }
}

async function withResumedContext(
  play: (ctx: AudioContext) => void
): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') await ctx.resume();
  } catch {
    return;
  }

  play(ctx);
}

/** ~2s ascending barbershop seventh (root → 3rd → 5th → harmonic 7th). */
export async function playWarningTone(): Promise<void> {
  await withResumedContext((ctx) => {
    playBarbershopSeventhArpeggio(ctx, {
      direction: 'ascending',
      totalDuration: 2,
    });
  });
}

/** ~5s descending barbershop seventh (harmonic 7th → 5th → 3rd → root). */
export async function playDoneTone(): Promise<void> {
  await withResumedContext((ctx) => {
    playBarbershopSeventhArpeggio(ctx, {
      direction: 'descending',
      totalDuration: 5,
    });
  });
}

const WARNING_DURATION_MS = 2000;
const DEMO_GAP_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Warning, then 3s silence, then done — for demonstrating alert sounds. */
export async function playSessionAlertDemo(): Promise<void> {
  await unlockSessionAlertAudio();
  await playWarningTone();
  await sleep(WARNING_DURATION_MS + DEMO_GAP_MS);
  await playDoneTone();
}
