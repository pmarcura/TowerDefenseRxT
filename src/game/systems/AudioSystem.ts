import { GameRegistry } from "../GameRegistry";
import { waveDefinitions } from "../data/waves";
import type { AudioCueId, GameState } from "../models/types";
import type { GameSystem } from "./GameSystem";

const cueGapMs: Record<AudioCueId, number> = {
  ui_confirm: 80,
  ui_error: 160,
  build: 80,
  tower_fire: 60,
  hit: 45,
  kill: 90,
  wave_start: 400,
  boss: 500,
  reward: 250,
  base_hit: 250,
  victory: 1000,
  defeat: 1000
};

type MusicMood = "silent" | "prep" | "combat" | "boss" | "reward" | "paused" | "victory" | "defeat";

export class AudioSystem implements GameSystem {
  private context: AudioContext | null = null;
  private readonly playedEventIds = new Set<string>();
  private readonly lastPlayedAt = new Map<AudioCueId, number>();
  private musicMood: MusicMood = "silent";
  private musicNextBeatAt = 0;
  private musicStep = 0;

  constructor(private readonly registry: GameRegistry) {}

  update(_deltaMs: number): void {
    const state = this.registry.state;

    if (state.settings.muted || state.settings.masterVolume <= 0) {
      return;
    }

    const context = this.getContext();

    if (!context) {
      return;
    }

    if (state.settings.sfxVolume > 0) {
      for (const event of state.presentationEvents) {
        if (!event.cueId || this.playedEventIds.has(event.id)) {
          continue;
        }

        const now = performance.now();
        const lastPlayed = this.lastPlayedAt.get(event.cueId) ?? 0;

        if (now - lastPlayed < cueGapMs[event.cueId]) {
          continue;
        }

        this.playedEventIds.add(event.id);
        this.lastPlayedAt.set(event.cueId, now);
        this.playCue(event.cueId);
      }
    }

    this.updateMusic(context, state);
  }

  private playCue(cueId: AudioCueId): void {
    const context = this.getContext();

    if (!context) {
      return;
    }

    const volume = this.registry.state.settings.masterVolume * this.registry.state.settings.sfxVolume;

    if (cueId === "ui_error") {
      this.tone(context, 160, 0.08, volume * 0.18, "sawtooth");
      return;
    }

    if (cueId === "build") {
      this.chord(context, [330, 495, 660], 0.16, volume * 0.14);
      return;
    }

    if (cueId === "tower_fire") {
      this.tone(context, 740, 0.035, volume * 0.08, "triangle");
      return;
    }

    if (cueId === "hit") {
      this.tone(context, 220, 0.035, volume * 0.07, "square");
      return;
    }

    if (cueId === "kill") {
      this.chord(context, [440, 660], 0.09, volume * 0.1);
      return;
    }

    if (cueId === "wave_start") {
      this.chord(context, [196, 392, 588], 0.24, volume * 0.13);
      return;
    }

    if (cueId === "boss" || cueId === "base_hit" || cueId === "defeat") {
      this.tone(context, cueId === "defeat" ? 82 : 110, 0.42, volume * 0.18, "sawtooth");
      return;
    }

    if (cueId === "reward" || cueId === "victory" || cueId === "ui_confirm") {
      this.chord(context, cueId === "victory" ? [330, 495, 660, 990] : [520, 780], 0.22, volume * 0.12);
    }
  }

  private updateMusic(context: AudioContext, state: GameState): void {
    if (state.settings.musicVolume <= 0) {
      this.musicMood = "silent";
      return;
    }

    const mood = this.getMusicMood(state);

    if (mood === "silent") {
      this.musicMood = mood;
      return;
    }

    if (mood !== this.musicMood) {
      this.musicMood = mood;
      this.musicStep = 0;
      this.musicNextBeatAt = context.currentTime + 0.04;
    }

    const profile = this.getMusicProfile(mood);
    const lookahead = context.currentTime + 0.12;

    while (this.musicNextBeatAt <= lookahead) {
      this.scheduleMusicBeat(context, mood, profile, this.musicNextBeatAt, this.musicStep);
      this.musicNextBeatAt += profile.beatSeconds;
      this.musicStep += 1;
    }
  }

  private getMusicMood(state: GameState): MusicMood {
    if (state.phase === "menu" || state.phase === "class-selection") {
      return "prep";
    }

    if (state.phase === "paused") {
      return "paused";
    }

    if (state.phase === "reward-selection") {
      return "reward";
    }

    if (state.phase === "victory") {
      return "victory";
    }

    if (state.phase === "defeat") {
      return "defeat";
    }

    const wave = waveDefinitions[state.wave.currentWaveIndex];

    if (wave?.isBoss && (state.wave.active || state.wave.nextWaveInMs < 5000)) {
      return "boss";
    }

    return state.wave.active ? "combat" : "prep";
  }

  private getMusicProfile(mood: MusicMood): {
    root: number;
    notes: readonly number[];
    beatSeconds: number;
    pulseGain: number;
  } {
    if (mood === "combat") {
      return { root: 110, notes: [0, 7, 10, 14, 17, 14, 10, 7], beatSeconds: 0.34, pulseGain: 0.042 };
    }

    if (mood === "boss") {
      return { root: 82.41, notes: [0, 1, 7, 10, 12, 10, 7, 1], beatSeconds: 0.3, pulseGain: 0.054 };
    }

    if (mood === "reward" || mood === "victory") {
      return { root: 164.81, notes: [0, 5, 7, 12, 14, 12, 7, 5], beatSeconds: 0.48, pulseGain: 0.04 };
    }

    if (mood === "defeat") {
      return { root: 73.42, notes: [0, -2, -5, -7], beatSeconds: 0.78, pulseGain: 0.044 };
    }

    if (mood === "paused") {
      return { root: 98, notes: [0, 7, 12, 7], beatSeconds: 0.95, pulseGain: 0.024 };
    }

    return { root: 123.47, notes: [0, 7, 12, 14, 12, 7], beatSeconds: 0.68, pulseGain: 0.032 };
  }

  private scheduleMusicBeat(
    context: AudioContext,
    mood: MusicMood,
    profile: { root: number; notes: readonly number[]; beatSeconds: number; pulseGain: number },
    startAt: number,
    step: number
  ): void {
    const settings = this.registry.state.settings;
    const volume = settings.masterVolume * settings.musicVolume;
    const note = profile.notes[step % profile.notes.length];
    const frequency = profile.root * 2 ** (note / 12);
    const bassFrequency = profile.root / (mood === "boss" || mood === "defeat" ? 2 : 1);

    if (step % 4 === 0) {
      this.toneAt(context, bassFrequency, startAt, profile.beatSeconds * 1.8, volume * profile.pulseGain, "sine");
    }

    this.toneAt(context, frequency * 2, startAt + 0.015, 0.16, volume * profile.pulseGain * 0.72, "triangle");

    if (mood === "combat" || mood === "boss") {
      this.toneAt(context, frequency * 3, startAt + 0.06, 0.05, volume * profile.pulseGain * 0.38, "square");
    }

    if (mood === "reward" || mood === "victory") {
      this.toneAt(context, frequency * 2.5, startAt + 0.09, 0.18, volume * profile.pulseGain * 0.45, "sine");
    }
  }

  private getContext(): AudioContext | null {
    if (typeof AudioContext === "undefined") {
      return null;
    }

    if (!this.context) {
      this.context = new AudioContext();
    }

    if (this.context.state === "suspended") {
      void this.context.resume();
    }

    return this.context;
  }

  private tone(
    context: AudioContext,
    frequency: number,
    duration: number,
    gainValue: number,
    type: OscillatorType
  ): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private toneAt(
    context: AudioContext,
    frequency: number,
    startAt: number,
    duration: number,
    gainValue: number,
    type: OscillatorType
  ): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(Math.max(0.0001, gainValue), startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  }

  private chord(context: AudioContext, frequencies: number[], duration: number, gainValue: number): void {
    frequencies.forEach((frequency, index) => {
      window.setTimeout(() => {
        this.tone(context, frequency, duration, gainValue, "sine");
      }, index * 24);
    });
  }
}
