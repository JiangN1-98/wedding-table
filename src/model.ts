export const CAPACITY = 10;
export const STORAGE_KEY = "wedding-seating:v1";
export const DEFAULT_GROUPS = ["新郎亲友", "新娘亲友", "共同好友", "其他宾客"];
export type Guest = {
  id: string;
  name: string;
  group: string;
  phone: string;
  note: string;
};
export type WeddingTable = {
  id: string;
  name: string;
  seats: (string | null)[];
};
export type TablePosition = {
  side: "left" | "right";
  row: number;
  column: number;
};
export type HallLayout = {
  columnsPerSide: number;
  positions: (TablePosition & { tableId: string })[];
};
export type WeddingState = {
  version: 1;
  title: string;
  date: string;
  venue: string;
  isDemo: boolean;
  guests: Guest[];
  tables: WeddingTable[];
  layout?: HallLayout;
};
export const uid = () => crypto.randomUUID();
export const newTable = (name: string): WeddingTable => ({
  id: uid(),
  name,
  seats: Array(CAPACITY).fill(null),
});

export function createInitialState(): WeddingState {
  return {
    version: 1,
    title: "我们的婚礼",
    date: "",
    venue: "",
    isDemo: false,
    guests: [],
    tables: Array.from({ length: 3 }, (_, i) => newTable(`亲友相聚 ${i + 1}`)),
  };
}

export function isWeddingState(value: unknown): value is WeddingState {
  if (!value || typeof value !== "object") return false;
  const v = value as WeddingState;
  if (
    v.version !== 1 ||
    typeof v.title !== "string" ||
    typeof v.date !== "string" ||
    typeof v.venue !== "string" ||
    typeof v.isDemo !== "boolean" ||
    !Array.isArray(v.guests) ||
    !Array.isArray(v.tables)
  )
    return false;
  const ids = new Set<string>();
  for (const g of v.guests) {
    if (
      !g ||
      !["id", "name", "group", "phone", "note"].every(
        (k) => typeof g[k as keyof Guest] === "string",
      ) ||
      !g.name.trim() ||
      ids.has(g.id)
    )
      return false;
    ids.add(g.id);
  }
  const seated = new Set<string>();
  const tableIds = new Set<string>();
  for (const t of v.tables) {
    if (
      !t ||
      typeof t.id !== "string" ||
      typeof t.name !== "string" ||
      tableIds.has(t.id) ||
      !Array.isArray(t.seats) ||
      t.seats.length !== CAPACITY
    )
      return false;
    tableIds.add(t.id);
    for (const id of t.seats) {
      if (id === null) continue;
      if (typeof id !== "string" || !ids.has(id) || seated.has(id))
        return false;
      seated.add(id);
    }
  }
  if (v.layout !== undefined) {
    if (
      !v.layout ||
      !Number.isInteger(v.layout.columnsPerSide) ||
      v.layout.columnsPerSide < 1 ||
      v.layout.columnsPerSide > 3 ||
      !Array.isArray(v.layout.positions) ||
      v.layout.positions.length !== v.tables.length
    )
      return false;
    const placed = new Set<string>();
    const cells = new Set<string>();
    for (const p of v.layout.positions) {
      if (
        !p ||
        !tableIds.has(p.tableId) ||
        placed.has(p.tableId) ||
        !validTablePosition(p, v.layout.columnsPerSide) ||
        cells.has(positionKey(p))
      )
        return false;
      placed.add(p.tableId);
      cells.add(positionKey(p));
    }
  }
  return true;
}

export const positionKey = (p: TablePosition) =>
  `${p.side}-${p.row}-${p.column}`;
export function validTablePosition(p: TablePosition, columns: number) {
  return (
    (p.side === "left" || p.side === "right") &&
    Number.isSafeInteger(p.row) &&
    p.row >= 0 &&
    Number.isSafeInteger(p.column) &&
    p.column >= 0 &&
    p.column < columns
  );
}

// Old plans have no layout. Assign grid positions without changing tables, guests or seat numbers.
export function getHallLayout(state: WeddingState): HallLayout {
  const columnsPerSide = state.layout?.columnsPerSide ?? 3;
  const ids = new Set(state.tables.map((t) => t.id));
  const occupied = new Set<string>();
  const placements = new Map<string, TablePosition>();
  for (const p of state.layout?.positions ?? []) {
    if (
      !ids.has(p.tableId) ||
      placements.has(p.tableId) ||
      !validTablePosition(p, columnsPerSide) ||
      occupied.has(positionKey(p))
    )
      continue;
    placements.set(p.tableId, { side: p.side, row: p.row, column: p.column });
    occupied.add(positionKey(p));
  }
  for (const table of state.tables) {
    if (placements.has(table.id)) continue;
    const previousSide = state.layout?.positions.find(
      (p) => p.tableId === table.id,
    )?.side;
    let i = 0;
    let p: TablePosition;
    do {
      p = previousSide
        ? {
            side: previousSide,
            row: Math.floor(i / columnsPerSide),
            column: i % columnsPerSide,
          }
        : {
            side: i % (2 * columnsPerSide) < columnsPerSide ? "left" : "right",
            row: Math.floor(i / (2 * columnsPerSide)),
            column: i % columnsPerSide,
          };
      i++;
    } while (occupied.has(positionKey(p)));
    placements.set(table.id, p);
    occupied.add(positionKey(p));
  }
  return {
    columnsPerSide,
    positions: state.tables.map((t) => ({
      tableId: t.id,
      ...placements.get(t.id)!,
    })),
  };
}

export function moveTable(
  state: WeddingState,
  tableId: string,
  target: TablePosition,
): { state: WeddingState; error?: string; swapped?: boolean } {
  const layout = getHallLayout(state);
  const source = layout.positions.find((p) => p.tableId === tableId);
  if (!source) return { state, error: "这张桌子已不存在" };
  if (!validTablePosition(target, layout.columnsPerSide))
    return { state, error: "请把桌子放在过道两侧的行列网格内" };
  if (positionKey(source) === positionKey(target)) return { state };
  const occupant = layout.positions.find(
    (p) => positionKey(p) === positionKey(target),
  );
  const positions = layout.positions.map((p) =>
    p.tableId === tableId
      ? { tableId, side: target.side, row: target.row, column: target.column }
      : p.tableId === occupant?.tableId
        ? {
            tableId: p.tableId,
            side: source.side,
            row: source.row,
            column: source.column,
          }
        : p,
  );
  return {
    state: { ...state, layout: { ...layout, positions } },
    swapped: !!occupant,
  };
}

export function setHallColumns(
  state: WeddingState,
  columnsPerSide: number,
): WeddingState {
  if (
    !Number.isInteger(columnsPerSide) ||
    columnsPerSide < 1 ||
    columnsPerSide > 3
  )
    return state;
  const layout = getHallLayout(state);
  if (layout.columnsPerSide === columnsPerSide) return state;
  const next = { ...state, layout: { ...layout, columnsPerSide } };
  return { ...next, layout: getHallLayout(next) };
}

export function loadWedding(): WeddingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data: unknown = JSON.parse(raw);
      if (isWeddingState(data)) return data;
    }
  } catch {
    /* A blocked or malformed local store should not prevent opening the planner. */
  }
  return createInitialState();
}

export function locateGuest(state: WeddingState, id: string) {
  for (const table of state.tables) {
    const seat = table.seats.indexOf(id);
    if (seat !== -1) return { table, seat };
  }
  return null;
}

export function moveGuest(
  state: WeddingState,
  guestId: string,
  tableId: string | null,
  seatIndex?: number,
): { state: WeddingState; error?: string } {
  if (!state.guests.some((g) => g.id === guestId))
    return { state, error: "这位宾客已不存在" };
  const source = locateGuest(state, guestId);
  if (tableId === null) {
    if (!source) return { state };
    return {
      state: {
        ...state,
        tables: state.tables.map((t) => ({
          ...t,
          seats: t.seats.map((id) => (id === guestId ? null : id)),
        })),
      },
    };
  }
  const target = state.tables.find((t) => t.id === tableId);
  if (!target) return { state, error: "这张桌子已不存在" };
  if (seatIndex === undefined && source?.table.id === tableId) return { state };
  const slot = seatIndex ?? target.seats.indexOf(null);
  if (slot < 0 || slot >= CAPACITY || !Number.isInteger(slot))
    return { state, error: "这桌已满 10 人，请选择其他桌子" };
  const occupant = target.seats[slot];
  if (occupant === guestId) return { state };
  if (occupant && !source)
    return { state, error: "这个座位已有宾客，请选择空位" };
  const tables = state.tables.map((t) => ({ ...t, seats: [...t.seats] }));
  if (source)
    tables.find((t) => t.id === source.table.id)!.seats[source.seat] = occupant;
  tables.find((t) => t.id === tableId)!.seats[slot] = guestId;
  return { state: { ...state, tables } };
}

export function deleteGuest(state: WeddingState, id: string): WeddingState {
  return {
    ...state,
    guests: state.guests.filter((g) => g.id !== id),
    tables: state.tables.map((t) => ({
      ...t,
      seats: t.seats.map((s) => (s === id ? null : s)),
    })),
  };
}
export function groupTone(group: string) {
  const index = DEFAULT_GROUPS.indexOf(group);
  return ["sage", "rose", "lavender", "sand"][index === -1 ? 3 : index];
}

export type ImportedGuest = Guest & { tableNumber?: number };

export function importGuests(state: WeddingState, guests: ImportedGuest[]) {
  const tables = state.tables.map((table) => ({ ...table, seats: [...table.seats] }));
  for (const guest of guests) {
    if (guest.tableNumber !== undefined && (!Number.isInteger(guest.tableNumber) || guest.tableNumber < 1 || guest.tableNumber > 200))
      throw new Error("桌号需要填写 1～200 的整数");
  }
  const maxTable = Math.max(tables.length, ...guests.map((g) => g.tableNumber ?? 0));
  while (tables.length < maxTable) tables.push(newTable(`亲友相聚 ${tables.length + 1}`));
  let seated = 0;
  let overflow = 0;
  for (const guest of guests) {
    if (!guest.tableNumber) continue;
    const table = tables[guest.tableNumber - 1];
    const seat = table.seats.indexOf(null);
    if (seat === -1) { overflow++; continue; }
    table.seats[seat] = guest.id;
    seated++;
  }
  return {
    state: { ...state, tables, guests: [...state.guests, ...guests.map(({ id, name, group, phone, note }) => ({ id, name, group, phone, note }))] },
    seated,
    overflow,
    addedTables: tables.length - state.tables.length,
  };
}
