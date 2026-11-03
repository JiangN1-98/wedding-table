import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Flower2, Grip, Plus } from "lucide-react";
import type { HallLayout, TablePosition, WeddingTable } from "./model";
import { positionKey, tableNumber } from "./model";

export function TableMarker({
  table,
  number,
  selected = false,
  dragging = false,
}: {
  table: WeddingTable;
  number: number;
  selected?: boolean;
  dragging?: boolean;
}) {
  return (
    <div
      className={`table-marker ${selected ? "is-selected" : ""} ${dragging ? "is-moving" : ""}`}
    >
      <Grip size={13} className="marker-grip" aria-hidden="true" />
      <span className="table-number">{String(number).padStart(2, "0")}</span>
      <span className="marker-name">{table.name}</span>
      <span className="marker-count">
        {table.seats.filter(Boolean).length} / 10 人
      </span>
    </div>
  );
}

function MovableTable({
  table,
  number,
  selected,
  onSelect,
}: {
  table: WeddingTable;
  number: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `move-table-${table.id}`,
    data: { type: "move-table", tableId: table.id },
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      aria-label={`移动第${number}桌 ${table.name}`}
      aria-pressed={selected}
      className={`movable-table ${isDragging ? "is-dragging" : ""}`}
    >
      <TableMarker table={table} number={number} selected={selected} />
    </button>
  );
}

function HallSlot({
  position,
  gridColumn,
  table,
  number,
  editing,
  draggingTable,
  selected,
  onSelect,
  onMove,
  children,
}: {
  position: TablePosition;
  gridColumn: number;
  table?: WeddingTable;
  number: number;
  editing: boolean;
  draggingTable: boolean;
  selected: boolean;
  onSelect: () => void;
  onMove: (position: TablePosition) => void;
  children?: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `hall-slot-${positionKey(position)}`,

    data: { type: "hall-slot", position },
  });
  return (
    <div
      ref={setNodeRef}
      data-position={positionKey(position)}
      data-table-id={table?.id}
      className={`hall-slot ${editing || draggingTable ? "is-editable" : ""} ${isOver ? "is-over" : ""} ${table ? "has-table" : ""}`}
      style={{ gridColumn, gridRow: position.row + 2 }}
    >
      {editing ? (
        <>
          <span className="slot-coordinate">
            {position.side === "left" ? "左" : "右"} · {position.row + 1} 行{" "}
            {position.column + 1} 列
          </span>
          {table ? (
            <MovableTable
              table={table}
              number={number}
              selected={selected}
              onSelect={onSelect}
            />
          ) : (
            <button
              className="empty-hall-slot"
              onClick={() => onMove(position)}
              aria-label={`${position.side === "left" ? "左侧" : "右侧"}第${position.row + 1}行第${position.column + 1}列空位`}
            >
              <Plus size={18} strokeWidth={1.3} />
              <span>放置桌子</span>
            </button>
          )}
        </>
      ) : (
        table ? children : draggingTable ? <div className="empty-hall-slot"><Plus size={18} /><span>放置桌子</span></div> : null
      )}
    </div>
  );
}

export function Hall({
  tables,
  layout,
  zoom,
  editing,
  draggingTable,
  selectedTable,
  onSelectTable,
  onMoveTable,
  onAddTable,
  renderTable,
}: {
  tables: WeddingTable[];
  layout: HallLayout;
  zoom: number;
  editing: boolean;
  draggingTable: boolean;
  selectedTable: string | null;
  onSelectTable: (id: string) => void;
  onMoveTable: (position: TablePosition) => void;
  onAddTable: () => void;
  renderTable: (table: WeddingTable, number: number) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1080);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const columns = layout.columnsPerSide;
  const cellWidth = editing ? 148 : 278;
  const surfaceWidth = columns * 2 * cellWidth + columns * 2 * 12 + 88 + 32;
  const scale =
    (Math.min(1, Math.max(editing ? 0.25 : 0.15, (width - 32) / surfaceWidth)) *
      zoom) /
    100;
  const rows =
    Math.max(1, ...layout.positions.map((p) => p.row + 1)) + 1;
  const positions = new Map(
    layout.positions.map((p) => [positionKey(p), p.tableId]),
  );
  const tableMap = new Map(
    tables.map((table, i) => [table.id, { table, number: tableNumber(table, i) }]),
  );
  const slots = Array.from({ length: rows }, (_, row) =>
    (["left", "right"] as const).flatMap((side) =>
      Array.from({ length: columns }, (_, column) => ({ side, row, column })),
    ),
  ).flat();
  return (
    <div ref={ref} className={`hall-layout ${editing ? "is-arranging" : ""}`}>
      <div
        className="hall-surface"
        style={{ width: surfaceWidth, zoom: scale }}
      >
        <div
          className="banquet-plan"
          style={{
            gridTemplateColumns: `repeat(${columns}, ${cellWidth}px) 88px repeat(${columns}, ${cellWidth}px)`,
            gridTemplateRows: `82px repeat(${rows}, ${editing ? 154 : 288}px)`,
          }}
          aria-label={`宴会厅布局：上方舞台，中央过道，两侧各${columns}列圆桌`}
        >
          <div className="banquet-stage" role="img" aria-label="宴会厅前方舞台">
            <Flower2 size={24} strokeWidth={1.2} aria-hidden="true" />
            <div>
              <span className="stage-caption">THE WEDDING STAGE</span>
              <h3>婚礼舞台</h3>
            </div>
            <Flower2 size={24} strokeWidth={1.2} aria-hidden="true" />
          </div>
          <div
            className="banquet-aisle"
            style={{ gridColumn: columns + 1, gridRow: `2 / span ${rows}` }}
            role="img"
            aria-label="中央过道，禁止放置桌子"
          >
            <span className="aisle-direction" aria-hidden="true">
              ↑
            </span>
            <span className="aisle-label">中央过道</span>
            <span className="aisle-direction" aria-hidden="true">
              ↑
            </span>
          </div>
          {slots.map((position) => {
            const id = positions.get(positionKey(position));
            const entry = id ? tableMap.get(id) : undefined;
            return (
              <HallSlot
                key={positionKey(position)}
                position={position}
                gridColumn={
                  position.side === "left"
                    ? columns - position.column
                    : columns + 2 + position.column
                }
                table={entry?.table}
                number={entry?.number ?? 0}
                editing={editing}
                draggingTable={draggingTable}
                selected={!!id && selectedTable === id}
                onSelect={() => {
                  if (id) onSelectTable(id);
                }}
                onMove={onMoveTable}
              >
                {entry ? renderTable(entry.table, entry.number) : null}
              </HallSlot>
            );
          })}
        </div>
        <div className="banquet-entrance">
          <span />
          宾客入口
          <span />
        </div>
        <div className="hall-add-table">
          <button
            onClick={onAddTable}
            className="btn add-table-tile border-dashed! bg-[#f7faf2]! text-[#839674]!"
          >
            <Plus size={14} />
            再添一桌欢喜
            <span className="text-[10px] font-normal text-[#a7b498]">
              每桌 10 人
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
