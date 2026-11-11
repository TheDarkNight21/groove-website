"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { track } from "@/lib/analytics/client";
import type { HomeSection } from "@/lib/analytics/events";

// The pre-order button, saying which part of the page it was pressed in.
export function PreorderLink({ from, className, children }: { from: HomeSection; className?: string; children: ReactNode }) {
  return (
    <Link href="/preorder/" className={className} onClick={() => track({ kind: "preorder_clicked", from })}>
      {children}
    </Link>
  );
}
