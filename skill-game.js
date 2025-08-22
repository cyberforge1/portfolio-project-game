/* ============================================
   Skill Tile Game — Static (no dragging/moving)
   ============================================ */
   (function () {
    const MIN_WIDTH = 768; // small tablets and up
  
    // ---- Feature gate ----
    const isGameEnabled = () => window.innerWidth >= MIN_WIDTH;
  
    // ---- DOM helpers ----
    // Only ever consider the <section id="..."> (ignore anchor divs)
    const getSectionById = (id) => document.querySelector(`section#${id}`) || null;
  
    // Use the SKILLS section as the game area
    function computeGameBounds() {
      const skillsSection = getSectionById("skills");
      if (!skillsSection) return null;
      const r = skillsSection.getBoundingClientRect();
      const top = r.top + window.scrollY;
      return { top, bottom: top + r.height, height: r.height };
    }
  
    // Visible frame inside the zone
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
    };
  
    // ---- Builder (no drag) ----
    function buildWorldOnce(clickedOriginal) {
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
  
      // 3) Create static clones at snapshot positions; hide originals
      snaps.forEach(({ el, left, top, width, height }) => {
        const clone = el.cloneNode(true);
        clone.classList.add("skill-drag-clone");
        // Normalize the clone box for exact placement
        clone.style.width = width + "px";
        clone.style.height = height + "px";
        clone.style.margin = "0";            // ignore grid/card margins
        clone.style.boxSizing = "border-box";
        zone.appendChild(clone);
  
        const inBounds = renderCloneAtPagePos(left, top, width, height, zone, clone);
        state.clonesByOriginal.set(el, clone);
        state.logicalPos.set(clone, { pageLeft: inBounds.x, pageTop: inBounds.y, width, height });
  
        // Hide the original without collapsing layout
        el.classList.add("skill-original-ghost");
      });
  
      state.built = true;
      state.building = false;
      document.body.classList.remove("freeze-skill-layout");
    }
  
    // ---- Event handlers (build only; no drag) ----
    function onOriginalMouseDown(e) {
      if (e.button !== 0) return;
      if (!isGameEnabled()) return;
      e.preventDefault();
      e.stopPropagation();
      buildWorldOnce(e.currentTarget);
    }
    function preventDefaultDrag(ev) { ev.preventDefault(); }
  
    // ---- Realign on resize/scroll (keep static positions clamped) ----
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
        // Keep logical in sync (in case zone shrank and clamped)
        state.logicalPos.set(clone, {
          pageLeft: inBounds.x,
          pageTop: inBounds.y,
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
  
    // ---- Bind originals & init ----
    function bindOriginals() {
      document.querySelectorAll(".img-background-card").forEach((el) => {
        if (!el.__skillInitBound) {
          el.addEventListener("mousedown", onOriginalMouseDown);
          el.addEventListener("dragstart", preventDefaultDrag);
          el.__skillInitBound = true;
        }
      });
    }
  
    document.addEventListener("DOMContentLoaded", () => {
      bindOriginals();
    });
  
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", realignAllClones, { passive: true });
  })();
  