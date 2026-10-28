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

  /* 4. Flux laminaire : particules qui descendent dans le bandeau d'accueil */
  var canvas = document.querySelector('.hero-flux');
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d'), hero = canvas.parentElement, w = 0, h = 0, dpr = 1, parts = [], actif = true, raf = 0;
    var dimensionner = function () {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = hero.clientWidth; h = hero.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(90, w * h / 14000));
      parts = [];
      for (var i = 0; i < n; i++) parts.push(nouvelle(true));
    };
    var nouvelle = function (partout) {
      return {
        x: Math.random() * w,
        y: partout ? Math.random() * h : -10,
        v: 0.25 + Math.random() * 0.55,
        r: 0.6 + Math.random() * 1.4,
        a: 0.15 + Math.random() * 0.45,
        l: 6 + Math.random() * 22
      };
    };
    var dessiner = function () {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.y += p.v;
        if (p.y - p.l > h) parts[i] = p = nouvelle(false);
        var g = ctx.createLinearGradient(p.x, p.y - p.l, p.x, p.y);
        g.addColorStop(0, 'rgba(201,168,76,0)');
        g.addColorStop(1, 'rgba(201,168,76,' + p.a + ')');
        ctx.strokeStyle = g; ctx.lineWidth = p.r;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - p.l); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      raf = actif ? requestAnimationFrame(dessiner) : 0;
    };
    dimensionner();
    window.addEventListener('resize', function () { dimensionner(); }, { passive: true });
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
