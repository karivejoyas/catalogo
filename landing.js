(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- reveal al hacer scroll ----
  const revealEls = document.querySelectorAll('.ld-reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } });
    }, { threshold: 0.18 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  // ---- scrollytelling del hero ----
  const hero = document.querySelector('.ld-hero');
  const earring = document.getElementById('ld-earring');
  const halo = document.getElementById('ld-halo');
  const pour = document.getElementById('ld-pour');
  const copy = document.getElementById('ld-hero-copy');
  const hint = document.getElementById('ld-scrollhint');

  if (!reduceMotion && hero && earring) {
    let ticking = false;

    function update() {
      ticking = false;
      const rect = hero.getBoundingClientRect();
      const total = hero.offsetHeight - window.innerHeight;
      const progress = Math.min(1, Math.max(0, -rect.top / total));

      // fase A (0 → .45): el aro se balancea y crece suavemente
      // fase B (.45 → 1): se inclina y "derrama" un hilo de destellos dorados
      const sway = Math.sin(progress * Math.PI * 2.2) * 7;
      const tilt = progress > 0.45 ? (progress - 0.45) * 38 : 0;
      const scale = 1 + progress * 0.16;
      const rise = progress * -34;
      earring.style.transform = 'translateY(' + rise + 'px) rotate(' + (sway + tilt) + 'deg) scale(' + scale + ')';

      const glow = 0.18 + progress * 0.3;
      earring.style.filter = 'drop-shadow(0 24px 60px rgba(0,0,0,0.55)) drop-shadow(0 0 30px rgba(227,197,114,' + glow + '))';
      if (halo) halo.style.transform = 'scale(' + (1 + progress * 0.25) + ')';

      if (pour) {
        const pourP = Math.min(1, Math.max(0, (progress - 0.5) / 0.45));
        pour.style.height = (pourP * 46) + 'vh';
        pour.style.opacity = pourP > 0 ? String(Math.min(1, pourP * 2)) : '0';
      }

      if (copy) {
        const fade = Math.min(1, Math.max(0, (progress - 0.55) / 0.35));
        copy.style.opacity = String(1 - fade * 0.85);
        copy.style.transform = 'translateY(' + (fade * -26) + 'px)';
      }

      if (hint) hint.style.opacity = progress > 0.06 ? '0' : '1';
    }

    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }
})();
