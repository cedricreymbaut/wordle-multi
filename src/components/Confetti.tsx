import { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  w: number; h: number;
  color: string;
  rotation: number;
  rotSpeed: number;
}

const COLORS = [
  '#538d4e', '#b59f3b', '#ff6b6b', '#4ecdc4', '#ffe66d',
  '#ff8a5c', '#a8e6cf', '#fdffab', '#ffd3b6', '#d4a5ff',
];
const PARTICLE_COUNT = 140;
const DURATION = 4500;

export function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 3 + 2,
      w: Math.random() * 10 + 4,
      h: Math.random() * 6 + 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
    }));

    const t0 = performance.now();
    let raf: number;

    function draw(now: number) {
      const elapsed = now - t0;
      if (elapsed > DURATION) {
        c!.clearRect(0, 0, canvas!.width, canvas!.height);
        return;
      }

      c!.clearRect(0, 0, canvas!.width, canvas!.height);
      const fade = elapsed > DURATION * 0.65
        ? 1 - (elapsed - DURATION * 0.65) / (DURATION * 0.35)
        : 1;

      for (const p of particles) {
        p.x += p.vx;
        p.vy += 0.06;
        p.y += p.vy;
        p.vx *= 0.995;
        p.rotation += p.rotSpeed;

        c!.save();
        c!.translate(p.x, p.y);
        c!.rotate(p.rotation);
        c!.globalAlpha = Math.max(0, fade);
        c!.fillStyle = p.color;
        c!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        c!.restore();
      }
      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        pointerEvents: 'none',
      }}
    />
  );
}
