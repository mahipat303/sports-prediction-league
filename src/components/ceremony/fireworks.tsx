"use client";

import { useEffect, useRef } from "react";

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
}

const PALETTE = ["#fbbf24", "#f59e0b", "#818cf8", "#ec4899", "#34d399", "#ffffff"];

/**
 * A few celebratory firework bursts, launched whenever `burstKey` changes.
 * Restrained on purpose — two or three shells, not a barrage — so the champion
 * reveal reads as premium rather than busy on a projector. Skipped under
 * prefers-reduced-motion.
 */
export function Fireworks({ burstKey }: { burstKey: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparks = useRef<Spark[]>([]);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (burstKey === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const W = window.innerWidth;
    const H = window.innerHeight;

    const shell = (cx: number, cy: number) => {
      const color = PALETTE[(Math.random() * PALETTE.length) | 0];
      const count = 46;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const speed = 2 + Math.random() * 3.5;
        sparks.current.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: 0,
          max: 60 + Math.random() * 30,
          color,
        });
      }
    };

    // Two immediate shells + one delayed, at varied positions.
    shell(W * (0.3 + Math.random() * 0.1), H * 0.35);
    shell(W * (0.6 + Math.random() * 0.1), H * 0.3);
    const delayed = setTimeout(() => shell(W * 0.5, H * 0.42), 550);

    if (raf.current) cancelAnimationFrame(raf.current);
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const live: Spark[] = [];
      for (const s of sparks.current) {
        s.life++;
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.04; // gravity
        s.vx *= 0.985;
        s.vy *= 0.985;
        const alpha = 1 - s.life / s.max;
        if (alpha <= 0) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        live.push(s);
      }
      ctx.globalAlpha = 1;
      sparks.current = live;
      if (live.length) raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);

    return () => {
      clearTimeout(delayed);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [burstKey]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 h-full w-full"
    />
  );
}
