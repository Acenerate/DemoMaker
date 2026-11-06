// Reads the Klick-Zen docs as plain text: from the live docs site in config.json ("docsUrl"), or from
// the offline copy in site/ if the site can't be reached.
//
//   node tools/read-docs.js                              list every page (path and title)
//   node tools/read-docs.js landing-pages/overview       print one page's text
//   node tools/read-docs.js landing-pages how-do-i/build-a-one-click-ticket-close   several pages
const { readPage, listPages } = require('./lib/docs');

(async () => {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    const r = await listPages();
    console.log(`${r.pages.length} docs pages (${r.source === 'live' ? 'live: ' + r.base : 'offline copy in site/'})`);
    if (r.liveError) console.log(`Note: the live docs site could not be reached (${r.liveError}), so this is the offline copy, which may be out of date.`);
    let section = null;
    for (const p of r.pages) {
      if (p.section !== section) { section = p.section; console.log(`\n${section}`); }
      console.log(`  ${p.path.replace(/^\/|\/$/g, '').padEnd(56)} ${p.title}`);
    }
    return;
  }
  for (const p of paths) {
    const page = await readPage(p);
    console.log(`=== ${page.title || p}  (${page.source === 'live' ? page.url : 'offline copy: ' + page.url})`);
    if (page.liveError) console.log(`Note: the live docs site could not be reached (${page.liveError}); this is the offline copy and may be out of date.`);
    console.log(page.text + '\n');
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
