/* Vitalis Tower — /webinar/pro/watch/ — calls to action back to the form.

   · Every a[href="#floor-plans"] jumps to the Typeform section. The page's
     html { scroll-behavior: smooth } animates it (instant under reduced
     motion); this script only moves keyboard focus there afterwards.
   · Phones: the glass dock (#w-dock) slides up once the form section has
     been scrolled past, and slides away again while the form, or anything
     above it, is on screen. Hidden on desktop by CSS. */
(function () {
  'use strict';
  var form = document.getElementById('floor-plans');
  if (!form) return;

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="#floor-plans"]');
    if (!a) return;
    // Let the native smooth scroll run, then hand focus to the section.
    setTimeout(function () { try { form.focus({ preventScroll: true }); } catch (err) {} }, 600);
  });

  var dock = document.getElementById('w-dock');
  if (!dock) return;
  var link = dock.querySelector('a');
  var shown = false;
  function setDock(on) {
    if (on === shown) return;
    shown = on;
    dock.classList.toggle('is-on', on);
    dock.setAttribute('aria-hidden', on ? 'false' : 'true');
    if (link) link.tabIndex = on ? 0 : -1;
  }
  // On only when the whole form section is above the viewport.
  function update(rect) { setDock(rect.bottom <= 0); }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      update(entries[entries.length - 1].boundingClientRect);
    }, { threshold: [0, 0.01] }).observe(form);
  } else {
    var tick = false;
    window.addEventListener('scroll', function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(function () { tick = false; update(form.getBoundingClientRect()); });
    }, { passive: true });
  }
  update(form.getBoundingClientRect());
})();
