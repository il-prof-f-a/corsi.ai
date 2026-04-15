'use strict';
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE   = 'http://localhost:3000';
const PW     = 'password';

async function run() {
  console.log('Avvio Chrome headless...');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);

  // Raccoglie errori JS dalla pagina
  const jsErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') jsErrors.push(msg.text());
  });
  page.on('pageerror', err => jsErrors.push(err.message));

  let passed = 0, failed = 0;
  function ok(label)   { console.log(`  ✅ ${label}`); passed++; }
  function fail(label) { console.log(`  ❌ ${label}`); failed++; }

  async function check(label, fn) {
    try { await fn(); ok(label); }
    catch(e) { fail(`${label} — ${e.message}`); }
  }

  // ── 1. Caricamento pagina ────────────────────────────────────────────────
  console.log('\n[1] Caricamento app');
  await check('Pagina risponde (200)', async () => {
    const res = await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    if (res.status() !== 200) throw new Error(`Status: ${res.status()}`);
  });
  await check('Titolo corretto', async () => {
    const title = await page.title();
    if (!title.includes('Kanban')) throw new Error(`Titolo: "${title}"`);
  });

  // ── 2. Schermata login ───────────────────────────────────────────────────
  console.log('\n[2] Schermata login');
  await check('View-login visibile', async () => {
    await page.waitForSelector('#view-login:not([hidden])', { timeout: 4000 });
  });
  await check('Campo password presente', async () => {
    await page.waitForSelector('#login-password', { visible: true });
  });
  await check('Selettore lingua presente', async () => {
    await page.waitForSelector('#lang-login', { visible: true });
  });

  // ── 3. Login ─────────────────────────────────────────────────────────────
  console.log('\n[3] Login con password "password"');
  await check('Inserimento password', async () => {
    await page.type('#login-password', PW);
  });
  await check('Click Accedi', async () => {
    await page.click('#btn-login');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 5000 });
  });
  await check('View-app visibile dopo login', async () => {
    const hidden = await page.$eval('#view-app', el => el.hidden);
    if (hidden) throw new Error('view-app ancora hidden');
  });
  await check('Header presente', async () => {
    await page.waitForSelector('.app-header', { visible: true });
  });

  // ── 4. Lista progetti ────────────────────────────────────────────────────
  console.log('\n[4] Lista progetti');
  await check('Griglia progetti visibile', async () => {
    await page.waitForSelector('#view-projects:not([hidden])', { timeout: 3000 });
  });
  await check('Almeno una project-card', async () => {
    await page.waitForSelector('.project-card', { visible: true, timeout: 4000 });
  });
  await check('Pulsante "Nuovo Progetto" visibile', async () => {
    await page.waitForSelector('#btn-new-project:not([hidden])', { visible: true });
  });

  // ── 5. Aprire kanban board ───────────────────────────────────────────────
  console.log('\n[5] Apertura kanban board');
  await check('Click su project-card', async () => {
    await page.click('.project-card');
    await page.waitForSelector('#view-kanban:not([hidden])', { timeout: 5000 });
  });
  await check('Colonne kanban renderizzate', async () => {
    await page.waitForSelector('.kanban-column', { visible: true, timeout: 4000 });
  });
  const numCols = await page.$$eval('.kanban-column', els => els.length);
  await check(`Tre colonne di default (trovate: ${numCols})`, async () => {
    if (numCols < 3) throw new Error(`Solo ${numCols} colonne`);
  });
  await check('Task cards presenti', async () => {
    await page.waitForSelector('.task-card', { visible: true, timeout: 3000 });
  });

  // ── 6. Modal nuovo progetto ──────────────────────────────────────────────
  console.log('\n[6] Modal nuovo progetto');
  await check('Torna ai progetti', async () => {
    await page.click('#btn-back');
    await page.waitForSelector('#view-projects:not([hidden])', { timeout: 3000 });
  });
  await check('Apertura modal progetto', async () => {
    await page.click('#btn-new-project');
    await page.waitForSelector('#modal-project:not([hidden])', { visible: true });
  });
  await check('Campo nome progetto presente', async () => {
    await page.waitForSelector('#project-name', { visible: true });
  });
  await check('Color picker presente', async () => {
    await page.waitForSelector('#project-color-picker .color-option', { visible: true });
  });
  await check('Chiusura modal con Esc', async () => {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('modal-project')?.hidden, { timeout: 2000 });
  });

  // ── 7. Errori JS ─────────────────────────────────────────────────────────
  console.log('\n[7] Errori JavaScript');
  if (jsErrors.length === 0) {
    ok('Nessun errore JS rilevato');
  } else {
    jsErrors.forEach(e => fail(`Errore JS: ${e}`));
  }

  // ── Screenshot finale ────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  // Sessione potrebbe essere già attiva oppure no
  const isLoginVisible = await page.$eval('#view-login', el => !el.hidden).catch(() => false);
  if (isLoginVisible) {
    await page.type('#login-password', PW);
    await page.click('#btn-login');
  }
  await page.waitForSelector('.project-card', { visible: true, timeout: 5000 });
  await page.click('.project-card');
  await page.waitForSelector('.kanban-column', { visible: true, timeout: 5000 });
  await page.screenshot({ path: 'test-screenshot.png', fullPage: false });
  console.log('\n📸 Screenshot salvato: test-screenshot.png');

  await browser.close();

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Risultato: ${passed} passati, ${failed} falliti`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('\n💥 Errore critico:', err.message);
  process.exit(1);
});
