"use client";

/**
 * Ads, behind one door.
 *
 * The app runs in two places and they advertise differently: as a web page
 * there is no AdMob, and inside the Capacitor shell on Google Play there is
 * no AdSense. Rather than sprinkle `if (native)` through the screens, every
 * placement calls these two functions and this file decides what that means
 * where it's running.
 *
 * Nothing here loads unless NEXT_PUBLIC_ADS_ENABLED is "1", so development
 * and the web build stay clean and no policy applies to them.
 *
 * The AdMob plugin is resolved at runtime, not imported: a static import
 * would put a native-only module into the web bundle, where it fails to
 * build.
 */

const ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === "1";

/** Matches are short. An ad after every single one is how you lose players. */
const MATCHES_PER_INTERSTITIAL = 3;
/** And never twice inside this window, however fast they replay. */
const MIN_GAP_MS = 90_000;

const COUNT_KEY = "blopy-ad-count";

let lastShown = 0;
let admob: AdMobLike | null = null;
let ready: Promise<void> | null = null;

/** The slice of @capacitor-community/admob this app actually uses. */
interface AdMobLike {
  initialize(options: Record<string, unknown>): Promise<void>;
  showBanner(options: Record<string, unknown>): Promise<void>;
  hideBanner(): Promise<void>;
  prepareInterstitial(options: Record<string, unknown>): Promise<void>;
  showInterstitial(): Promise<void>;
  requestConsentInfo(options?: Record<string, unknown>): Promise<ConsentInfo>;
  showConsentForm(): Promise<ConsentInfo>;
}

interface ConsentInfo {
  status: "REQUIRED" | "NOT_REQUIRED" | "OBTAINED" | "UNKNOWN";
  isConsentFormAvailable?: boolean;
}

let consent: ConsentInfo | null = null;

function isNative() {
  if (typeof window === "undefined") return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

function unitId(kind: "banner" | "interstitial") {
  const env =
    kind === "banner"
      ? process.env.NEXT_PUBLIC_ADMOB_BANNER_ID
      : process.env.NEXT_PUBLIC_ADMOB_INTERSTITIAL_ID;
  // Google's own always-fill test units. Shipping with a real ID but no fill
  // looks identical to a bug, so the fallback is the one that always shows.
  const test = kind === "banner" ? "ca-app-pub-3940256099942544/6300978111" : "ca-app-pub-3940256099942544/1033173712";
  return env || test;
}

/**
 * Google's consent flow (UMP), required before any personalised or
 * non-personalised ad shows to a user in the EEA, the UK or Switzerland — and
 * Spain is one of those. `requestConsentInfo` itself decides, from the
 * device's location, whether a form is even needed; outside that region it
 * comes back NOT_REQUIRED immediately and nothing is shown.
 *
 * This runs before `initialize()`, not after: initialising the SDK first and
 * asking for consent second is the mistake that gets an app rejected, because
 * it means ad requests could theoretically fire before consent is settled.
 */
async function ensureConsent(sdk: AdMobLike) {
  try {
    consent = await sdk.requestConsentInfo();
    if (consent.status === "REQUIRED" && consent.isConsentFormAvailable) {
      consent = await sdk.showConsentForm();
    }
  } catch {
    // No network, or the form failed to load. Leave `consent` as whatever it
    // last was — `canServeAds()` below treats unknown as "don't show".
  }
}

/** Whether current consent state allows a request to be made at all. */
function canServeAds() {
  return consent?.status === "OBTAINED" || consent?.status === "NOT_REQUIRED";
}

async function load() {
  if (!ENABLED || !isNative() || admob) return;
  if (!ready) {
    ready = (async () => {
      try {
        // Built from a variable so the web bundle never tries to resolve a
        // plugin that only exists inside the native shell — a literal
        // specifier fails the build wherever the plugin isn't installed.
        const specifier = "@capacitor-community/" + "admob";
        const mod = (await import(/* webpackIgnore: true */ specifier)) as { AdMob: AdMobLike };
        const sdk = mod.AdMob;
        await ensureConsent(sdk);
        await sdk.initialize({ initializeForTesting: process.env.NEXT_PUBLIC_ADS_TEST === "1" });
        admob = sdk;
      } catch {
        // Plugin missing (web build, or a shell built without it). Silence is
        // right here: the game must keep working with no ads at all.
        admob = null;
      }
    })();
  }
  await ready;
}

/** A banner along the bottom. Only ever on the hub, never over a game. */
export async function showBanner() {
  await load();
  if (!admob || !canServeAds()) return;
  try {
    await admob.showBanner({
      adId: unitId("banner"),
      position: "BOTTOM_CENTER",
      margin: 0,
      isTesting: process.env.NEXT_PUBLIC_ADS_TEST === "1",
    });
  } catch {
    // No fill, no network, no consent — all fine, just no banner.
  }
}

export async function hideBanner() {
  if (!admob) return;
  try {
    await admob.hideBanner();
  } catch {
    // Already hidden.
  }
}

/**
 * A full-screen ad between matches. Rate-limited on two axes so it can never
 * become the thing you remember about the app; resolves either way, so the
 * caller can always just carry on.
 */
export async function showInterstitial() {
  await load();
  if (!admob || !canServeAds()) return;

  const now = Date.now();
  if (now - lastShown < MIN_GAP_MS) return;

  let count = 0;
  try {
    count = Number(window.localStorage.getItem(COUNT_KEY) ?? "0") + 1;
    window.localStorage.setItem(COUNT_KEY, String(count));
  } catch {
    return;
  }
  if (count % MATCHES_PER_INTERSTITIAL !== 0) return;

  try {
    await admob.prepareInterstitial({
      adId: unitId("interstitial"),
      isTesting: process.env.NEXT_PUBLIC_ADS_TEST === "1",
    });
    await admob.showInterstitial();
    lastShown = Date.now();
  } catch {
    // Same as the banner: never block play on an ad failing.
  }
}

/** Is there any chance of an ad here? Used to reserve banner space. */
export function adsActive() {
  return ENABLED && isNative();
}
