import {
  createSlotRecipeContext,
  type HTMLChakraProps,
  type RecipeVariantProps,
} from "@chakra-ui/react";
import { forwardRef } from "react";
import { bookplateRecipe } from "@/theme";

const { withProvider, withContext } = createSlotRecipeContext({ recipe: bookplateRecipe });

const Root = withProvider<
  HTMLDivElement,
  HTMLChakraProps<"div", RecipeVariantProps<typeof bookplateRecipe>>
>("div", "root");
const Inner = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "inner");

type BookplateProps = HTMLChakraProps<"div"> & { size?: "md" | "lg" };

/**
 * Double-ruled accent frame (sign-in panel, profile practice record). Style props apply
 * to the inner panel, which holds the content.
 */
export const Bookplate = forwardRef<HTMLDivElement, BookplateProps>(function Bookplate(
  { size, children, ...rest },
  ref,
) {
  return (
    <Root ref={ref} size={size}>
      <Inner {...rest}>{children}</Inner>
    </Root>
  );
});
