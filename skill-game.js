/* ============================================
   Skill Tile Drag Game — Physics World (>=768px)
   Snapshot-first, hover-freeze, zone realignment
   ============================================ */
   (function () {
    const MIN_WIDTH = 768; // Enable game on small tablets and above
  
    // ---------- Feature gates ----------
    function isGameEnabled() {
      return window.innerWidth >= MIN_WIDTH;
    }
  
    // ---------- DOM helpers ----------
    function getSectionById(id) {
      // Prefer an actual <section id="...">
      const exactSection = document.querySelector(`section#${id}`);
      if (exactSection) return exactSection;
  
      // Fallback: find element by id and then the next <section>
      const first = document.getElementById(id);
      if (first && first.tagName !== "SECTION") {
        let n = first.nextElementSibling;
        while (n) {
          if (n.tagName === "SECTION") return n;
          n = n.nextElementSibling;
        }
      }
      return null;
    }
  
    function computeGameBounds() {
      const projectsSection = getSectionById("projects");
      const skillsSection = getSectionById("skills");
      if (!projectsSection || !skillsSection) return null;
  
      const projTop = projectsSection.getBoundingClientRect().top + window.scrollY;
      const skillsBottom = skillsSection.getBoundingClientRect().bottom + window.scrollY;
  
      return { top: projTop, bottom: skillsBottom, height: skillsBottom - projTop };
    }
  
    // ---------- Visual bounds overlay ----------
    function ensureBoundsOverlay(zone) {
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
  
    // ---------- NEW: snapshot-first + robust placement helpers ----------
    // Get rects for all originals BEFORE any DOM mutation (page coordinates)
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
  
    // Create/realign the game zone to exact bounds + viewport width
    function ensureGameZone(bounds) {
      let zone = document.getElementById("skill-game-zone");
      if (!zone) {
        zone = document.createElement("div");
        zone.id = "skill-game-zone";
        document.body.appendChild(zone);
      }
      zone.style.top = bounds.top + "px";
      zone.style.height = bounds.height + "px";
      zone.style.left = "0px";
      zone.style.width = document.documentElement.clientWidth + "px";
      ensureBoundsOverlay(zone); // draw/update visual frame
      return zone;
    }
  
    // Place a clone at an absolute page position within the zone
    function placeCloneAtPagePos(pageLeft, pageTop, zone, clone) {
      const zoneRect = zone.getBoundingClientRect();
      const zoneLeft = zoneRect.left + window.scrollX;
      const zoneTop  = zoneRect.top  + window.scrollY;
      const localLeft = pageLeft - zoneLeft;
      const localTop  = pageTop  - zoneTop;
      clone.style.transform = `translate(${localLeft}px, ${localTop}px)`;
    }
  
    // ---------- State ----------
    const state = {
      built: false,
      zone: null,
      clonesByOriginal: new Map(), // originalEl -> cloneEl
      drag: null,                  // { clone, zone, srcW, srcH, offsetX, offsetY }
    };
  
    // ---------- Builder (snapshot-first) ----------
    function buildWorldOnce(clickedOriginal) {
      if (state.built || !isGameEnabled()) return;
  
      const bounds = computeGameBounds();
      if (!bounds) return;
  
      // Freeze hover/scale so measurements are stable
      document.body.classList.add("freeze-skill-layout");
  
      // 1) Snapshot positions FIRST (before any DOM changes)
      const originals = Array.from(document.querySelectorAll(".img-background-card"));
      const snaps = snapshotOriginalRects(originals);
  
      // 2) Create/align the zone
      const zone = ensureGameZone(bounds);
      state.zone = zone;
  
      // 3) Create clones at snapshot positions; THEN hide originals
      snaps.forEach(({ el, left, top, width, height }) => {
        const clone = el.cloneNode(true);
        clone.classList.add("skill-drag-clone");
        clone.style.width = width + "px";
        clone.style.height = height + "px";
        zone.appendChild(clone);
  
        placeCloneAtPagePos(left, top, zone, clone);
        state.clonesByOriginal.set(el, clone);
  
        // Hide without collapsing layout (visibility keeps space)
        el.classList.add("skill-original-ghost");
      });
  
      // 4) Listen for drags on clones
      zone.addEventListener("mousedown", onCloneMouseDown);
  
      state.built = true;
  
      // Unfreeze after everything is positioned
      document.body.classList.remove("freeze-skill-layout");
  
      // If user started with a click on an original, start drag on its clone
      if (clickedOriginal) {
        const targetClone = state.clonesByOriginal.get(clickedOriginal);
        if (targetClone) {
          const onceMove = (ev) => {
            window.removeEventListener("mousemove", onceMove);
            startDrag(targetClone, ev.pageX, ev.pageY);
          };
          window.addEventListener("mousemove", onceMove, { once: true });
        }
      }
    }
  
    // ---------- Drag logic (clones only) ----------
    function startDrag(clone, pageX, pageY) {
      const zone = state.zone;
      if (!zone) return;
  
      clone.classList.add("picked-up");
      document.body.classList.add("dragging-skill");
  
      const cloneRect = clone.getBoundingClientRect();
      const srcW = cloneRect.width;
      const srcH = cloneRect.height;
  
      const offsetX = pageX - (cloneRect.left + window.scrollX);
      const offsetY = pageY - (cloneRect.top + window.scrollY);
  
      state.drag = { clone, zone, srcW, srcH, offsetX, offsetY };
  
      window.addEventListener("mousemove", onMouseMove, { passive: true });
      window.addEventListener("mouseup", onMouseUp, { once: true });
    }
  
    function positionClone(pageX, pageY) {
      const d = state.drag;
      if (!d) return;
  
      const zoneRect = d.zone.getBoundingClientRect();
      const zoneLeft = zoneRect.left + window.scrollX;
      const zoneTop = zoneRect.top + window.scrollY;
      const zoneRight = zoneLeft + zoneRect.width;
      const zoneBottom = zoneTop + zoneRect.height;
  
      const desiredLeft = pageX - d.offsetX;
      const desiredTop = pageY - d.offsetY;
  
      const maxLeft = zoneRight - d.srcW;
      const maxTop = zoneBottom - d.srcH;
  
      const clampedLeft = Math.max(zoneLeft, Math.min(maxLeft, desiredLeft));
      const clampedTop = Math.max(zoneTop, Math.min(maxTop, desiredTop));
  
      const localLeft = clampedLeft - zoneLeft;
      const localTop = clampedTop - zoneTop;
  
      d.clone.style.transform = `translate(${localLeft}px, ${localTop}px)`;
    }
  
    function endDrag() {
      const d = state.drag;
      if (!d) return;
  
      d.clone.classList.remove("picked-up");
      document.body.classList.remove("dragging-skill");
  
      window.removeEventListener("mousemove", onMouseMove);
      state.drag = null;
    }
  
    // ---------- Event handlers ----------
    function onOriginalMouseDown(e) {
      if (e.button !== 0) return;
      if (!isGameEnabled()) return; // Don’t build on small screens
      const original = e.currentTarget;
      e.preventDefault();
      buildWorldOnce(original);
    }
  
    function onCloneMouseDown(e) {
      if (e.button !== 0) return;
      if (!isGameEnabled()) return;
  
      const clone = e.target.closest(".skill-drag-clone");
      if (!clone) return;
  
      e.preventDefault();
      startDrag(clone, e.pageX, e.pageY);
    }
  
    function onMouseMove(e) {
      positionClone(e.pageX, e.pageY);
    }
  
    function onMouseUp() {
      endDrag();
    }
  
    // Keep zone aligned on resize; destroy world if shrinking below threshold
    function onResize() {
      if (!isGameEnabled()) {
        // If game was built and screen shrinks below tablet size — reset
        if (state.built) {
          if (state.zone) state.zone.remove();
          state.clonesByOriginal.forEach((clone, original) => {
            original.classList.remove("skill-original-ghost");
          });
          state.clonesByOriginal.clear();
          state.zone = null;
          state.drag = null;
          state.built = false;
        }
        return;
      }
  
      if (state.built) {
        const bounds = computeGameBounds();
        if (!bounds || !state.zone) return;
        ensureGameZone(bounds);
      }
    }
  
    // ---------- NEW: realign zone on scroll ----------
    function realignZone() {
      if (!state.built || !state.zone) return;
      const bounds = computeGameBounds();
      if (!bounds) return;
      ensureGameZone(bounds); // updates top/height/width to follow page
    }
  
    // ---------- Bind/unbind originals ----------
    function preventDefaultDrag(ev) { ev.preventDefault(); }
  
    function bindOriginals() {
      document.querySelectorAll(".img-background-card").forEach((el) => {
        if (!el.__skillInitBound) {
          el.addEventListener("mousedown", onOriginalMouseDown);
          el.addEventListener("dragstart", preventDefaultDrag);
          el.__skillInitBound = true;
        }
      });
    }
  
    // ---------- Init ----------
    document.addEventListener("DOMContentLoaded", () => {
      bindOriginals();
    });
  
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", realignZone, { passive: true });
  })();
  