import { Box, chakra, type HTMLChakraProps } from "@chakra-ui/react";
import { ChevronDown } from "lucide-react";
import { forwardRef } from "react";
import { inputRecipe, textareaRecipe } from "@/theme";

export const Input = chakra("input", inputRecipe);

export const Textarea = chakra("textarea", textareaRecipe);

const Select = chakra("select", inputRecipe);

export type NativeSelectProps = HTMLChakraProps<"select">;

/** Native <select> styled as `.input`, with a chevron. */
export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  function NativeSelect(props, ref) {
    return (
      <Box position="relative" width="100%">
        <Select ref={ref} pr="30px" cursor="pointer" {...props} />
        <Box
          as={ChevronDown}
          position="absolute"
          right="10px"
          top="50%"
          transform="translateY(-50%)"
          boxSize="14px"
          color="fg.muted"
          pointerEvents="none"
        />
      </Box>
    );
  },
);
