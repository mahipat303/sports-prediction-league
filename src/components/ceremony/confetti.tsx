"use client";

import { useEffect, useRef } from "react";

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  shape: 0 | 1;
}

const COLORS = ["#4f46e5", "#818cf8", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#eab308"];

/**
 * Lightweight canvas confetti. `burstKey` fires a fresh burst whenever it
 * changes, so a slide reveal or the C key can trigger one. Particle count is
 * capped for smoothness on a projector, and it self-stops when the last piece
 * leaves the screen. Skipped entirely under prefers-reduced-motion.
 */
export function Confetti({ burstKey, pieces = 160 }: { burstKey: number; pieces?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const partsRef = useRef<Piece[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (burstKey === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = (canvas.width = window.innerWidth * dpr);
    const h = (canvas.height = window.innerHeight * dpr);
    ctx.scale(dpr, dpr);
    const vw = window.innerWidth;

    const fresh: Piece[] = Array.from({ length: pieces }, () => ({
      x: vw * (0.2 + Math.random() * 0.6),
      y: -20 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 6,
      vy: 3 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      size: 6 + Math.random() * 7,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      shape: Math.random() > 0.5 ? 1 : 0,
    }));
    partsRef.current = [...partsRef.current.filter((p) => p.y < window.innerHeight), ...fresh];

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const live = partsRef.current.filter((p) => p.y < window.innerHeight + 30);
      partsRef.current = live;
      for (const p of live) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // gravity
        p.vx *= 0.99;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 0) ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (live.length) rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [burstKey, pieces]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
    />
  );
}
