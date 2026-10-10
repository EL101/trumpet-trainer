import {
  createSlotRecipeContext,
  type HTMLChakraProps,
  type RecipeVariantProps,
} from "@chakra-ui/react";
import { cardRecipe } from "@/theme";

const { withProvider, withContext } = createSlotRecipeContext({ recipe: cardRecipe });

type CardRootProps = HTMLChakraProps<"div", RecipeVariantProps<typeof cardRecipe>>;

/**
 * Bordered, unfilled content surface.
 *
 * <Card.Root size="lg">
 *   <Card.Kicker>Up next · 03</Card.Kicker>
 *   <Card.Title>Clarke Study No. 2 in G</Card.Title>
 *   <Card.Meta>G major · ♩ = 96</Card.Meta>
 * </Card.Root>
 */
export const Card = {
  Root: withProvider<HTMLDivElement, CardRootProps>("div", "root"),
  Kicker: withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "kicker"),
  Title: withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "title"),
  Body: withContext<HTMLParagraphElement, HTMLChakraProps<"p">>("p", "body"),
  Meta: withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "meta"),
};
