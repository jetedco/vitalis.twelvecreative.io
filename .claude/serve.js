// Minimal static server for local preview of the funnel (no PHP — the
// event.php/chat.php endpoints 404 here; client-side fallbacks cover them).
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.vcf': 'text/vcard'
};
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404 ' + p); }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    // Byte ranges, so video can stream, seek, and loop like on a real host.
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (m) {
      const start = m[1] ? +m[1] : 0;
      const end = m[2] ? Math.min(+m[2], data.length - 1) : data.length - 1;
      res.writeHead(206, {
        'Content-Type': type, 'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1
      });
      return res.end(data.subarray(start, end + 1));
    }
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': data.length });
    res.end(data);
  });
}).listen(8123, () => console.log('vitalis funnel on http://localhost:8123'));
