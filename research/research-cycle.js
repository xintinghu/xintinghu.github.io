(function () {
  'use strict';

  var cycle = document.querySelector('.research-cycle');
  if (!cycle) {
    return;
  }

  var DESKTOP_MIN = 1280;
  var VISIBILITY_THRESHOLD = 0.1;
  var observer = null;
  var activated = false;
  var desktopQuery = window.matchMedia('(min-width: ' + DESKTOP_MIN + 'px)');
  var reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  function prefersReducedMotion() {
    return reducedMotionQuery.matches;
  }

  function isDesktop() {
    return desktopQuery.matches;
  }

  function visibleRatio(element) {
    var rect = element.getBoundingClientRect();
    if (rect.height <= 0 || rect.width <= 0) {
      return 0;
    }

    var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    var visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
    return visibleHeight / rect.height;
  }

  function activate() {
    if (activated) {
      return;
    }

    if (visibleRatio(cycle) < VISIBILITY_THRESHOLD) {
      return;
    }

    activated = true;
    cycle.classList.add('research-cycle-is-active');

    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function teardownObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function disableJsEnhancement() {
    teardownObserver();
    cycle.classList.remove('research-cycle-js');
  }

  function maybeActivateFromVisibility() {
    if (activated || !cycle.classList.contains('research-cycle-js')) {
      return;
    }

    if (visibleRatio(cycle) >= VISIBILITY_THRESHOLD) {
      requestAnimationFrame(activate);
    }
  }

  function setup() {
    if (!isDesktop() || prefersReducedMotion()) {
      disableJsEnhancement();
      return;
    }

    cycle.classList.add('research-cycle-js');

    if (!activated && visibleRatio(cycle) < VISIBILITY_THRESHOLD) {
      cycle.classList.remove('research-cycle-is-active');
    }

    if (activated) {
      teardownObserver();
      return;
    }

    if (!('IntersectionObserver' in window)) {
      cycle.classList.remove('research-cycle-js');
      return;
    }

    if (!observer) {
      observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.target !== cycle || activated) {
              return;
            }

            if (entry.isIntersecting && entry.intersectionRatio >= VISIBILITY_THRESHOLD) {
              activate();
            }
          });
        },
        {
          threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
        }
      );
    }

    observer.observe(cycle);
    maybeActivateFromVisibility();
  }

  function onReady() {
    setup();
  }

  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      activated = false;
      cycle.classList.remove('research-cycle-is-active');
      setup();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  if (typeof desktopQuery.addEventListener === 'function') {
    desktopQuery.addEventListener('change', setup);
    reducedMotionQuery.addEventListener('change', setup);
  } else if (typeof desktopQuery.addListener === 'function') {
    desktopQuery.addListener(setup);
    reducedMotionQuery.addListener(setup);
  }
})();
