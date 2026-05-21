"use client";

import type { ScoredStore } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreRing } from "@/components/score-ring";
import { ScoreBreakdown } from "@/components/score-breakdown";

interface Props {
  store: ScoredStore;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function StoreCard({ store, selected, onSelect }: Props) {
  return (
    <Card
      onClick={() => onSelect(store.id)}
      className={`cursor-pointer transition-colors ${selected ? "ring-2 ring-primary" : ""}`}
    >
      <CardContent className="flex gap-3 p-4">
        <ScoreRing score={store.score.total} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-semibold">{store.name}</h3>
            <Badge variant="secondary">{store.distanceMiles.toFixed(1)} mi</Badge>
          </div>
          {store.address && <p className="truncate text-xs text-muted-foreground">{store.address}</p>}
          <div className="mt-3">
            <ScoreBreakdown score={store.score} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
