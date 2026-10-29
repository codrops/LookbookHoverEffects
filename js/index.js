// Lookbook Hover Effects · lifts the loader once the fonts and photographs
// are in, and starts the page's effect, named by `data-effect` on <body>. An
// effect throws when it can't run (no WebGL 2); then the card simply shows
// on hover.

const effects = {
  'shadow-first': () => import('./effects/shadow-first.js'),
  glass: () => import('./effects/glass.js'),
  reach: () => import('./effects/reach.js'),
  lift: () => import('./effects/lift.js'),
  peel: () => import('./effects/peel.js'),
  melt: () => import('./effects/melt.js'),
  liquid: () => import('./effects/liquid.js'),
  channel: () => import('./effects/channel.js'),
};

const ready = Promise.all([
  document.fonts.ready,
  ...[...document.images].map((img) => img.decode().catch(() => {})),
]);

Promise.all([effects[document.body.dataset.effect](), ready]).then(([{ default: effect }]) => {
  try {
    effect([...document.querySelectorAll('.look')]);
  } catch (error) {
    console.warn(error);
    document.documentElement.classList.add('plain');
  }
  document.body.classList.remove('loading');
});
