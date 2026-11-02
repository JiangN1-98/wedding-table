import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  deleteGuest,
  isWeddingState,
  locateGuest,
  moveGuest,
  newTable,
  getHallLayout,
  moveTable,
  setHallColumns,
  positionKey,
} from "../src/model.ts";

import { createDemo } from "./fixtures.ts";

test("initial plan has no guests and three empty tables", () => {
  const state = createInitialState();
  assert.deepEqual(state.guests, []);
  assert.equal(state.tables.length, 3);
  assert.ok(state.tables.every((table) => table.seats.length === 10 && table.seats.every((seat) => seat === null)));
  assert.equal(state.isDemo, false);
  assert.ok(isWeddingState(state));
});

test("demo has 48 unique guests, 30 seated and ten seats per table", () => {
  const state = createDemo();
  assert.equal(state.guests.length, 48);
  assert.equal(state.tables.flatMap((t) => t.seats).filter(Boolean).length, 30);
  assert.ok(state.tables.every((t) => t.seats.length === 10));
  assert.ok(isWeddingState(state));
});

test("legacy plans acquire three columns per side without changing tables or guests", () => {
  const state = createDemo();
  const layout = getHallLayout(state);
  assert.equal(layout.columnsPerSide, 3);
  assert.deepEqual(
    layout.positions.map((p) => [p.side, p.row, p.column]),
    [
      ["left", 0, 0],
      ["left", 0, 1],
      ["left", 0, 2],
      ["right", 0, 0],
      ["right", 0, 1],
      ["right", 0, 2],
    ],
  );
  assert.ok(isWeddingState({ ...state, layout }));
  assert.equal(state.layout, undefined);
});

test("moving a table snaps to a valid empty grid cell and preserves its number and occupants", () => {
  const state = createDemo();
  const target = { side: "right" as const, row: 2, column: 1 };
  const result = moveTable(state, state.tables[0].id, target);
  assert.deepEqual(result.state.layout?.positions[0], {
    tableId: state.tables[0].id,
    ...target,
  });
  assert.equal(result.state.tables, state.tables);
  assert.equal(result.state.guests, state.guests);
  assert.ok(isWeddingState(result.state));
  assert.equal(
    moveTable(result.state, state.tables[0].id, target).state,
    result.state,
  );
});

test("occupied target cells swap table positions, preserving all guest seating", () => {
  const state = createDemo();
  const layout = getHallLayout(state);
  const result = moveTable(state, state.tables[0].id, layout.positions[5]);
  assert.equal(result.swapped, true);
  assert.equal(
    positionKey(result.state.layout!.positions[0]),
    positionKey(layout.positions[5]),
  );
  assert.equal(
    positionKey(result.state.layout!.positions[5]),
    positionKey(layout.positions[0]),
  );
  assert.equal(result.state.tables, state.tables);
  assert.ok(isWeddingState(result.state));
});

test("invalid rows, columns and aisle/stage positions cannot change a table layout", () => {
  const state = createDemo();
  for (const target of [
    { side: "left", row: -1, column: 0 },
    { side: "right", row: 1.5, column: 0 },
    { side: "left", row: 0, column: 3 },
    { side: "aisle", row: 0, column: 0 },
    { side: "stage", row: 0, column: 0 },
  ]) {
    const result = moveTable(
      state,
      state.tables[0].id,
      target as Parameters<typeof moveTable>[2],
    );
    assert.ok(result.error);
    assert.equal(result.state, state);
  }
  assert.ok(
    moveTable(state, "missing-table", { side: "left", row: 0, column: 0 })
      .error,
  );
});

test("reducing columns preserves each side, assigns non-overlapping cells and retains valid positions", () => {
  const state = createDemo();
  const moved = moveTable(state, state.tables[0].id, {
    side: "right",
    row: 3,
    column: 0,
  }).state;
  const narrow = setHallColumns(moved, 1);
  assert.equal(narrow.layout?.columnsPerSide, 1);
  assert.deepEqual(narrow.layout?.positions[0], {
    tableId: state.tables[0].id,
    side: "right",
    row: 3,
    column: 0,
  });
  assert.ok(narrow.layout?.positions.every((p) => p.column === 0));
  assert.equal(new Set(narrow.layout!.positions.map(positionKey)).size, 6);
  assert.equal(narrow.tables, state.tables);
  assert.ok(isWeddingState(narrow));
  assert.equal(setHallColumns(narrow, 4), narrow);
});

test("adding and removing tables preserves existing positions and cleans up removed IDs", () => {
  const state = moveTable(createDemo(), "not-found", {
    side: "left",
    row: 0,
    column: 0,
  }).state;
  const layout = getHallLayout(state);
  const added = {
    ...state,
    layout,
    tables: [...state.tables, newTable("新增桌子")],
  };
  const nextLayout = getHallLayout(added);
  assert.deepEqual(nextLayout.positions.slice(0, 6), layout.positions);
  assert.equal(nextLayout.positions[6].row, 1);
  const removed = {
    ...added,
    layout: nextLayout,
    tables: added.tables.slice(1),
  };
  const cleaned = getHallLayout(removed);
  assert.equal(cleaned.positions.length, 6);
  assert.ok(!cleaned.positions.some((p) => p.tableId === state.tables[0].id));
  assert.ok(isWeddingState({ ...removed, layout: cleaned }));
});

test("persisted layouts reject duplicate cells, invalid columns and unknown table IDs", () => {
  const state = createDemo();
  state.layout = getHallLayout(state);
  const duplicate = structuredClone(state);
  duplicate.layout!.positions[1] = {
    ...duplicate.layout!.positions[0],
    tableId: duplicate.tables[1].id,
  };
  assert.equal(isWeddingState(duplicate), false);
  const invalid = structuredClone(state);
  invalid.layout!.positions[0].column = 3;
  assert.equal(isWeddingState(invalid), false);
  const orphan = structuredClone(state);
  orphan.layout!.positions[0].tableId = "missing";
  assert.equal(isWeddingState(orphan), false);
  assert.equal(
    isWeddingState({
      ...state,
      layout: { ...state.layout, columnsPerSide: 4 },
    }),
    false,
  );
});

test("placing and moving a guest preserves uniqueness and does not mutate the previous plan", () => {
  const original = createDemo();
  const id = original.guests[30].id;
  const first = moveGuest(original, id, original.tables[0].id, 9).state;
  assert.equal(locateGuest(first, id)?.seat, 9);
  assert.equal(locateGuest(original, id), null);
  const second = moveGuest(first, id, first.tables[1].id).state;
  assert.equal(locateGuest(second, id)?.table.id, second.tables[1].id);
  assert.equal(second.tables[0].seats[9], null);
  assert.ok(isWeddingState(second));
});

test("full tables reject an additional guest and allow seated guests to swap", () => {
  let state = createDemo();
  state = moveGuest(state, state.guests[30].id, state.tables[0].id).state;
  state = moveGuest(state, state.guests[31].id, state.tables[0].id).state;
  const rejected = moveGuest(state, state.guests[32].id, state.tables[0].id);
  assert.ok(rejected.error?.includes("已满"));
  assert.equal(rejected.state, state);
  const source = state.tables[1].seats[0]!;
  const target = state.tables[0].seats[0]!;
  const swapped = moveGuest(state, source, state.tables[0].id, 0).state;
  assert.equal(swapped.tables[0].seats[0], source);
  assert.equal(swapped.tables[1].seats[0], target);
  assert.ok(isWeddingState(swapped));
});

test("a pending guest cannot displace an occupant, and moving to the same table is a no-op", () => {
  const state = createDemo();
  assert.ok(moveGuest(state, state.guests[30].id, state.tables[0].id, 0).error);
  assert.equal(
    moveGuest(state, state.guests[0].id, state.tables[0].id).state,
    state,
  );
  assert.ok(
    moveGuest(state, state.guests[30].id, state.tables[0].id, 10).error,
  );
});

test("unassign, guest deletion and table deletion release seats without losing other guests", () => {
  const state = createDemo();
  const id = state.guests[0].id;
  const unassigned = moveGuest(state, id, null).state;
  assert.equal(locateGuest(unassigned, id), null);
  assert.equal(unassigned.guests.length, 48);
  const deleted = deleteGuest(state, id);
  assert.equal(deleted.guests.length, 47);
  assert.equal(locateGuest(deleted, id), null);
  const removedTable = { ...state, tables: state.tables.slice(1) };
  assert.equal(removedTable.guests.length, 48);
  assert.equal(locateGuest(removedTable, id), null);
  assert.ok(isWeddingState(removedTable));
});

test("saved plan validation rejects duplicate occupancy, duplicate IDs and orphaned seats", () => {
  const state = createDemo();
  const duplicate = structuredClone(state);
  duplicate.tables[1].seats[0] = duplicate.tables[0].seats[0];
  assert.equal(isWeddingState(duplicate), false);
  const orphan = structuredClone(state);
  orphan.tables[0].seats[0] = "missing-guest";
  assert.equal(isWeddingState(orphan), false);
  assert.equal(
    isWeddingState({ ...state, guests: [...state.guests, state.guests[0]] }),
    false,
  );
  assert.equal(
    isWeddingState({ ...state, tables: [...state.tables, state.tables[0]] }),
    false,
  );
  assert.deepEqual(newTable("亲友相聚").seats, Array(10).fill(null));
});
