// Paints a look's card onto a canvas as the page lays it out, `scale` canvas
// pixels to a CSS pixel: its colour, then each line of its text, so a shader
// can show it with the type as crisp as the page's. Each text node is drawn
// as one line, as the card's text is.
export function paint(paper, card, look, scale) {
  const box = look.getBoundingClientRect();
  paper.width = Math.round(box.width * scale);
  paper.height = Math.round(box.height * scale);
  const ctx = paper.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = getComputedStyle(card).backgroundColor;
  ctx.fillRect(0, 0, box.width, box.height);
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (!text) continue;
    const style = getComputedStyle(node.parentElement);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = style.color;
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    ctx.fillText(text, r.left - box.left, r.top - box.top + ctx.measureText(text).fontBoundingBoxAscent);
  }
}
