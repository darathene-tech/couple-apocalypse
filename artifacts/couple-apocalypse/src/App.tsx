import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';

type GamePhase = 'intro' | 'playing' | 'over';
type Hazard = {
  id: number;
  lane: number;
  y: number;
  emoji: string;
  sway: number;
};

const COUPLE_EMOJIS = ['👩‍❤️‍👨', '💑', '👫', '🧑‍🤝‍🧑'];
const LANE_POSITIONS = [10, 30, 50, 70, 90];

function App() {
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [playerX, setPlayerX] = useState(50);
  const [elapsed, setElapsed] = useState(0);
  const [heldDirection, setHeldDirection] = useState<-1 | 0 | 1>(0);
  const [impact, setImpact] = useState(false);

  const arenaRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<GamePhase>('intro');
  const playerXRef = useRef(50);
  const hazardsRef = useRef<Hazard[]>([]);
  const directionRef = useRef<-1 | 0 | 1>(0);
  const runStartedRef = useRef(0);
  const nextSpawnRef = useRef(0);
  const lastPaintRef = useRef(0);
  const nextHazardIdRef = useRef(0);
  const priorLaneRef = useRef(-1);

  const setDirection = useCallback((direction: -1 | 0 | 1) => {
    directionRef.current = direction;
    setHeldDirection(direction);
  }, []);

  const startRun = useCallback(() => {
    hazardsRef.current = [];
    setHazards([]);
    playerXRef.current = 50;
    setPlayerX(50);
    setElapsed(0);
    setImpact(false);
    directionRef.current = 0;
    setHeldDirection(0);
    priorLaneRef.current = -1;
    const now = performance.now();
    runStartedRef.current = now;
    nextSpawnRef.current = now + 560;
    lastPaintRef.current = now;
    phaseRef.current = 'playing';
    setPhase('playing');
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return undefined;
    let frame = 0;
    let lastUiUpdate = 0;

    const tick = (now: number) => {
      if (phaseRef.current !== 'playing') return;
      const arena = arenaRef.current;
      if (!arena) {
        frame = requestAnimationFrame(tick);
        return;
      }

      const width = arena.clientWidth;
      const height = arena.clientHeight;
      const dt = Math.min((now - lastPaintRef.current) / 1000, 0.05);
      lastPaintRef.current = now;
      const survived = (now - runStartedRef.current) / 1000;

      if (directionRef.current !== 0) {
        const distance = Math.max(245, width * 0.74) * dt;
        playerXRef.current = Math.min(
          91,
          Math.max(9, playerXRef.current + directionRef.current * (distance / width) * 100),
        );
      }

      const speed = 0.19 + Math.min(0.24, survived * 0.0055);
      if (now >= nextSpawnRef.current) {
        let lane = Math.floor(Math.random() * LANE_POSITIONS.length);
        if (lane === priorLaneRef.current) lane = (lane + 1 + Math.floor(Math.random() * 3)) % LANE_POSITIONS.length;
        priorLaneRef.current = lane;
        const newHazard: Hazard = {
          id: nextHazardIdRef.current++,
          lane,
          y: -0.09,
          emoji: COUPLE_EMOJIS[Math.floor(Math.random() * COUPLE_EMOJIS.length)],
          sway: Math.random() * Math.PI * 2,
        };
        hazardsRef.current = [...hazardsRef.current, newHazard];
        nextSpawnRef.current = now + Math.max(610, 1280 - survived * 17);
      }

      const movedHazards = hazardsRef.current
        .map((hazard) => ({ ...hazard, y: hazard.y + speed * dt }))
        .filter((hazard) => hazard.y < 1.13);
      hazardsRef.current = movedHazards;

      const playerCenterY = height * 0.92 - 36;
      const collided = movedHazards.some((hazard) => {
        const coupleX = (LANE_POSITIONS[hazard.lane] / 100) * width;
        const coupleY = hazard.y * height;
        return Math.abs(coupleX - (playerXRef.current / 100) * width) < 43
          && Math.abs(coupleY - playerCenterY) < 48;
      });

      if (collided) {
        phaseRef.current = 'over';
        directionRef.current = 0;
        setHeldDirection(0);
        setImpact(true);
        setTimeout(() => setImpact(false), 420);
        setHazards(movedHazards);
        setElapsed(survived);
        setPhase('over');
        return;
      }

      setPlayerX(playerXRef.current);
      if (now - lastUiUpdate > 34) {
        lastUiUpdate = now;
        setHazards(movedHazards);
        setElapsed(survived);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'playing') return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        setDirection(event.key === 'ArrowLeft' ? -1 : 1);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if ((event.key === 'ArrowLeft' && directionRef.current === -1)
          || (event.key === 'ArrowRight' && directionRef.current === 1)) setDirection(0);
      }
    };
    const onBlur = () => setDirection(0);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [setDirection]);

  const beginHold = (direction: -1 | 1) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (phaseRef.current !== 'playing') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDirection(direction);
  };

  const endHold = () => setDirection(0);

  return (
    <main className="game-page">
      <section className="game-shell" aria-label="Couple Apocalypse game">
        <div className="masthead">
          <span>FIELD REPORT // 01</span>
          <span className="edition">SINGLE SURVIVAL SIM</span>
        </div>
        <h1 className="game-title">COUPLE <span className="title-break">APOCALYPSE</span></h1>

        <div className="scorebar" aria-live="polite">
          <div className="score-label">
            <span>Survival</span>
            <strong className="score-value">{elapsed.toFixed(1)}s</strong>
          </div>
          {phase === 'playing'
            ? <span className="single-badge">STAY SINGLE</span>
            : <span className="single-badge">{phase === 'over' ? 'STATUS: COMPLICATED' : 'STATUS: SINGLE'}</span>}
        </div>

        <div
          ref={arenaRef}
          className={`arena${phase === 'playing' ? ' running' : ''}${impact ? ' shake' : ''}`}
          aria-label="Play field. Dodge the descending couples."
        >
          <div className="city-glow" />
          {[20, 40, 60, 80].map((position) => (
            <div className="lane-line" key={position} style={{ left: `${position}%` }} />
          ))}
          <div className="arena-hint">PUBLIC DISPLAY OF AFFECTION DETECTED</div>

          {hazards.map((hazard) => (
            <div
              className="hazard"
              key={hazard.id}
              style={{
                left: `${LANE_POSITIONS[hazard.lane]}%`,
                top: `${hazard.y * 100}%`,
              }}
              aria-label="Incoming couple"
            >
              <span className="hazard-emoji" aria-hidden="true">{hazard.emoji}</span>
            </div>
          ))}

          <div className="player" style={{ left: `${playerX}%` }} aria-label="Your single character">
            <div className="player-shadow" />
            <div className="player-head" />
            <div className="player-body" />
            <span className="player-label">ME, THRIVING</span>
          </div>

          {impact && <div className="screen-flash" aria-hidden="true" />}

          {phase === 'intro' && (
            <div className="overlay">
              <div className="intro-card">
                <p className="kicker">A survival game for the romantically unbothered</p>
                <h2 className="intro-title">COUPLE APOCALYPSE 💔</h2>
                <p className="intro-subtitle">The world is full of couples. Stay single.</p>
                <p className="warning-line"><span>♡</span> incoming hand-holders <span>♡</span></p>
                <button className="primary-button" onClick={startRun}>
                  STAY SINGLE <span aria-hidden="true">→</span>
                </button>
                <p className="controls-note"><strong>Move:</strong> hold ← → or use the big buttons below.<br />One collision. That’s all it takes.</p>
              </div>
            </div>
          )}

          {phase === 'over' && (
            <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="game-over-heading">
              <div className="end-card">
                <p className="kicker">It was nice while it lasted</p>
                <h2 className="game-over-title" id="game-over-heading">YOU GOT A PARTNER. 💀</h2>
                <p className="game-over-subtitle">Your single era has ended.</p>
                <div className="final-score">
                  <span>Time spent unclaimed</span>
                  <strong>{elapsed.toFixed(1)}s</strong>
                </div>
                <button className="primary-button" onClick={startRun}>
                  TRY AGAIN <span aria-hidden="true">↻</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="game-controls" aria-label="Movement controls">
          <button
            className={`move-button${heldDirection === -1 ? ' is-held' : ''}`}
            type="button"
            disabled={phase !== 'playing'}
            aria-label="Move left. Hold to keep moving."
            onPointerDown={beginHold(-1)}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            onLostPointerCapture={endHold}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className="move-key">← KEY</span>
            <span className="move-arrow" aria-hidden="true">←</span>
            <span className="move-label">LEFT</span>
          </button>
          <button
            className={`move-button${heldDirection === 1 ? ' is-held' : ''}`}
            type="button"
            disabled={phase !== 'playing'}
            aria-label="Move right. Hold to keep moving."
            onPointerDown={beginHold(1)}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            onLostPointerCapture={endHold}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className="move-key">→ KEY</span>
            <span className="move-label">RIGHT</span>
            <span className="move-arrow" aria-hidden="true">→</span>
          </button>
        </div>
        <div className="footnote">
          <span>ONE YOU</span><span className="divider">/</span><span>TOO MANY COUPLES</span><span className="divider">/</span><span>NO PRESSURE</span>
        </div>
      </section>
    </main>
  );
}

export default App;