import { chakra, type HTMLChakraProps, type RecipeVariantProps } from "@chakra-ui/react";
import { forwardRef } from "react";
import { buttonRecipe } from "@/theme";

/** Outlined action. `variant`: primary (accent) · secondary (hairline) · ghost (text-only). */
export const Button = chakra("button", buttonRecipe, { defaultProps: { type: "button" } });

export type ButtonProps = HTMLChakraProps<"button", RecipeVariantProps<typeof buttonRecipe>>;

export type IconButtonProps = Omit<ButtonProps, "iconOnly"> & { "aria-label": string };

/** Square icon-only button; `aria-label` is required. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(props, ref) {
    return <Button ref={ref} iconOnly {...props} />;
  },
);
