"use client";

import { SearchX, TriangleAlert } from "lucide-react";
import type { ScoredStore } from "@/lib/types";
import { StoreCard } from "@/components/store-card";

interface Props {
  stores: ScoredStore[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex gap-3.5">
        <div className="size-14 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-[13px] text-muted-foreground">{body}</p>
    </div>
  );
}

export function StoreList({ stores, loading, error, selectedId, onSelect }: Props) {
  if (loading) {
    return (
      <div className="space-y-2.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState
        icon={<TriangleAlert className="size-5" />}
        title="Couldn’t load stores"
        body="Something went wrong reaching the data sources. Try again in a moment."
      />
    );
  }
  if (stores.length === 0) {
    return (
      <EmptyState
        icon={<SearchX className="size-5" />}
        title="No Goodwill stores in range"
        body="Widen your radius, lower the minimum score, or search a different location."
      />
    );
  }

  return (
    <ul className="space-y-2.5">
      {stores.map((s, i) => (
        <li
          key={s.id}
          className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both"
          style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
        >
          <StoreCard store={s} rank={i + 1} selected={s.id === selectedId} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}
