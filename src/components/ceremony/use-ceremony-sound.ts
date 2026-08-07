"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "ceremony.muted";
const STYLE_KEY = "ceremony.soundStyle";

export type SoundStyle = "classic" | "fun";

/**
 * All ceremony audio is SYNTHESISED with the Web Audio API — no sound files,
 * so there is nothing to license or bundle. Each named cue (tick / roll /
 * impact / applause) resolves to a procedural generator; a "style" selects the
 * generator set, so a future admin screen can add a "custom" style that maps
 * cues to uploaded audio URLs without changing any caller.
 *
 * Two styles ship today:
 *   • classic — a filtered-noise drum roll, countdown ticks, a deep impact.
 *   • fun     — cartoonish boops and a "ta-da" reveal, for an office crowd.
 *
 * The context is created lazily on the first cue (browser autoplay policy
 * requires a user gesture first — the presenter pressing Space counts). Mute
 * and style both persist in localStorage.
 */
export function useCeremonySound(config?: {
  enabled?: boolean;
  style?: SoundStyle;
  /** cue name -> hosted audio URL; when present it plays instead of the synth. */
  urls?: Record<string, string>;
}) {
  // Admin config provides the defaults; the presenter's own live toggles
  // (persisted in localStorage) override them when present.
  const [muted, setMuted] = useState(config?.enabled === false);
  const [style, setStyle] = useState<SoundStyle>(config?.style ?? "classic");
  const ctxRef = useRef<AudioContext | null>(null);
  const rollRef = useRef<{ stop: () => void } | null>(null);
  const urlsRef = useRef<Record<string, string>>(config?.urls ?? {});
  const configUrls = config?.urls;
  useEffect(() => {
    urlsRef.current = configUrls ?? {};
  }, [configUrls]);

  useEffect(() => {
    // Deferred so the state reads don't run synchronously inside the effect.
    const raf = requestAnimationFrame(() => {
      try {
        const m = localStorage.getItem(STORAGE_KEY);
        if (m !== null) setMuted(m === "1");
        const s = localStorage.getItem(STYLE_KEY);
        if (s === "fun" || s === "classic") setStyle(s);
      } catch {
        /* ignore */
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (next) rollRef.current?.stop();
      return next;
    });
  }, []);

  const cycleStyle = useCallback(() => {
    setStyle((s) => {
      const next: SoundStyle = s === "classic" ? "fun" : "classic";
      try {
        localStorage.setItem(STYLE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const ctx = useCallback((): AudioContext | null => {
    if (muted) return null;
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }, [muted]);

  // Small building block: one shaped tone. `type` "boop" glides upward for a
  // cartoon feel; "tick" glides down for a percussive click.
  const tone = useCallback(
    (ac: AudioContext, at: number, freq: number, dur: number, wave: OscillatorType, dir: 1 | -1 = -1, vol = 0.35) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(dir === -1 ? freq : freq * 0.75, at);
      osc.frequency.exponentialRampToValueAtTime(dir === -1 ? freq * 0.66 : freq, at + dur * 0.6);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(vol, at + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(at);
      osc.stop(at + dur + 0.02);
    },
    []
  );

  // A short percussive tick (used for 3 / 2 / 1). "fun" style boops instead.
  const playTick = useCallback(() => {
    const ac = ctx();
    if (!ac) return;
    const t = ac.currentTime;
    if (style === "fun") tone(ac, t, 520, 0.14, "square", 1, 0.3);
    else tone(ac, t, 660, 0.16, "sine", -1, 0.35);
  }, [ctx, style, tone]);

  // A sustained drum roll built from filtered noise with a fast amplitude
  // tremolo. Returns nothing; call stopRoll() (or any reveal cue) to end it.
  const startRoll = useCallback(() => {
    const ac = ctx();
    if (!ac) return;
    rollRef.current?.stop();
    const dur = 8;
    const frames = ac.sampleRate * dur;
    const buf = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 180;
    bp.Q.value = 0.7;
    const trem = ac.createGain();
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    lfo.frequency.value = 26; // roll speed
    lfoGain.gain.value = 0.18;
    trem.gain.value = 0.18;
    lfo.connect(lfoGain).connect(trem.gain);
    src.connect(bp).connect(trem).connect(ac.destination);
    const t = ac.currentTime;
    trem.gain.setValueAtTime(0.02, t);
    trem.gain.linearRampToValueAtTime(0.22, t + 1.2);
    src.start(t);
    lfo.start(t);
    const stop = () => {
      try {
        const now = ac.currentTime;
        trem.gain.cancelScheduledValues(now);
        trem.gain.setValueAtTime(trem.gain.value, now);
        trem.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        src.stop(now + 0.2);
        lfo.stop(now + 0.2);
      } catch {
        /* already stopped */
      }
      rollRef.current = null;
    };
    rollRef.current = { stop };
  }, [ctx]);

  const stopRoll = useCallback(() => rollRef.current?.stop(), []);

  // Reveal cue. "classic" is a deep impact boom; "fun" is a cartoon "ta-da".
  const playImpact = useCallback(() => {
    const ac = ctx();
    if (!ac) return;
    const t = ac.currentTime;
    if (style === "fun") {
      // "ta-da!" — a quick rising pair then a bright held chord.
      tone(ac, t, 392, 0.14, "triangle", 1, 0.3); // G
      tone(ac, t + 0.14, 523, 0.5, "triangle", 1, 0.32); // C, held
      tone(ac, t + 0.14, 659, 0.5, "triangle", 1, 0.22); // E, sparkle
      return;
    }
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.5);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.7, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.75);
  }, [ctx, style, tone]);

  // A brief applause wash (shaped white noise with a slow swell + decay).
  const playApplause = useCallback(() => {
    const ac = ctx();
    if (!ac) return;
    const dur = 2.6;
    const frames = ac.sampleRate * dur;
    const buf = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      // crackle: random spikes over a noise bed
      const spike = Math.random() < 0.06 ? (Math.random() * 2 - 1) : 0;
      data[i] = (Math.random() * 2 - 1) * 0.15 + spike * 0.5;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1500;
    const gain = ac.createGain();
    const t = ac.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.3);
    gain.gain.setValueAtTime(0.4, t + dur - 0.9);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(hp).connect(gain).connect(ac.destination);
    src.start(t);
    src.stop(t + dur);
  }, [ctx]);

  // The reveal cue for a given moment. If the admin configured a custom audio
  // URL for this cue it plays that file; otherwise the synth impact.
  const playReveal = useCallback(
    (cue: string) => {
      const url = urlsRef.current[cue];
      if (url) {
        if (muted) return;
        try {
          const audio = new Audio(url);
          audio.volume = 0.9;
          audio.play().catch(() => {});
        } catch {
          /* fall back silently */
        }
        return;
      }
      playImpact();
    },
    [muted, playImpact]
  );

  return {
    muted, toggleMuted,
    style, cycleStyle,
    playTick, startRoll, stopRoll, playImpact, playApplause, playReveal,
  };
}
