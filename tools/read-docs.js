// Reads the Klick-Zen docs as plain text, from the docs site in config.json ("docsUrl").
//
//   node tools/read-docs.js                              list every page (path and title)
//   node tools/read-docs.js landing-pages/overview       print one page's text
//   node tools/read-docs.js landing-pages how-do-i/build-a-one-click-ticket-close   several pages
const { readPage, listPages } = require('./lib/docs');

(async () => {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    const r = await listPages();
    console.log(`${r.pages.length} docs pages (${r.base})`);
    let section = null;
    for (const p of r.pages) {
      if (p.section !== section) { section = p.section; console.log(`\n${section}`); }
      console.log(`  ${p.path.replace(/^\/|\/$/g, '').padEnd(56)} ${p.title}`);
    }
    return;
  }
  for (const p of paths) {
    const page = await readPage(p);
    console.log(`=== ${page.title || p}  (${page.url})`);
    console.log(page.text + '\n');
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
