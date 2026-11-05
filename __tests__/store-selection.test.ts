import { expect, it } from "vitest";
import { resolveSelectedStoreId } from "@/components/store-selection";

it("restores a selected OSM source alias after deduplication", () => {
  expect(resolveSelectedStoreId([{id:"atp:123", sourceAliases:["node/456"]}], "node/456")).toBe("atp:123");
});
it("prioritizes canonical IDs over a different store's alias", () => {
  expect(resolveSelectedStoreId([{id:"a", sourceAliases:["b"]}, {id:"b"}], "b")).toBe("b");
});
it("preserves pending deep links while stores load", () => {
  expect(resolveSelectedStoreId([], "node/456")).toBe("node/456");
  expect(resolveSelectedStoreId([], null)).toBeNull();
});
