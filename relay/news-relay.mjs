// MASAAR news relay. Google News refuses requests from Cloudflare, so the engine cannot read it directly.
// This job reads the same Google News feeds from a GitHub machine and saves the newest items as one file
// on the "relay" branch. The engine reads that file (one request) instead of each Google feed.
// The feed list is taken from the engine itself so the two never drift apart.
import fs from 'fs';
const ENGINE = 'https://raw.githubusercontent.com/basemome/masaar-30/main/cloudflare-worker.js';
const src = await (await fetch(ENGINE)).text();
const start = src.indexOf('const FEEDS = ['), block = src.slice(start, src.indexOf('\n];', start));
const gn = (q, gl) => 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=ar&gl=' + gl + '&ceid=' + gl + ':ar';
const urls = [];
for (const line of block.split('\n')) {
  const m = line.match(/url:\s*(?:gnRss\(\s*"([^"]+)"\s*,\s*"([A-Z]+)"\s*\)|"([^"]+)")/); if (!m) continue;
  const url = m[3] || gn(m[1], m[2]);
  if (/^https:\/\/news\.google\.com\//.test(url)) urls.push(url);
}
const feeds = {}; let ok = 0;
for (const url of urls) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36' }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) continue;
    const xml = await r.text(), items = (xml.match(/<item[\s\S]*?<\/item>/gi) || []).slice(0, 14);
    if (!items.length) continue;
    feeds[url] = '<rss><channel>' + items.join('') + '</channel></rss>'; ok++;
  } catch (e) {}
}
if (ok < Math.min(3, urls.length)) { console.error('too few feeds answered', ok, '/', urls.length); process.exit(1); }
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/news.json', JSON.stringify({ at: new Date().toISOString(), count: ok, of: urls.length, feeds }));
console.log('relay', ok, '/', urls.length, 'feeds');
