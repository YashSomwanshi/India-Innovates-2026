import { useRef, useEffect, useCallback } from 'react';

/**
 * AvatarCanvas — Polished 2D animated avatar with full hair and continuous animation.
 * 
 * Props:
 *   isSpeaking  — avatar is playing audio
 *   isListening — avatar is recording user (Talking Tom mode)
 *   analyserRef — shared Web Audio AnalyserNode ref from App.jsx
 */
export default function AvatarCanvas({ isSpeaking, isListening, analyserRef }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const dataArrayRef = useRef(null);

  // Animation state persists across renders
  const S = useRef({
    t: 0,
    mouth: 0,
    blink: 0,
    blinkTimer: 0,
    nextBlink: 140,
    gazeX: 0, gazeY: 0,
    gazeTX: 0, gazeTY: 0,
    gazeTimer: 0,
    headTilt: 0, headTiltT: 0,
    breathPhase: 0,
  }).current;

  // Keep data array in sync with analyser
  useEffect(() => {
    if (analyserRef?.current) {
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
    }
  }, [analyserRef?.current]);

  // --- Drawing ---
  const draw = useCallback((ctx, W, H) => {
    S.t += 1;
    const cx = W / 2;
    const cy = H / 2;
    const sc = Math.min(W, H) / 340;

    // ── Audio ──
    let mTarget = 0;
    if (isSpeaking && analyserRef.current && dataArrayRef.current) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      const d = dataArrayRef.current;
      const lo = (d[1]+d[2]+d[3]+d[4]+d[5]) / 5;
      const md = (d[6]+d[7]+d[8]+d[9]+d[10]+d[11]+d[12]+d[13]) / 8;
      mTarget = Math.min((lo * 0.5 + md * 0.5) / 130, 1);
    }
    S.mouth += (mTarget - S.mouth) * 0.28;

    // ── Blink ──
    S.blinkTimer++;
    if (S.blinkTimer >= S.nextBlink) {
      S.blink = 1;
      S.blinkTimer = 0;
      S.nextBlink = Math.random() < 0.15 ? 12 : (100 + Math.random() * 200);
    }
    S.blink *= 0.8;

    // ── Gaze ──
    S.gazeTimer++;
    if (S.gazeTimer > 60 + Math.random() * 100) {
      S.gazeTX = (Math.random() - 0.5) * 5;
      S.gazeTY = (Math.random() - 0.5) * 3;
      S.gazeTimer = 0;
    }
    S.gazeX += (S.gazeTX - S.gazeX) * 0.035;
    S.gazeY += (S.gazeTY - S.gazeY) * 0.035;

    // ── Head tilt ──
    if (S.t % 180 < 3) S.headTiltT = (Math.random() - 0.5) * 0.025;
    S.headTilt += (S.headTiltT - S.headTilt) * 0.015;

    // ── Breathing ──
    S.breathPhase += 0.022;
    const breath = Math.sin(S.breathPhase) * 1.8 * sc;

    // ── Clear ──
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.6);
    bg.addColorStop(0, '#151b30');
    bg.addColorStop(1, '#0a0e1a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Ambient ring
    const ra = 0.07 + Math.sin(S.t * 0.013) * 0.035;
    ctx.strokeStyle = isListening ? `rgba(59,130,246,${ra + 0.12})` : isSpeaking ? `rgba(16,185,129,${ra + 0.08})` : `rgba(99,102,241,${ra})`;
    ctx.lineWidth = 1.5 * sc;
    ctx.beginPath();
    ctx.arc(cx, cy, 132 * sc, 0, Math.PI * 2);
    ctx.stroke();

    // Speaking glow
    if (isSpeaking) {
      const gi = 0.06 + S.mouth * 0.2;
      const gr = ctx.createRadialGradient(cx, cy, 50*sc, cx, cy, 140*sc);
      gr.addColorStop(0, `rgba(16,185,129,${gi})`);
      gr.addColorStop(1, 'transparent');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }

    // Listening glow (blue)
    if (isListening) {
      const li = 0.08 + Math.sin(S.t * 0.06) * 0.05;
      const lg = ctx.createRadialGradient(cx, cy, 50*sc, cx, cy, 140*sc);
      lg.addColorStop(0, `rgba(59,130,246,${li})`);
      lg.addColorStop(1, 'transparent');
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.save();
    ctx.translate(cx, cy + breath);
    ctx.rotate(S.headTilt);

    // ══════ BODY ══════

    // Neck
    const nk = ctx.createLinearGradient(0, 58*sc, 0, 100*sc);
    nk.addColorStop(0, '#D4A57C');
    nk.addColorStop(1, '#C49570');
    ctx.fillStyle = nk;
    ctx.beginPath();
    ctx.moveTo(-20*sc, 62*sc);
    ctx.lineTo(-28*sc, 100*sc);
    ctx.lineTo(28*sc, 100*sc);
    ctx.lineTo(20*sc, 62*sc);
    ctx.closePath();
    ctx.fill();

    // Shoulders
    const cl = ctx.createLinearGradient(-80*sc, 90*sc, 80*sc, 140*sc);
    cl.addColorStop(0, '#1a4d7d');
    cl.addColorStop(0.5, '#1f5f94');
    cl.addColorStop(1, '#153f6a');
    ctx.fillStyle = cl;
    ctx.beginPath();
    ctx.ellipse(0, 130*sc, 82*sc, 40*sc, 0, Math.PI, 0, true);
    ctx.fill();

    // Neckline / dupatta border
    ctx.strokeStyle = '#d4a024';
    ctx.lineWidth = 2.5*sc;
    ctx.beginPath();
    ctx.moveTo(-24*sc, 90*sc);
    ctx.quadraticCurveTo(0, 105*sc, 24*sc, 90*sc);
    ctx.stroke();

    // ══════ FACE ══════
    const fg = ctx.createRadialGradient(-5*sc, -10*sc, 5*sc, 0, 0, 75*sc);
    fg.addColorStop(0, '#E0B892');
    fg.addColorStop(0.5, '#D4A57C');
    fg.addColorStop(1, '#C49268');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(0, 2*sc, 62*sc, 74*sc, 0, 0, Math.PI * 2);
    ctx.fill();

    // Jaw line shadow
    ctx.fillStyle = 'rgba(150,100,60,0.08)';
    ctx.beginPath();
    ctx.ellipse(0, 30*sc, 55*sc, 45*sc, 0, 0.15, Math.PI-0.15);
    ctx.fill();

    // Cheeks
    ctx.fillStyle = 'rgba(220,140,130,0.12)';
    ctx.beginPath(); ctx.ellipse(-36*sc, 18*sc, 16*sc, 11*sc, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(36*sc, 18*sc, 16*sc, 11*sc, 0, 0, Math.PI*2); ctx.fill();

    // ══════ HAIR (FULL COVERAGE) ══════
    const hg = ctx.createRadialGradient(0, -50*sc, 10*sc, 0, -10*sc, 100*sc);
    hg.addColorStop(0, '#2a1808');
    hg.addColorStop(0.5, '#1c0e03');
    hg.addColorStop(1, '#100800');
    ctx.fillStyle = hg;

    // Main hair dome — covers the ENTIRE top of the head
    ctx.beginPath();
    ctx.moveTo(-68*sc, 5*sc);
    ctx.quadraticCurveTo(-72*sc, -35*sc, -55*sc, -62*sc);
    ctx.quadraticCurveTo(-35*sc, -85*sc, 0, -88*sc);
    ctx.quadraticCurveTo(35*sc, -85*sc, 55*sc, -62*sc);
    ctx.quadraticCurveTo(72*sc, -35*sc, 68*sc, 5*sc);
    // Hairline across forehead (low enough to look natural)
    ctx.quadraticCurveTo(50*sc, -28*sc, 30*sc, -36*sc);
    ctx.quadraticCurveTo(15*sc, -42*sc, 0, -40*sc);
    ctx.quadraticCurveTo(-15*sc, -42*sc, -30*sc, -36*sc);
    ctx.quadraticCurveTo(-50*sc, -28*sc, -68*sc, 5*sc);
    ctx.closePath();
    ctx.fill();

    // Left side hair (flows down)
    ctx.beginPath();
    ctx.moveTo(-68*sc, 5*sc);
    ctx.quadraticCurveTo(-72*sc, 20*sc, -66*sc, 40*sc);
    ctx.quadraticCurveTo(-60*sc, 50*sc, -52*sc, 35*sc);
    ctx.quadraticCurveTo(-58*sc, 15*sc, -55*sc, 0*sc);
    ctx.closePath();
    ctx.fill();

    // Right side hair
    ctx.beginPath();
    ctx.moveTo(68*sc, 5*sc);
    ctx.quadraticCurveTo(72*sc, 20*sc, 66*sc, 40*sc);
    ctx.quadraticCurveTo(60*sc, 50*sc, 52*sc, 35*sc);
    ctx.quadraticCurveTo(58*sc, 15*sc, 55*sc, 0*sc);
    ctx.closePath();
    ctx.fill();

    // Hair shine / highlight
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.ellipse(-12*sc, -65*sc, 22*sc, 10*sc, -0.25, 0, Math.PI*2);
    ctx.fill();

    // Hair parting
    ctx.strokeStyle = 'rgba(60,30,10,0.3)';
    ctx.lineWidth = 1*sc;
    ctx.beginPath();
    ctx.moveTo(0, -88*sc);
    ctx.quadraticCurveTo(-3*sc, -60*sc, 0, -42*sc);
    ctx.stroke();

    // ══════ BINDI ══════
    const bi = ctx.createRadialGradient(0, -34*sc, 0, 0, -34*sc, 5*sc);
    bi.addColorStop(0, '#e63c3c');
    bi.addColorStop(0.7, '#c02020');
    bi.addColorStop(1, 'rgba(180,30,30,0)');
    ctx.fillStyle = bi;
    ctx.beginPath();
    ctx.arc(0, -34*sc, 4.5*sc, 0, Math.PI*2);
    ctx.fill();

    // ══════ EYEBROWS ══════
    const brow = isSpeaking ? Math.sin(S.t * 0.07) * 1.2 : 0;
    ctx.strokeStyle = '#1e0d02';
    ctx.lineWidth = 2.5*sc;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-38*sc, (-23+brow)*sc);
    ctx.quadraticCurveTo(-25*sc, (-30+brow)*sc, -12*sc, (-24+brow)*sc);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12*sc, (-24+brow)*sc);
    ctx.quadraticCurveTo(25*sc, (-30+brow)*sc, 38*sc, (-23+brow)*sc);
    ctx.stroke();

    // ══════ EYES ══════
    const eH = Math.max(0.5, 11 * (1 - S.blink));
    const eY = -10*sc;
    const positions = [[-24, eY], [24, eY]];

    for (const [exBase, eyPos] of positions) {
      const ex = exBase * sc;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.beginPath();
      ctx.ellipse(ex, eyPos, 13*sc, (eH+1.5)*sc, 0, 0, Math.PI*2);
      ctx.fill();

      // White
      ctx.fillStyle = '#F8F8F8';
      ctx.beginPath();
      ctx.ellipse(ex, eyPos, 12*sc, eH*sc, 0, 0, Math.PI*2);
      ctx.fill();

      if (eH > 2) {
        const gx = S.gazeX * sc;
        const gy = S.gazeY * sc;

        // Iris gradient
        const ig = ctx.createRadialGradient(ex+gx, eyPos+gy, 1*sc, ex+gx, eyPos+gy, 7*sc);
        ig.addColorStop(0, '#6a4420');
        ig.addColorStop(0.5, '#3D2914');
        ig.addColorStop(1, '#241408');
        ctx.fillStyle = ig;
        ctx.beginPath();
        ctx.arc(ex+gx, eyPos+gy, 6.5*sc, 0, Math.PI*2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = '#080200';
        ctx.beginPath();
        ctx.arc(ex+gx, eyPos+gy, 3.5*sc, 0, Math.PI*2);
        ctx.fill();

        // Two highlights
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(ex+gx+2.5*sc, eyPos+gy-2.5*sc, 1.8*sc, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(ex+gx-1.5*sc, eyPos+gy+1.5*sc, 1*sc, 0, Math.PI*2);
        ctx.fill();
      }

      // Upper lid
      ctx.strokeStyle = '#1e0d02';
      ctx.lineWidth = 1.5*sc;
      ctx.beginPath();
      ctx.ellipse(ex, eyPos, 12*sc, eH*sc, 0, Math.PI+0.25, -0.25);
      ctx.stroke();
    }

    // ══════ NOSE ══════
    ctx.strokeStyle = 'rgba(150,100,65,0.4)';
    ctx.lineWidth = 1.2*sc;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-1*sc, 0);
    ctx.quadraticCurveTo(-6*sc, 14*sc, -1*sc, 17*sc);
    ctx.stroke();

    ctx.fillStyle = 'rgba(180,120,80,0.15)';
    ctx.beginPath(); ctx.ellipse(-5*sc, 18*sc, 2.5*sc, 1.5*sc, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4*sc, 18*sc, 2.5*sc, 1.5*sc, 0, 0, Math.PI*2); ctx.fill();

    // Nose stud (left)
    ctx.fillStyle = '#d4a024';
    ctx.beginPath();
    ctx.arc(-8*sc, 14*sc, 1.5*sc, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,180,0.6)';
    ctx.beginPath();
    ctx.arc(-8.3*sc, 13.5*sc, 0.6*sc, 0, Math.PI*2);
    ctx.fill();

    // ══════ MOUTH ══════
    const mo = S.mouth;
    const mY = 34*sc;
    const mW = (18 + mo * 7) * sc;
    const mH = (2 + mo * 16) * sc;

    // Upper lip
    ctx.fillStyle = isSpeaking ? '#c24545' : '#bf7070';
    ctx.beginPath();
    ctx.moveTo(-mW, mY);
    // Cupid's bow
    ctx.quadraticCurveTo(-mW*0.5, mY - mH*0.7, -2*sc, mY - mH*0.35);
    ctx.lineTo(0, mY - mH*0.5);
    ctx.lineTo(2*sc, mY - mH*0.35);
    ctx.quadraticCurveTo(mW*0.5, mY - mH*0.7, mW, mY);
    ctx.quadraticCurveTo(mW*0.5, mY + mH*0.15, 0, mY + mH*0.08);
    ctx.quadraticCurveTo(-mW*0.5, mY + mH*0.15, -mW, mY);
    ctx.fill();

    // Lower lip
    ctx.fillStyle = isSpeaking ? '#b03a3a' : '#a86060';
    ctx.beginPath();
    ctx.moveTo(-mW, mY);
    ctx.quadraticCurveTo(-mW*0.5, mY + mH*0.2, 0, mY + mH*0.08);
    ctx.quadraticCurveTo(mW*0.5, mY + mH*0.2, mW, mY);
    ctx.quadraticCurveTo(mW*0.55, mY + mH*0.9, 0, mY + mH);
    ctx.quadraticCurveTo(-mW*0.55, mY + mH*0.9, -mW, mY);
    ctx.fill();

    // Teeth
    if (mo > 0.1) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.rect(-mW*0.6, mY - mH*0.25, mW*1.2, mH*0.3);
      ctx.fill();
    }
    // Tongue
    if (mo > 0.4) {
      ctx.fillStyle = 'rgba(190,90,90,0.5)';
      ctx.beginPath();
      ctx.ellipse(0, mY + mH*0.5, mW*0.35, mH*0.25, 0, 0, Math.PI);
      ctx.fill();
    }

    // Lip highlight
    ctx.fillStyle = 'rgba(255,200,200,0.12)';
    ctx.beginPath();
    ctx.ellipse(-2*sc, mY-mH*0.15, 5*sc, 1.5*sc, 0, 0, Math.PI*2);
    ctx.fill();

    // Smile dimples (idle)
    if (mo < 0.1) {
      ctx.strokeStyle = 'rgba(170,120,90,0.15)';
      ctx.lineWidth = 0.8*sc;
      ctx.beginPath(); ctx.arc(-20*sc, 28*sc, 10*sc, 0.2, 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(20*sc, 28*sc, 10*sc, Math.PI-0.9, Math.PI-0.2); ctx.stroke();
    }

    // ══════ EARRINGS ══════
    const eb = Math.sin(S.t * 0.035) * 1.5;
    for (const side of [-1, 1]) {
      const ex = side * 60 * sc;
      const ey = (12 + eb) * sc;
      ctx.strokeStyle = '#d4a024';
      ctx.lineWidth = 1.8*sc;
      ctx.beginPath(); ctx.arc(ex, ey, 4.5*sc, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#d4a024';
      ctx.beginPath(); ctx.arc(ex, ey + 7*sc, 2.5*sc, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,0.5)';
      ctx.beginPath(); ctx.arc(ex-0.5*sc*side, ey+5.5*sc, 0.8*sc, 0, Math.PI*2); ctx.fill();
    }

    ctx.restore();

    // ── Speaking sound waves ──
    if (isSpeaking) {
      const n = 3;
      for (let i = 0; i < n; i++) {
        const ph = (S.t * 0.018 + i / n) % 1;
        const r = (132 + ph * 30) * sc;
        const a = (1 - ph) * 0.1 * (0.3 + S.mouth * 0.7);
        ctx.strokeStyle = `rgba(16,185,129,${a})`;
        ctx.lineWidth = 1*sc;
        ctx.beginPath();
        ctx.arc(cx, cy + breath, r, 0, Math.PI*2);
        ctx.stroke();
      }
    }

    // ── Listening ear-pulse waves ──
    if (isListening) {
      const n = 3;
      for (let i = 0; i < n; i++) {
        const ph = (S.t * 0.02 + i / n) % 1;
        const r = (132 + ph * 25) * sc;
        const a = (1 - ph) * 0.12;
        ctx.strokeStyle = `rgba(59,130,246,${a})`;
        ctx.lineWidth = 1.5*sc;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy + breath, r, 0, Math.PI*2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

  }, [isSpeaking, isListening]);

  // ── Canvas loop — never stops ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    function loop() {
      const r = canvas.getBoundingClientRect();
      draw(ctx, r.width, r.height);
      animRef.current = requestAnimationFrame(loop);
    }
    loop();

    window.addEventListener('resize', resize);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [draw]);

  return <canvas ref={canvasRef} className="avatar-canvas" style={{ width:'100%', height:'100%' }} />;
}
