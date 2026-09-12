(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

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

  const canvas = document.getElementById("graph-canvas");
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext("2d");
  const nodes = [];
  const links = [];
  let width = 0;
  let height = 0;
  let animationId = 0;
  let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedGraph() {
    nodes.length = 0;
    links.length = 0;
    const count = Math.max(28, Math.floor((width * height) / 45000));

    for (let i = 0; i < count; i += 1) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.6 + 0.8,
      });
    }

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        if (Math.random() > 0.92) links.push([i, j]);
      }
    }
  }

  function step() {
    ctx.clearRect(0, 0, width, height);

    for (const node of nodes) {
      if (!reducedMotion) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;
      }
    }

    ctx.lineWidth = 1;
    for (const [a, b] of links) {
      const n1 = nodes[a];
      const n2 = nodes[b];
      const dx = n1.x - n2.x;
      const dy = n1.y - n2.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 220) continue;
      const alpha = (1 - dist / 220) * 0.28;
      ctx.strokeStyle = `rgba(63, 191, 154, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(n1.x, n1.y);
      ctx.lineTo(n2.x, n2.y);
      ctx.stroke();
    }

    for (const node of nodes) {
      ctx.fillStyle = "rgba(231, 239, 234, 0.55)";
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!reducedMotion) animationId = requestAnimationFrame(step);
  }

  function start() {
    cancelAnimationFrame(animationId);
    resize();
    seedGraph();
    step();
  }

  start();
  window.addEventListener("resize", start);
  window
    .matchMedia("(prefers-reduced-motion: reduce)")
    .addEventListener("change", (event) => {
      reducedMotion = event.matches;
      start();
    });
})();
