// scripts.js

document.addEventListener("DOMContentLoaded", function() {
    let typedInitialized = false;


    function isAboutMeVisible() {
        const aboutMeSection = document.getElementById('about');
        if (!aboutMeSection) {
            console.error('The "About Me" section could not be found in the DOM.');
            return false;
        }
        const rect = aboutMeSection.getBoundingClientRect();
        const windowHeight = (window.innerHeight || document.documentElement.clientHeight);
        return (
            rect.top >= 0 && rect.top < windowHeight
        );
    }

    function initTyped() {
        if (!document.querySelector("#typed-text")) {
            console.error('The "typed-text" element could not be found in the DOM.');
            return;
        }
        new Typed("#typed-text", {
            strings: ['<span class="text-color-off-white">Nice to meet you, I\'m </span><span class="text-color-five">Oliver. </span>'],
            typeSpeed: 75,
            backSpeed: 50,
            loop: false,
            contentType: 'html',
            cursorChar: '_', 
            showCursor: true,
            onComplete: function(self) {
                let cursorElement = document.querySelector('.typed-cursor');
                if (cursorElement) {
                    cursorElement.classList.add('slow');
                }
            }
        });
        typedInitialized = true;
    }
    

    document.addEventListener('scroll', function() {
        if (isAboutMeVisible() && !typedInitialized) {
            initTyped();
        }
    });

    if (isAboutMeVisible()) {
        initTyped();
    }
});

document.addEventListener("scroll", function() {
    var projectDivs = document.querySelectorAll('.project-div');
    var imageContainers = document.querySelectorAll('.image-container');

    var triggerHeight = window.innerHeight / 2;

    projectDivs.forEach(function(div) {
        if (div && window.scrollY + triggerHeight > div.offsetTop) {
            div.classList.add('active');
        } else {
            div.classList.remove('active');
        }
    });

    imageContainers.forEach(function(container) {
        if (container && window.scrollY + triggerHeight > container.offsetTop) {
            container.classList.add('active');
        } else {
            container.classList.remove('active');
        }
    });
});

document.querySelectorAll('.navbar-nav .nav-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
        if (item.previousElementSibling) {
            item.previousElementSibling.classList.add('scale-small');
            if (item.previousElementSibling.previousElementSibling) {
                item.previousElementSibling.previousElementSibling.classList.add('scale-smallest');
            }
        }
        if (item.nextElementSibling) {
            item.nextElementSibling.classList.add('scale-small');
            if (item.nextElementSibling.nextElementSibling) {
                item.nextElementSibling.nextElementSibling.classList.add('scale-smallest');
            }
        }
    });

    item.addEventListener('mouseleave', () => {
        document.querySelectorAll('.navbar-nav .nav-item').forEach(navItem => {
            navItem.classList.remove('scale-small');
            navItem.classList.remove('scale-smallest');
        });
    });
});

document.addEventListener("scroll", function() {
    var skillsTitle = document.querySelector('#typed-skills-title');
    if (!skillsTitle) {
        console.error('The "skillsTitle" element could not be found in the DOM.');
        return;
    }
    var triggerHeight = window.innerHeight / 2;

    if (window.scrollY + triggerHeight > skillsTitle.offsetTop) {
        skillsTitle.classList.add('active');
    } else {
        skillsTitle.classList.remove('active');
    }
});

document.addEventListener("scroll", function() {
    var projectTitle = document.querySelector('#typed-project-title');
    var skillsTitle = document.querySelector('#typed-skills-title');
    var triggerHeight = window.innerHeight / 2;

    if (projectTitle) {
        if (window.scrollY + triggerHeight > projectTitle.offsetTop) {
            projectTitle.classList.add('active');
        } else {
            projectTitle.classList.remove('active');
        }
    }

    if (skillsTitle) {
        if (window.scrollY + triggerHeight > skillsTitle.offsetTop) {
            skillsTitle.classList.add('active');
        } else {
            skillsTitle.classList.remove('active');
        }
    }
});


function updateOverlayOpacity() {
    const firstPage = document.querySelector('.first_page');
    const overlay = document.querySelector('.black-overlay');

    const firstPageHeight = firstPage.offsetHeight;

    const scrollTop = window.scrollY;

    let opacity = scrollTop / (firstPageHeight/0.9);

    opacity = Math.max(0, Math.min(1, opacity));

    overlay.style.opacity = opacity;
}

document.addEventListener("DOMContentLoaded", updateOverlayOpacity);

document.addEventListener("scroll", updateOverlayOpacity);

document.addEventListener('click', function(event) {
    const navbarCollapse = document.getElementById('navbarNav');
    const navbarToggler = document.querySelector('.navbar-toggler');
    if (!navbarCollapse.contains(event.target) && !navbarToggler.contains(event.target) && navbarCollapse.classList.contains('show')) {
        const bsCollapse = new bootstrap.Collapse(navbarCollapse, {
            toggle: false
        });
        bsCollapse.hide();
    }
});


document.addEventListener('DOMContentLoaded', function () {
    const navbar = document.querySelector('.navbar');
    let timeout;

    function showNavbar() {
        navbar.classList.add('visible');
        clearTimeout(timeout);
        timeout = setTimeout(hideNavbar, 1500);
    }
    function hideNavbar() {
        navbar.classList.remove('visible');
    }
    window.addEventListener('mousemove', showNavbar);
    timeout = setTimeout(hideNavbar, 1500);
});
