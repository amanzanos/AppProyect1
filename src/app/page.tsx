import { redirect } from "next/navigation";

// The hub is the app. Keeping the games under /games matches the URLs the
// controller QR codes are built from, so the root just forwards.
export default function Home() {
  redirect("/games");
}
