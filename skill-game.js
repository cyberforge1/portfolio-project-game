/* ============================================
   Skill Tile Drag Game
   ============================================ */
   (function () {
    function getSectionById(id) {
      const exactSection = document.querySelector(`section#${id}`);
      if (exactSection) return exactSection;
  
      const first = document.getElementById(id);
      if (first && first.tagName !== 'SECTION') {
        let n = first.nextElementSibling;
        while (n) {
          if (n.tagName === 'SECTION') return n;
          n = n.nextElementSibling;
        }
      }
      return null;
    }
  
    function computeGameBounds() {
      const projectsSection = getSectionById('projects');
      const skillsSection   = getSectionById('skills');
      if (!projectsSection || !skillsSection) return null;
  
      const projTop = projectsSection.getBoundingClientRect().top + window.scrollY;
      const skillsBottom = skillsSection.getBoundingClientRect().bottom + window.scrollY;
  
      return { top: projTop, bottom: skillsBottom, height: skillsBottom - projTop };
    }
  
    function ensureGameZone(bounds) {
      let zone = document.getElementById('skill-game-zone');
      if (!zone) {
        zone = document.createElement('div');
        zone.id = 'skill-game-zone';
        document.body.appendChild(zone);
      }
      zone.style.top = bounds.top + 'px';
      zone.style.height = bounds.height + 'px';
      return zone;
    }
  
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  
    let drag = null;
  
    function onCardMouseDown(e) {
      if (e.button !== 0) return;
      e.preventDefault();
  
      const card = e.currentTarget;
      const bounds = computeGameBounds();
      if (!bounds) return;
  
      const zone = ensureGameZone(bounds);
      const srcRect = card.getBoundingClientRect();
  
      const clone = card.cloneNode(true);
      clone.classList.add('skill-drag-clone', 'picked-up');
      clone.style.width = srcRect.width + 'px';
      clone.style.height = srcRect.height + 'px';
  
      zone.appendChild(clone);
      card.classList.add('skill-original-ghost');
      document.body.classList.add('dragging-skill');
  
      function placeAtOriginal() {
        const zoneRect = zone.getBoundingClientRect();
        const zoneLeft = zoneRect.left + window.scrollX;
        const zoneTop  = zoneRect.top + window.scrollY;
  
        const localLeft = srcRect.left + window.scrollX - zoneLeft;
        const localTop  = srcRect.top + window.scrollY - zoneTop;
  
        clone.style.transform = `translate(${localLeft}px, ${localTop}px)`;
      }
      placeAtOriginal();
  
      const startPageX = e.pageX;
      const startPageY = e.pageY;
      const offsetX = startPageX - (srcRect.left + window.scrollX);
      const offsetY = startPageY - (srcRect.top + window.scrollY);
  
      function positionClone(pageX, pageY) {
        const zoneRect   = zone.getBoundingClientRect();
        const zoneLeft   = zoneRect.left + window.scrollX;
        const zoneTop    = zoneRect.top + window.scrollY;
        const zoneRight  = zoneLeft + zoneRect.width;
        const zoneBottom = zoneTop + zoneRect.height;
  
        const desiredLeft = pageX - offsetX;
        const desiredTop  = pageY - offsetY;
  
        const maxLeft = zoneRight - srcRect.width;
        const maxTop  = zoneBottom - srcRect.height;
  
        const clampedLeft = Math.max(zoneLeft, Math.min(maxLeft, desiredLeft));
        const clampedTop  = Math.max(zoneTop,  Math.min(maxTop,  desiredTop));
  
        const localLeft = clampedLeft - zoneLeft;
        const localTop  = clampedTop  - zoneTop;
  
        clone.style.transform = `translate(${localLeft}px, ${localTop}px)`;
      }
  
      drag = { card, clone, zone, positionClone };
      window.addEventListener('mousemove', onMouseMove, { passive: true });
      window.addEventListener('mouseup', onMouseUp, { once: true });
    }
  
    function endDrag() {
      if (!drag) return;
      const { card, clone } = drag;
  
      if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
      card.classList.remove('skill-original-ghost');
      document.body.classList.remove('dragging-skill');
  
      window.removeEventListener('mousemove', onMouseMove);
      drag = null;
    }
  
    function onMouseMove(e) {
      if (!drag) return;
      drag.positionClone(e.pageX, e.pageY);
    }
  
    function onMouseUp() {
      endDrag();
    }
  
    function bindSkillCards(root = document) {
      root.querySelectorAll('.img-background-card').forEach((el) => {
        if (!el.__skillDragBound) {
          el.addEventListener('mousedown', onCardMouseDown);
          el.addEventListener('dragstart', (ev) => ev.preventDefault());
          el.__skillDragBound = true;
        }
      });
    }
  
    document.addEventListener('DOMContentLoaded', () => {
      bindSkillCards();
    });
  
    window.addEventListener('resize', () => {
      if (!drag) return;
      const bounds = computeGameBounds();
      if (!bounds) return;
      ensureGameZone(bounds);
    });
  })();
  