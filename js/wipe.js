// The hovers the effects share, and the helpers they use: which side of a
// look the pointer came in by, and how far in it is.
//
// wipe() brings a look's card in between two edges, a leading and a
// trailing one, each running from 0 on the side the card comes in by to 1
// on the far side. GSAP moves the edges; the effect draws the card between
// them. The card comes in by whichever side of the look the pointer enters
// by. Leave by the far half and the trailing edge follows the leading one
// off the far side; leave by the near half and the leading edge goes back
// the way it came. Come back before the card has gone and it turns round.
//
// toggle(), at the end, is for the effects that come in the same way
// whichever side the pointer enters by.

// 0 when the visitor prefers reduced motion, else 1: every duration is
// multiplied by it, so the card shows and hides at once.
export const motion = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;

// Which way the card sweeps, by the side it comes in by: [x, y, z] such
// that d = x·u + y·v + z is 0 on that side and 1 on the far one, where
// (u, v) runs from 0 to 1 across the look and up it.
export const sweeps = {
  left: [1, 0, 0],
  right: [-1, 0, 1],
  top: [0, -1, 1],
  bottom: [0, 1, 0],
};

// Where the pointer is on a look, 0 to 1 across and down, and the side it's nearest.
export function locate(look, e) {
  const r = look.getBoundingClientRect();
  const x = gsap.utils.clamp(0, 1, (e.clientX - r.left) / r.width);
  const y = gsap.utils.clamp(0, 1, (e.clientY - r.top) / r.height);
  const gaps = { left: x, right: 1 - x, top: y, bottom: 1 - y };
  const side = Object.keys(gaps).reduce((a, b) => (gaps[b] < gaps[a] ? b : a));
  return { x, y, side };
}

// How far a point from locate() is into the look from `side`, 0 to 1.
export const inward = ({ x, y }, side) => ({ left: x, right: 1 - x, top: y, bottom: 1 - y })[side];

// For the effects that cut the card with clip-path: a point at depth d into
// the look from `side` (0 on that side, 1 on the far one) and a along the
// edge (0 to 1), as a polygon corner.
export const corner = {
  left: (d, a) => `${d * 100}% ${a * 100}%`,
  right: (d, a) => `${(1 - d) * 100}% ${a * 100}%`,
  top: (d, a) => `${a * 100}% ${d * 100}%`,
  bottom: (d, a) => `${a * 100}% ${(1 - d) * 100}%`,
};

// Sets up the hover on one look and returns its edges. `start(sweep, side)`
// is called when the card sets off from a new side, with that side's entry
// in `sweeps` and its name; `update()` whenever an edge moves.
export function wipe(look, { duration, ease, start, update }) {
  // How far the card's leading and trailing edges have swept, 0 to 1.
  const edges = { lead: 0, trail: 0 };
  let from = null; // the side the card came in by, while any of it is on the photograph
  let shown = false; // whether the card is on its way in (true) or out

  // Once the card has gone, off either side, the next one can come in by
  // any side.
  const rest = () => {
    if (edges.lead > 0 && edges.trail < 1) return;
    gsap.killTweensOf(edges);
    edges.lead = edges.trail = 0;
    from = null;
    update();
  };

  // Sends one edge to `to`, from where it is now.
  const move = (edge, to) => {
    gsap.to(edges, {
      [edge]: to,
      duration: duration * motion,
      ease,
      overwrite: 'auto',
      onUpdate: update,
      onComplete: rest,
    });
  };

  const enter = (e) => {
    shown = true;
    if (from) move('trail', 0); // back before it's gone: the card fills in again
    else {
      from = locate(look, e).side;
      start(sweeps[from], from);
    }
    move('lead', 1);
  };

  const leave = (e) => {
    shown = false;
    if (!from) return;
    if (inward(locate(look, e), from) > 0.5) move('trail', 1);
    else move('lead', 0);
  };

  look.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && enter(e));
  look.addEventListener('pointerleave', (e) => e.pointerType !== 'touch' && leave(e));

  // Touch has no hover: a tap brings the card in, and the next one sends
  // it off by the side nearest the tap.
  look.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    if (shown) leave(e);
    else enter(e);
  });

  return edges;
}

// The hover for the effects that don't depend on the side the pointer comes
// in by: one value, run up to 1 while the pointer is over the look and back
// down to 0 when it leaves. `start(e)` is called when it sets off from 0;
// `update()` whenever it moves. Touch gets a tap to run it up and another to
// run it down. Returns the value, { p }.
//
// It's one tween, played on hover and reversed on leaving. `easeReverse`
// (GSAP 3.15) is the ease it runs back with: reversed mid-way, the tween
// goes back from wherever it is, eased by it, in the time it took to get
// there, so a quick hover in and out is quick. Without it, the tween would
// run its own ease backwards, starting slowly where `ease` ends slowly.
export function toggle(look, { duration, ease, easeReverse = ease, start, update }) {
  const state = { p: 0 };
  let shown = false;

  const tween = gsap.to(state, {
    p: 1,
    duration: duration * motion,
    ease,
    easeReverse,
    paused: true,
    onUpdate: update,
    onComplete: update,
    onReverseComplete: update,
  });

  const enter = (e) => {
    shown = true;
    if (state.p === 0) start?.(e);
    tween.play();
  };

  const leave = () => {
    shown = false;
    tween.reverse();
  };

  look.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && enter(e));
  look.addEventListener('pointerleave', (e) => e.pointerType !== 'touch' && leave());
  look.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    if (shown) leave();
    else enter(e);
  });

  return state;
}
