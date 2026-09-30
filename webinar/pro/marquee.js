/* Sponsor rows for the /webinar/pro/ pages. Each .mq-track holds one set
   of logos in the HTML; this clones it three more times (hidden from
   assistive tech) so the -50% CSS loop is seamless on wide screens.
   Reduced motion: no clones — the CSS shows static, wrapped rows. */
(function () {
  'use strict';
  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (reduced) return;
  document.querySelectorAll('[data-mq] .mq-track').forEach(function (track) {
    var originals = Array.prototype.slice.call(track.children);
    for (var copy = 0; copy < 3; copy++) {
      originals.forEach(function (li) {
        var c = li.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        var img = c.querySelector('img');
        if (img) img.alt = '';
        track.appendChild(c);
      });
    }
  });
})();
