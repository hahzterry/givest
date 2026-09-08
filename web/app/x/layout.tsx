import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Send from X | Givest",
  description:
    "Paste a post from X. Givest reads the handle, the dollars, and the stock, and opens a gift locked to that account.",
};

export default function XLayout({ children }: { children: ReactNode }) {
  return children;
}
