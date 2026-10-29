# Lookbook Hover Effects

Eight hover effects for a lookbook grid of photographs: a card comes in over each one, along an edge that's never a plain straight wipe: jagged, curved, folded, melted or seen through glass. Driven by [GSAP](https://gsap.com), and drawn in WebGL in every variation but 03, which cuts the card with a CSS `clip-path`.

Inspired by the jagged-edge wipe of the menu on [Monument](https://monument.tv/). 03 is based on it; the other variations take the idea of a card coming in along an edge that isn't straight in their own directions.

![Lookbook Hover Effects](og-image.jpg)

[Demo](https://tympanus.net/Demos/LookbookHoverEffects/)

## Installation

Run this demo on a [local server](https://developer.mozilla.org/en-US/docs/Learn/Common_questions/Tools_and_setup/set_up_a_local_testing_server). There's no build step and nothing to install, but the scripts are ES modules, which don't load from `file://`:

```sh
npx serve .
# or
python3 -m http.server
```

Then open `index.html` (or `index2.html` … `index8.html` for the other variations) and move the pointer over the photographs. On a touch screen, tap one to bring its card in and tap again to send it off.

## The variations

| #   | Name         | What happens |
| --- | ------------ | ------------ |
| 01  | shadow-first | The card's colour sweeps in from the side the pointer entered by, but reaches the photograph's shadows before its highlights, so the photograph draws the leading edge itself: frizzy through curls, clean down a lapel, different on every look. A hairline of light runs along the edge. Leave by the far half and the colour drains away the same way, out of the shadows first; leave by the near half and it goes back, out of the highlights first. |
| 02  | glass        | A drop of liquid glass swells from the middle of the look and, in one movement, spreads over all of it, round at first and squaring off, wobbling a little as it goes. It has no frame of its own: through it is the card, magnified at first and settling flat, drawn out towards the glass's edge with the colours splitting, and around it the photograph is pulled in towards the drop. Leave and it draws back into the middle. It's the same whichever side the pointer comes in by. |
| 03  | reach        | The card reaches in after the pointer. Its edge is a line of points that each follow the pointer at their own speed, so moving makes the edge jagged and keeping still straightens it. Past halfway, the card fills the look. Leave by the far half and the card follows the pointer off the far side; leave by the near half and it pulls back. |
| 04  | lift         | The photograph comes apart in its tones instead of being covered: its lightest parts slide off to the far side first, then the mid-tones, then the shadows, each cut along the jagged outline of its tones, and the card is underneath. Leave by the far half and the photograph comes back in from the near side; leave by the near half and its layers slide back the way they went. |
| 05  | peel         | The photograph peels back from the corner nearest the pointer, like a print lifted off a board: the fold runs straight across and on over the whole look, and the flap shows the back of the print, paper with the photograph faint and mirrored through it, casting a soft shadow. The card is underneath, in the print's shade at first and brightening as it comes off. Leave and the print lays back down. |
| 06  | melt         | The pointer is a source of heat. Around it the photograph softens like warm plastic film: it sags, stretches downwards into strands and tears open in holes with darker, glossy rims, and the card shows through. Darker parts take the heat sooner; the heat follows the pointer and spreads until the whole film has given way. Leave and it cools and pulls itself back together. |
| 07  | liquid       | The card is a liquid glass you draw in with the pointer: a clear blob of it follows the pointer with a gooey lag and a stretching tail, the photograph and the card's type bending through it near its rim. Flick and drops break away and are pulled back, merging with a stretchy neck. It gathers as you hover, faster the more you move, until it floods the look and settles flat into a pane of frosted glass with the card on it. Leave and it drains back into a drop. |
| 08  | channel      | The look changes like a channel, in bands across it: each band breaks up at its own moment, and the bands are dealt again fourteen times a second, so the picture flickers between them. A broken band is a grain of the photograph's own colours and the card's, redrawn thirty times a second, which settles into the card. Leave and it changes back the same way. It's the same whichever side the pointer comes in by. |

## How it works

- **`js/index.js`** waits for the fonts and photographs, then loads the page's effect, named by `data-effect` on `<body>`, with a dynamic `import()`. If the effect can't run (no WebGL 2), the card simply shows on hover.
- **An effect** is a module in `js/effects/` that receives every `.look` on the page and brings each one's card in over its photograph.
- **The hover.** 01, 03 and 04 bring the card in from the side the pointer entered by, and on leaving go on off the far side if it left by the far half or back if by the near half; 01 does it with a leading and a trailing edge that GSAP tweens from 0 to 1 (`wipe()` in `js/wipe.js`). 06 and 07 follow the pointer. 02, 05 and 08 come in the same way whichever side the pointer enters by: one tween played on hover and reversed on leaving, with its own `easeReverse` for the way back (`toggle()`), and 05 peeling from the nearest corner. When the visitor prefers reduced motion, every variation shows and hides the card at once.
- **The card**, text and all, is painted onto a canvas from the page's own layout at the screen's resolution (`js/card.js`), so the WebGL variations can cut its type along the same edge as its colour. 03 cuts the card itself, with `clip-path`.
- **01 shadow-first** puts a WebGL canvas over each photograph. Its shader works out when the colour reaches each pixel, later the further across it is and the lighter the photograph is there, and covers every pixel reached between the card's two edges.
- **02 glass** draws the glass in the shader as a superellipse around the look's middle, a circle while it's a drop and a tile with round corners once it has spread, its outline wobbled by two sine waves around it. Under it, it shows the card, magnified about the middle; for a short way either side of its edge it looks further away from the edge, more the nearer it is, so the card inside is drawn out towards the edge and the photograph outside is pulled in towards it. Each is sampled three times a little apart for red, green and blue, so the colours split. GSAP tweens one value, and the glass's size, roundness and dome all follow from it.
- **03 reach** clips the card with a polygon whose points are each moved by their own `gsap.quickTo()`, all aimed at how far in the pointer is; their different durations make the edge jagged while the pointer moves.
- **04 lift** cuts the photograph into three layers by its blurred tones, a third of it in each, and the shader slides each layer along the sweep by its own amount, with the card underneath. A single GSAP tween runs the whole hover, and each layer's position is staggered from it, so reversing it mid-way reverses the stagger too.
- **05 peel** folds the photograph in the shader along a line that moves from the corner towards the middle and on past the far corner: on the corner's side of it the card shows, darkened at first and brightening as the fold goes on, and beyond it, wherever the spot mirrored back across the fold was part of the print, the flap, showing that spot faintly through paper. How far outside the print that mirrored spot falls gives the soft shadow around the flap.
- **06 melt** works out heat and melting on a 48 × 60 grid on the CPU each frame while it's moving: heat collects around the pointer and spreads to the neighbouring cells, and each cell melts by its heat, faster where the photograph is dark, and all over once the pointer has stayed long enough. The shader sags the photograph by how much has melted above each point, roughens the melt with a grain drawn out downwards, and tears the film where it passes 1, with a darker, shiny rim just before.
- **07 liquid** draws the liquid in the shader as metaballs: every drop adds r²/d² to a field, so drops that come close merge with a neck, and the liquid is wherever the field passes 1. Through it the shader shows the photograph, blurred by averaging a ring of points read from a blurred mip level (more as it floods), under the card's see-through veil and type; the field's slope gives the surface its highlight and bends it all near the rim. On GSAP's ticker the blob is sprung after the pointer, its tail follows a moment behind, and fast moves throw drops that are pulled back; once enough has gathered, a GSAP tween grows the blob over the whole look, and leaving tweens it all away.
- **08 channel** gives each band, in the shader, a moment between 0 and 1 from two random numbers (one for its wide band, one for its narrow one), dealt again `deals` times a second: it breaks up once the change has gone that far. In a broken band each grain takes its colour from a random spot nearby, in the photograph or the card, until more and more of them settle on the card's own colour. All its settings are in `CONFIG` at the top of `js/effects/channel.js`.

## Credits

- Inspired by the menu transition on [Monument](https://monument.tv/); 03 is based on it.
- Photographs: generated for this demo with Nano Banana in [Paper](https://paper.design), a series of six for each variation.
- Nyght Serif by Maksym Kobuzan (SIL Open Font License, `fonts/OFL.txt`), and [Inter Tight](https://fonts.google.com/specimen/Inter+Tight) from Google Fonts.
- [GSAP](https://gsap.com) 3.15.

## Misc

Follow Codrops: [Bluesky](https://bsky.app/profile/codrops.bsky.social), [Facebook](https://www.facebook.com/codrops), [GitHub](https://github.com/codrops), [Instagram](https://www.instagram.com/codropsss/), [X](https://www.x.com/codrops)

## License

The code is [MIT](LICENSE). Nyght Serif in `fonts/` is under the SIL Open Font License (`fonts/OFL.txt`), and GSAP in `js/gsap.min.js` under its own [standard license](https://gsap.com/standard-license).
