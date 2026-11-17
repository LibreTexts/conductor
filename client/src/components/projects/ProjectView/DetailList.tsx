import type { ReactNode } from "react";
import { Text } from "@libretexts/davis-react";

/** Two-column label/value list used by the sidebar cards. */
export const DetailList = ({ children }: { children: ReactNode }) => (
  <dl className="m-0 grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-3">{children}</dl>
);

export const DetailRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <Text as="dt" size="sm" color="muted">
      {label}
    </Text>
    <Text as="dd" size="sm" className="m-0 break-words">
      {children}
    </Text>
  </>
);
