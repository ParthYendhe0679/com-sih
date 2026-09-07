'use client';

// ============================================================
// KRITAGAS — Login Network Backdrop
// A slowly drifting constellation of nodes and link lines that
// evokes a criminal-network graph without distracting from the
// sign-in card. Motion is deliberately very slow (~8px/sec).
// ============================================================

import React, { useEffect, useRef } from 'react';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Phase offset so nodes do not pulse in lockstep. */
  phase: number;
}

const NODE_DENSITY = 1 / 26000; // nodes per px² of viewport
const MAX_NODES = 64;
const MIN_NODES = 22;
const LINK_DISTANCE = 190;
const DRIFT = 0.09; // px per frame at 60fps ≈ 5px/sec

export default function NetworkBackdrop({ isDark }: { isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const rafRef = useRef<number | null>(null);
  // Read theme inside the animation loop without restarting it.
  const darkRef = useRef(isDark);
  darkRef.current = isDark;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;

    const seed = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(
        Math.min(MAX_NODES, Math.max(MIN_NODES, width * height * NODE_DENSITY))
      );

      nodesRef.current = Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * DRIFT,
          vy: Math.sin(angle) * DRIFT,
          r: 1.6 + Math.random() * 2.6,
          phase: Math.random() * Math.PI * 2,
        };
      });
    };

    const draw = (t: number) => {
      const dark = darkRef.current;
      const nodes = nodesRef.current;
      ctx.clearRect(0, 0, width, height);

      const linkRGB = dark ? '129, 140, 248' : '79, 70, 229';
      const nodeRGB = dark ? '165, 180, 252' : '99, 102, 241';

      // Links first so nodes sit on top.
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist > LINK_DISTANCE) continue;
          // Fade the link out as the two nodes drift apart.
          const strength = 1 - dist / LINK_DISTANCE;
          ctx.strokeStyle = `rgba(${linkRGB}, ${strength * (dark ? 0.22 : 0.16)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }

      for (const n of nodes) {
        // Slow breathing halo, offset per node.
        const pulse = 0.5 + 0.5 * Math.sin(t / 2600 + n.phase);

        ctx.fillStyle = `rgba(${nodeRGB}, ${dark ? 0.1 : 0.07})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * (3.2 + pulse * 1.4), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${nodeRGB}, ${dark ? 0.62 : 0.44})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduceMotion) {
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;
          // Wrap around the edges so the field never thins out.
          const pad = LINK_DISTANCE * 0.25;
          if (n.x < -pad) n.x = width + pad;
          if (n.x > width + pad) n.x = -pad;
          if (n.y < -pad) n.y = height + pad;
          if (n.y > height + pad) n.y = -pad;
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    seed();
    rafRef.current = requestAnimationFrame(draw);

    const onResize = () => seed();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
