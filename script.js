/* ============================================================
   Research Project Page — script.js
   ============================================================ */

// ---------- HSV Explorer ----------
(function () {
  // ── Configure samples here ────────────────────────────────────────────────
  // Each entry: one main interactive image + two static reference images.
  // captions: [main, ref-left, ref-right] — fill in the empty strings.
  // captions: [main, ref-0]
  const SAMPLES = [
    {
      sectionCaption: 'Task: coordinate both hands to adjust the position of the network cable head',   // fill in — shown above the row for this sample
      main:     'assets/hsv_demo5.png',
      refs:     ['assets/ref5a.gif'],
      captions: ['Dense Pixel Motion at t', 'RGBs from t to t+T'],
    },
    {
      sectionCaption: 'Task: use the sponge scouring pad with your left hand to wipe the cutting board',   // fill in — shown above the row for this sample
      main:     'assets/hsv_demo4.png',
      refs:     ['assets/ref4a.gif'],
      captions: ['Dense Pixel Motion at t', 'RGBs from t to t+T'],
    },
    {
      sectionCaption: 'Task: pull the chair backward with both hands to create seating space',   // fill in — shown above the row for this sample
      main:     'assets/hsv_demo3.png',
      refs:     ['assets/ref3a.gif'],
      captions: ['Dense Pixel Motion at t', 'RGBs from t to t+T'],
    },
    {
      sectionCaption: 'Task: push the object into the drawer',   // fill in — shown above the row for this sample
      main:     'assets/hsv_demo1.png',
      refs:     ['assets/ref1a.gif'],
      captions: ['Dense Pixel Motion at t', 'RGBs from t to t+T'],
    },
    {
      sectionCaption: 'Task: push the pink block to the right',
      main:     'assets/hsv_demo2.png',
      refs:     ['assets/ref2a.gif'],
      captions: ['Dense Pixel Motion at t', 'RGBs from t to t+T'],
    },
  ];

  // ── Donut wheel geometry (matches canvas width/height="200" in HTML) ──────
  const WW = 200, WH = 200;
  const WCX = WW / 2, WCY = WH / 2;
  const WR_OUT = 94, WR_IN = 45;   // outer / inner radii → ring width ≈ 49 px

  let activeIdx    = 0;
  let nativeCanvas = null; // full-res offscreen canvas for pixel sampling
  let autoTimer    = null;

  function startAutoPlay() {
    stopAutoPlay();
    autoTimer = setInterval(() => switchSample((activeIdx + 1) % SAMPLES.length), 5000);
  }
  function stopAutoPlay() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }

  // ── Color utilities ───────────────────────────────────────────────────────
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    if (d !== 0) {
      if      (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else                h = ((r - g) / d + 4) / 6;
    }
    return { h: h * 360, s: s * 100, v: v * 100 };
  }

  function hsvToRgb(h, s, v) {
    h /= 360; s /= 100; v /= 100;
    let r = 0, g = 0, b = 0;
    if (s === 0) { r = g = b = v; }
    else {
      const i = Math.floor(h * 6), f = h * 6 - i;
      const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
      switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
      }
    }
    return [r * 255 | 0, g * 255 | 0, b * 255 | 0];
  }

  // ── Donut hue ring (drawn once on init) ───────────────────────────────────
  function buildWheel() {
    const canvas = document.getElementById('hsv-wheel-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const id  = ctx.createImageData(WW, WH);
    const d   = id.data;
    const F = 1.5; // feather width in canvas pixels — smooths both edges
    for (let y = 0; y < WH; y++) {
      for (let x = 0; x < WW; x++) {
        const dx = x - WCX, dy = y - WCY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Per-edge soft alpha: ramp over ±F around each boundary
        const aOut = dist <= WR_OUT - F ? 1 : dist >= WR_OUT + F ? 0 : (WR_OUT + F - dist) / (2 * F);
        const aIn  = dist >= WR_IN  + F ? 1 : dist <= WR_IN  - F ? 0 : (dist - (WR_IN - F))  / (2 * F);
        const alpha = Math.min(aOut, aIn);
        if (alpha <= 0) continue;
        const hue = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
        const [r, g, b] = hsvToRgb(hue, 100, 100);
        const i = (y * WW + x) * 4;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(id, 0, 0);
  }

  // ── Arrow overlay (redrawn on every pixel sample) ─────────────────────────
  // Angle = hue; length from centre = WR_OUT * 0.96 * (v/100)
  function drawArrow(h, s, v) {
    const canvas = document.getElementById('hsv-wheel-fg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, WW, WH);
    if (v < 0.5) return;   // nothing to show — skip drawing

    const ang = h * Math.PI / 180;
    const len = WR_OUT * 0.96 * (v / 100);
    const ex  = WCX + len * Math.cos(ang);
    const ey  = WCY + len * Math.sin(ang);

    // White arrow with dark shadow — always visible against the coloured ring
    // and the dark transparent centre
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur  = 5;

    // Shaft
    ctx.beginPath();
    ctx.moveTo(WCX, WCY);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.stroke();

    // Arrowhead wings
    const HS = 10, HA = 0.42;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - HS * Math.cos(ang - HA), ey - HS * Math.sin(ang - HA));
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - HS * Math.cos(ang + HA), ey - HS * Math.sin(ang + HA));
    ctx.stroke();

    // Pivot dot
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(WCX, WCY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  // ── Numeric readout ───────────────────────────────────────────────────────
  function updateValues(h, s, v) {
    const eh = document.getElementById('hv-h');
    const es = document.getElementById('hv-s');
    const ev = document.getElementById('hv-v');
    if (eh) eh.textContent = Math.round(h);
    if (es) es.textContent = Math.round(s);
    if (ev) ev.textContent = Math.round(v);
  }

  // ── Image loading helper ──────────────────────────────────────────────────
  function loadImg(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // ── Switch sample with cross-fade ────────────────────────────────────────
  const FADE_MS = 300; // must match CSS transition on .hsv-fadeable

  function getFadeEls() {
    return document.querySelectorAll('.hsv-fadeable');
  }

  async function switchSample(idx) {
    activeIdx = idx;
    updateDots();
    const sample  = SAMPLES[idx];
    const disp    = document.getElementById('hsv-img-canvas');
    const overlay = document.getElementById('hsv-overlay');
    if (!disp || !overlay) return;

    // Fade out + preload main image in parallel
    getFadeEls().forEach(el => { el.style.opacity = '0'; });
    const results = await Promise.allSettled([
      loadImg(sample.main),
      new Promise(r => setTimeout(r, FADE_MS)),
    ]);

    // ── Update all DOM while invisible ───────────────────────────────────────
    const secEl = document.getElementById('hsv-section-caption');
    if (secEl) secEl.textContent = sample.sectionCaption || '';

    const cap = sample.captions || [];
    ['hsv-main-caption', 'hsv-ref-caption-0'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.textContent = cap[i] || '';
    });

    const imgResult = results[0];
    if (imgResult.status === 'fulfilled') {
      const img   = imgResult.value;
      const MAX_W = 500, MAX_H = 300;
      const scale = Math.min(MAX_W / img.width, MAX_H / img.height);
      const dw    = Math.round(img.width  * scale);
      const dh    = Math.round(img.height * scale);
      disp.width  = dw; disp.height  = dh;
      overlay.width = dw; overlay.height = dh;
      disp.getContext('2d').drawImage(img, 0, 0, dw, dh);
      nativeCanvas        = document.createElement('canvas');
      nativeCanvas.width  = img.width;
      nativeCanvas.height = img.height;
      nativeCanvas.getContext('2d').drawImage(img, 0, 0);
    } else {
      const W = 420, H = 240;
      disp.width = W; disp.height = H;
      overlay.width = W; overlay.height = H;
      nativeCanvas = null;
      const ctx = disp.getContext('2d');
      ctx.fillStyle = '#1a1d27';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#5a5f78';
      ctx.font = '13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Image not found: ' + sample.main, W / 2, H / 2 - 10);
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText('Edit SAMPLES in script.js', W / 2, H / 2 + 14);
    }

    (sample.refs || []).forEach((src, i) => {
      const el = document.getElementById('hsv-ref-' + i);
      if (el) el.src = src;
    });
    const bgRef = document.getElementById('hsv-bg-ref');
    if (bgRef && sample.refs && sample.refs[0]) bgRef.src = sample.refs[0];

    drawArrow(0, 0, 0); // clear stale arrow from previous sample

    // Fade in
    requestAnimationFrame(() => { getFadeEls().forEach(el => { el.style.opacity = '1'; }); });
  }

  // ── Dot nav ───────────────────────────────────────────────────────────────
  function buildDots() {
    const container = document.getElementById('hsv-dots');
    if (!container) return;
    container.innerHTML = '';
    SAMPLES.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'hsv-dot' + (i === activeIdx ? ' active' : '');
      dot.addEventListener('click', () => { switchSample(i); startAutoPlay(); });
      container.appendChild(dot);
    });
  }

  function updateDots() {
    document.querySelectorAll('#hsv-dots .hsv-dot').forEach((d, i) => {
      d.classList.toggle('active', i === activeIdx);
    });
  }

  // ── Pointer events ────────────────────────────────────────────────────────
  function onMouseMove(e) {
    stopAutoPlay();
    const disp    = document.getElementById('hsv-img-canvas');
    const overlay = document.getElementById('hsv-overlay');
    if (!disp || !overlay) return;

    const rect = disp.getBoundingClientRect();
    const cx   = (e.clientX - rect.left)  * (disp.width  / rect.width);
    const cy   = (e.clientY - rect.top)   * (disp.height / rect.height);

    // Crosshair
    const octx = overlay.getContext('2d');
    octx.clearRect(0, 0, overlay.width, overlay.height);
    const R = 6;
    octx.strokeStyle = 'rgba(255,255,255,0.9)';
    octx.lineWidth   = 1.5;
    octx.shadowColor = 'rgba(0,0,0,0.5)';
    octx.shadowBlur  = 3;
    octx.beginPath();
    octx.moveTo(cx - R, cy); octx.lineTo(cx + R, cy);
    octx.moveTo(cx, cy - R); octx.lineTo(cx, cy + R);
    octx.stroke();
    octx.beginPath();
    octx.arc(cx, cy, R, 0, Math.PI * 2);
    octx.stroke();
    octx.shadowBlur = 0;

    if (!nativeCanvas) return;
    const nx = Math.max(0, Math.min(Math.round(cx * nativeCanvas.width  / disp.width),  nativeCanvas.width  - 1));
    const ny = Math.max(0, Math.min(Math.round(cy * nativeCanvas.height / disp.height), nativeCanvas.height - 1));
    const px = nativeCanvas.getContext('2d').getImageData(nx, ny, 1, 1).data;
    const { h, s, v } = rgbToHsv(px[0], px[1], px[2]);

    drawArrow(h, s, v);
    updateValues(h, s, v);
  }

  function onMouseLeave() {
    const overlay = document.getElementById('hsv-overlay');
    if (overlay) overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
    startAutoPlay();
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  function init() {
    const imgCanvas = document.getElementById('hsv-img-canvas');
    if (!imgCanvas) return;

    buildWheel();
    buildDots();
    drawArrow(0, 0, 0);
    switchSample(0);
    startAutoPlay();

    imgCanvas.addEventListener('mousemove',  onMouseMove);
    imgCanvas.addEventListener('mouseleave', onMouseLeave);

    const slider = document.getElementById('hsv-opacity');
    if (slider) {
      slider.addEventListener('input', () => {
        imgCanvas.style.opacity = slider.value / 100;
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// ---------- Copy BibTeX ----------
function copyBibtex() {
  const text = document.getElementById('bibtex-text').innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.copy-btn');
    const icon = btn.querySelector('i');
    icon.className = 'fas fa-check';
    btn.style.background = '#4ade80';
    btn.style.color = '#0d0f14';
    setTimeout(() => {
      icon.className = 'fas fa-copy';
      btn.style.background = '';
      btn.style.color = '';
    }, 2000);
  });
}

// ---------- Intersection Observer: fade-in sections ----------
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08 }
);

document.querySelectorAll('.section, .method-card, figure, .video-item').forEach((el) => {
  el.classList.add('fade-in');
  observer.observe(el);
});

// ---------- Lazy-load videos ----------
// Pause autoplay videos when they leave the viewport to save resources
const videoObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  },
  { threshold: 0.2 }
);

document.querySelectorAll('video[autoplay]').forEach((v) => videoObserver.observe(v));

// ---------- Smooth active nav highlighting ----------
// If you add a <nav> bar later, this snippet tracks which section is in view
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('nav a[href^="#"]');

if (navLinks.length > 0) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navLinks.forEach((link) => link.classList.remove('active'));
          const active = document.querySelector(`nav a[href="#${entry.target.id}"]`);
          if (active) active.classList.add('active');
        }
      });
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );
  sections.forEach((s) => sectionObserver.observe(s));
}
