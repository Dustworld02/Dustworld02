/* B&F Berto & Fils — animations du site vitrine.
   Amélioration progressive : sans JavaScript, tout le contenu reste visible et lisible.
   Respecte le réglage « réduire les animations » du système. */
(function () {
  'use strict';
  var reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 1. En-tête compact au défilement */
  var header = document.querySelector('.site-header');
  if (header) {
    var majHeader = function () { header.classList.toggle('scrolled', window.scrollY > 12); };
    window.addEventListener('scroll', majHeader, { passive: true });
    majHeader();
  }

  /* Salle blanche en coupe : repères ↔ légende, pause du flux d'air */
  var coupe = document.querySelector('.anatomie-figure');
  if (coupe) {
    var allumer = function (n, oui) {
      document.querySelectorAll('[data-n="' + n + '"]').forEach(function (el) { el.classList.toggle('actif', oui); });
    };
    document.querySelectorAll('.cs-pt, .cs-legende li').forEach(function (el) {
      var n = el.getAttribute('data-n');
      el.addEventListener('mouseenter', function () { allumer(n, true); });
      el.addEventListener('mouseleave', function () { allumer(n, false); });
      el.addEventListener('focus', function () { allumer(n, true); });
      el.addEventListener('blur', function () { allumer(n, false); });
    });
    var bouton = coupe.querySelector('.anim-toggle');
    if (reduit) { coupe.classList.add('coupe-pause'); if (bouton) bouton.hidden = true; }
    if (bouton) bouton.addEventListener('click', function () {
      var enPause = coupe.classList.toggle('coupe-pause');
      bouton.setAttribute('aria-pressed', enPause ? 'true' : 'false');
      bouton.textContent = enPause ? 'Relancer le flux d\'air' : 'Mettre en pause le flux d\'air';
    });
  }

  if (reduit || !('IntersectionObserver' in window)) {
    document.documentElement.classList.add('sans-anim');
    return;
  }

  /* 2. Apparition des blocs au défilement, en cascade */
  var cibles = document.querySelectorAll(
    'main .section-head, main .card, main .steps > li, main .zone, main .sectors > li, main .split > *, ' +
    'main .faq details, .trust li, main .zone-article, main .contact-card, main .table-wrap, main .callout, ' +
    'main .toc, main .form, .cta-inner > *, main .page-head > *'
  );
  var vues = new IntersectionObserver(function (entrees) {
    entrees.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-visible');
      vues.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  cibles.forEach(function (el) {
    var freres = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
    el.style.setProperty('--d', Math.min(freres, 6) * 80 + 'ms');
    el.classList.add('reveal');
    vues.observe(el);
  });

  /* 3. Compteurs animés (la valeur finale est déjà dans le HTML) */
  var compteurs = document.querySelectorAll('[data-count]');
  var vuesCompteurs = new IntersectionObserver(function (entrees) {
    entrees.forEach(function (e) {
      if (!e.isIntersecting) return;
      vuesCompteurs.unobserve(e.target);
      var el = e.target, fin = +el.dataset.count, debut = +(el.dataset.from || 0), t0 = null, duree = 1400;
      var pas = function (t) {
        if (!t0) t0 = t;
        var k = Math.min((t - t0) / duree, 1), ease = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(debut + (fin - debut) * ease);
        if (k < 1) requestAnimationFrame(pas);
      };
      requestAnimationFrame(pas);
    });
  }, { threshold: 0.6 });
  compteurs.forEach(function (c) { vuesCompteurs.observe(c); });

  /* 4. Flux laminaire : filets d'air parallèles, à vitesse égale, qui contournent la souris
        (comme l'air autour d'un opérateur sous un plafond filtrant) */
  var canvas = document.querySelector('.hero-flux');
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d'), hero = canvas.parentElement;
    var w = 0, h = 0, dpr = 1, colonnes = [], actif = true, raf = 0;
    var ECART = 56, PAS = 8, VITESSE = 1.5, LONG = 150;
    var souris = { x: -9999, y: -9999, force: 0, cible: 0 };

    var dimensionner = function () {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = hero.clientWidth; h = hero.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      colonnes = [];
      for (var x = ECART / 2; x < w; x += ECART) {
        var impulsions = [];
        var n = 1 + (Math.random() < 0.45 ? 1 : 0);
        for (var k = 0; k < n; k++) impulsions.push(Math.random() * (h + LONG * 2) - LONG);
        colonnes.push({ x: x, imp: impulsions });
      }
    };

    // Déviation horizontale d'un point du filet autour de la souris
    var deviation = function (x, y) {
      if (souris.force < 0.01) return 0;
      var dx = x - souris.x, dy = y - souris.y, r = 110;
      var e = Math.exp(-(dx * dx + dy * dy) / (2 * r * r));
      return (dx >= 0 ? 1 : -1) * 46 * e * souris.force;
    };

    var trace = function (x, y0, y1) {
      ctx.beginPath();
      for (var y = Math.max(0, y0); y <= Math.min(h, y1); y += PAS) {
        var px = x + deviation(x, y);
        if (y === Math.max(0, y0)) ctx.moveTo(px, y); else ctx.lineTo(px, y);
      }
    };

    var dessiner = function () {
      ctx.clearRect(0, 0, w, h);
      souris.force += (souris.cible - souris.force) * 0.08;
      for (var i = 0; i < colonnes.length; i++) {
        var c = colonnes[i];
        var poids = 0.35 + 0.65 * (c.x / w);       // plus discret derrière le texte, à gauche
        // filet de fond
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(201,168,76,' + (0.13 * poids) + ')';
        trace(c.x, 0, h); ctx.stroke();
        // impulsions : toutes à la même vitesse = flux unidirectionnel
        for (var k = 0; k < c.imp.length; k++) {
          c.imp[k] += VITESSE;
          if (c.imp[k] - LONG > h) c.imp[k] = -Math.random() * h * 0.6;
          var bas = c.imp[k], haut = bas - LONG;
          var g = ctx.createLinearGradient(0, haut, 0, bas);
          g.addColorStop(0, 'rgba(201,168,76,0)');
          g.addColorStop(0.85, 'rgba(201,168,76,' + (0.55 * poids) + ')');
          g.addColorStop(1, 'rgba(226,203,138,' + (0.9 * poids) + ')');
          ctx.strokeStyle = g; ctx.lineWidth = 1.6;
          trace(c.x, haut, bas); ctx.stroke();
        }
      }
      raf = actif ? requestAnimationFrame(dessiner) : 0;
    };

    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = hero.getBoundingClientRect();
      souris.x = e.clientX - r.left; souris.y = e.clientY - r.top; souris.cible = 1;
    });
    hero.addEventListener('pointerleave', function () { souris.cible = 0; });

    dimensionner();
    var minuteur = 0;
    window.addEventListener('resize', function () { clearTimeout(minuteur); minuteur = setTimeout(dimensionner, 150); }, { passive: true });
    new IntersectionObserver(function (e) {
      actif = e[0].isIntersecting && !document.hidden;
      if (actif && !raf) raf = requestAnimationFrame(dessiner);
    }).observe(hero);
    document.addEventListener('visibilitychange', function () {
      actif = !document.hidden;
      if (actif && !raf) raf = requestAnimationFrame(dessiner);
    });
    raf = requestAnimationFrame(dessiner);
  }
})();
