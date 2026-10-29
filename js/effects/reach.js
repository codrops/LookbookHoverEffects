// 03 · Reach
//
// Hover a look and the card reaches in after the pointer from the side it
// came in by. Its edge is a line of points that each follow the pointer at
// their own speed: move, and the quick ones get there first and the edge
// turns jagged; keep still, and the slow ones catch up and it straightens.
// Once the pointer is past halfway, the card fills the look.
//
// Leave by the far half of the look and the card follows the pointer off
// the far side; leave by the near half and it pulls back the way it came,
// each point still at its own speed. Come back before it's gone and it
// reaches in again.

import { corner, inward, locate, motion } from '../wipe.js';

const CONFIG = {
  points: 8, // points along the card's edge
  quickest: 0.4, // seconds the quickest point takes to catch up with the pointer
  slowest: 1, // seconds the slowest one takes
  ease: 'expo', // how each point slows as it arrives
  fill: 0.5, // how far in the pointer goes, as a share of the look, before the card fills it
};

function reach(look) {
  const card = look.querySelector('.look__card');

  // The card's leading and trailing edges, each a line of points running
  // from 0 (the side the card comes in by) to 1 (the far side). Each point
  // gets its own speed, the same for both edges, and a quickTo that sends
  // it on from wherever it is. The speeds are random but each is averaged
  // with its neighbours', so the edge breaks into a few uneven teeth rather
  // than a regular saw.
  const random = Array.from({ length: CONFIG.points }, () => Math.random());
  const speeds = random.map((r, i) => {
    const near = (random[i - 1] ?? r) + r + (random[i + 1] ?? r);
    return gsap.utils.interpolate(
      CONFIG.quickest,
      CONFIG.slowest,
      gsap.utils.clamp(0, 1, gsap.utils.normalize(0.5, 2.5, near)),
    );
  });
  const edge = () =>
    Array.from({ length: CONFIG.points }, (_, i) => {
      const point = { d: 0 };
      point.to = gsap.quickTo(point, 'd', {
        duration: speeds[i],
        ease: CONFIG.ease,
        onUpdate: request,
      });
      // quickTo needs a duration above 0, so with reduced motion the point
      // just jumps.
      if (!motion) {
        point.to = (d) => {
          point.d = d;
          request();
        };
      }
      return point;
    });
  const lead = edge();
  const trail = edge();

  let from = null; // the side the card came in by, while any of it is on the photograph
  let shown = false; // whether the card is on its way in (true) or out
  let full = false; // whether the pointer has gone far enough in for the card to fill the look

  // The card's clip-path: down the leading edge and back up the trailing one.
  const render = () => {
    const at = (p, i) => corner[from](p.d, i / (CONFIG.points - 1));
    card.style.clipPath = `polygon(${[...lead.map(at), ...trail.map(at).reverse()].join(', ')})`;
  };

  // Once the card has gone, off either side, the next one can come in by
  // any side.
  const rest = () => {
    if (!from || (!trail.every((p) => p.d >= 1) && !lead.every((p) => p.d <= 0))) return;
    [...lead, ...trail].forEach((p) => p.to(0, 0));
    from = null;
    full = false;
    card.style.clipPath = '';
  };

  // Draws the card once a frame while its points move, after GSAP has
  // moved them.
  let ticking = false;
  function request() {
    if (ticking) return;
    ticking = true;
    gsap.ticker.add(tick);
  }
  function tick() {
    if (from) render();
    if (gsap.isTweening([...lead, ...trail])) return;
    gsap.ticker.remove(tick);
    ticking = false;
    rest();
  }

  const follow = (e) => {
    if (!shown) return;
    const depth = inward(locate(look, e), from);
    if (depth > CONFIG.fill) full = true;
    lead.forEach((p) => p.to(full ? 1 : depth));
  };

  const enter = (e, fill = false) => {
    shown = true;
    if (!from) from = locate(look, e).side;
    full ||= fill;
    trail.forEach((p) => p.to(0));
    follow(e);
  };

  const leave = (e) => {
    shown = false;
    if (!from) return;
    if (inward(locate(look, e), from) > 0.5) [...lead, ...trail].forEach((p) => p.to(1));
    else lead.forEach((p) => p.to(0));
  };

  look.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && enter(e));
  look.addEventListener('pointermove', (e) => e.pointerType !== 'touch' && follow(e));
  look.addEventListener('pointerleave', (e) => e.pointerType !== 'touch' && leave(e));

  // Touch has no hover: a tap brings the whole card in, and the next one
  // sends it off by the side nearest the tap.
  look.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    if (shown) leave(e);
    else enter(e, true);
  });
}

export default function reaching(looks) {
  looks.forEach(reach);
}
