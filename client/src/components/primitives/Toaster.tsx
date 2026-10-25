import {
  Flex,
  Toaster as ChakraToaster,
  Portal,
  Toast,
  createSlotRecipeContext,
  type HTMLChakraProps,
} from "@chakra-ui/react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { forwardRef } from "react";
import { Link as RouterLink } from "react-router-dom";
import { toastRecipe } from "@/theme";
import { Button } from "./Button";
import { toaster, type NoticeLink } from "./notify";

const { withProvider, withContext } = createSlotRecipeContext({ recipe: toastRecipe });

// Chakra's toast parts bring the behaviour (timers, pausing on hover, the live
// region); their own look is switched off so the recipe's applies instead.
const UnstyledRoot = forwardRef<HTMLDivElement, Toast.RootProps>(function UnstyledRoot(props, ref) {
  return <Toast.Root ref={ref} unstyled {...props} />;
});

const Root = withProvider<HTMLDivElement, Toast.RootProps>(UnstyledRoot, "root");
const Indicator = withContext<HTMLSpanElement, HTMLChakraProps<"span">>("span", "indicator");
const Title = withContext<HTMLDivElement, Toast.TitleProps>(Toast.Title, "title");
const Description = withContext<HTMLDivElement, Toast.DescriptionProps>(
  Toast.Description,
  "description",
);
const Action = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "action");
const CloseTrigger = withContext<HTMLButtonElement, Toast.CloseTriggerProps>(
  Toast.CloseTrigger,
  "closeTrigger",
);

/**
 * Where notices from `notify()` appear, in the bottom-right corner. Mount it once,
 * inside the router, so a notice's link can navigate.
 */
export function Toaster() {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "md" }}>
        {(toast) => {
          const Icon =
            toast.type === "success" ? CircleCheck : toast.type === "error" ? CircleAlert : Info;
          const link = (toast.meta as { link?: NoticeLink } | undefined)?.link;
          return (
            <Root>
              <Indicator aria-hidden>
                <Icon />
              </Indicator>
              <Flex direction="column" flex="1" minWidth={0}>
                {toast.title && <Title>{toast.title}</Title>}
                {toast.description && <Description>{toast.description}</Description>}
                {link && (
                  <Action>
                    <Button asChild size="sm">
                      <RouterLink to={link.to} onClick={() => toaster.dismiss(toast.id)}>
                        {link.label}
                      </RouterLink>
                    </Button>
                  </Action>
                )}
              </Flex>
              <CloseTrigger aria-label="Dismiss">
                <X />
              </CloseTrigger>
            </Root>
          );
        }}
      </ChakraToaster>
    </Portal>
  );
}
