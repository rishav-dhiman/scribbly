import { twMerge } from "tailwind-merge";

// Join class strings, dropping falsy entries and letting later utilities win
export function cn(...classes: Array<string | false | null | undefined>) {
  return twMerge(classes.filter(Boolean).join(" "));
}
