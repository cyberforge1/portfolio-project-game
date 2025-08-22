/* ==========================================================
   Skill Tile Game — build-on-first-click + drag + bounce
   ========================================================== */
   (function () {
    // -------- Config --------
    const MIN_WIDTH = 768;     // enable on small tablets and up
    const BOUNCE = 0.85;       // wall restitution (0..1)
    const FRICTION = 0.995;    // per-tick damping for moving tiles
    const MAX_DT = 1 / 30;     // clamp big frame gaps (s)
    const KICK_SCALE = 1.1;    // scale the drag velocity imparted to other tiles
    const MIN_KICK = 120;      // px/s, minimum impulse when drag is very slow
  
    // -------- Feature gate --------
    const isGameEnabled = () => window.innerWidth >= MIN_WIDTH;
  
    // -------- DOM helpers --------
    const getSectionById = (id) => document.querySelector(`section#${id}`) || null;
  
    // Use the SKILLS section as the Game Area
    function computeGameBounds() {
      const skills = getSectionById("skills");
      if (!skills) return null;
      const r = skills.getBoundingClientRect();
      const top = r.top + window.scrollY;
      return { top, bottom: top + r.height, height: r.height };
    }
  
    // Visual frame inside the zone
    function ensureBoundsOverlay(zone) {
      zone.querySelectorAll(".skill-game-bounds").forEach((el, i) => { if (i > 0) el.remove(); });
      let frame = zone.querySelector(".skill-game-bounds");
      if (!frame) {
        frame = document.createElement("div");
        frame.className = "skill-game-bounds";
        const label = document.createElement("div");
        label.className = "skill-game-bounds__label";
        label.textContent = "Game Area";
        frame.appendChild(label);
        zone.appendChild(frame);
      }
    }
  
    // Ensure a single full-viewport-width zone aligned to bounds
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
      zone.style.overflow = "hidden"; // clips contents
  
      ensureBoundsOverlay(zone);
      return zone;
    }
  
    // Snapshot BEFORE any DOM mutation (absolute page coordinates)
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
  
    // Convert absolute page pos to local zone coordinates (clamped)
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
  
    // Render a clone at LOCAL zone coords
    function renderCloneAtLocalPos(localLeft, localTop, clone) {
      clone.style.position = "absolute";
      clone.style.left = `${localLeft}px`;
      clone.style.top  = `${localTop}px`;
    }
  
    // -------- State --------
    const state = {
      built: false,
      building: false,             // re-entrant build guard
      zone: null,
      clonesByOriginal: new Map(), // originalEl -> cloneEl
      localPos: new WeakMap(),     // cloneEl -> { x, y, w, h }  (zone-local)
      velocity: new WeakMap(),     // cloneEl -> { vx, vy }      (px/s)
      drag: null,                  // { clone, offsetX, offsetY, lastX, lastY, vx, vy }
      anim: { running: false, lastT: 0 }
    };
  
    // -------- Build world (create clones, hide originals) --------
    function buildWorldOnce(clickedOriginal, startX, startY) {
      if (state.built || state.building || !isGameEnabled()) return;
      state.building = true;
  
      const bounds = computeGameBounds();
      if (!bounds) { state.building = false; return; }
  
      document.body.classList.add("freeze-skill-layout");
  
      // 1) Snapshot originals BEFORE any DOM changes
      const originals = Array.from(document.querySelectorAll(".img-background-card"));
      const snaps = snapshotOriginalRects(originals);
  
      // 2) Create/realign zone
      const zone = ensureGameZone(bounds);
      state.zone = zone;
  
      // 3) Create clones at snapshot positions (converted to local), hide originals
      const zr = zone.getBoundingClientRect();
      const zoneLeft = zr.left + window.scrollX;
      const zoneTop  = zr.top  + window.scrollY;
  
      snaps.forEach(({ el, left, top, width, height }) => {
        const clone = el.cloneNode(true);
        clone.classList.add("skill-drag-clone");
        clone.style.width = width + "px";
        clone.style.height = height + "px";
        clone.style.margin = "0";
        clone.style.boxSizing = "border-box";
        zone.appendChild(clone);
  
        const { localLeft, localTop } = toLocalClamped(left, top, width, height, zone);
        renderCloneAtLocalPos(localLeft, localTop, clone);
  
        state.clonesByOriginal.set(el, clone);
        state.localPos.set(clone, { x: localLeft, y: localTop, w: width, h: height });
        state.velocity.set(clone, { vx: 0, vy: 0 });
  
        el.classList.add("skill-original-ghost"); // hide without collapsing layout
      });
  
      // 4) Drag on clones
      zone.addEventListener("mousedown", onCloneMouseDown);
  
      state.built = true;
      state.building = false;
      document.body.classList.remove("freeze-skill-layout");
  
      // Start animation loop once
      startAnimLoop();
  
      // If build initiated via original click, immediately pick up its clone
      if (clickedOriginal) {
        const targetClone = state.clonesByOriginal.get(clickedOriginal);
        if (targetClone) {
          startDrag(targetClone, startX, startY);
        }
      }
    }
  
    // -------- Drag lifecycle --------
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
      document.body.classList.add("dragging-skill");
  
      window.addEventListener("mousemove", onMouseMove, { passive: false });
      window.addEventListener("mouseup", onMouseUp, { once: true });
    }
  
    function onCloneMouseDown(e) {
      if (e.button !== 0) return;       // left button only
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
  
      // Desired local position based on cursor minus initial offset
      let localLeft = (e.pageX - d.offsetX) - zoneLeft;
      let localTop  = (e.pageY - d.offsetY) - zoneTop;
  
      // Clamp to zone
      const maxX = Math.max(0, zr.width  - w);
      const maxY = Math.max(0, zr.height - h);
      localLeft = Math.min(Math.max(localLeft, 0), maxX);
      localTop  = Math.min(Math.max(localTop,  0), maxY);
  
      // Velocity from last sample (local space)
      const now = performance.now();
      const dt = Math.max(0.001, (now - d.lastT) / 1000);
      d.vx = (localLeft - d.lastX) / dt;
      d.vy = (localTop  - d.lastY) / dt;
      d.lastX = localLeft;
      d.lastY = localTop;
      d.lastT = now;
  
      // Render + store
      renderCloneAtLocalPos(localLeft, localTop, d.clone);
      state.localPos.set(d.clone, { x: localLeft, y: localTop, w, h });
    }
  
    function onMouseUp() {
      if (!state.drag) return;
  
      // Option: leave dragged tile static after release:
      state.velocity.set(state.drag.clone, { vx: 0, vy: 0 });
  
      state.drag.clone.classList.remove("picked-up");
      document.body.classList.remove("dragging-skill");
      window.removeEventListener("mousemove", onMouseMove);
      state.drag = null;
    }
  
    // -------- Physics loop (other tiles bounce off dragged tile & walls) --------
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
  
      const zr = state.zone.getBoundingClientRect();
      const zoneW = zr.width;
      const zoneH = zr.height;
  
      // Compute the dragged tile rect (if any) in local coords
      let dragRect = null;
      let dragVX = 0, dragVY = 0;
  
      if (state.drag) {
        const dLP = state.localPos.get(state.drag.clone);
        if (dLP) {
          dragRect = { x: dLP.x, y: dLP.y, w: dLP.w, h: dLP.h };
          dragVX = state.drag.vx;
          dragVY = state.drag.vy;
        }
      }
  
      // Update every clone except the dragged one
      state.clonesByOriginal.forEach((clone) => {
        if (state.drag && clone === state.drag.clone) return;
  
        const lp = state.localPos.get(clone);
        const vel = state.velocity.get(clone);
        if (!lp || !vel) return;
  
        // Integrate position
        lp.x += vel.vx * dt;
        lp.y += vel.vy * dt;
  
        // Wall collisions (AABB)
        // Left/Right
        if (lp.x < 0) {
          lp.x = 0;
          vel.vx = -vel.vx * BOUNCE;
        } else if (lp.x + lp.w > zoneW) {
          lp.x = zoneW - lp.w;
          vel.vx = -vel.vx * BOUNCE;
        }
        // Top/Bottom
        if (lp.y < 0) {
          lp.y = 0;
          vel.vy = -vel.vy * BOUNCE;
        } else if (lp.y + lp.h > zoneH) {
          lp.y = zoneH - lp.h;
          vel.vy = -vel.vy * BOUNCE;
        }
  
        // Collision with dragged tile (AABB vs AABB)
        if (dragRect) {
          const overlapX = Math.max(0, Math.min(lp.x + lp.w, dragRect.x + dragRect.w) - Math.max(lp.x, dragRect.x));
          const overlapY = Math.max(0, Math.min(lp.y + lp.h, dragRect.y + dragRect.h) - Math.max(lp.y, dragRect.y));
          if (overlapX > 0 && overlapY > 0) {
            // Minimum translation axis
            if (overlapX < overlapY) {
              // push horizontally
              if (lp.x + lp.w / 2 < dragRect.x + dragRect.w / 2) {
                lp.x -= overlapX; // move left
                vel.vx = -Math.abs(dragVX) * KICK_SCALE;
                if (Math.abs(vel.vx) < MIN_KICK) vel.vx = -MIN_KICK;
              } else {
                lp.x += overlapX; // move right
                vel.vx = Math.abs(dragVX) * KICK_SCALE;
                if (Math.abs(vel.vx) < MIN_KICK) vel.vx = MIN_KICK;
              }
              // small transfer on Y, proportional to dragVY
              vel.vy += dragVY * 0.2;
            } else {
              // push vertically
              if (lp.y + lp.h / 2 < dragRect.y + dragRect.h / 2) {
                lp.y -= overlapY; // up
                vel.vy = -Math.abs(dragVY) * KICK_SCALE;
                if (Math.abs(vel.vy) < MIN_KICK) vel.vy = -MIN_KICK;
              } else {
                lp.y += overlapY; // down
                vel.vy = Math.abs(dragVY) * KICK_SCALE;
                if (Math.abs(vel.vy) < MIN_KICK) vel.vy = MIN_KICK;
              }
              // small transfer on X, proportional to dragVX
              vel.vx += dragVX * 0.2;
            }
  
            // Re-clamp in case correction pushed us outside
            if (lp.x < 0) lp.x = 0;
            if (lp.y < 0) lp.y = 0;
            if (lp.x + lp.w > zoneW) lp.x = zoneW - lp.w;
            if (lp.y + lp.h > zoneH) lp.y = zoneH - lp.h;
          }
        }
  
        // Damping
        vel.vx *= Math.pow(FRICTION, dt * 60);
        vel.vy *= Math.pow(FRICTION, dt * 60);
  
        // Render + persist
        renderCloneAtLocalPos(lp.x, lp.y, clone);
        state.localPos.set(clone, lp);
        state.velocity.set(clone, vel);
      });
    }
  
    // -------- Realign on resize/scroll --------
    function realignAllClones() {
      if (!state.built || !state.zone) return;
  
      const bounds = computeGameBounds();
      if (!bounds) return;
  
      const zone = ensureGameZone(bounds); // updates zone geometry
      state.zone = zone;
  
      // Clamp all local positions to new zone size
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
        // Reset if screen shrinks below tablet size
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
        }
        return;
      }
      realignAllClones();
    }
  
    // -------- Bind originals to trigger build+pickup on first click --------
    function onOriginalMouseDown(e) {
      if (e.button !== 0) return;     // left button only
      if (!isGameEnabled()) return;
      e.preventDefault();
      e.stopPropagation();
  
      buildWorldOnce(e.currentTarget, e.pageX, e.pageY);
    }
  
    function bindOriginals() {
      document.querySelectorAll(".img-background-card").forEach((el) => {
        if (!el.__skillInitBound) {
          el.addEventListener("mousedown", onOriginalMouseDown);
          el.addEventListener("dragstart", (ev) => ev.preventDefault()); // disable native drag ghost
          el.__skillInitBound = true;
        }
      });
    }
  
    // -------- Init --------
    document.addEventListener("DOMContentLoaded", bindOriginals);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", realignAllClones, { passive: true });
  })();
  