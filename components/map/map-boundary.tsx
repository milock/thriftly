"use client";

import { Component, type ReactNode } from "react";
import { useTranslations } from "next-intl";

class Boundary extends Component<{children: ReactNode; fallback: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Map rendering is optional. Errors here must never unmount the list or search. */
export function MapBoundary({children}: {children: ReactNode}) {
  const t = useTranslations("directory");
  return <Boundary fallback={<div role="status" className="flex h-full items-center justify-center bg-muted p-6 text-center text-sm">{t("mapUnavailable")}</div>}>{children}</Boundary>;
}
