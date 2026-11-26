import { useEffect, useRef } from 'react';
import { plans } from '@content/spark/lazy-evaluation/lesson';
import { createLazySim } from './lazySim';

const SCENE_W = 980;
const SCENE_H = 372;

/**
 * Opakowanie silnika symulatora. Scena ma stały układ 980x372 i jest skalowana do szerokości
 * kontenera, więc nigdy nie wymusza poziomego przewijania.
 */
export function LazySim() {
  const wrap = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const say = useRef<HTMLParagraphElement>(null);
  const facts = useRef<HTMLUListElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const ticks = useRef<HTMLSpanElement>(null);
  const mission = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sim = createLazySim(
      { scene: scene.current!, sayEl: say.current!, factsEl: facts.current!, dock: dock.current!, ticks: ticks.current!, missionEl: mission.current! },
      plans
    );
    return () => sim.destroy();
  }, []);

  useEffect(() => {
    const w = wrap.current!;
    const s = scene.current!;
    const fit = () => {
      if (!w.clientWidth) return; // etap ukryty
      const scale = Math.min(1, w.clientWidth / SCENE_W);
      s.style.transform = `scale(${scale})`;
      s.style.marginLeft = `${Math.max(0, (w.clientWidth - SCENE_W * scale) / 2)}px`;
      w.style.height = `${SCENE_H * scale}px`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(w);
    fit();
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="mission">
        <span className="ticks" ref={ticks}>
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <span ref={mission} />
      </div>
      <div className="coach">
        <p className="say" ref={say} />
        <ul className="facts" ref={facts} />
      </div>
      <div className="scene-wrap" ref={wrap}>
        <div className="scene" ref={scene} />
      </div>
      <p className="simhint">Na wąskim ekranie scena jest pomniejszona. Obróć telefon, żeby zobaczyć ją wyraźniej.</p>
      <div className="dock" ref={dock} />
    </>
  );
}
