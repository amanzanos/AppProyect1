import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The Play Store build is a thin shell around the deployed site.
 *
 * A static export would let the app work offline, but every game here needs
 * Firestore to talk between the screen and the phones anyway — offline it
 * cannot function. Pointing the shell at the live URL buys the thing that
 * does matter: fixing a quiz answer or a physics bug ships in a deploy
 * instead of a store review that takes days.
 */
const config: CapacitorConfig = {
  appId: "com.amanzanos.pique",
  appName: "Pique",
  webDir: "public",
  server: {
    url: process.env.PIQUE_URL || "https://pique.vercel.app",
    cleartext: false,
  },
  android: {
    backgroundColor: "#1b1040",
  },
};

export default config;
