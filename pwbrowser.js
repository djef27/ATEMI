const { chromium } = require('C:/Users/DJOGBENOU Jean/AppData/Local/Temp/opencode/pw/node_modules/playwright');

const argv = process.argv;
const get = (name) => {
  const i = argv.indexOf('--' + name);
  return i !== -1 ? argv[i + 1] : undefined;
};

const action = get('action') || 'open';
const url = get('url');
const target = get('target');
const text = get('text');
const screenshotPath = get('screenshot') || 'screen.png';
const waitTime = parseInt(get('wait') || '3000', 10);
const navTimeout = parseInt(get('navtimeout') || '30000', 10);
const headless = get('headless') === 'true';
const fullPage = get('fullpage') === 'true';
const dump = get('dump') === 'true';
const manual = get('manual') === 'true';
const manualTimeout = parseInt(get('manualtimeout') || '120', 10) * 1000;

const CHROME_PATH = 'C:/Users/DJOGBENOU Jean/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';

let lastBlock = null;

async function checkBlock(page) {
  const u = page.url();
  if (/(sorry|recaptcha|captcha|\/cf_chl|hcaptcha|challenges\.cloudflare|unusual traffic|are you a human)/i.test(u)) {
    return { blocked: true, reason: 'URL: ' + u };
  }
  const dom = await page.evaluate(() => {
    const t = (document.body ? document.body.innerText : '').toLowerCase();
    const frames = Array.from(document.querySelectorAll('iframe')).map((f) => f.src || '');
    return { t, frames };
  }).catch(() => ({ t: '', frames: [] }));
  const kws = [
    'unusual traffic from your computer network',
    'verify you are human',
    "verify you're human",
    'are you a robot',
    'you are a robot',
    'attention required',
    'enable javascript and cookies',
    'press and hold',
    'humans only',
    'trafic inhabituel',
    'vérification de sécurité',
    'anti-bot',
    'access denied',
    'checking your browser',
    'just a moment',
    'cf-connecting-ip'
  ];
  for (const k of kws) {
    if (dom.t.includes(k)) return { blocked: true, reason: 'TEXTE: "' + k + '"', url: u };
  }
  const fi = dom.frames.find((f) => /(recaptcha|hcaptcha|cf-chl|challenges\.cloudflare)/i.test(f));
  if (fi) return { blocked: true, reason: 'IFRAME: ' + fi.slice(0, 80), url: u };
  return { blocked: false };
}

async function handleBlock(page) {
  const b = lastBlock;
  const blockShot = screenshotPath.replace(/.png$/i, '_BLOCAGE.png');
  try { await page.screenshot({ path: blockShot }); } catch (e) {}
  console.log('!!! BLOCK_DETECTED reason=' + b.reason);
  console.log('!!! BLOCK_DETECTED url=' + b.url);
  console.log('!!! BLOCK_DETECTED screenshot=' + blockShot);
  if (!manual) {
    console.log('!!! MODE=REPORT (lancez avec --manual true pour laisser intervenir un humain)');
    return;
  }
  console.log('!!! ACTION_REQUISE: Un blocage est detecte. RESOLVEZ-LE DANS LA FENETRE DU NAVIGATEUR OUVERTE.');
  console.log('!!! ATTENTE du déblocage manuel (max ' + (manualTimeout / 1000) + 's)...');
  const start = Date.now();
  while (Date.now() - start < manualTimeout) {
    await page.waitForTimeout(2000);
    const c = await checkBlock(page);
    if (!c.blocked) {
      console.log('!!! MANUAL_OK: blocage leve, on continue.');
      return;
    }
    lastBlock = c;
  }
  console.log('!!! MANUAL_TIMEOUT: pas de déblocage dans le temps imparti.');
}

(async () => {
  const effHeadless = headless || false;
  if (manual && effHeadless) {
    console.log('!!! WARNING: mode manuel force fenetre visible (headless=false).');
  }
  const browser = await chromium.launch({
    headless: manual ? false : effHeadless,
    executablePath: CHROME_PATH
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  if (url) {
    await page.goto(url, { timeout: navTimeout }).catch((e) => console.log('WARN goto: ' + e.message.split('\n')[0]));
    lastBlock = await checkBlock(page);
    if (lastBlock.blocked) await handleBlock(page);
  }

  switch (action) {
    case 'open':
      await page.waitForTimeout(waitTime);
      break;

    case 'click':
      await page.locator(target).first().click().catch((e) => console.log('WARN click: ' + e.message.split('\n')[0]));
      await page.waitForTimeout(waitTime);
      break;

    case 'type':
      await page.locator(target).first().fill(text).catch((e) => console.log('WARN fill: ' + e.message.split('\n')[0]));
      await page.waitForTimeout(waitTime);
      break;

    case 'search':
      await page.locator(target).first().fill(text).catch((e) => console.log('WARN fill: ' + e.message.split('\n')[0]));
      await page.waitForTimeout(800);
      await page.locator(target).first().press('Enter').catch((e) => console.log('WARN enter: ' + e.message.split('\n')[0]));
      await page.waitForTimeout(waitTime);
      break;

    case 'submitform':
      await page.evaluate(() => {
        const f = document.querySelector('form[action*="search"]') || document.querySelector('#sb_form') || document.querySelector('form');
        if (f) f.submit();
      });
      await page.waitForTimeout(waitTime);
      break;

    case 'typesubmit':
      await page.locator(target).first().fill(text).catch((e) => console.log('WARN fill: ' + e.message.split('\n')[0]));
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        const f = document.querySelector('form[action*="search"]') || document.querySelector('#sb_form') || document.querySelector('form');
        if (f) f.submit();
      });
      await page.waitForTimeout(waitTime);
      break;

    case 'screenshot':
      await page.waitForTimeout(waitTime);
      break;

    default:
      await page.waitForTimeout(waitTime);
      break;
  }

  lastBlock = await checkBlock(page);
  if (lastBlock.blocked) await handleBlock(page);

  await page.screenshot({ path: screenshotPath, fullPage }).catch(() => {});
  if (dump || get('info') === 'true') {
    const data = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      text: document.body ? document.body.innerText.slice(0, 6000) : '',
      buttons: Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]')).map((el) => ({
        tag: el.tagName,
        type: el.type || '',
        text: (el.innerText || el.value || el.textContent || '').trim().slice(0, 80),
        selector: el.id ? '#' + el.id : (el.name ? '[name="' + el.name + '"]' : '')
      })).slice(0, 50),
      links: Array.from(document.querySelectorAll('a[href]')).map((el) => ({
        text: (el.innerText || '').trim().slice(0, 60),
        href: el.href
      })).slice(0, 40),
      inputs: Array.from(document.querySelectorAll('input, textarea, select')).map((el) => ({
        type: el.type || el.tagName,
        name: el.name || '',
        id: el.id || '',
        placeholder: el.placeholder || ''
      })).slice(0, 40)
    }));
    console.log('=== PAGE_INFO ===');
    console.log(JSON.stringify(data, null, 2));
  }
  console.log('DONE url=' + page.url());
  process.exit(0);
})();