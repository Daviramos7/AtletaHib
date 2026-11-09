// Confere o SVG vetorizado contra o PNG original: renderiza o SVG no Chromium (Playwright) no
// mesmo sistema de coordenadas do PNG de 1024 e compara pixel a pixel.
// Uso: node scripts/conferir-simbolo.mjs [saida-diff.png]
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync('logos/atleta-hib-simbolo.svg', 'utf8')
  .replace(/viewBox="[^"]*" width="[^"]*" height="[^"]*"/, 'viewBox="0 0 1024 1024" width="1024" height="1024"');
const png = readFileSync('public/icons/atleta-hib-symbol-1024.png').toString('base64');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent('<body style="margin:0"><canvas id=c width=1024 height=1024></canvas></body>');
const result = await page.evaluate(async ({ svg, png }) => {
  const load = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });
  const alpha = async (src) => {
    const c = new OffscreenCanvas(1024, 1024); const x = c.getContext('2d');
    x.drawImage(await load(src), 0, 0, 1024, 1024);
    const d = x.getImageData(0, 0, 1024, 1024).data; const a = new Uint8Array(1024 * 1024);
    for (let i = 0; i < a.length; i += 1) a[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    return a;
  };
  const ref = await alpha(`data:image/png;base64,${png}`);
  const vec = await alpha(`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`);
  let both = 0, onlyRef = 0, onlyVec = 0;
  const c = document.getElementById('c'); const x = c.getContext('2d'); const out = x.createImageData(1024, 1024);
  for (let i = 0; i < ref.length; i += 1) {
    const r = ref[i], v = vec[i];
    if (r && v) both += 1; else if (r) onlyRef += 1; else if (v) onlyVec += 1;
    const [R, G, B] = r && v ? [120, 120, 120] : r ? [255, 60, 60] : v ? [60, 160, 255] : [12, 12, 12];
    out.data.set([R, G, B, 255], i * 4);
  }
  x.putImageData(out, 0, 0);
  return { iou: both / (both + onlyRef + onlyVec), onlyRef, onlyVec, both, diff: c.toDataURL('image/png') };
}, { svg, png });
await browser.close();
console.log(`IoU ${(result.iou * 100).toFixed(2)}% · só no PNG ${result.onlyRef}px · só no SVG ${result.onlyVec}px · comum ${result.both}px`);
if (process.argv[2]) writeFileSync(process.argv[2], Buffer.from(result.diff.split(',')[1], 'base64'));
