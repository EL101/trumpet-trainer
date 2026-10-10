import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { globalCss } from "./globalCss";
import { keyframes } from "./keyframes";
import { semanticTokens, tokens } from "./tokens";
import { textStyles } from "./textStyles";

const config = defineConfig({
  globalCss,
  theme: {
    tokens,
    semanticTokens,
    textStyles,
    keyframes,
  },
});

/** Chakra's defaults (so legacy pages keep working) overlaid with the Classical design system. */
export const system = createSystem(defaultConfig, config);

export { roles } from "./roles";
export { buttonRecipe } from "./recipes/button";
export { tagRecipe } from "./recipes/tag";
export { cardRecipe } from "./recipes/card";
export { inputRecipe, textareaRecipe } from "./recipes/input";
export { segmentedRecipe, radioRecipe } from "./recipes/choice";
export { bookplateRecipe } from "./recipes/bookplate";
