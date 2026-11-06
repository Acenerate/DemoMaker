// Paste into a page: fingerprints computed style + geometry of every element in #sd_container.
(async () => {
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 800));
  const skip = el => el.closest('#sd_search_modal, #sd_image_lightbox, script, style');
  const props = ['color', 'background-color', 'font-family', 'font-size', 'font-weight', 'line-height', 'display', 'visibility', 'opacity', 'border-top-color', 'grid-template-rows'];
  const rows = [];
  for (const el of document.querySelectorAll('#sd_container *')) {
    if (skip(el)) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    rows.push([el.tagName, el.id, Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height), ...props.map(p => cs.getPropertyValue(p))].join('|'));
  }
  const h = s => { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0; return x.toString(36); };
  const chunks = []; for (let i = 0; i < rows.length; i += 40) chunks.push(h(rows.slice(i, i + 40).join('\n')));
  window.__fp = rows;
  return { n: rows.length, all: h(rows.join('\n')), chunks: chunks.join(' '), w: innerWidth, dark: document.documentElement.classList.contains('dark') };
})()
