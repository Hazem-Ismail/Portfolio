'use strict';

// Appearance is the only saved preference. Storage is optional on file://.
const root = document.documentElement;
const themeButton = document.querySelector('.theme-toggle');
let themeChanging = false;
function syncTheme() {
  const dark = root.dataset.theme === 'dark';
  const label = `Switch to ${dark ? 'light' : 'dark'} theme`;
  themeButton.setAttribute('aria-label', label);
  themeButton.title = label;
  document.querySelector('.theme-name').textContent = dark ? 'Dark' : 'Light';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#071019' : '#f0f6fa';
}
themeButton.addEventListener('click', async () => {
  if (themeChanging) return;
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  const apply = () => {
    root.dataset.theme = next;
    try { localStorage.setItem('hazem-portfolio-v2-appearance', next); } catch (error) {}
    syncTheme();
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return; }
  const box = themeButton.getBoundingClientRect();
  const origin = `${(box.left + box.width / 2) / innerWidth * 100}% ${(box.top + box.height / 2) / innerHeight * 100}%`;
  themeChanging = true;
  let transition;
  try {
    if (document.startViewTransition) {
      transition = document.startViewTransition(apply);
      await transition.ready;
      await root.animate({ clipPath: [`circle(0% at ${origin})`, `circle(150% at ${origin})`] }, {duration:720, easing:'cubic-bezier(.22,1,.36,1)', pseudoElement:'::view-transition-new(root)'}).finished;
      await transition.finished;
    } else {
      apply();
      await document.body.animate([{opacity:.65},{opacity:1}],{duration:400}).finished;
    }
  } catch (error) { transition?.skipTransition(); apply(); }
  finally { themeChanging = false; }
});
syncTheme();

// Native <details> keep all project content accessible without JavaScript.
// Native <dialog> adds modal focus management and Escape dismissal in Chrome.
const dialogs = new Map();
let projectOpener = null;
if (typeof HTMLDialogElement !== 'undefined' && 'showModal' in HTMLDialogElement.prototype) {
  document.querySelectorAll('.case-study').forEach(disclosure => {
    const dialog = document.createElement('dialog');
    dialog.id = disclosure.id;
    dialog.className = 'project-dialog';
    const article = disclosure.querySelector('.case-article');
    dialog.setAttribute('aria-labelledby', article.querySelector('h2').id);
    dialog.append(article);
    disclosure.replaceWith(dialog);
    document.body.append(dialog);
    const closeButton = dialog.querySelector('.dialog-close');
    closeButton.hidden = false;
    let closing = false;
    async function closeProject() {
      if (closing) return;
      closing = true;
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        await dialog.animate([{opacity:1, transform:'translateY(0) scale(1)'},{opacity:0, transform:'translateY(16px) scale(.98)'}],{duration:180,easing:'ease-in'}).finished.catch(() => {});
      }
      dialog.close(); closing = false;
    }
    closeButton.addEventListener('click', closeProject);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeProject(); });
    let pointerStartedOnBackdrop = false;
    dialog.addEventListener('pointerdown', event => {
      pointerStartedOnBackdrop = event.target === dialog;
    });
    dialog.addEventListener('click', event => {
      if (event.target === dialog && pointerStartedOnBackdrop) closeProject();
    });
    dialog.addEventListener('close', () => {
      dialog.querySelectorAll('video').forEach(video => video.pause());
      document.body.classList.remove('modal-open');
      if (projectOpener && projectOpener.isConnected) projectOpener.focus({ preventScroll: true });
    });
    dialogs.set(dialog.id, dialog);
  });
  document.querySelector('.project-details-fallback').remove();

  function openProject(id, opener) {
    const dialog = dialogs.get(id);
    if (!dialog || dialog.open) return;
    projectOpener = opener;
    document.body.classList.add('modal-open');
    dialog.showModal();
    dialog.scrollTop = 0;
    dialog.querySelector('.dialog-close').focus({ preventScroll: true });
  }

  document.querySelectorAll('[data-project]').forEach(link => {
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openProject(link.dataset.project, link);
    });
  });

  // Direct project anchors also work when opened in a separate browser tab.
  function openLinkedProject() {
    const id = location.hash.slice(1);
    if (dialogs.has(id)) openProject(id, document.querySelector(`[data-project="${id}"]`));
  }
  window.addEventListener('hashchange', openLinkedProject);
  openLinkedProject();
}

// Arrow keys, Home and End operate the project gallery as a standard tablist.
document.querySelectorAll('.media-gallery').forEach(gallery => {
  const tablist = gallery.querySelector('.media-tabs');
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  tablist.hidden = false;
  function activateTab(selected, moveFocus = false) {
    tabs.forEach(tab => {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      panel.setAttribute('role', 'tabpanel');
      panel.tabIndex = 0;
      panel.hidden = !active;
      if (!active) panel.querySelectorAll('video').forEach(video => video.pause());
    });
    if (moveFocus) selected.focus();
    if (root.dataset.motion === 'full') {
      document.getElementById(selected.getAttribute('aria-controls')).animate([
        { opacity:0, transform:'translateY(9px)' }, { opacity:1, transform:'translateY(0)' }
      ], {duration:300,easing:'ease-out'});
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', event => {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      activateTab(tabs[next], true);
    });
  });
  activateTab(tabs[0]);
});

const navigationLinks = [...document.querySelectorAll('.main-nav a')];
let navigationFrame = 0;
function updateNavigation() {
  navigationFrame = 0;
  const marker = Math.min(innerHeight * .32, 230);
  let current = '';
  navigationLinks.forEach(link => {
    const section = document.querySelector(link.hash);
    if (section.getBoundingClientRect().top <= marker) current = link.hash;
  });
  if (scrollY > 100 && scrollY + innerHeight >= document.documentElement.scrollHeight - 4) current = '#contact';
  navigationLinks.forEach(link => {
    if (link.hash === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
function scheduleNavigation() {
  if (!navigationFrame) navigationFrame = requestAnimationFrame(updateNavigation);
}
window.addEventListener('scroll', scheduleNavigation, { passive: true });
window.addEventListener('resize', scheduleNavigation, { passive: true });
updateNavigation();
document.getElementById('current-year').textContent = String(new Date().getFullYear());

// Respect reduced motion and pause effects in background tabs.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 761px)');
const runningEntrances = new Set();
const tiltCards = [...document.querySelectorAll('[data-tilt]')];

function motionEnabled() {
  return !reducedMotion.matches && !document.hidden;
}
function resetTilt(card) {
  card.style.removeProperty('--rx');
  card.style.removeProperty('--ry');
  card.style.removeProperty('--mx');
  card.style.removeProperty('--my');
}
function syncMotion() {
  const enabled = motionEnabled();
  root.dataset.motion = enabled ? 'full' : 'quiet';
  if (!enabled) {
    runningEntrances.forEach(animation => animation.cancel());
    runningEntrances.clear();
    tiltCards.forEach(resetTilt);
  }
}
reducedMotion.addEventListener('change', syncMotion);
finePointer.addEventListener('change', () => tiltCards.forEach(resetTilt));
document.addEventListener('visibilitychange', syncMotion);
syncMotion();

// Web Animations leave the document visible if motion is paused or JS fails.
function reveal(element, delay = 0, distance = 24) {
  if (!motionEnabled() || !element.animate) return;
  const animation = element.animate([
    { opacity: 0, transform: `translateY(${distance}px)`, filter: 'blur(5px)' },
    { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }
  ], { duration: 800, delay, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
  runningEntrances.add(animation);
  animation.finished.then(() => runningEntrances.delete(animation)).catch(() => runningEntrances.delete(animation));
}
if (!location.hash || location.hash === '#home') {
  document.querySelectorAll('.hero-topline,.name-first,.name-last,.hero-intro,.hero-aside,.portrait,.hero-foot').forEach((element, index) => {
    reveal(element, index * 65, index < 3 ? 30 : 18);
  });
}
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      reveal(entry.target);
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: .08, rootMargin: '0px 0px -24px 0px' });
  document.querySelectorAll('.section-heading,.project,.about-intro,.experience-group,.education-strip,.knowledge-grid>*,.contact-section>.wrap').forEach(element => revealObserver.observe(element));
}

// Pointer effects are event-driven, with one paint per frame and no idle loop.
tiltCards.forEach(card => {
  let frame = 0;
  let point = null;
  card.addEventListener('pointermove', event => {
    if (!motionEnabled() || !finePointer.matches || event.pointerType === 'touch') return;
    point = { x: event.clientX, y: event.clientY };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!point || !motionEnabled() || !finePointer.matches) return;
      const bounds = card.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (point.x - bounds.left) / bounds.width));
      const y = Math.max(0, Math.min(1, (point.y - bounds.top) / bounds.height));
      card.style.setProperty('--rx', `${((.5 - y) * 4).toFixed(2)}deg`);
      card.style.setProperty('--ry', `${((x - .5) * 4).toFixed(2)}deg`);
      card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    });
  }, { passive: true });
  card.addEventListener('pointerleave', () => {
    point = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    resetTilt(card);
  });
});

// Keep the summary stable while only its content slides. A second click reverses
// the current animation from its visible height instead of dropping the click.
document.querySelectorAll('details:not(.case-study)').forEach(details => {
  const summary = details.querySelector('summary');
  const content = document.createElement('div');
  content.className = 'disclosure-content';
  [...details.childNodes].filter(node => node !== summary).forEach(node => content.append(node));
  details.append(content);
  let animation = null;
  let desiredOpen = details.open;
  summary.addEventListener('click', event => {
    event.preventDefault();
    const start = details.open ? content.getBoundingClientRect().height : 0;
    desiredOpen = !desiredOpen;
    if (animation) animation.cancel();
    animation = null;
    if (!motionEnabled() || !content.animate) {
      details.open = desiredOpen;
      content.style.overflow = '';
      return;
    }
    details.open = true;
    content.style.overflow = 'hidden';
    const target = desiredOpen ? content.getBoundingClientRect().height : 0;
    const current = content.animate({ height: [`${start}px`, `${target}px`] }, {
      duration: 320, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both'
    });
    animation = current;
    current.finished.then(() => {
      if (animation !== current) return;
      details.open = desiredOpen;
      current.cancel();
      content.style.overflow = '';
      animation = null;
    }).catch(() => {});
  });
});
