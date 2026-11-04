import type { SurfaceType } from './types';
import type { NpcVoiceKind } from './npcs';

let audioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let stepToggle = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) {
      audioCtx = new Ctor();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
    return noiseBuffer;
  }
  const len = Math.floor(ctx.sampleRate * 0.12);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    ch[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buf;
  return buf;
}

function playFilteredTone(
  freq: number,
  startOffsetSec: number,
  durationSec: number,
  type: OscillatorType = 'triangle',
  gainPeak = 0.055,
  cutoffHz = 2400
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const t0 = ctx.currentTime + startOffsetSec;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoffHz, t0);

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t0);
  osc.stop(t0 + durationSec + 0.025);
}

function playShortNoiseBurst(
  durationSec: number,
  filterFreq: number,
  filterQ: number,
  gainPeak: number
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(filterFreq, t0);
  filter.Q.setValueAtTime(filterQ, t0);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  src.start(t0);
  src.stop(t0 + durationSec + 0.015);
}

/**
 * 16-bit SNES Surface-Aware Footsteps (Cobblestones, Grass/Moss, Wooden Bridges, Gravel + River Murmur)
 */
export function playStepSfx(
  muted: boolean,
  surface: SurfaceType = 'stone',
  nearWater = false,
  subterranean = false
) {
  if (muted) return;
  stepToggle = (stepToggle + 1) % 2;
  const alt = stepToggle === 0 ? 1 : 0.94;

  if (subterranean) {
    // Deep cavern stone tap + reverberant echo + occasional crystalline drip!
    playFilteredTone(182 * alt, 0, 0.042, 'triangle', 0.038, 1250);
    playFilteredTone(182 * alt, 0.085, 0.065, 'sine', 0.015, 950);
    playShortNoiseBurst(0.028, 1850 * alt, 2.4, 0.015);
    if ((nearWater || stepToggle === 0) && Math.random() < 0.35) {
      playFilteredTone(987.77, 0.06, 0.09, 'sine', 0.014, 2400);
      playFilteredTone(1318.51, 0.11, 0.07, 'sine', 0.009, 2400);
    }
    return;
  }

  if (surface === 'wood') {
    // Hollow wooden plank knock on bridges & piers
    playFilteredTone(138 * alt, 0, 0.055, 'triangle', 0.05, 900);
    playFilteredTone(276 * alt, 0.005, 0.032, 'sine', 0.022, 1200);
  } else if (surface === 'grass') {
    // Soft mossy turf rustle
    playShortNoiseBurst(0.048, 950 * alt, 1.4, 0.024);
    playFilteredTone(108 * alt, 0, 0.038, 'sine', 0.024, 650);
  } else if (surface === 'gravel') {
    // Crisp path crunch
    playShortNoiseBurst(0.052, 1950 * alt, 1.9, 0.03);
    playFilteredTone(165 * alt, 0, 0.035, 'triangle', 0.022, 1100);
  } else {
    // Limestone cobblestone tap
    playFilteredTone(215 * alt, 0, 0.038, 'triangle', 0.034, 1500);
    playShortNoiseBurst(0.026, 2400 * alt, 2.6, 0.016);
  }

  // Subtle crystalline water-shimmer overtone every few steps along riverbanks/bridges
  if (nearWater && stepToggle === 0) {
    playFilteredTone(659.25, 0.02, 0.075, 'sine', 0.012, 1800);
  }
}

export function playDiscoveryFanfare(muted: boolean) {
  if (muted) return;
  // Warm SNES Harp/Crystal Polyphonic Secret-Found Arpeggio + Gentle Echo
  const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
  notes.forEach((f, i) => {
    const t = i * 0.085;
    const isFinal = i === notes.length - 1;
    playFilteredTone(f, t, isFinal ? 0.42 : 0.16, isFinal ? 'triangle' : 'square', isFinal ? 0.07 : 0.045, 2200);
    // Warm fifth / octave shimmer + SNES delay tail
    playFilteredTone(f * 0.5, t, isFinal ? 0.45 : 0.14, 'triangle', 0.032, 1200);
    playFilteredTone(f, t + 0.11, isFinal ? 0.32 : 0.11, 'sine', 0.018, 1600);
  });
}

export function playMissionFanfare(muted: boolean) {
  if (muted) return;
  // Heroic Guild Brass/Chime Chord Progression
  const notes = [440, 554.37, 659.25, 880, 1108.73];
  notes.forEach((f, i) => {
    const t = i * 0.08;
    const isLast = i === notes.length - 1;
    playFilteredTone(f, t, isLast ? 0.46 : 0.15, 'triangle', 0.06, 2400);
    playFilteredTone(f * 1.5, t + 0.02, isLast ? 0.36 : 0.1, 'sine', 0.022, 2600);
  });
}

export function playJournalOpenSfx(muted: boolean) {
  if (muted) return;
  // Parchment rustle + soft brass clasp chime
  playShortNoiseBurst(0.055, 1400, 1.2, 0.022);
  playFilteredTone(392, 0.01, 0.07, 'triangle', 0.035, 1600);
  playFilteredTone(587.33, 0.055, 0.09, 'sine', 0.03, 1800);
}

export function playProximityChimeSfx(muted: boolean) {
  if (muted) return;
  // Pocket-compass crystalline resonance ping when entering a mystery seal zone
  playFilteredTone(880, 0, 0.12, 'sine', 0.042, 2600);
  playFilteredTone(1318.51, 0.07, 0.18, 'triangle', 0.036, 2600);
}

export function playStampSfx(muted: boolean) {
  if (muted) return;
  // Wax/ink seal thud + bright confirmation glint
  playFilteredTone(125, 0, 0.07, 'triangle', 0.065, 600);
  playShortNoiseBurst(0.04, 900, 1.5, 0.03);
  playFilteredTone(783.99, 0.055, 0.14, 'sine', 0.035, 2200);
}

export function playPortalSfx(muted: boolean, descending: boolean) {
  if (muted) return;
  // Tactile stone staircase resonance + cavern torchlight / daylight breeze chord
  playShortNoiseBurst(0.085, descending ? 620 : 1350, 1.4, 0.024);
  const seq = descending ? [587.33, 440, 329.63, 220] : [220, 329.63, 440, 659.25];
  seq.forEach((f, i) => {
    const t = i * 0.058;
    playFilteredTone(f, t, 0.16, 'triangle', 0.048, descending ? 1450 : 2100);
    // Subtle reverberant fifth / cavern tail on final step
    if (i === seq.length - 1) {
      playFilteredTone(descending ? f * 0.5 : f * 1.5, t + 0.035, 0.24, 'sine', 0.024, 1800);
    }
  });
}

export function playNpcVoiceSfx(muted: boolean, voice: NpcVoiceKind) {
  if (muted) return;
  if (voice === 'bird') {
    playFilteredTone(1174.66, 0, 0.065, 'sine', 0.038, 2800);
    playFilteredTone(1567.98, 0.065, 0.085, 'sine', 0.036, 2800);
  } else if (voice === 'insect') {
    playFilteredTone(260, 0, 0.05, 'sawtooth', 0.02, 1100);
    playFilteredTone(295, 0.045, 0.055, 'sawtooth', 0.02, 1100);
  } else if (voice === 'amphibian') {
    playFilteredTone(185, 0, 0.075, 'square', 0.03, 850);
    playFilteredTone(235, 0.07, 0.085, 'triangle', 0.032, 950);
  } else if (voice === 'beast') {
    playShortNoiseBurst(0.035, 1100, 1.8, 0.018);
    playFilteredTone(310, 0.015, 0.075, 'triangle', 0.036, 1300);
    playFilteredTone(392, 0.075, 0.075, 'triangle', 0.03, 1400);
  } else {
    // Classic 16-bit JRPG human speech blips (3 warm melodic syllables)
    const base = voice === 'human_low' ? 246.94 : voice === 'human_bright' ? 440 : 329.63;
    playFilteredTone(base, 0, 0.052, 'square', 0.026, 1500);
    playFilteredTone(base * 1.12, 0.055, 0.052, 'square', 0.025, 1500);
    playFilteredTone(base * 1.25, 0.11, 0.065, 'triangle', 0.028, 1650);
  }
}

export function playRumorPinSfx(muted: boolean) {
  if (muted) return;
  // Parchment quill scratch + warm brass compass note
  playShortNoiseBurst(0.05, 1650, 1.6, 0.024);
  playFilteredTone(440, 0.02, 0.09, 'triangle', 0.038, 1900);
  playFilteredTone(659.25, 0.08, 0.14, 'sine', 0.036, 2200);
}

export function playRumorResolvedSfx(muted: boolean) {
  if (muted) return;
  // Investigative revelation arpeggio
  const notes = [392, 493.88, 587.33, 783.99];
  notes.forEach((f, idx) => {
    const t = idx * 0.07;
    playFilteredTone(f, t, idx === 3 ? 0.34 : 0.14, 'triangle', 0.05, 2300);
    if (idx === 3) {
      playFilteredTone(f * 1.5, t + 0.03, 0.28, 'sine', 0.022, 2500);
    }
  });
}

export function playSpecimenHarvestSfx(muted: boolean, isMineral: boolean) {
  if (muted) return;
  if (isMineral) {
    // Geologist hammer clink + crystalline quartz resonance
    playShortNoiseBurst(0.035, 2200, 1.8, 0.025);
    playFilteredTone(659.25, 0.01, 0.1, 'triangle', 0.042, 2600);
    playFilteredTone(987.77, 0.06, 0.15, 'sine', 0.045, 2900);
    playFilteredTone(1318.51, 0.12, 0.24, 'sine', 0.038, 3100);
  } else {
    // Botanical parchment rustle + warm herbalist harp triad
    playShortNoiseBurst(0.045, 1300, 1.4, 0.022);
    playFilteredTone(392.0, 0.015, 0.11, 'triangle', 0.04, 1900);
    playFilteredTone(493.88, 0.07, 0.13, 'triangle', 0.042, 2100);
    playFilteredTone(587.33, 0.13, 0.22, 'sine', 0.038, 2200);
  }
}

// ============================================================================
// PROCEDURAL BIOME AMBIENT SOUNDSCAPE ENGINE (Discreet, Zero-Asset, Commutable)
// ============================================================================

export interface BiomeSoundscapeParams {
  enabled: boolean;
  muted: boolean;
  subterranean: boolean;
  surface: SurfaceType;
  nearWater: boolean;
  isCrestOrWindy: boolean;
  isNight: boolean;
  isRaining: boolean;
}

interface SoundscapeRig {
  ctx: AudioContext;
  masterGain: GainNode;
  windGain: GainNode;
  windFilter: BiquadFilterNode;
  waterGain: GainNode;
  foliageGain: GainNode;
  cavernGain: GainNode;
}

let pinkLoopBuffer: AudioBuffer | null = null;
let soundscapeRig: SoundscapeRig | null = null;
let latestSoundscapeParams: BiomeSoundscapeParams = {
  enabled: false,
  muted: false,
  subterranean: false,
  surface: 'stone',
  nearWater: false,
  isCrestOrWindy: false,
  isNight: false,
  isRaining: false,
};
let accentTimerId: number | null = null;
let lifecycleListenersBound = false;

function getPinkNoiseLoopBuffer(ctx: AudioContext): AudioBuffer {
  if (pinkLoopBuffer && pinkLoopBuffer.sampleRate === ctx.sampleRate) {
    return pinkLoopBuffer;
  }
  const seconds = 3.2;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const out = buf.getChannelData(0);

  // Voss-McCartney / Paul Kellet pink noise filter with seamless crossfade loop seam
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.09;
    b6 = white * 0.115926;
  }

  // Smooth 4096-sample crossfade at buffer boundary so loop never clicks
  const fade = Math.min(4096, Math.floor(len / 8));
  for (let i = 0; i < fade; i++) {
    const alpha = i / fade;
    out[i] = out[i] * alpha + out[len - fade + i] * (1 - alpha);
  }

  pinkLoopBuffer = buf;
  return buf;
}

function ensureSoundscapeRig(): SoundscapeRig | null {
  if (typeof window === 'undefined') return null;
  // Do not instantiate AudioContext until soundscape is actually active & unmuted
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  const ctx = audioCtx;
  if (soundscapeRig && soundscapeRig.ctx === ctx) {
    return soundscapeRig;
  }

  const loopBuf = getPinkNoiseLoopBuffer(ctx);
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  masterGain.connect(ctx.destination);

  // 1. Ridge / Crest Wind channel (bandpass pink noise + slow LFO swell)
  const windSrc = ctx.createBufferSource();
  windSrc.buffer = loopBuf;
  windSrc.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.setValueAtTime(340, ctx.currentTime);
  windFilter.Q.setValueAtTime(1.6, ctx.currentTime);
  const windLfo = ctx.createOscillator();
  windLfo.type = 'sine';
  windLfo.frequency.setValueAtTime(0.14, ctx.currentTime);
  const windLfoGain = ctx.createGain();
  windLfoGain.gain.setValueAtTime(95, ctx.currentTime);
  windLfo.connect(windLfoGain);
  windLfoGain.connect(windFilter.frequency);
  const windGain = ctx.createGain();
  windGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  windSrc.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(masterGain);
  windSrc.start();
  windLfo.start();

  // 2. River / Living Water channel (warm stream body + gentle ripple shimmer)
  const waterSrc = ctx.createBufferSource();
  waterSrc.buffer = loopBuf;
  waterSrc.loop = true;
  waterSrc.playbackRate.setValueAtTime(1.18, ctx.currentTime);
  const waterFilter = ctx.createBiquadFilter();
  waterFilter.type = 'bandpass';
  waterFilter.frequency.setValueAtTime(860, ctx.currentTime);
  waterFilter.Q.setValueAtTime(1.1, ctx.currentTime);
  const waterLfo = ctx.createOscillator();
  waterLfo.type = 'sine';
  waterLfo.frequency.setValueAtTime(0.37, ctx.currentTime);
  const waterLfoGain = ctx.createGain();
  waterLfoGain.gain.setValueAtTime(190, ctx.currentTime);
  waterLfo.connect(waterLfoGain);
  waterLfoGain.connect(waterFilter.frequency);
  const waterGain = ctx.createGain();
  waterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  waterSrc.connect(waterFilter);
  waterFilter.connect(waterGain);
  waterGain.connect(masterGain);
  waterSrc.start();
  waterLfo.start();

  // 3. Woodland Foliage / Soft Rain texture channel
  const foliageSrc = ctx.createBufferSource();
  foliageSrc.buffer = loopBuf;
  foliageSrc.loop = true;
  foliageSrc.playbackRate.setValueAtTime(0.92, ctx.currentTime);
  const foliageFilter = ctx.createBiquadFilter();
  foliageFilter.type = 'bandpass';
  foliageFilter.frequency.setValueAtTime(1350, ctx.currentTime);
  foliageFilter.Q.setValueAtTime(0.9, ctx.currentTime);
  const foliageGain = ctx.createGain();
  foliageGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  foliageSrc.connect(foliageFilter);
  foliageFilter.connect(foliageGain);
  foliageGain.connect(masterGain);
  foliageSrc.start();

  // 4. Deep Subterranean Vault Air Resonance
  const cavernSrc = ctx.createBufferSource();
  cavernSrc.buffer = loopBuf;
  cavernSrc.loop = true;
  cavernSrc.playbackRate.setValueAtTime(0.62, ctx.currentTime);
  const cavernFilter = ctx.createBiquadFilter();
  cavernFilter.type = 'lowpass';
  cavernFilter.frequency.setValueAtTime(155, ctx.currentTime);
  const cavernGain = ctx.createGain();
  cavernGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  cavernSrc.connect(cavernFilter);
  cavernFilter.connect(cavernGain);
  cavernGain.connect(masterGain);
  cavernSrc.start();

  soundscapeRig = {
    ctx,
    masterGain,
    windGain,
    windFilter,
    waterGain,
    foliageGain,
    cavernGain,
  };
  return soundscapeRig;
}

function playBiomeOrganicAccent() {
  const p = latestSoundscapeParams;
  if (!p.enabled || p.muted) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  if (!audioCtx || audioCtx.state !== 'running') return;

  if (p.subterranean) {
    // Reverberant subterranean water-droplet echo
    const baseDrops = [880, 987.77, 1046.5, 1174.66, 1318.51];
    const f0 = baseDrops[Math.floor(Math.random() * baseDrops.length)];
    playFilteredTone(f0, 0, 0.085, 'sine', 0.014, 2400);
    playFilteredTone(f0 * 1.25, 0.095, 0.11, 'sine', 0.0085, 2100);
    playFilteredTone(f0 * 1.25, 0.23, 0.14, 'sine', 0.0045, 1700);
    return;
  }

  if (p.isRaining) return;

  if (!p.isNight && (p.surface === 'grass' || p.surface === 'gravel')) {
    // Discreet songbird call in woodland edges, parks & meadows
    const motifs = [
      [1318.51, 1567.98],
      [1174.66, 1479.98, 1318.51],
      [1567.98, 1760.0],
      [1046.5, 1318.51, 1567.98],
    ];
    const motif = motifs[Math.floor(Math.random() * motifs.length)];
    motif.forEach((freq, idx) => {
      playFilteredTone(freq, idx * 0.095, 0.08, 'sine', 0.011, 2800);
    });
    return;
  }

  if (p.isNight && (p.surface === 'grass' || p.surface === 'gravel')) {
    // Soft nocturnal owl or cricket murmur
    if (Math.random() < 0.4) {
      playFilteredTone(329.63, 0, 0.18, 'sine', 0.01, 900);
      playFilteredTone(261.63, 0.24, 0.24, 'sine', 0.009, 850);
    } else {
      playFilteredTone(2349.32, 0, 0.035, 'sine', 0.0055, 2800);
      playFilteredTone(2349.32, 0.055, 0.035, 'sine', 0.005, 2800);
    }
  }
}

function scheduleNextBiomeAccent() {
  if (typeof window === 'undefined') return;
  if (accentTimerId !== null) {
    window.clearTimeout(accentTimerId);
    accentTimerId = null;
  }
  const p = latestSoundscapeParams;
  if (!p.enabled || p.muted) return;

  const delayMs = p.subterranean
    ? 2300 + Math.random() * 2900
    : 2900 + Math.random() * 3800;

  accentTimerId = window.setTimeout(() => {
    playBiomeOrganicAccent();
    scheduleNextBiomeAccent();
  }, delayMs);
}

function applyRigGains() {
  const p = latestSoundscapeParams;
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  const active = p.enabled && !p.muted && !hidden;

  if (!active) {
    if (soundscapeRig) {
      const now = soundscapeRig.ctx.currentTime;
      soundscapeRig.masterGain.gain.setTargetAtTime(0.0001, now, 0.18);
    }
    if (accentTimerId !== null && typeof window !== 'undefined') {
      window.clearTimeout(accentTimerId);
      accentTimerId = null;
    }
    return;
  }

  const rig = ensureSoundscapeRig();
  if (!rig) return;
  if (rig.ctx.state === 'suspended') {
    rig.ctx.resume().catch(() => {});
  }

  const now = rig.ctx.currentTime;
  const tau = 0.42;

  let windTarget = 0.004;
  let waterTarget = 0.0001;
  let foliageTarget = 0.0001;
  let cavernTarget = 0.0001;
  let windCenterHz = 330;

  if (p.subterranean) {
    cavernTarget = 0.24;
    windTarget = 0.03;
    windCenterHz = 210;
    waterTarget = p.nearWater ? 0.16 : 0.025;
    foliageTarget = 0.0001;
  } else {
    if (p.isCrestOrWindy) {
      windTarget = 0.26;
      windCenterHz = 430;
    } else if (p.surface === 'gravel' || p.surface === 'grass') {
      windTarget = 0.09;
      windCenterHz = 350;
    } else {
      // Quiet town cobblestones
      windTarget = 0.04;
      windCenterHz = 290;
    }

    if (p.nearWater || p.surface === 'wood') {
      waterTarget = p.nearWater ? 0.24 : 0.12;
    }

    if (p.isRaining) {
      foliageTarget = 0.18;
    } else if (p.surface === 'grass') {
      foliageTarget = 0.085;
    } else if (p.surface === 'gravel') {
      foliageTarget = 0.045;
    }
  }

  // Discreet master ceiling (~0.11 over pre-attenuated pink noise -> very gentle ambient presence)
  rig.masterGain.gain.setTargetAtTime(0.115, now, 0.28);
  rig.windFilter.frequency.setTargetAtTime(windCenterHz, now, tau);
  rig.windGain.gain.setTargetAtTime(windTarget, now, tau);
  rig.waterGain.gain.setTargetAtTime(waterTarget, now, tau);
  rig.foliageGain.gain.setTargetAtTime(foliageTarget, now, tau);
  rig.cavernGain.gain.setTargetAtTime(cavernTarget, now, tau);

  if (accentTimerId === null) {
    scheduleNextBiomeAccent();
  }
}

function bindSoundscapeLifecycleOnce() {
  if (lifecycleListenersBound || typeof window === 'undefined') return;
  lifecycleListenersBound = true;

  const wakeIfActive = () => {
    if (!latestSoundscapeParams.enabled || latestSoundscapeParams.muted) return;
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => applyRigGains()).catch(() => {});
    } else if (!audioCtx) {
      applyRigGains();
    }
  };

  window.addEventListener('pointerdown', wakeIfActive, { passive: true });
  window.addEventListener('keydown', wakeIfActive, { passive: true });
  document.addEventListener('visibilitychange', () => {
    applyRigGains();
  });
}

export function syncBiomeSoundscape(params: BiomeSoundscapeParams) {
  latestSoundscapeParams = params;
  bindSoundscapeLifecycleOnce();
  // Avoid creating a suspended AudioContext before first gesture unless enabled; if enabled, apply smoothly
  if (!params.enabled || params.muted) {
    applyRigGains();
    return;
  }
  applyRigGains();
}

export function playChestOpenSfx(muted: boolean) {
  if (muted) return;
  // Brass clasp click + classic SNES treasure chest ascending arpeggio
  playShortNoiseBurst(0.04, 1500, 1.8, 0.025);
  playFilteredTone(196, 0, 0.06, 'triangle', 0.05, 950);
  const notes = [392.0, 493.88, 587.33, 783.99, 987.77, 1174.66];
  notes.forEach((f, idx) => {
    const t = 0.06 + idx * 0.072;
    const isLast = idx === notes.length - 1;
    playFilteredTone(f, t, isLast ? 0.44 : 0.14, isLast ? 'triangle' : 'square', isLast ? 0.065 : 0.042, 2400);
    playFilteredTone(f * 0.5, t, isLast ? 0.46 : 0.13, 'triangle', 0.03, 1300);
  });
}

export function playDetectorPingSfx(muted: boolean, strength01 = 0.5) {
  if (muted) return;
  const clamped = Math.max(0, Math.min(1, strength01));
  const baseHz = 560 + clamped * 520;
  playFilteredTone(baseHz, 0, 0.095, 'sine', 0.04, 2800);
  playFilteredTone(baseHz * 1.498, 0.065, 0.14, 'triangle', 0.032, 2800);
}

export function playCapsuleBurySfx(muted: boolean) {
  if (muted) return;
  // Soft turf spade rustle + sealed brass capsule chime
  playShortNoiseBurst(0.075, 820, 1.3, 0.032);
  playFilteredTone(146.83, 0.015, 0.08, 'triangle', 0.048, 780);
  playFilteredTone(523.25, 0.09, 0.13, 'triangle', 0.04, 2100);
  playFilteredTone(783.99, 0.15, 0.22, 'sine', 0.038, 2300);
}

export function playTitleSelectSfx(muted: boolean) {
  if (muted) return;
  playFilteredTone(659.25, 0, 0.055, 'triangle', 0.04, 2400);
  playFilteredTone(987.77, 0.04, 0.085, 'sine', 0.035, 2600);
}

export function playTitleEmbarkSfx(muted: boolean) {
  if (muted) return;
  // Warm SNES overworld harp glissando + brass fifth resolve
  const harp = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
  harp.forEach((f, idx) => {
    const t = idx * 0.052;
    const isFinal = idx === harp.length - 1;
    playFilteredTone(
      f,
      t,
      isFinal ? 0.55 : 0.18,
      isFinal ? 'triangle' : 'sine',
      isFinal ? 0.06 : 0.038,
      2600
    );
  });
  playFilteredTone(130.81, 0.16, 0.58, 'triangle', 0.055, 900);
  playFilteredTone(196.0, 0.22, 0.52, 'triangle', 0.045, 1200);
}

let lastBirdFlutterAt = 0;
export function playStartledBirdsSfx(muted: boolean) {
  if (muted) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastBirdFlutterAt < 4500) return;
  lastBirdFlutterAt = now;
  playShortNoiseBurst(0.05, 1650, 1.6, 0.018);
  playShortNoiseBurst(0.045, 1850, 1.7, 0.014);
  playFilteredTone(1567.98, 0.03, 0.06, 'sine', 0.02, 3200);
  playFilteredTone(1975.53, 0.09, 0.075, 'sine', 0.018, 3400);
}

export function playOrientationTableSfx(muted: boolean) {
  if (muted) return;
  // Crisp brass azimuth click + open-horizon airy fifth chord
  playShortNoiseBurst(0.03, 1800, 2.0, 0.018);
  const horizonNotes = [392.0, 587.33, 783.99, 1174.66];
  horizonNotes.forEach((f, idx) => {
    const t = 0.03 + idx * 0.065;
    playFilteredTone(f, t, idx === 3 ? 0.45 : 0.2, 'triangle', 0.04, 2400);
  });
}

export function playLieuDitBannerSfx(muted: boolean) {
  if (muted) return;
  // Soft vellum scroll rustle + gentle cartographic chime
  playShortNoiseBurst(0.045, 1150, 1.4, 0.015);
  playFilteredTone(523.25, 0.02, 0.11, 'sine', 0.024, 2000);
  playFilteredTone(659.25, 0.08, 0.16, 'triangle', 0.022, 2200);
}

export function playSecretClueChimeSfx(muted: boolean) {
  if (muted) return;
  // Mysterious Lydian sympathetic-ink shimmer (F#4 - A#4 - C#5 - F5 - G#5)
  playShortNoiseBurst(0.04, 1500, 1.8, 0.014);
  const inkNotes = [369.99, 466.16, 554.37, 698.46, 830.61];
  inkNotes.forEach((f, idx) => {
    playFilteredTone(f, 0.02 + idx * 0.06, idx === 4 ? 0.36 : 0.16, 'triangle', 0.036, 2600);
  });
}

export function playSecretArchiveSealBreakSfx(muted: boolean) {
  if (muted) return;
  // Crisp wax-seal crack + royal purple archive fanfare
  playShortNoiseBurst(0.065, 950, 1.3, 0.03);
  const notes = [293.66, 440.0, 554.37, 659.25, 880.0, 1108.73];
  notes.forEach((f, idx) => {
    const t = 0.04 + idx * 0.07;
    playFilteredTone(f, t, idx >= 4 ? 0.52 : 0.22, 'triangle', 0.05, 2900);
  });
  playFilteredTone(146.83, 0.12, 0.58, 'sine', 0.055, 850);
}

