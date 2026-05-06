import type { UndercutCheckGroup } from "@eve/shared/tradecraft-pricing";

export type GroupingMode = "perOrder" | "perCharacter" | "global";

export type GroupToRender = {
  group: UndercutCheckGroup;
  updates: UndercutCheckGroup["updates"];
};
