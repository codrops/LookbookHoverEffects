// Lookbook Hover Effects · moves the live server's sponsor line out of the
// frame, lifts the loader once the fonts and photographs are in, and starts
// the page's effect, named by `data-effect` on <body>. An effect throws when
// it can't run (no WebGL 2); then the card simply shows on hover.

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

// On the live server, Codrops' sponsor script adds an empty box to the frame
// and fills it with the sponsor line once that's loaded. Moved now, while
// it's still empty, the line comes in at the foot of the label's column
// instead (css/base.css), so it never pushes the page down.
const frame = document.querySelector('.frame');
const sponsor = () => {
  const box = frame.querySelector('#in-demo-placement-box');
  if (box) document.querySelector('.lookbook__head').append(box);
  return box;
};
if (!sponsor()) {
  new MutationObserver((records, observer) => sponsor() && observer.disconnect()).observe(frame, {
    childList: true,
  });
}

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
