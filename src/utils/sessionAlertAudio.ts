/** Web Audio tones for judge session alerts. Requires a user gesture to unlock. */

let audioContext: AudioContext | null = null;

/** Just-intonation barbershop (harmonic) seventh: 1 : 5/4 : 3/2 : 7/4 */
const BARBERSHOP_SEVENTH_RATIOS = [1, 5 / 4, 3 / 2, 7 / 4] as const;

/** Comfortable midrange root (approx. Bb3). */
const BARBERSHOP_ROOT_HZ = 233.08;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;

  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextCtor();
  }

  return audioContext;
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

function playVoice(
  ctx: AudioContext,
  {
    frequency,
    startAt,
    endAt,
    gain = 0.07,
  }: {
    frequency: number;
    startAt: number;
    endAt: number;
    gain?: number;
  }
): void {
  const duration = endAt - startAt;
  if (duration <= 0) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  const attack = Math.min(0.04, duration * 0.15);
  const release = Math.min(0.35, duration * 0.25);
  const peak = Math.max(0.0001, gain);

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(peak, startAt + attack);
  gainNode.gain.setValueAtTime(peak, Math.max(startAt + attack, endAt - release));
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(endAt + 0.02);
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
      gain: 0.065,
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
