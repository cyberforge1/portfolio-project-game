// scripts.js

document.addEventListener("DOMContentLoaded", function () {

    let typedInitialized = false;
  
    function isAboutMeVisible() {
      const aboutMeSection = document.getElementById("about");
      if (!aboutMeSection) {
        console.error('The "About Me" section could not be found in the DOM.');
        return false;
      }
      const rect = aboutMeSection.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      return rect.top >= 0 && rect.top < windowHeight;
    }
  
    function initTyped() {
      const target = document.querySelector("#typed-text");
      if (!target) {
        console.error('The "typed-text" element could not be found in the DOM.');
        return;
      }
      new Typed("#typed-text", {
        strings: [
          '<span class="text-color-off-white">Nice to meet you, I\'m </span><span class="text-color-five">Oliver. </span>',
        ],
        typeSpeed: 75,
        backSpeed: 50,
        loop: false,
        contentType: "html",
        cursorChar: "_",
        showCursor: true,
        onComplete: function () {
          const cursorElement = document.querySelector(".typed-cursor");
          if (cursorElement) cursorElement.classList.add("slow");
        },
      });
      typedInitialized = true;
    }
  
    function checkTypedVisibility() {
      if (!typedInitialized && isAboutMeVisible()) {
        initTyped();
      }
    }
  
    checkTypedVisibility();
    document.addEventListener("scroll", checkTypedVisibility, { passive: true });
  
    function toggleActive(el, shouldActivate) {
      if (document.body.classList.contains("game-active")) return;
      if (shouldActivate) el.classList.add("active");
      else el.classList.remove("active");
    }
  
    function updateSlideIns() {
      const trigger = window.innerHeight * 0.5;
  
      const projectDivs = document.querySelectorAll(".project-div");
      const imageContainers = document.querySelectorAll(".image-container");
      const projectTitle = document.querySelector("#typed-project-title");
      const skillsTitle = document.querySelector("#typed-skills-title");
  
      projectDivs.forEach((div) => {
        const top = div.getBoundingClientRect().top;
        toggleActive(div, top < trigger);
      });
  
      imageContainers.forEach((el) => {
        const top = el.getBoundingClientRect().top;
        toggleActive(el, top < trigger);
      });
  
      if (projectTitle) {
        const top = projectTitle.getBoundingClientRect().top;
        toggleActive(projectTitle, top < trigger);
      }
      if (skillsTitle) {
        const top = skillsTitle.getBoundingClientRect().top;
        toggleActive(skillsTitle, top < trigger);
      }
    }
  
    let _slideTick = false;
    function onScrollForSlideIns() {
      if (_slideTick) return;
      _slideTick = true;
      requestAnimationFrame(() => {
        updateSlideIns();
        _slideTick = false;
      });
    }
  
    window.addEventListener("load", updateSlideIns);
    window.addEventListener("resize", updateSlideIns);
    document.addEventListener("scroll", onScrollForSlideIns, { passive: true });
  
    window.addEventListener("game:end", updateSlideIns);

    document.querySelectorAll(".navbar-nav .nav-item").forEach((item) => {
      item.addEventListener("mouseenter", () => {
        if (item.previousElementSibling) {
          item.previousElementSibling.classList.add("scale-small");
          if (item.previousElementSibling.previousElementSibling) {
            item.previousElementSibling.previousElementSibling.classList.add("scale-smallest");
          }
        }
        if (item.nextElementSibling) {
          item.nextElementSibling.classList.add("scale-small");
          if (item.nextElementSibling.nextElementSibling) {
            item.nextElementSibling.nextElementSibling.classList.add("scale-smallest");
          }
        }
      });
  
      item.addEventListener("mouseleave", () => {
        document.querySelectorAll(".navbar-nav .nav-item").forEach((navItem) => {
          navItem.classList.remove("scale-small", "scale-smallest");
        });
      });
    });
  

    function updateOverlayOpacity() {
      const firstPage = document.querySelector(".first_page");
      const overlay = document.querySelector(".black-overlay");
      if (!firstPage || !overlay) return;
  
      const firstPageHeight = firstPage.offsetHeight;
      const scrollTop = window.scrollY || window.pageYOffset || 0;

      let opacity = scrollTop / (firstPageHeight / 0.9);
      opacity = Math.max(0, Math.min(1, opacity));
      overlay.style.opacity = opacity;
    }
  
    updateOverlayOpacity();
    document.addEventListener("scroll", updateOverlayOpacity, { passive: true });
  
    document.addEventListener("click", function (event) {
      const navbarCollapse = document.getElementById("navbarNav");
      const navbarToggler = document.querySelector(".navbar-toggler");
      if (!navbarCollapse || !navbarToggler) return;
  
      const clickedInsideCollapse = navbarCollapse.contains(event.target);
      const clickedToggler = navbarToggler.contains(event.target);
      const isOpen = navbarCollapse.classList.contains("show");
  
      if (!clickedInsideCollapse && !clickedToggler && isOpen) {
        const bsCollapse = new bootstrap.Collapse(navbarCollapse, { toggle: false });
        bsCollapse.hide();
      }
    });
  
    (function setupAutoHideNavbar() {
      const navbar = document.querySelector(".navbar");
      if (!navbar) return;
  
      let timeout;
      function showNavbar() {
        navbar.classList.add("visible");
        clearTimeout(timeout);
        timeout = setTimeout(hideNavbar, 1500);
      }
      function hideNavbar() {
        navbar.classList.remove("visible");
      }
      window.addEventListener("mousemove", showNavbar);
      timeout = setTimeout(hideNavbar, 1500);
    })();
  });
  