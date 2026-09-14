(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const root = document.documentElement;
  root.removeAttribute("data-theme");
  try {
    localStorage.removeItem("ow-theme");
  } catch (_) {}

  const hero = document.getElementById("top");
  if (hero && "IntersectionObserver" in window) {
    const homeObserver = new IntersectionObserver(
      ([entry]) => {
        document.body.classList.toggle(
          "is-away-from-home",
          !entry.isIntersecting
        );
      },
      { threshold: 0.45 }
    );
    homeObserver.observe(hero);
  } else if (hero) {
    const syncHomeState = () => {
      const rect = hero.getBoundingClientRect();
      const visible =
        rect.top < window.innerHeight * 0.55 &&
        rect.bottom > window.innerHeight * 0.2;
      document.body.classList.toggle("is-away-from-home", !visible);
    };
    syncHomeState();
    window.addEventListener("scroll", syncHomeState, { passive: true });
  }

  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
      });
    });
  }

  const stages = document.querySelectorAll(".stage");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    stages.forEach((stage) => observer.observe(stage));
  } else {
    stages.forEach((stage) => stage.classList.add("is-visible"));
  }

  // Native snap scrolling — browser handles section snaps
  const panels = Array.from(document.querySelectorAll(".snap-panel"));

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href")?.slice(1);
      if (!id) return;
      const target = panels.find((panel) => panel.id === id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (history.replaceState) {
        history.replaceState(null, "", `#${id}`);
      }
    });
  });

  const canvas = document.getElementById("hero-graph-canvas");
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext("2d");
  const nodes = [];
  const edges = [];
  const adj = new Map();
  const signals = [];
  let width = 0;
  let height = 0;
  let animationId = 0;
  let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastTs = 0;
  let logoImage = null;
  let logoReady = false;
  let logoLayout = null;

  function brandColors() {
    const styles = getComputedStyle(root);
    return {
      brand: styles.getPropertyValue("--brand").trim() || "#001850",
      accent: styles.getPropertyValue("--accent").trim() || "#0f7a66",
    };
  }

  function hexToRgb(hex) {
    const clean = hex.replace("#", "").trim();
    if (clean.length === 3) {
      return [
        parseInt(clean[0] + clean[0], 16),
        parseInt(clean[1] + clean[1], 16),
        parseInt(clean[2] + clean[2], 16),
      ];
    }
    if (clean.length >= 6) {
      return [
        parseInt(clean.slice(0, 2), 16),
        parseInt(clean.slice(2, 4), 16),
        parseInt(clean.slice(4, 6), 16),
      ];
    }
    return [0, 24, 80];
  }

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function loadLogo() {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = "assets/brand-mark.png";
    });
  }

  function computeLogoLayout() {
    if (!logoImage || !width || !height) return null;
    const pad = 0.04;
    const availW = width * (1 - pad * 2);
    const availH = height * (1 - pad * 2);
    const scale = Math.min(availW / logoImage.width, availH / logoImage.height);
    const drawW = logoImage.width * scale;
    const drawH = logoImage.height * scale;
    const offsetX = (width - drawW) / 2;
    const offsetY = (height - drawH) / 2;
    return { scale, drawW, drawH, offsetX, offsetY };
  }

  function sampleLogoNodes() {
    if (!logoImage) return [];
    const sample = document.createElement("canvas");
    const maxSide = 280;
    const scale = Math.min(1, maxSide / Math.max(logoImage.width, logoImage.height));
    sample.width = Math.max(1, Math.floor(logoImage.width * scale));
    sample.height = Math.max(1, Math.floor(logoImage.height * scale));
    const sctx = sample.getContext("2d", { willReadFrequently: true });
    sctx.drawImage(logoImage, 0, 0, sample.width, sample.height);
    const { data } = sctx.getImageData(0, 0, sample.width, sample.height);

    const candidates = [];
    const step = 5;
    for (let y = 0; y < sample.height; y += step) {
      for (let x = 0; x < sample.width; x += step) {
        const i = (y * sample.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 120) continue;
        if (r > 230 && g > 230 && b > 230) continue;
        const brightness = (r + g + b) / 3;
        if (brightness > 210) continue;
        candidates.push({
          nx: x / sample.width,
          ny: y / sample.height,
          weight: 255 - brightness,
        });
      }
    }

    candidates.sort((a, b) => b.weight - a.weight);
    const selected = [];
    const minDist = 0.052;
    const targetCount = Math.min(52, Math.max(30, Math.floor(candidates.length / 12)));

    for (const c of candidates) {
      if (selected.length >= targetCount) break;
      const ok = selected.every((s) => {
        const dx = s.nx - c.nx;
        const dy = s.ny - c.ny;
        return Math.hypot(dx, dy) >= minDist;
      });
      if (ok) selected.push(c);
    }

    return selected;
  }

  function positionNodes() {
    if (!logoLayout) return;
    const { offsetX, offsetY, drawW, drawH } = logoLayout;
    for (const node of nodes) {
      node.x = offsetX + node.nx * drawW;
      node.y = offsetY + node.ny * drawH;
    }
  }

  function buildGraphFromLogo() {
    nodes.length = 0;
    edges.length = 0;
    adj.clear();
    signals.length = 0;
    logoLayout = computeLogoLayout();
    if (!logoLayout) return;

    const samples = sampleLogoNodes();
    samples.forEach((s, idx) => {
      nodes.push({
        id: idx,
        nx: s.nx,
        ny: s.ny,
        x: 0,
        y: 0,
        r: 3.4 + Math.random() * 1.8,
        pulse: 0,
        phase: Math.random() * Math.PI * 2,
        hue: 210 - s.nx * 95,
      });
      adj.set(idx, []);
    });

    const maxDist = 0.145;
    const maxNeighbors = 3;
    for (let i = 0; i < nodes.length; i += 1) {
      const dists = [];
      for (let j = 0; j < nodes.length; j += 1) {
        if (i === j) continue;
        const d = Math.hypot(nodes[i].nx - nodes[j].nx, nodes[i].ny - nodes[j].ny);
        if (d <= maxDist) dists.push({ j, d });
      }
      dists.sort((a, b) => a.d - b.d);
      dists.slice(0, maxNeighbors).forEach(({ j }) => {
        const a = Math.min(i, j);
        const b = Math.max(i, j);
        if (!edges.some((e) => e.a === a && e.b === b)) {
          edges.push({ a, b });
          adj.get(a).push(b);
          adj.get(b).push(a);
        }
      });
    }

    for (let i = 0; i < nodes.length; i += 1) {
      if ((adj.get(i) || []).length) continue;
      let best = -1;
      let bestD = Infinity;
      for (let j = 0; j < nodes.length; j += 1) {
        if (i === j) continue;
        const d = Math.hypot(nodes[i].nx - nodes[j].nx, nodes[i].ny - nodes[j].ny);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      if (best >= 0) {
        const a = Math.min(i, best);
        const b = Math.max(i, best);
        edges.push({ a, b });
        adj.get(a).push(b);
        adj.get(b).push(a);
      }
    }

    positionNodes();

    for (let s = 0; s < 3; s += 1) {
      const start = Math.floor(Math.random() * nodes.length);
      const neighbors = adj.get(start) || [];
      const next =
        neighbors.length > 0
          ? neighbors[Math.floor(Math.random() * neighbors.length)]
          : start;
      signals.push({
        from: start,
        to: next,
        t: Math.random(),
        speed: 0.55 + Math.random() * 0.4,
        trail: [],
      });
    }
  }

  function pickNextNode(current, previous) {
    const neighbors = adj.get(current) || [];
    if (!neighbors.length) return current;
    const options = neighbors.filter((n) => n !== previous);
    const pool = options.length ? options : neighbors;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function pointOnEdge(fromId, toId, t) {
    const a = nodes[fromId];
    const b = nodes[toId];
    if (!a || !b) return { x: 0, y: 0 };
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    if (!logoReady || !logoLayout || !nodes.length) return;

    const { offsetX, offsetY, drawW, drawH } = logoLayout;

    // Brighter logo silhouette — closer to the real mark
    ctx.save();
    ctx.globalAlpha = 0.58;
    ctx.drawImage(logoImage, offsetX, offsetY, drawW, drawH);
    ctx.restore();

    // Soft glow behind structure
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.filter = "blur(10px)";
    ctx.drawImage(logoImage, offsetX, offsetY, drawW, drawH);
    ctx.restore();
    ctx.filter = "none";

    ctx.lineWidth = 1.35;
    for (const edge of edges) {
      const a = nodes[edge.a];
      const b = nodes[edge.b];
      if (!a || !b) continue;
      const midHue = ((a.hue || 180) + (b.hue || 180)) / 2;
      ctx.strokeStyle = `hsla(${midHue}, 85%, 42%, 0.55)`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (const signal of signals) {
      if (signal.trail.length < 2) continue;
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "rgba(40, 210, 180, 0.45)";
      ctx.beginPath();
      signal.trail.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }

    for (const node of nodes) {
      const glow = Math.max(0, node.pulse);
      const r = node.r + glow * 2.8;
      const hue = node.hue || 180;

      if (glow > 0.05) {
        ctx.beginPath();
        ctx.fillStyle = `hsla(${hue}, 90%, 55%, ${0.28 * glow})`;
        ctx.arc(node.x, node.y, r + 9, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.fillStyle = `hsla(${hue}, 88%, 48%, 0.95)`;
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.arc(node.x, node.y, Math.max(1.5, r * 0.38), 0, Math.PI * 2);
      ctx.fill();
    }

    for (const signal of signals) {
      const pos = pointOnEdge(signal.from, signal.to, signal.t);
      signal.trail.push({ x: pos.x, y: pos.y });
      if (signal.trail.length > 22) signal.trail.shift();

      for (let i = 0; i < signal.trail.length; i += 1) {
        const p = signal.trail[i];
        const alpha = ((i + 1) / signal.trail.length) * 0.55;
        ctx.beginPath();
        ctx.fillStyle = `rgba(64, 230, 200, ${alpha})`;
        ctx.arc(p.x, p.y, 1.8 + (i / signal.trail.length) * 2.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.fillStyle = "rgba(80, 255, 220, 0.98)";
      ctx.arc(pos.x, pos.y, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.arc(pos.x, pos.y, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function step(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    const onHero = !document.body.classList.contains("is-away-from-home");
    if (!onHero) {
      animationId = 0;
      lastTs = 0;
      return;
    }

    if (!reducedMotion && nodes.length && logoLayout) {
      for (const node of nodes) {
        const baseX = logoLayout.offsetX + node.nx * logoLayout.drawW;
        const baseY = logoLayout.offsetY + node.ny * logoLayout.drawH;
        node.x = baseX + Math.sin(ts / 1200 + node.phase) * 1.1;
        node.y = baseY + Math.cos(ts / 1400 + node.phase) * 1.1;
        node.pulse = Math.max(0, node.pulse - dt * 1.5);
      }

      for (const signal of signals) {
        signal.t += signal.speed * dt;
        if (signal.t >= 1) {
          signal.t = 0;
          const arrived = signal.to;
          if (nodes[arrived]) nodes[arrived].pulse = 1;
          const next = pickNextNode(arrived, signal.from);
          signal.from = arrived;
          signal.to = next;
        }
      }
    } else if (nodes.length) {
      positionNodes();
    }

    draw();
    animationId = requestAnimationFrame(step);
  }

  async function start() {
    cancelAnimationFrame(animationId);
    lastTs = 0;
    resize();
    if (!logoReady) {
      try {
        logoImage = await loadLogo();
        logoReady = true;
      } catch (_) {
        logoReady = false;
      }
    }
    if (logoReady) buildGraphFromLogo();
    animationId = requestAnimationFrame(step);
  }

  const resumeGraph = () => {
    if (
      !document.body.classList.contains("is-away-from-home") &&
      !animationId
    ) {
      lastTs = 0;
      animationId = requestAnimationFrame(step);
    }
  };

  start();
  window.addEventListener("resize", () => {
    start();
  });
  const classObserver = new MutationObserver(resumeGraph);
  classObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  window
    .matchMedia("(prefers-reduced-motion: reduce)")
    .addEventListener("change", (event) => {
      reducedMotion = event.matches;
      start();
    });
})();
