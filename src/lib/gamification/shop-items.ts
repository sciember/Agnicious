export type ShopItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  kind: "freeze" | "frame" | "theme";
};

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: "streak_freeze",
    name: "Streak freeze",
    description: "Protect one streak day when life gets in the way.",
    price: 50,
    kind: "freeze",
  },
  {
    id: "frame_gold",
    name: "Gold avatar frame",
    description: "A subtle gold ring on your profile avatar.",
    price: 100,
    kind: "frame",
  },
  {
    id: "theme_ocean",
    name: "Ocean dashboard theme",
    description: "Cool teal accents across cards and highlights.",
    price: 200,
    kind: "theme",
  },
];
