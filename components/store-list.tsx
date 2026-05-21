"use client";

import type { ScoredStore } from "@/lib/types";
import { StoreCard } from "@/components/store-card";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  stores: ScoredStore[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function StoreList({ stores, loading, error, selectedId, onSelect }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (error) return <p className="p-4 text-sm text-destructive">{error}</p>;
  if (stores.length === 0)
    return <p className="p-4 text-sm text-muted-foreground">No Goodwill stores found here. Try a wider radius or a different location.</p>;

  return (
    <div className="space-y-3">
      {stores.map((s) => (
        <StoreCard key={s.id} store={s} selected={s.id === selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}
