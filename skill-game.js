/* ============================================
   Skill Tile Game — pick-up & drag clones
   ============================================ */
   (function () {
    const MIN_WIDTH = 768; // small tablets and up
  
    // ---- feature gate ----
    const isGameEnabled = () => window.innerWidth >= MIN_WIDTH;
  
    // ---- DOM helpers ----
    const getSectionById = (id) => document.querySelector(`section#${id}`) || null;
  
    // Use only the SKILLS section as the game area
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
      let boundsEl = zone.querySelector(".skill-game-bounds");
      if (!boundsEl) {
        boundsEl = document.createElement("div");
        boundsEl.className = "skill-game-bounds";
        const label = document.createElement("div");
        label.className = "skill-game-bounds__label";
        label.textContent = "Game Area";
        boundsEl.appendChild(label);
        zone.appendChild(boundsEl);
      }
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
  
    // Ensure a single, full-width zone aligned to bounds
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
  
      ensureBoundsOverlay(zone);
      return zone;
    }
  
    // Clamp a (pageLeft, pageTop) so a w×h box stays inside the zone
    function clampPagePosToZone(pageLeft, pageTop, w, h, zone) {
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
  
      return { clampedLeft, clampedTop, zoneLeft, zoneTop };
    }
  
    // Place a clone using ABSOLUTE left/top (no transforms)
    function renderCloneAtPagePos(pageLeft, pageTop, w, h, zone, clone) {
      const { clampedLeft, clampedTop, zoneLeft, zoneTop } =
        clampPagePosToZone(pageLeft, pageTop, w, h, zone);
  
      const localLeft = clampedLeft - zoneLeft;
      const localTop  = clampedTop  - zoneTop;
  
      clone.style.position = "absolute";
      clone.style.left = `${localLeft}px`;
      clone.style.top  = `${localTop}px`;
      return { x: clampedLeft, y: clampedTop };
    }
  
    // ---- State ----
    const state = {
      built: false,
      building: false,              // re-entrant build lock
      zone: null,
      clonesByOriginal: new Map(),  // originalEl -> cloneEl
      logicalPos: new WeakMap(),    // cloneEl -> { pageLeft, pageTop, width, height }
      drag: null,                   // { clone, zone, srcW, srcH, offsetX, offsetY }
    };
  
    // ---- Build world (creates clones, hides originals) ----
    function buildWorldOnce() {
      if (state.built || state.building || !isGameEnabled()) return;
      state.building = true;
  
      const bounds = computeGameBounds();
      if (!bounds) { state.building = false; return; }
  
      // Freeze hover/scale for stable measurements
      document.body.classList.add("freeze-skill-layout");
  
      // 1) Snapshot originals BEFORE DOM changes
      const originals = Array.from(document.querySelectorAll(".img-background-card"));
      const snaps = snapshotOriginalRects(originals);
  
      // 2) Create/realign zone
      const zone = ensureGameZone(bounds);
      state.zone = zone;
  
      // 3) Create clones at snapshot positions; hide originals
      snaps.forEach(({ el, left, top, width, height }) => {
        const clone = el.cloneNode(true);
        clone.classList.add("skill-drag-clone");
        // Normalize the clone box for exact placement
        clone.style.width = width + "px";
        clone.style.height = height + "px";
        clone.style.margin = "0";
        clone.style.boxSizing = "border-box";
        state.zone.appendChild(clone);
  
        const inBounds = renderCloneAtPagePos(left, top, width, height, state.zone, clone);
        state.clonesByOriginal.set(el, clone);
        state.logicalPos.set(clone, { pageLeft: inBounds.x, pageTop: inBounds.y, width, height });
  
        // Hide the original without collapsing layout
        el.classList.add("skill-original-ghost");
      });
  
      // 4) Listen for drags on clones (mousedown to pick up)
      state.zone.addEventListener("mousedown", onCloneMouseDown);
  
      state.built = true;
      state.building = false;
      document.body.classList.remove("freeze-skill-layout");
    }
  
    // ---- Drag lifecycle: start -> move -> end ----
    function onCloneMouseDown(e) {
      if (e.button !== 0) return;                 // left button only
      if (!isGameEnabled() || !state.built) return;
  
      const clone = e.target.closest(".skill-drag-clone");
      if (!clone) return;
  
      e.preventDefault();
      const cr = clone.getBoundingClientRect();
  
      // offset where the mouse is inside the clone
      const offsetX = e.pageX - (cr.left + window.scrollX);
      const offsetY = e.pageY - (cr.top  + window.scrollY);
  
      state.drag = {
        clone,
        zone: state.zone,
        srcW: cr.width,
        srcH: cr.height,
        offsetX,
        offsetY
      };
  
      clone.classList.add("picked-up");
      document.body.classList.add("dragging-skill");
  
      window.addEventListener("mousemove", onMouseMove, { passive: false });
      window.addEventListener("mouseup", onMouseUp, { once: true });
    }
  
    function onMouseMove(e) {
      if (!state.drag) return;
  
      const d = state.drag;
      const desiredLeft = e.pageX - d.offsetX;
      const desiredTop  = e.pageY - d.offsetY;
  
      const { clampedLeft, clampedTop, zoneLeft, zoneTop } =
        clampPagePosToZone(desiredLeft, desiredTop, d.srcW, d.srcH, d.zone);
  
      const localLeft = clampedLeft - zoneLeft;
      const localTop  = clampedTop  - zoneTop;
  
      d.clone.style.left = `${localLeft}px`;
      d.clone.style.top  = `${localTop}px`;
  
      // Keep logical position in page coords so we can realign on scroll/resize
      state.logicalPos.set(d.clone, {
        pageLeft: clampedLeft,
        pageTop:  clampedTop,
        width: d.srcW,
        height: d.srcH
      });
    }
  
    function onMouseUp() {
      if (!state.drag) return;
      state.drag.clone.classList.remove("picked-up");
      document.body.classList.remove("dragging-skill");
      window.removeEventListener("mousemove", onMouseMove);
      state.drag = null;
    }
  
    // ---- Realign on resize/scroll (re-clamp all clones to zone) ----
    function realignAllClones() {
      if (!state.built || !state.zone) return;
      const bounds = computeGameBounds();
      if (!bounds) return;
  
      const zone = ensureGameZone(bounds); // repositions/resizes zone
      state.zone = zone;
  
      state.clonesByOriginal.forEach((clone) => {
        const lp = state.logicalPos.get(clone);
        if (!lp) return;
        const { pageLeft, pageTop, width, height } = lp;
        const inBounds = renderCloneAtPagePos(pageLeft, pageTop, width, height, zone, clone);
        state.logicalPos.set(clone, {
          pageLeft: inBounds.x,
          pageTop:  inBounds.y,
          width,
          height
        });
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
          state.logicalPos = new WeakMap();
          state.zone = null;
          state.built = false;
          state.building = false;
        }
        return;
      }
      realignAllClones();
    }
  
    // ---- Bind originals to trigger the one-time build ----
    function onOriginalMouseDown(e) {
      if (e.button !== 0) return;
      if (!isGameEnabled()) return;
      e.preventDefault();
      e.stopPropagation(); // don’t bubble to parents
      buildWorldOnce();    // build once; dragging happens on clones
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
  
    // ---- init ----
    document.addEventListener("DOMContentLoaded", bindOriginals);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", realignAllClones, { passive: true });
  })();