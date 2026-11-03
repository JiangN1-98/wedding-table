import { useEffect, useId, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Check, Flower2, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { CAPACITY, groupTone } from "./model";
import type { Guest, WeddingTable } from "./model";

export function Avatar({
  guest,
  small = false,
}: {
  guest: Guest;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar tone-${groupTone(guest.group)} ${small ? "h-7 w-7 rounded-md text-xs" : "h-9 w-9 rounded-[10px] text-sm"}`}
    >
      {guest.name.slice(0, 1)}
    </span>
  );
}

export function GuestRow({
  guest,
  selected,
  location,
  onSelect,
  onEdit,
  onDelete,
  disabled = false,
}: {
  guest: Guest;
  selected: boolean;
  location?: string;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `roster-${guest.id}`,
    disabled,
    data: { guestId: guest.id },
  });
  return (
    <div
      className={`group flex items-center gap-1 rounded-lg border transition-colors ${selected ? "border-[#c4d3b8] bg-sage-50" : "border-transparent hover:bg-[#f6f8f3]"} ${isDragging ? "opacity-30" : ""}`}
    >
      <button
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={onSelect}
        aria-label={`${guest.name}，${guest.group}，${location || "待安排"}，点击选择或拖动排座`}
        className="guest-row flex min-w-0 flex-1 cursor-grab items-center gap-2.5 py-2.5 pl-1 text-left active:cursor-grabbing"
      >
        <GripVertical size={13} className="text-[#c7cdbe]" />
        <Avatar guest={guest} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-[#50584a]">
            {guest.name}
          </span>
          <span className="mt-0.5 block truncate text-[10px] text-[#929a88]">
            {guest.group}
            {guest.note ? ` · ${guest.note}` : ""}
          </span>
        </span>
        {location ? (
          <span className="mr-1 whitespace-nowrap rounded bg-[#eef3e7] px-1.5 py-1 text-[9px] text-sage-500">
            {location}
          </span>
        ) : selected ? (
          <Check size={14} className="text-sage-600" />
        ) : null}
      </button>
      <button
        onClick={onEdit}
        className="icon-btn h-6! w-6! shrink-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100"
        aria-label={`编辑${guest.name}`}
      >
        <Pencil size={12} />
      </button>
      <button
        onClick={onDelete}
        className="icon-btn mr-1 h-6! w-6! shrink-0 opacity-0 hover:bg-red-50! hover:text-red-600! group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100"
        aria-label={`删除${guest.name}`}
        title={`删除${guest.name}`}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

const seatPositions = Array.from({ length: CAPACITY }, (_, i) => {
  const angle = ((-90 + i * 36) * Math.PI) / 180;
  return {
    left: `${139 + Math.cos(angle) * 106}px`,
    top: `${126 + Math.sin(angle) * 107}px`,
  };
});

function Seat({
  table,
  index,
  guest,
  canSelect,
  onClick,
}: {
  table: WeddingTable;
  index: number;
  guest?: Guest;
  canSelect: boolean;
  onClick: () => void;
}) {
  const drop = useDroppable({
    id: `drop-${table.id}-${index}`,
    data: { type: "seat", tableId: table.id, seatIndex: index },
  });
  const drag = useDraggable({
    id: `seated-${table.id}-${index}`,
    disabled: !guest,
    data: { guestId: guest?.id },
  });
  return (
    <button
      ref={(node) => {
        drop.setNodeRef(node);
        drag.setNodeRef(node);
      }}
      {...(guest ? drag.listeners : {})}
      {...(guest ? drag.attributes : {})}
      onClick={onClick}
      className={`seat ${guest ? `occupied tone-${groupTone(guest.group)}` : canSelect ? "available" : ""} ${drop.isOver ? "is-over" : ""} ${drag.isDragging ? "is-dragging" : ""}`}
      style={seatPositions[index] as CSSProperties}
      aria-label={`${table.name}，${index + 1}号座位，${guest?.name ?? "空位"}`}
      title={
        guest
          ? `${guest.name} · ${guest.group}${guest.note ? ` · ${guest.note}` : ""}`
          : `${index + 1}号空位：选择宾客后点击，或拖动宾客到这里`
      }
    >
      {guest ? (
        <span className="max-w-full truncate px-1.5">{guest.name}</span>
      ) : (
        <>
          <Plus size={11} />
          <span className="ml-1">{index + 1}</span>
        </>
      )}
    </button>
  );
}

export function RoundTable({
  table,
  number,
  guestMap,
  selectedGuest,
  onSeatClick,
  onTableClick,
  onEdit,
}: {
  table: WeddingTable;
  number: number;
  guestMap: Map<string, Guest>;
  selectedGuest: string | null;
  onSeatClick: (index: number, guest?: Guest) => void;
  onTableClick: () => void;
  onEdit: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `table-${table.id}`,
    data: { type: "table", tableId: table.id },
  });
  const drag = useDraggable({
    id: `move-round-table-${table.id}`,
    data: { type: "move-table", tableId: table.id },
  });
  const count = table.seats.filter(Boolean).length;
  return (
    <div className="table-unit group flex flex-col items-center">
      <div className="table-stage">
        <button
          ref={(node) => { setNodeRef(node); drag.setNodeRef(node); }}
          {...drag.attributes}
          {...drag.listeners}
          title="拖动调整桌位，点击编辑桌号和名称"
          className={`table-disc ${isOver ? "is-over" : ""} ${drag.isDragging ? "opacity-30" : ""}`}
          onClick={onTableClick}
          aria-label={`第${number}桌 ${table.name}，${count}人，共10个座位`}
        >
          <Flower2 className="table-flower" strokeWidth={1} />
          <span className="mb-1 text-[8px] tracking-[2.5px] text-[#9eaa90]">
            TABLE
          </span>
          <span className="table-number">
            {String(number).padStart(2, "0")}
          </span>
          <span className="mt-1.5 max-w-[108px] truncate text-[11px] font-medium text-[#68785a]">
            {table.name}
          </span>
          <span className="mt-1.5 text-[9px] text-[#98a48c]">
            <span className={count === 10 ? "text-sage-600" : "text-[#798d67]"}>
              {count}
            </span>{" "}
            / 10 人
          </span>
        </button>
        {table.seats.map((id, index) => (
          <Seat
            key={index}
            table={table}
            index={index}
            guest={id ? guestMap.get(id) : undefined}
            canSelect={!!selectedGuest}
            onClick={() =>
              onSeatClick(index, id ? guestMap.get(id) : undefined)
            }
          />
        ))}
      </div>
      <div className="-mt-0.5 mb-4 flex h-6 items-center gap-2 text-[10px] text-[#98a18d]">
        <span
          className={`h-1.5 w-1.5 rounded-full ${count === 10 ? "bg-sage-500" : count === 0 ? "bg-[#c6cebd]" : "bg-[#a9b898]"}`}
        />
        {count === 10
          ? "已坐满"
          : count === 0
            ? "等待美好的相聚"
            : `还可安排 ${10 - count} 位宾客`}
        <button
          aria-label={`管理第${number}桌`}
          onClick={onEdit}
          className="icon-btn h-5! w-5!"
        >
          <Pencil size={11} />
        </button>
      </div>
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const id = useId();
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = ref.current;
    dialog
      ?.querySelector<HTMLElement>("input, button, select, textarea, a[href]")
      ?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === "Tab" && dialog) {
        const elements = [
          ...dialog.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select, textarea, a[href], [tabindex="0"]',
          ),
        ].filter((el) => el.offsetParent !== null);
        const first = elements[0],
          last = elements[elements.length - 1];
        if (!first) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[#263123]/30 p-4 backdrop-blur-[3px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`modal-card max-h-[90svh] w-full overflow-y-auto rounded-2xl border border-[#e3e8dd] bg-[#fdfefb] p-6 shadow-2xl ${wide ? "max-w-[660px]" : "max-w-[460px]"}`}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id={id} className="text-lg font-semibold text-[#3b4832]">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-2 text-xs leading-5 text-[#8c9681]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            className="icon-btn -mr-1 -mt-1"
            onClick={onClose}
            aria-label="关闭弹窗"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
