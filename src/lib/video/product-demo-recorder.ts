import puppeteer, { type Page } from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";
import { VIEWPORTS } from "@/lib/screenshots/capture";

const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ||
  "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar";

export interface ProductDemoAccess {
  demoUrl: string;
  demoEmail?: string;
  demoPassword?: string;
}

export interface CapturedProductDemoFrame {
  intent: "invoice" | "supplier" | "inventory";
  overlayText: string;
  buffer: Buffer;
  width: number;
  height: number;
  cursor?: { x: number; y: number };
}

export interface ProductDemoAccessVerification {
  ok: boolean;
  finalUrl: string;
  title: string;
  hasPasswordField: boolean;
  message: string;
}

const FEATURE_FLOWS: Array<{
  intent: CapturedProductDemoFrame["intent"];
  overlayText: string;
  keywords: string[];
}> = [
  {
    intent: "invoice",
    overlayText: "Upload an invoice and review extracted line items",
    keywords: ["invoice", "חשבונית", "upload", "scan", "סריקת"],
  },
  {
    intent: "supplier",
    overlayText: "Catch supplier price increases before they hurt margin",
    keywords: ["supplier", "ספק", "price", "התייקרות", "מחיר"],
  },
  {
    intent: "inventory",
    overlayText: "Turn low inventory into the next supplier order",
    keywords: ["inventory", "מלאי", "stock", "whatsapp", "order", "הזמנה"],
  },
];

export async function verifyProductDemoAccess(
  access: ProductDemoAccess
): Promise<ProductDemoAccessVerification> {
  if (!access.demoUrl) {
    return {
      ok: false,
      finalUrl: "",
      title: "",
      hasPasswordField: false,
      message: "Demo/login URL is required.",
    };
  }

  let browser: Awaited<ReturnType<typeof launchRecorderBrowser>> | null = null;
  try {
    browser = await launchRecorderBrowser();
    const page = await browser.newPage();
    await page.goto(access.demoUrl, { waitUntil: "networkidle2", timeout: 25_000 });
    await loginIfNeeded(page, access);
    const hasPasswordField = Boolean(await page.$('input[type="password"]'));
    const finalUrl = page.url();
    const title = await page.title().catch(() => "");
    const pageText = await getVisibleText(page);

    if (looksLikeExternalAuthWall(finalUrl, pageText)) {
      return {
        ok: false,
        finalUrl,
        title,
        hasPasswordField,
        message:
          "This link reaches Google login / external OAuth. MarketPilot cannot use a private Google account password. Use a true magic/demo link that opens the app directly, invite a dedicated capture account, or use screenshots/browser recording.",
      };
    }

    if (hasPasswordField || /login|signin|sign-in|auth|התחברות|כניסה/i.test(finalUrl)) {
      return {
        ok: false,
        finalUrl,
        title,
        hasPasswordField,
        message: access.demoEmail || access.demoPassword
          ? "MarketPilot still sees a login screen after submitting the credentials."
          : "This link still reaches a login screen. For invite/magic-link access, the URL must open the app without asking for a password.",
      };
    }

    const accessibleApp = looksLikeAccessibleApp(finalUrl, pageText);
    return {
      ok: accessibleApp,
      finalUrl,
      title,
      hasPasswordField,
      message: accessibleApp
        ? access.demoEmail || access.demoPassword
          ? "Demo login works. MarketPilot can access the app."
          : "Invite/magic link works. MarketPilot can access the app without email/password."
        : "The URL opened, but it looks like a public landing/marketing page rather than an authenticated app screen. Use a link that lands inside the product dashboard or demo workspace.",
    };
  } catch (err) {
    return {
      ok: false,
      finalUrl: access.demoUrl,
      title: "",
      hasPasswordField: false,
      message: err instanceof Error ? err.message : "Could not open or verify the demo app.",
    };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export async function captureProductDemoFlows(
  access: ProductDemoAccess
): Promise<CapturedProductDemoFrame[]> {
  if (!access.demoUrl) return [];

  const spec = VIEWPORTS.desktop;
  const browser = await launchRecorderBrowser();

  try {
    const page = await browser.newPage();
    await page.goto(access.demoUrl, { waitUntil: "networkidle2", timeout: 25_000 });
    await loginIfNeeded(page, access);

    const frames: CapturedProductDemoFrame[] = [];
    for (const flow of FEATURE_FLOWS) {
      await navigateToFeature(page, flow.keywords);
      const cursor = cursorForIntent(flow.intent);
      await page.mouse.move(cursor.x - 180, cursor.y - 120, { steps: 8 });
      await page.mouse.move(cursor.x, cursor.y, { steps: 18 });
      await page.mouse.click(cursor.x, cursor.y).catch(() => undefined);
      await settle(page);
      const screenshot = await page.screenshot({ type: "png", fullPage: false });
      frames.push({
        intent: flow.intent,
        overlayText: flow.overlayText,
        buffer: Buffer.from(screenshot),
        width: spec.width * (spec.deviceScaleFactor ?? 2),
        height: spec.height * (spec.deviceScaleFactor ?? 2),
        cursor,
      });
    }

    return frames;
  } finally {
    await browser.close();
  }
}

async function launchRecorderBrowser() {
  const spec = VIEWPORTS.desktop;
  const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: {
      width: spec.width,
      height: spec.height,
      deviceScaleFactor: spec.deviceScaleFactor ?? 2,
    },
    executablePath,
    headless: true,
  });
}

async function getVisibleText(page: Page): Promise<string> {
  return page
    .evaluate(() => document.body?.innerText || "")
    .catch(() => "");
}

function looksLikeExternalAuthWall(finalUrl: string, pageText: string): boolean {
  return (
    /accounts\.google\.com|oauth|openid|sso/i.test(finalUrl) ||
    /sign in with google|continue with google|המשך עם google|כניסה עם google/i.test(pageText)
  );
}

function looksLikePublicLandingPage(finalUrl: string, pageText: string): boolean {
  const url = new URL(finalUrl);
  const rootPath = url.pathname === "/" || url.pathname === "";
  const landingSignals = [
    /pricing|מחירים/i,
    /faq|שאלות נפוצות/i,
    /start free|free trial|התחל.*חינם|ניסיון.*חינם/i,
    /no credit card|ללא כרטיס אשראי/i,
  ];
  return rootPath && landingSignals.filter((pattern) => pattern.test(pageText)).length >= 2;
}

function looksLikeAccessibleApp(finalUrl: string, pageText: string): boolean {
  if (looksLikeExternalAuthWall(finalUrl, pageText)) return false;
  if (looksLikePublicLandingPage(finalUrl, pageText)) return false;

  const appPath = /dashboard|app|admin|workspace|restaurant|inventory|invoices|orders/i.test(
    finalUrl
  );
  const appTextSignals = [
    /dashboard|workspace|inventory|supplier|invoice|approve|upload invoice/i,
    /דשבורד|מלאי|ספקים|חשבוניות|אישור|העלאת חשבונית/i,
  ];
  return appPath || appTextSignals.some((pattern) => pattern.test(pageText));
}

async function loginIfNeeded(page: Page, access: ProductDemoAccess) {
  if (!access.demoEmail || !access.demoPassword) return;

  const hasPasswordField = await page.$('input[type="password"]');
  const hasEmailField = await page.$('input[type="email"], input[name*="email" i], input[autocomplete="email"]');

  if (!hasPasswordField && !hasEmailField) return;

  const emailSelector = 'input[type="email"], input[name*="email" i], input[autocomplete="email"], input[type="text"]';
  await page.click(emailSelector).catch(() => undefined);
  await page.keyboard.down(process.platform === "darwin" ? "Meta" : "Control");
  await page.keyboard.press("KeyA");
  await page.keyboard.up(process.platform === "darwin" ? "Meta" : "Control");
  await page.keyboard.type(access.demoEmail, { delay: 10 });

  await page.click('input[type="password"]');
  await page.keyboard.type(access.demoPassword, { delay: 10 });

  const submitted = await clickSubmitButton(page);

  if (!submitted) await page.keyboard.press("Enter");
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 12_000 }).catch(() => undefined);
  await settle(page);
}

async function navigateToFeature(page: Page, keywords: string[]) {
  const candidates = await page.$$("a, button, [role=button], nav a, aside a");
  for (const el of candidates) {
    const text = ((await el.evaluate((node) => node.textContent || "")) || "").toLowerCase();
    if (keywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
      await el.click().catch(() => undefined);
      await settle(page);
      return;
    }
  }

  // Fallback: keep the current dashboard/screen but scroll to vary the shot.
  await page.evaluate((terms) => {
    const lowerTerms = (terms as string[]).map((t) => t.toLowerCase());
    const all = Array.from(document.querySelectorAll("h1,h2,h3,p,span,div"));
    const match = all.find((el) =>
      lowerTerms.some((term) => (el.textContent || "").toLowerCase().includes(term))
    );
    match?.scrollIntoView({ behavior: "instant", block: "center" });
  }, keywords);
  await settle(page);
}

async function clickSubmitButton(page: Page): Promise<boolean> {
  const clicked = await page.evaluate(() => {
    const labels = ["login", "sign in", "התחבר", "כניסה", "כניסה למערכת"];
    const buttons = Array.from(document.querySelectorAll("button, input[type=submit]"));
    const target = buttons.find((button) => {
      const text = `${button.textContent || ""} ${(button as HTMLInputElement).value || ""}`.toLowerCase();
      return (
        (button as HTMLButtonElement).type === "submit" ||
        labels.some((label) => text.includes(label.toLowerCase()))
      );
    }) as HTMLElement | undefined;
    target?.click();
    return Boolean(target);
  });
  return Boolean(clicked);
}

async function settle(page: Page) {
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 5_000 }).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 800));
}

function cursorForIntent(intent: CapturedProductDemoFrame["intent"]) {
  switch (intent) {
    case "invoice":
      return { x: 720, y: 360 };
    case "supplier":
      return { x: 880, y: 430 };
    case "inventory":
    default:
      return { x: 640, y: 520 };
  }
}
