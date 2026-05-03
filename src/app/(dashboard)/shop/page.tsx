import { redirect } from "next/navigation";

/** Shop UI paused — see `FEATURE_SHOP_AND_BADGES` in `src/lib/feature-gamification.ts`. */
export default function ShopPage() {
  redirect("/");
}
