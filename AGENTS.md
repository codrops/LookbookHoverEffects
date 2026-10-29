# AGENTS.md

Notes for coding agents working on this repo. Read [README.md](README.md) first for what the demo is.

## Setup

- There is no build step, no package.json and nothing to install. Plain HTML, CSS and ES modules.
- Serve the root with any static server (`npx serve .` or `python3 -m http.server`). ES modules don't load from `file://`.
- GSAP 3.15 is vendored in `js/` and loaded as a classic script before the module, so `gsap` is a global. Don't import it.
- There are no automated tests. Check a change in a browser: hover a photograph from each of its four sides, leave by the far side and by the near one, slip in and out quickly, sweep the pointer along both rows, and look at the console. On a touch screen (or device emulation), tap a photograph twice.

## Map

| Path                 | What it is |
| -------------------- | ---------- |
| `index.html`         | Variation 01: the frame, the lookbook head and the six looks, in two rows of three.               |
| `index2.html` … `index8.html` | Variations 02 to 08: the same page, with their own `data-effect`.                   |
| `js/index.js`        | The registry of effects by name (each loaded with `import()` only on its page), the loader, start-up. |
| `js/effects/*.js`    | One effect per file.                                                                              |
| `js/wipe.js`         | The two shared hovers, `wipe()` and `toggle()`, and the helpers: `motion`, `sweeps`, `locate()`, `inward()`, `corner`. |
| `js/photo.js`        | A photograph's tones and a Gaussian blur, on the CPU, for 04 and 06.                              |
| `js/card.js`         | `paint()`: the card, text and all, onto a canvas from its own layout.                             |
| `js/gl.js`           | WebGL 2 helpers: the full-canvas vertex shader, `overlay()`, `program()`, `uniforms()`, `texture()`, `field()`. |
| `css/base.css`       | All styles: the frame, the loader, the lookbook, the card and the effects' canvas.               |
| `img/<NN>/`          | Each variation's own six photographs, `1.webp` to `6.webp`, 960 × 1200 (4:5): `img/01/` for `index.html`, `img/02/` for `index2.html` and so on. |
| `fonts/`             | Nyght Serif Light, for the label's name and the look numbers, with its licence (`OFL.txt`).        |
| `og-image.jpg`       | The 1200 × 630 social preview every page's `og:image` and `twitter:image` point to, and the README's image. |

## The effect contract

```js
export default function name(looks) {
  // looks: every <figure class="look"> on the page, in page order. Each holds
  // an <img class="look__img"> and the card to wipe in, <figcaption class="look__card">.
}
```

- Every `.look__card` is cut down to nothing by `clip-path` in `css/base.css`. Screen readers read it there, so don't hide it with `display`, `visibility` or `aria-hidden`; anything an effect adds over the photograph gets `aria-hidden="true"` (`overlay()` does this for the canvas). 03 brings the card in by setting that `clip-path` itself (`corner` turns a point into a polygon corner for the side the card comes in by), and clears it when the card has gone.
- The WebGL effects (all but 03) draw the card on their canvas, painted from the card's own layout (`paint()` in `js/card.js`), so a change to the card's markup or CSS shows up in the effect as it is. They paint when the look is first sized and on every resize, after `js/index.js` has waited for the fonts. `paint()` draws each text node as one line, so keep the card's lines as separate text nodes (`<br />` or their own element) rather than text that wraps.
- An effect may throw when it can't run (no WebGL 2). `js/index.js` catches it and adds `plain` to `<html>`, and the card simply shows on hover.
- 01, 03 and 04 bring the card in from the side of the look the pointer entered by (`locate()`), and on leaving go on off the far side if the pointer left by the far half (`inward() > 0.5`) or back the way they came if not. 06 and 07 follow the pointer, and 02, 05 and 08 come in the same way whichever side the pointer enters by. Hover uses pointer events and ignores `pointerType === 'touch'`; touch gets a tap to bring the card in and another to send it off.
- 01 uses `wipe(look, { duration, ease, start, update })` in `js/wipe.js`, which returns the card's edges, `{ lead, trail }`, each 0 to 1. It calls `start(sweep, side)` when the card sets off from a new side (the `[x, y, z]` for the shader's `uSweep`, and the side's name) and `update()` whenever an edge moves. 02, 05 and 08 use `toggle(look, { duration, ease, easeReverse, start, update })`, which returns `{ p }`: one tween to 1, played on hover and reversed on leaving, with `easeReverse` (GSAP 3.15, defaulting to `ease`) for the way back, so turned round mid-way it goes back from where it is, in the time it took to get there; `start(e)` is called when it sets off from 0 (05 picks its corner there). 03, 04, 06 and 07 run their own hover with the same helpers; 04 drives its from one tween of a single value, from 0 to 2, so that reversing it mid-way reverses everything, 06 works out its melting on GSAP's ticker, and 07 its liquid's movement.
- When the visitor prefers reduced motion, the card shows and hides at once: every duration is multiplied by `motion`, which is then 0. `gsap.quickTo()` needs a duration above 0, so 03's points set their value directly instead.

## WebGL

- WebGL 2 and GLSL ES 3.00, no three.js. One canvas per look (`.look__canvas`, made by `overlay()`, over the photograph, `pointer-events: none`), sized to the look at up to 2 device pixels per CSS pixel. `uniforms()` finds every uniform the shader uses, so `u.uLead` needs no list of names; an array goes by its plain name (`u.uDrops` for `uDrops[16]`).
- Each WebGL effect draws one triangle over its canvas (`fullscreen` in `js/gl.js`) and works from `gl_FragCoord.xy / uResolution`: 0 to 1 across and up. `texture()` flips images and canvases to match, so a texture lines up with the look pixel for pixel.
- The canvas is transparent wherever the page's own photograph should show, and its colour is premultiplied by its alpha (the browser's default for a WebGL canvas).
- Draw only when something changes: from the tweens' `onUpdate` and on resize. 02, 04, 05 and 06 clear their canvas while the photograph is whole, so the page's own image shows. 06 and 07 draw on GSAP's ticker while their film melts or their liquid moves, and take themselves off the ticker once it's still; 07 clears its canvas while there's no liquid. 03 has no canvas; it writes its `clip-path` from GSAP's ticker while its points move, and takes itself off the ticker once they stop.
- Data worked out on the CPU (04's blurred tones, 06's melting) goes up as a float texture with `field()`, rows bottom to top; pass `{ tex }` to replace one. `tones()` in `js/photo.js` already returns them that way.

## Adding a variation

1. Write `js/effects/<name>.js`, with `wipe()` for the hover if the card comes in between two edges from the pointer's side, or `toggle()` if it comes in the same way from any side (and `overlay()` and `paint()` if it draws on a canvas), then add `'<name>': () => import('./effects/<name>.js')` to `effects` in `js/index.js`. Don't import effects statically; each page loads only its own.
2. Copy `index.html` to `index<N>.html` and change `data-effect`, the `demo-<N>` body class, the `Demo <N>` title (in `<title>`, `og:title` and `twitter:title`), the `canonical` and `og:url` (to `https://tympanus.net/Demos/LookbookHoverEffects/index<N>.html`), and the meta description and keywords (see below). Each variation has its own series of six photographs in `img/<NN>/`, its series name in `.lookbook__meta`, and its card colours in `css/base.css` (`.demo-<N> { --card; --card-text }`, taken from its photographs; 07's card is a see-through veil, since its effect shows the photograph frosted under it).
3. Add the link to the `.frame__demos` nav on **every** page, and widen its `grid-template-columns` in `css/base.css`. The current page's entry is a `<span class="frame__demo frame__demo--current">`, not a link.
4. Add a row to the README's table, and a line under "How it works".
5. If the variation is based on someone else's effect, add a `<p class="credit">Based on … <a href="…">…</a></p>` after `</main>` on its page (as on `index3.html`), and a credit in the README.

## Meta description and keywords

Each page has its own, describing its own variation: what you see when you hover, in one or two plain sentences under about 160 characters, ending with what it's made with ("A WebGL and GSAP hover effect." or "A CSS clip-path and GSAP hover effect."). The same text goes in `og:description` and `twitter:description`. Keywords say the same in tags. Write them when a variation is added, and rewrite them whenever it changes what it does or is replaced; don't wait to be asked.

The analytics and sponsor scripts stay commented out in the repo; they're added on the live server only. The sponsor line they add (`#cdawrap`, inside `.frame`) sits on the frame's second row under the variations, and the looks shrink to make room for it (`--sponsor` in `css/base.css`).

## Style

- Two-space indentation, single quotes, semicolons, trailing commas. Follow what's in the file.
- Every effect opens with a comment saying what it looks like, in plain words, including what leaving does. Settings worth tuning go in a `CONFIG` object at the top, each with a comment. Other comments say why, not what.
- No dependencies and no build tooling unless asked.

## Ask before changing

- The page's `<title>` pattern, the `frame__title` heading and the tags. They're kept the same on every page.
- The frame's links (All demos and GitHub; there's no article), the social preview image, the photographs and the credits.
