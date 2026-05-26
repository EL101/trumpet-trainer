import { Dialog, Button, Portal } from "@chakra-ui/react";
import { useState } from "react";
import { LuTrash2 } from "react-icons/lu";

export default function ClearHistory({ onClear }: { onClear: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        color="gray.500"
        _hover={{ color: "red.500" }}
        height="auto"
        minW="0"
        width="auto"
        p="5px"
        onClick={() => setOpen(true)}
      >
        <LuTrash2 style={{ width: 15, height: 15 }} />
        Clear
      </Button>

      <Dialog.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content py={3} px={4} mt={2}>
              <Dialog.Header>
                <Dialog.Title>Clear History</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                This will remove all generated exercises from your history.
              </Dialog.Body>
              <Dialog.Footer mt={2}>
                <Button variant="outline" onClick={() => setOpen(false)} px={4} height="auto" py={2}>
                  Cancel
                </Button>
                <Button
                  bg="red.500"
                  color="white"
                  onClick={() => {
                    onClear();
                    setOpen(false);
                  }}
                  px={4} height="auto" py={2}
                  fontWeight="bold"
                >
                  Clear
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}