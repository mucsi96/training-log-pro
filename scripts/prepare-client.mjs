import { cp, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [directory, destination, assetBaseUrl, appOrigin] = process.argv.slice(2);
if (!directory || !destination || !assetBaseUrl || !appOrigin) {
  throw new Error('Usage: prepare-client.mjs <build> <output> <asset-base-url> <app-origin>');
}
const assetBase = new URL(assetBaseUrl);
const origin = new URL(appOrigin);
if (!['https:', 'http:'].includes(assetBase.protocol) || !assetBase.pathname.endsWith('/') ||
    !['https:', 'http:'].includes(origin.protocol) || origin.pathname !== '/') {
  throw new Error('Expected an HTTP(S) asset directory URL and application origin');
}
const root = await realpath(directory);
const index = await readFile(join(root, 'index.html'), 'utf8');
for (const entry of await readdir(root, { recursive: true })) {
  if ((await lstat(join(root, entry))).isSymbolicLink()) throw new Error(`Unexpected symlink: ${entry}`);
}
const assets = join(destination, 'assets');
const documents = join(destination, 'documents');
await mkdir(documents, { recursive: true });
await cp(root, assets, { recursive: true });
const html = index.replace(/<(script|link)\b[^>]*>/gi, tag => {
  const attribute = /^<script\b/i.test(tag) ? 'src' : 'href';
  const pattern = new RegExp(`\\b${attribute}=(['"])(.*?)\\1`, 'i');
  if (!pattern.test(tag)) return tag;
  const rewritten = tag.replace(pattern, (_, quote, path) => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path)) throw new Error(`Build assets must be local: ${path}`);
    const url = new URL(path.replace(/^\/+/, ''), assetBase).href;
    return `${attribute}="${url.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"`;
  }).replace(/\s+crossorigin(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '');
  return rewritten.replace(/\s*\/?>(?=$)/, ' crossorigin="anonymous">');
});
await rm(join(assets, 'index.html'));
await writeFile(join(documents, 'index.html'), html);
const manifestPath = join(assets, 'manifest.webmanifest');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
for (const key of ['id', 'start_url', 'scope']) manifest[key] = new URL(manifest[key] ?? '/', origin).href;
await writeFile(manifestPath, JSON.stringify(manifest));
