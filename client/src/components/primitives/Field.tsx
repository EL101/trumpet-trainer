import { Box, Text, type BoxProps } from "@chakra-ui/react";
import { useId, type ReactNode } from "react";

type FieldProps = Omit<BoxProps, "children"> & {
  label: ReactNode;
  helper?: ReactNode;
  /**
   * The control. A render function receives the generated id so a native input can be
   * linked to the label; group controls (segmented, radio) can ignore it — the label is
   * then rendered as a non-label element and the group should get its own aria-label.
   */
  children: ReactNode | ((id: string) => ReactNode);
};

/** `.field` — small muted label above a control. */
export function Field({ label, helper, children, ...rest }: FieldProps) {
  const id = useId();
  const linked = typeof children === "function";
  return (
    <Box {...rest}>
      <Text
        as={linked ? "label" : "div"}
        {...(linked ? { htmlFor: id } : {})}
        display="block"
        fontSize="12px"
        mb="5px"
        color="fg.muted"
      >
        {label}
      </Text>
      {linked ? children(id) : children}
      {helper && (
        <Text fontSize="11px" color="fg.muted" mt="xs">
          {helper}
        </Text>
      )}
    </Box>
  );
}
