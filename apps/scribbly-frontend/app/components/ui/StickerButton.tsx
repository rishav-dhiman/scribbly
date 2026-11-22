"use client";

import type { ComponentProps } from "react";
import { Button } from "@repo/ui";

// The signature violet sticker button: thick solid offset shadow that lifts
// on hover and presses flat on click. The styles live in @repo/ui so every app
// shares one source of truth; this wrapper just pins the creative defaults.
export function StickerButton(props: ComponentProps<typeof Button>) {
  return <Button variant="solid" size="md" {...props} />;
}
