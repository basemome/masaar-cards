// MASAAR news relay. Google News refuses requests from Cloudflare, so the engine cannot read it directly.
// This job reads the same Google News feeds from a GitHub machine and saves the newest items as one file
// on the "relay" branch. The engine reads that file (one request) instead of each Google feed.
import fs from 'fs';
// masaar-30 is private, so the job cannot read the engine file. The Google feed list is kept here in feeds.json
// (17 feeds, copied from FEEDS in cloudflare-worker.js on 25 Nov 2026). Keys must match the engine URLs exactly.
const urls = JSON.parse(fs.readFileSync(new URL('./feeds.json', import.meta.url), 'utf8'));
if (!urls.length) { console.error('feed list is empty'); process.exit(1); }
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
if (ok < 3) { console.error('too few feeds answered', ok, '/', urls.length); process.exit(1); }
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/news.json', JSON.stringify({ at: new Date().toISOString(), count: ok, of: urls.length, feeds }));
console.log('relay', ok, '/', urls.length, 'feeds');
