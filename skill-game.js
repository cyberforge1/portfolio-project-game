// skill-game.js


   (function () {
    const MIN_WIDTH = 768;
    const BOUNCE_WALL = 0.85;
    const BOUNCE_TILE = 0.92;
    const FRICTION = 0.995;
    const MAX_DT = 1 / 30;
    const KICK_SCALE = 1.1;
    const MIN_KICK = 120;
  
    const THROW_SCALE      = 1.0;
    const THROW_MIN_SPEED  = 80;
    const THROW_MAX_SPEED  = 2000;
  
    const isGameEnabled = () => window.innerWidth >= MIN_WIDTH;
  
    const getSectionById = (id) => document.querySelector(`section#${id}`) || null;
  
    function computeGameBounds() {
      const projects = document.querySelector("section#projects");
      const skills   = document.querySelector("section#skills");
      if (!projects || !skills) return null;
  
      const projTop    = projects.getBoundingClientRect().top + window.scrollY;
      const skillsRect = skills.getBoundingClientRect();
      const skillsBot  = skillsRect.bottom + window.scrollY;
  
      return {
        top: projTop,
        bottom: skillsBot,
        height: skillsBot - projTop
      };
    }
  
    function ensureBoundsOverlay(zone) {
      zone.querySelectorAll(".skill-game-bounds").forEach((el, i) => { if (i > 0) el.remove(); });
      let frame = zone.querySelector(".skill-game-bounds");
      if (!frame) {
        frame = document.createElement("div");
        frame.className = "skill-game-bounds";
        const label = document.createElement("div");
        label.className = "skill-game-bounds__label";
        frame.appendChild(label);
        zone.appendChild(frame);
      }
    }
  
    function ensureGameZone(bounds) {
      const zones = document.querySelectorAll("#skill-game-zone");
      zones.forEach((z, idx) => { if (idx > 0) z.remove(); });
  
      let zone = document.getElementById("skill-game-zone");
      if (!zone) {
        zone = document.createElement("div");
        zone.id = "skill-game-zone";
        document.body.appendChild(zone);
      }
      zone.style.position = "absolute";
      zone.style.left     = "0px";
      zone.style.top      = bounds.top + "px";
      zone.style.height   = bounds.height + "px";
      zone.style.width    = document.documentElement.clientWidth + "px";
      zone.style.overflow = "hidden";
      zone.style.pointerEvents = "auto";
      ensureBoundsOverlay(zone);
      return zone;
    }
  
    function snapshotOriginalRects(cards) {
      return cards.map(card => {
        const r = card.getBoundingClientRect();
        return {
          el: card,
          left: r.left + window.scrollX,
          top:  r.top  + window.scrollY,
          width: r.width,
          height: r.height
        };
      });
    }
  
    function toLocalClamped(pageLeft, pageTop, w, h, zone) {
      const zr = zone.getBoundingClientRect();
      const zoneLeft   = zr.left + window.scrollX;
      const zoneTop    = zr.top  + window.scrollY;
      const zoneRight  = zoneLeft + zr.width;
      const zoneBottom = zoneTop  + zr.height;
  
      const minLeft = zoneLeft;
      const minTop  = zoneTop;
      const maxLeft = Math.max(zoneLeft, zoneRight  - w);
      const maxTop  = Math.max(zoneTop,  zoneBottom - h);
  
      const clampedLeft = Math.min(Math.max(pageLeft, minLeft), maxLeft);
      const clampedTop  = Math.min(Math.max(pageTop,  minTop),  maxTop);
  
      return { localLeft: clampedLeft - zoneLeft, localTop: clampedTop - zoneTop };
    }
  
    function renderCloneAtLocalPos(localLeft, localTop, clone) {
      clone.style.position = "absolute";
      clone.style.left = `${localLeft}px`;
      clone.style.top  = `${localTop}px`;
      clone.style.pointerEvents = "auto";
      clone.style.margin = "0";
      clone.style.boxSizing = "border-box";
    }
  
    const FLASH_COOLDOWN_MS = 1000;
    const lastFlashAt = new WeakMap();
  
    function triggerImpact(el) {
      if (!el) return;
      const now = performance.now();
      const last = lastFlashAt.get(el) || 0;
      if (now - last < FLASH_COOLDOWN_MS) {
        return;
      }
      lastFlashAt.set(el, now);
  
      el.classList.remove("tile-hit");
      void el.offsetWidth;
      el.classList.add("tile-hit");
  
      setTimeout(() => el.classList.remove("tile-hit"), 260);
    }
  
    function getExitButtons() {
      return {
        top: document.getElementById("end-game-top"),
        bottom: document.getElementById("end-game-bottom"),
      };
    }
    function showExitButtons() {
      const { top, bottom } = getExitButtons();
      if (top) top.classList.remove("is-hidden");
      if (bottom) bottom.classList.remove("is-hidden");
    }
    function hideExitButtons() {
      const { top, bottom } = getExitButtons();
      if (top) top.classList.add("is-hidden");
      if (bottom) bottom.classList.add("is-hidden");
    }
  
    const state = {
      built: false,
      building: false,
      zone: null,
      clonesByOriginal: new Map(),
      localPos: new WeakMap(),
      velocity: new WeakMap(),
      drag: null,
      anim: { running: false, lastT: 0 }
    };
  
    function buildWorldOnce(clickedOriginal, startX, startY) {
      if (state.built || state.building || !isGameEnabled()) return;
      state.building = true;

      document.body.classList.add("game-active");
      window.dispatchEvent(new CustomEvent("game:start"));
  
      const bounds = computeGameBounds();
      if (!bounds) { state.building = false; return; }
  
      document.body.classList.add("freeze-skill-layout");
  
      const originals = Array.from(document.querySelectorAll(".img-background-card"));
      const snaps = snapshotOriginalRects(originals);
  
      const zone = ensureGameZone(bounds);
      state.zone = zone;
  
      snaps.forEach(({ el, left, top, width, height }) => {
        const clone = el.cloneNode(true);
        clone.classList.add("skill-drag-clone");
        clone.style.width  = width + "px";
        clone.style.height = height + "px";
        zone.appendChild(clone);
  
        const { localLeft, localTop } = toLocalClamped(left, top, width, height, zone);
        renderCloneAtLocalPos(localLeft, localTop, clone);
  
        state.clonesByOriginal.set(el, clone);
        state.localPos.set(clone, { x: localLeft, y: localTop, w: width, h: height });
        state.velocity.set(clone, { vx: 0, vy: 0 });
  
        el.classList.add("skill-original-ghost");
      });
  
      zone.addEventListener("mousedown", onCloneMouseDown);
  
      state.built = true;
      state.building = false;
      document.body.classList.remove("freeze-skill-layout");
  
      startAnimLoop();

      window.addEventListener("keydown", onKeyDownForEnd);
      const { top: btnTop, bottom: btnBottom } = getExitButtons();
      if (btnTop && !btnTop.__boundEnd) { btnTop.addEventListener("click", endGame); btnTop.__boundEnd = true; }
      if (btnBottom && !btnBottom.__boundEnd) { btnBottom.addEventListener("click", endGame); btnBottom.__boundEnd = true; }
      showExitButtons();
  
      if (clickedOriginal) {
        const targetClone = state.clonesByOriginal.get(clickedOriginal);
        if (targetClone) startDrag(targetClone, startX, startY);
      }
    }
  
    function startDrag(clone, pageX, pageY) {
      const zr = state.zone.getBoundingClientRect();
      const zoneLeft = zr.left + window.scrollX;
      const zoneTop  = zr.top  + window.scrollY;
  
      const cr = clone.getBoundingClientRect();
      const localX = cr.left + window.scrollX - zoneLeft;
      const localY = cr.top  + window.scrollY - zoneTop;
  
      const offsetX = pageX - (cr.left + window.scrollX);
      const offsetY = pageY - (cr.top  + window.scrollY);
  
      state.drag = {
        clone,
        offsetX,
        offsetY,
        lastX: localX,
        lastY: localY,
        vx: 0,
        vy: 0,
        lastT: performance.now()
      };
  
      clone.classList.add("picked-up");
      clone.style.zIndex = "10001";
  
      document.body.classList.add("dragging-skill");
  
      window.addEventListener("mousemove", onMouseMove, { passive: false });
      window.addEventListener("mouseup", onMouseUp,   { once: true });
    }
  
    function onCloneMouseDown(e) {
      if (e.button !== 0) return;
      if (!isGameEnabled() || !state.built) return;
  
      const clone = e.target.closest(".skill-drag-clone");
      if (!clone) return;
  
      e.preventDefault();
      startDrag(clone, e.pageX, e.pageY);
    }
  
    function onMouseMove(e) {
      if (!state.drag) return;
  
      const d = state.drag;
      const zr = state.zone.getBoundingClientRect();
      const zoneLeft = zr.left + window.scrollX;
      const zoneTop  = zr.top  + window.scrollY;
  
      const lp = state.localPos.get(d.clone);
      if (!lp) return;
      const { w, h } = lp;
  
      let localLeft = (e.pageX - d.offsetX) - zoneLeft;
      let localTop  = (e.pageY - d.offsetY) - zoneTop;
  
      const maxX = Math.max(0, zr.width  - w);
      const maxY = Math.max(0, zr.height - h);
      localLeft = Math.min(Math.max(localLeft, 0), maxX);
      localTop  = Math.min(Math.max(localTop,  0), maxY);
  
      const now = performance.now();
      const dt = Math.max(0.001, (now - d.lastT) / 1000);
      d.vx = (localLeft - d.lastX) / dt;
      d.vy = (localTop  - d.lastY) / dt;
      d.lastX = localLeft;
      d.lastY = localTop;
      d.lastT = now;
  
      renderCloneAtLocalPos(localLeft, localTop, d.clone);
      state.localPos.set(d.clone, { x: localLeft, y: localTop, w, h });
    }
  
    function onMouseUp() {
      if (!state.drag) return;
  
      const { clone, vx, vy } = state.drag;
  
      const speed = Math.hypot(vx, vy);
      if (speed >= THROW_MIN_SPEED) {
        const sx = Math.max(-THROW_MAX_SPEED, Math.min(THROW_MAX_SPEED, vx * THROW_SCALE));
        const sy = Math.max(-THROW_MAX_SPEED, Math.min(THROW_MAX_SPEED, vy * THROW_SCALE));
        state.velocity.set(clone, { vx: sx, vy: sy });
      } else {
        state.velocity.set(clone, { vx: 0, vy: 0 });
      }
  
      clone.classList.remove("picked-up");
      clone.style.removeProperty("z-index");
      document.body.classList.remove("dragging-skill");
  
      window.removeEventListener("mousemove", onMouseMove);
      state.drag = null;
    }
  
    function startAnimLoop() {
      if (state.anim.running) return;
      state.anim.running = true;
      state.anim.lastT = performance.now();
      requestAnimationFrame(tick);
    }
  
    function tick(t) {
      if (!state.anim.running) return;
  
      let dt = (t - state.anim.lastT) / 1000;
      state.anim.lastT = t;
      if (!isFinite(dt) || dt <= 0) dt = 0.016;
      if (dt > MAX_DT) dt = MAX_DT;
  
      stepPhysics(dt);
      requestAnimationFrame(tick);
    }
  
    function stepPhysics(dt) {
      if (!state.built || !state.zone) return;
  
      if (state.drag && state.drag.clone) {
        if (!state.drag.clone.classList.contains("picked-up")) {
          state.drag.clone.classList.add("picked-up");
        }
        state.drag.clone.style.zIndex = "10001";
      }
  
      const zr = state.zone.getBoundingClientRect();
      const zoneW = zr.width;
      const zoneH = zr.height;
  
      const movers = [];
      state.clonesByOriginal.forEach((clone) => {
        if (state.drag && clone === state.drag.clone) return;
        const lp  = state.localPos.get(clone);
        const vel = state.velocity.get(clone);
        if (!lp || !vel) return;
        movers.push({ clone, lp, vel });
      });
  
      for (const m of movers) {
        m.lp.x += m.vel.vx * dt;
        m.lp.y += m.vel.vy * dt;
  
        if (m.lp.x < 0) {
          m.lp.x = 0;
          m.vel.vx = -m.vel.vx * BOUNCE_WALL;
          triggerImpact(m.clone);
        } else if (m.lp.x + m.lp.w > zoneW) {
          m.lp.x = zoneW - m.lp.w;
          m.vel.vx = -m.vel.vx * BOUNCE_WALL;
          triggerImpact(m.clone);
        }
  
        if (m.lp.y < 0) {
          m.lp.y = 0;
          m.vel.vy = -m.vel.vy * BOUNCE_WALL;
          triggerImpact(m.clone);
        } else if (m.lp.y + m.lp.h > zoneH) {
          m.lp.y = zoneH - m.lp.h;
          m.vel.vy = -m.vel.vy * BOUNCE_WALL;
          triggerImpact(m.clone);
        }
      }
  
      if (state.drag) {
        const dLP = state.localPos.get(state.drag.clone);
        if (dLP) {
          const dragRect = { x: dLP.x, y: dLP.y, w: dLP.w, h: dLP.h };
          const dragVX = state.drag.vx, dragVY = state.drag.vy;
  
          for (const m of movers) {
            resolveAgainstDragged(m.lp, m.vel, dragRect, dragVX, dragVY, zoneW, zoneH, m.clone);
          }
        }
      }
  
      for (let i = 0; i < movers.length; i++) {
        for (let j = i + 1; j < movers.length; j++) {
          resolvePairwise(movers[i], movers[j], zoneW, zoneH);
        }
      }
  
      for (const m of movers) {
        m.vel.vx *= Math.pow(FRICTION, dt * 60);
        m.vel.vy *= Math.pow(FRICTION, dt * 60);
  
        if (m.lp.x < 0) m.lp.x = 0;
        if (m.lp.y < 0) m.lp.y = 0;
        if (m.lp.x + m.lp.w > zoneW) m.lp.x = zoneW - m.lp.w;
        if (m.lp.y + m.lp.h > zoneH) m.lp.y = zoneH - m.lp.h;
  
        renderCloneAtLocalPos(m.lp.x, m.lp.y, m.clone);
        state.localPos.set(m.clone, m.lp);
        state.velocity.set(m.clone, m.vel);
      }
    }
  
    function resolveAgainstDragged(lp, vel, dragRect, dragVX, dragVY, zoneW, zoneH, movingClone) {
      const overlapX = Math.max(0, Math.min(lp.x + lp.w, dragRect.x + dragRect.w) - Math.max(lp.x, dragRect.x));
      const overlapY = Math.max(0, Math.min(lp.y + lp.h, dragRect.y + dragRect.h) - Math.max(lp.y, dragRect.y));
      if (overlapX <= 0 || overlapY <= 0) return;
  
      triggerImpact(movingClone);
      if (state.drag && state.drag.clone) triggerImpact(state.drag.clone);
  
      if (overlapX < overlapY) {
        if (lp.x + lp.w / 2 < dragRect.x + dragRect.w / 2) {
          lp.x -= overlapX;
          vel.vx = -Math.abs(dragVX) * KICK_SCALE;
          if (Math.abs(vel.vx) < MIN_KICK) vel.vx = -MIN_KICK;
        } else {
          lp.x += overlapX;
          vel.vx = Math.abs(dragVX) * KICK_SCALE;
          if (Math.abs(vel.vx) < MIN_KICK) vel.vx =  MIN_KICK;
        }
        vel.vy += dragVY * 0.2;
      } else {
        if (lp.y + lp.h / 2 < dragRect.y + dragRect.h / 2) {
          lp.y -= overlapY;
          vel.vy = -Math.abs(dragVY) * KICK_SCALE;
          if (Math.abs(vel.vy) < MIN_KICK) vel.vy = -MIN_KICK;
        } else {
          lp.y += overlapY;
          vel.vy = Math.abs(dragVY) * KICK_SCALE;
          if (Math.abs(vel.vy) < MIN_KICK) vel.vy =  MIN_KICK;
        }
        vel.vx += dragVX * 0.2;
      }
  
      if (lp.x < 0) lp.x = 0;
      if (lp.y < 0) lp.y = 0;
      if (lp.x + lp.w > zoneW) lp.x = zoneW - lp.w;
      if (lp.y + lp.h > zoneH) lp.y = zoneH - lp.h;
    }
  
    function resolvePairwise(a, b, zoneW, zoneH) {
      const ax2 = a.lp.x + a.lp.w, ay2 = a.lp.y + a.lp.h;
      const bx2 = b.lp.x + b.lp.w, by2 = b.lp.y + b.lp.h;
  
      const overlapX = Math.max(0, Math.min(ax2, bx2) - Math.max(a.lp.x, b.lp.x));
      const overlapY = Math.max(0, Math.min(ay2, by2) - Math.max(a.lp.y, b.lp.y));
      if (overlapX <= 0 || overlapY <= 0) return;
  
      triggerImpact(a.clone);
      triggerImpact(b.clone);
  
      if (overlapX < overlapY) {
        if (a.lp.x + a.lp.w / 2 < b.lp.x + b.lp.w / 2) {
          a.lp.x -= overlapX / 2;
          b.lp.x += overlapX / 2;
        } else {
          a.lp.x += overlapX / 2;
          b.lp.x -= overlapX / 2;
        }
        const tmp = a.vel.vx;
        a.vel.vx = b.vel.vx * BOUNCE_TILE;
        b.vel.vx = tmp       * BOUNCE_TILE;
      } else {
        if (a.lp.y + a.lp.h / 2 < b.lp.y + b.lp.h / 2) {
          a.lp.y -= overlapY / 2;
          b.lp.y += overlapY / 2;
        } else {
          a.lp.y += overlapY / 2;
          b.lp.y -= overlapY / 2;
        }
        const tmp = a.vel.vy;
        a.vel.vy = b.vel.vy * BOUNCE_TILE;
        b.vel.vy = tmp       * BOUNCE_TILE;
      }
  
      if (a.lp.x < 0) a.lp.x = 0;
      if (a.lp.y < 0) a.lp.y = 0;
      if (a.lp.x + a.lp.w > zoneW) a.lp.x = zoneW - a.lp.w;
      if (a.lp.y + a.lp.h > zoneH) a.lp.y = zoneH - a.lp.h;
  
      if (b.lp.x < 0) b.lp.x = 0;
      if (b.lp.y < 0) b.lp.y = 0;
      if (b.lp.x + b.lp.w > zoneW) b.lp.x = zoneW - b.lp.w;
      if (b.lp.y + b.lp.h > zoneH) b.lp.y = zoneH - b.lp.h;
    }
  
    function realignAllClones() {
      if (!state.built || !state.zone) return;
  
      const bounds = computeGameBounds();
      if (!bounds) return;
  
      const zone = ensureGameZone(bounds);
      state.zone = zone;
  
      const zr = zone.getBoundingClientRect();
      const zoneW = zr.width;
      const zoneH = zr.height;
  
      state.clonesByOriginal.forEach((clone) => {
        const lp = state.localPos.get(clone);
        if (!lp) return;
        let { x, y, w, h } = lp;
  
        if (x + w > zoneW) x = Math.max(0, zoneW - w);
        if (y + h > zoneH) y = Math.max(0, zoneH - h);
        if (x < 0) x = 0;
        if (y < 0) y = 0;
  
        renderCloneAtLocalPos(x, y, clone);
        state.localPos.set(clone, { x, y, w, h });
      });
    }
  
    function onResize() {
      if (!isGameEnabled()) {
        if (state.built) {
          if (state.zone) state.zone.remove();
          state.clonesByOriginal.forEach((clone, original) => {
            original.classList.remove("skill-original-ghost");
          });
          state.clonesByOriginal.clear();
          state.localPos = new WeakMap();
          state.velocity = new WeakMap();
          state.zone = null;
          state.built = false;
          state.building = false;
          state.anim.running = false;
          hideExitButtons();
          window.removeEventListener("keydown", onKeyDownForEnd);
        }
        return;
      }
      realignAllClones();
    }
  
    function onOriginalMouseDown(e) {
      if (e.button !== 0) return;
      if (!isGameEnabled()) return;
      e.preventDefault();
      e.stopPropagation();
      buildWorldOnce(e.currentTarget, e.pageX, e.pageY);
    }
  
    function bindOriginals() {
      document.querySelectorAll(".img-background-card").forEach((el) => {
        if (!el.__skillInitBound) {
          el.addEventListener("mousedown", onOriginalMouseDown);
          el.addEventListener("dragstart", (ev) => ev.preventDefault());
          el.__skillInitBound = true;
        }
      });
    }
  
    function onKeyDownForEnd(e) {
      if (e.key === "Escape" || e.key === "Esc") {
        if (state.built) {
          e.preventDefault();
          endGame();
        }
      }
    }
  
    function endGame() {
      state.anim.running = false;
  
      if (state.zone) {
        state.zone.removeEventListener("mousedown", onCloneMouseDown);
        state.zone.remove();
      }
  
      state.clonesByOriginal.forEach((clone, original) => {
        original.classList.remove("skill-original-ghost");
      });
      state.clonesByOriginal.clear();
      state.localPos = new WeakMap();
      state.velocity = new WeakMap();
  
      if (state.drag && state.drag.clone) {
        state.drag.clone.classList.remove("picked-up");
        state.drag.clone.style.removeProperty("z-index");
      }
      state.drag = null;
  
      document.body.classList.remove("dragging-skill");
      document.body.classList.remove("freeze-skill-layout");
  
      state.zone = null;
      state.built = false;
      state.building = false;
  
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDownForEnd);
  
      hideExitButtons();
    }
  
    document.addEventListener("DOMContentLoaded", bindOriginals);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", realignAllClones, { passive: true });
  })();
  