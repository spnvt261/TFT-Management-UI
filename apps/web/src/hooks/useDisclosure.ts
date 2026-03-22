import { useState } from "react";

export const useDisclosure = (defaultOpen = false) => {
  const [open, setOpen] = useState(defaultOpen);

  return {
    open,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
    setOpen
  };
};
