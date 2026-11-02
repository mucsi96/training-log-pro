import { execFileSync } from 'node:child_process';
import { createServer, Server } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, expect } from '../fixtures';

let server: Server;
let directory: string;
let assetBase: string;
let indexHtml: string;
const assetCookies: string[] = [];

test.beforeAll(async ({ baseURL }) => {
  directory = await mkdtemp(join(tmpdir(), 'training-static-'));
  server = createServer(async (request, response) => {
    if (request.headers.cookie) assetCookies.push(request.headers.cookie);
    const path = decodeURIComponent(new URL(request.url!, 'http://localhost').pathname);
    const file = resolve(directory, 'assets', `.${path}`);
    if (!file.startsWith(`${resolve(directory, 'assets')}/`)) {
      response.writeHead(400).end();
      return;
    }
    try {
      const body = await readFile(file);
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' :
        file.endsWith('.webmanifest') ? 'application/manifest+json' : 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': type, 'Access-Control-Allow-Origin': baseURL! }).end(body);
    } catch {
      response.writeHead(404, { 'Access-Control-Allow-Origin': baseURL! }).end();
    }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing asset listener');
  assetBase = `http://127.0.0.1:${address.port}/`;
  execFileSync('node', ['../scripts/prepare-client.mjs', '../client/dist', directory, assetBase, baseURL!]);
  indexHtml = await readFile(join(directory, 'documents/index.html'), 'utf8');
});

test.afterAll(async () => {
  if (server) await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
  if (directory) await rm(directory, { recursive: true, force: true });
});

test('loads direct storage assets and lazy routes with same-origin telemetry and navigation', async ({ page, baseURL }) => {
  // The intercepted document has no network address; permit its test-only
  // loopback asset server while leaving normal cross-origin CORS checks enabled.
  await page.context().grantPermissions(['local-network-access']);
  const assets: string[] = [];
  page.on('request', request => {
    if (['script', 'stylesheet', 'font', 'image', 'manifest'].includes(request.resourceType())) assets.push(request.url());
  });
  await page.route('**/settings', route => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: indexHtml }) : route.continue());
  const telemetry = page.waitForRequest(request => request.url() === `${baseURL}/_telemetry/collect` && request.method() === 'POST');
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'Open profile menu' })).toBeVisible();
  expect((await telemetry).postDataJSON().meta.app.name).toBe('training-log-client');
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const font of ['400 16px Roboto', '400 24px "Material Icons"']) {
      if (!(await document.fonts.load(font)).length) throw new Error(`Missing bundled font: ${font}`);
    }
  });
  expect(await page.evaluate(() => document.baseURI)).toBe(`${baseURL}/`);
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!;
    return (await fetch(link.href, { credentials: 'omit' })).json();
  });
  expect(manifest.start_url).toBe(`${baseURL}/`);
  expect(manifest.scope).toBe(`${baseURL}/`);
  expect(assets.some(url => /\/chunk-.*\.js$/.test(url))).toBe(true);
  expect(assets.some(url => url.endsWith('.woff2'))).toBe(true);
  expect(assets.filter(url => !url.startsWith(assetBase))).toEqual([]);
  expect(assetCookies).toEqual([]);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open profile menu' })).toBeVisible();
});
