import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { CollisionDetection, DragEndEvent, Modifier } from "@dnd-kit/core";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  CircleUserRound,
  Download,
  Flower2,
  Heart,
  LayoutGrid,
  Leaf,
  List,
  MapPin,
  Maximize,
  Minimize,
  Minus,
  Move,
  MousePointer2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  Upload,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";
import { Avatar, GuestRow, Modal, RoundTable } from "./components";
import { Hall, TableMarker } from "./Hall";
import {
  GuestDialog,
  ImportDialog,
  SettingsDialog,
  TableDialog,
} from "./dialogs";
import {
  CAPACITY,
  DEFAULT_GROUPS,
  STORAGE_KEY,
  deleteGuest,
  importGuests,
  groupTone,
  loadWedding,
  locateGuest,
  moveGuest,
  newTable,
  tableNumber,
  nextTableNumber,
  updateTable,
  getHallLayout,
  moveTable,
  setHallColumns,
} from "./model";
import type { TablePosition, WeddingState } from "./model";
import { exportSeating } from "./excel";

type Dialog =
  | { type: "guest"; id?: string }
  | { type: "import" | "settings" | "help" }
  | { type: "table"; id: string }
  | {
      type: "confirm";
      action: "clear" | "delete-table" | "delete-guest";
      id?: string;
    };
type Filter = "pending" | "all" | "seated";
const positionGuestBesidePointer: Modifier = ({
  activatorEvent,
  activeNodeRect,
  overlayNodeRect,
  transform,
}) => {
  if (!(activatorEvent instanceof MouseEvent) || !activeNodeRect) {
    return transform;
  }
  return {
    ...transform,
    x: transform.x + activatorEvent.clientX - activeNodeRect.left + 12,
    y:
      transform.y +
      activatorEvent.clientY -
      activeNodeRect.top -
      (overlayNodeRect?.height ?? 0) / 2,
  };
};
const guestDragModifiers = [positionGuestBesidePointer];
const detectCollision: CollisionDetection = (args) => {
  if (args.active.data.current?.type === "move-table") {
    const tableArgs = {
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => c.data.current?.type === "hall-slot",
      ),
    };
    return args.pointerCoordinates
      ? pointerWithin(tableArgs)
      : rectIntersection(tableArgs);
  }
  args = { ...args, droppableContainers: args.droppableContainers.filter((c) => c.data.current?.type !== "hall-slot") };
  const hits = pointerWithin(args);
  const collisions = hits.length ? hits : rectIntersection(args);
  return [...collisions].sort((a, b) => {
    const priority = (id: typeof a.id) =>
      args.droppableContainers.find((container) => container.id === id)?.data
        .current?.type === "seat"
        ? 0
        : 1;
    return priority(a.id) - priority(b.id);
  });
};
function Roster({
  children,
  dragging,
}: {
  children: ReactNode;
  dragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "pending-roster",
    data: { type: "unassign" },
  });
  return (
    <aside
      ref={setNodeRef}
      className={`roster flex w-[290px] shrink-0 flex-col border-r border-[#e7ebdf] bg-white max-lg:w-[260px] max-md:w-full max-md:border-r-0 max-md:border-b ${isOver && dragging ? "bg-sage-50! ring-2 ring-inset ring-[#b5c9a0]" : ""}`}
    >
      {children}
    </aside>
  );
}

function App() {
  const [history, setHistory] = useState(() => ({
    present: loadWedding(),
    past: [] as WeddingState[],
  }));
  const state = history.present;
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [selectedGuest, setSelectedGuest] = useState<string | null>(null);
  const [activeGuest, setActiveGuest] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [editingLayout, setEditingLayout] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [zoom, setZoom] = useState(100);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"canvas" | "list">("canvas");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor),
  );
  const guestMap = useMemo(
    () => new Map(state.guests.map((g) => [g.id, g])),
    [state.guests],
  );
  const hallLayout = useMemo(() => getHallLayout(state), [state]);
  const locations = useMemo(() => {
    const map = new Map<
      string,
      { tableId: string; tableNumber: number; seat: number }
    >();
    state.tables.forEach((table, tableIndex) =>
      table.seats.forEach((id, seat) => {
        if (id)
          map.set(id, { tableId: table.id, tableNumber: tableNumber(table, tableIndex), seat });
      }),
    );
    return map;
  }, [state.tables]);
  const groups = useMemo(
    () => [
      ...new Set([...DEFAULT_GROUPS, ...state.guests.map((g) => g.group)]),
    ],
    [state.guests],
  );
  const filteredGuests = useMemo(
    () =>
      state.guests.filter((g) => {
        const seated = locations.has(g.id);
        return (
          (filter === "all" || (filter === "pending" ? !seated : seated)) &&
          (group === "all" || group === g.group) &&
          `${g.name} ${g.phone} ${g.note}`
            .toLowerCase()
            .includes(query.trim().toLowerCase())
        );
      }),
    [state.guests, locations, filter, group, query],
  );
  const seatedCount = locations.size;
  const pendingCount = state.guests.length - seatedCount;
  const selected = selectedGuest ? guestMap.get(selectedGuest) : undefined;
  const inspectedTable =
    dialog?.type === "table"
      ? state.tables.find((t) => t.id === dialog.id)
      : undefined;
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3800);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !dialog) {
        setSelectedGuest(null);
        setSelectedTable(null);
        if (!activeGuest && !activeTable) setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dialog, activeGuest, activeTable]);
  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || view !== "canvas") return;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (!event.deltaY) return;
      setZoom((previous) =>
        Math.min(200, Math.max(60, previous + (event.deltaY < 0 ? 10 : -10))),
      );
    };
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [view]);
  function notify(text: string, error = false) {
    setToast({ text, error });
  }
  function save(next: WeddingState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
      notify("本地保存失败，请导出座位表备份", true);
    }
  }
  function commit(next: WeddingState) {
    if (next === state) return;
    next = { ...next, layout: getHallLayout(next) };
    save(next);
    setHistory((previous) => ({
      present: next,
      past: [...previous.past.slice(-29), previous.present],
    }));
  }
  function undo() {
    const previous = history.past.at(-1);
    if (!previous) return;
    save(previous);
    setHistory({ present: previous, past: history.past.slice(0, -1) });
    setSelectedGuest(null);
    setSelectedTable(null);
    notify("已撤销上一步操作");
  }
  function assign(id: string, tableId: string | null, seatIndex?: number) {
    const result = moveGuest(state, id, tableId, seatIndex);
    if (result.error) {
      notify(result.error, true);
      return;
    }
    if (result.state === state) return;
    const name = guestMap.get(id)?.name;
    const old = locateGuest(state, id);
    const occupant =
      tableId && seatIndex !== undefined
        ? state.tables.find((t) => t.id === tableId)?.seats[seatIndex]
        : null;
    commit(result.state);
    setSelectedGuest(null);
    if (!tableId) notify(`${name} 已移回待安排名单`);
    else if (occupant && old)
      notify(`${name} 与 ${guestMap.get(occupant)?.name} 已交换座位`);
    else notify(`已为 ${name} 安排座位`);
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveGuest(null);
    setActiveTable(null);
    if (e.active.data.current?.type === "move-table") {
      const target = e.over?.data.current;
      if (target?.type === "hall-slot")
        placeTable(
          e.active.data.current.tableId,
          target.position as TablePosition,
        );
      else notify("请拖到过道两侧的网格中，舞台和过道不允许放桌子", true);
      return;
    }
    const id = e.active.data.current?.guestId as string | undefined;
    const target = e.over?.data.current;
    if (!id || !target) return;
    if (target.type === "unassign") {
      assign(id, null);
      setFilter("pending");
    } else
      assign(
        id,
        target.tableId as string,
        target.seatIndex as number | undefined,
      );
  }
  function placeTable(id: string, position: TablePosition) {
    const result = moveTable(state, id, position);
    if (result.error) {
      notify(result.error, true);
      return;
    }
    if (result.state !== state) {
      commit(result.state);
      notify(
        result.swapped
          ? "已交换两张桌子的位置，桌内宾客保持不变"
          : `桌子已对齐到${position.side === "left" ? "左侧" : "右侧"}第 ${position.row + 1} 行第 ${position.column + 1} 列`,
      );
    }
    setSelectedTable(null);
  }
  function toggleLayout() {
    setEditingLayout(!editingLayout);
    setSelectedGuest(null);
    setSelectedTable(null);
    setView("canvas");
  }
  function addTable() {
    const n = nextTableNumber(state.tables);
    if (n > 200) { notify("最多支持 200 张桌子", true); return; }
    commit({ ...state, tables: [...state.tables.map((table, i) => ({ ...table, number: tableNumber(table, i) })), { ...newTable(`亲友相聚 ${n}`), number: n }] });
    notify(`已添加第 ${n} 桌`);
  }
  function confirmAction() {
    if (dialog?.type !== "confirm") return;
    if (dialog.action === "clear") {
      commit({
        ...state,
        isDemo: false,
        title: state.isDemo ? "我们的婚礼" : state.title,
        date: state.isDemo ? "" : state.date,
        venue: state.isDemo ? "" : state.venue,
        guests: [],
        layout: undefined,
        tables: Array.from({ length: 3 }, (_, i) =>
          ({ ...newTable(`亲友相聚 ${i + 1}`), number: i + 1 }),
        ),
      });
      setQuery("");
      setGroup("all");
      setFilter("pending");
      setSelectedGuest(null);
      setSelectedTable(null);
      notify("已清空，可导入你的宾客名单");
    } else if (dialog.action === "delete-table") {
      commit({
        ...state,
        tables: state.tables.filter((t) => t.id !== dialog.id),
      });
      notify("已删除桌子，本桌宾客已回到待安排名单");
    } else if (dialog.id) {
      commit(deleteGuest(state, dialog.id));
      if (selectedGuest === dialog.id) setSelectedGuest(null);
      notify("已删除宾客");
    }
    setDialog(null);
  }
  async function handleExport() {
    setExporting(true);
    try {
      await exportSeating(state);
      notify("座位表已导出");
    } catch {
      notify("导出失败，请重试", true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detectCollision}
      onDragStart={(e) => {
        setActiveGuest(e.active.data.current?.guestId ?? null);
        setActiveTable(
          e.active.data.current?.type === "move-table"
            ? e.active.data.current.tableId
            : null,
        );
      }}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveGuest(null);
        setActiveTable(null);
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "按空格开始移动，使用方向键调整，再按空格放下，按 Escape 取消。排座模式也可点击宾客后点击座位；调整桌位模式可点击桌子后点击目标空格或另一张桌子。",
        },
      }}
    >
      <header hidden={isFullscreen} className="flex h-[76px] items-center justify-between border-b border-[#e5e9df] bg-[#fdfefb] px-8 max-md:h-16 max-md:px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9efdf] text-sage-600">
            <Flower2 size={25} strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-[21px] font-semibold tracking-[3px] text-[#4b5b40]">
              喜席
              <span className="ml-2.5 text-[10px] font-normal tracking-[2px] text-[#9da88e] max-sm:hidden">
                X I X I
              </span>
            </div>
            <div className="mt-0.5 text-[9px] tracking-[1.5px] text-[#a1a992]">
              每一席，都是心意
            </div>
          </div>
        </div>
        <button
          className="flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-[#617154] hover:bg-sage-50 max-sm:max-w-[180px]"
          onClick={() => setDialog({ type: "settings" })}
        >
          <Heart size={14} className="text-[#b39884]" strokeWidth={1.6} />
          <span className="truncate">{state.title}</span>
          <ChevronDown size={13} className="text-[#9aa58b]" />
        </button>
        <div className="flex items-center gap-3 max-sm:gap-1">
          <button
            onClick={() => setDialog({ type: "help" })}
            className="icon-btn"
            aria-label="使用帮助"
          >
            <CircleHelp size={18} />
          </button>
          <span className="h-5 w-px bg-[#e7ebdf] max-sm:hidden" />
          <button
            onClick={() => setDialog({ type: "settings" })}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e1e8d8] bg-[#f0f4e9] text-[#80946d]"
            aria-label="婚礼设置"
          >
            <Leaf size={16} strokeWidth={1.5} />
          </button>
        </div>
      </header>
      <main className={`mx-auto max-w-[1600px] px-8 pb-6 pt-7 max-lg:px-5 max-md:px-4 ${isFullscreen ? "fullscreen-page" : ""}`}>
        <section className="intro mb-6 flex items-end justify-between gap-4 max-md:flex-col max-md:items-start">
          <div>
            <div className="mb-2.5 flex items-center gap-2 text-[10px] font-medium tracking-[2px] text-[#9aa98b]">
              <Leaf size={12} />A SEAT FOR EVERY LOVE
            </div>
            <h1 className="text-[27px] font-semibold tracking-[1px] text-[#3c4d31] max-sm:text-[23px]">
              把重要的人，安排在心里。
            </h1>
            <p className="mt-2 text-xs text-[#949e88]">
              轻松安排每一席，让美好的相聚从这里开始。
            </p>
          </div>
          <div className="mb-0.5 flex items-center gap-2">
            <button
              className="btn"
              onClick={() => setDialog({ type: "import" })}
            >
              <Upload size={14} />
              导入宾客
            </button>
            <button
              className="btn btn-primary"
              disabled={exporting}
              onClick={() => void handleExport()}
            >
              <Download size={14} />
              {exporting ? "正在导出…" : "导出座位表"}
              <ArrowUpRight size={13} className="ml-1 text-white/60" />
            </button>
          </div>
        </section>
        <section
          aria-label="排座进度"
          className="intro mb-6 grid grid-cols-4 rounded-xl border border-[#e3e8dc] bg-[#fdfefb] py-4 max-sm:grid-cols-2 max-sm:gap-y-5"
        >
          {[
            {
              icon: UsersRound,
              label: "宾客总人数",
              value: state.guests.length,
              unit: "位",
              text: "每一位，都值得用心",
              color: "bg-[#edf2e6] text-[#899d74]",
            },
            {
              icon: CheckCheck,
              label: "已安排座位",
              value: seatedCount,
              unit: "位",
              text: "美好相聚，已有归属",
              color: "bg-[#eef3e8] text-[#8d9e7b]",
            },
            {
              icon: CircleUserRound,
              label: "待安排宾客",
              value: pendingCount,
              unit: "位",
              text: pendingCount
                ? "期待找到合适的位置"
                : "所有宾客都已安排妥当",
              color: "bg-[#f6efe0] text-[#b2a078]",
            },
            {
              icon: Table2,
              label: "婚礼桌数",
              value: state.tables.length,
              unit: "桌",
              text: `每桌 10 人 · 共 ${state.tables.length * CAPACITY} 个座位`,
              color: "bg-[#efeef5] text-[#a195b5]",
            },
          ].map((m, i) => (
            <div
              key={m.label}
              className={`flex items-center gap-3.5 px-6 max-lg:px-4 max-sm:px-4 ${i ? "border-l border-[#e9eddf] max-sm:odd:border-l-0" : ""}`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl max-lg:h-9 max-lg:w-9 ${m.color}`}
              >
                <m.icon size={21} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[11px] text-[#8e9b81]">{m.label}</p>
                <p className="mt-1 text-[27px] font-semibold leading-8 tracking-tight text-[#4f6142]">
                  {m.value}
                  <span className="ml-2 text-[11px] font-normal text-[#a0ab92]">
                    {m.unit}
                  </span>
                </p>
                <p className="mt-1 text-[9px] text-[#acb39f] max-lg:hidden">
                  {m.text}
                </p>
              </div>
            </div>
          ))}
        </section>
        <section className={`workspace flex min-h-[700px] overflow-hidden rounded-xl border border-[#e1e7d9] bg-white shadow-[0_4px_20px_#4c634504] max-md:flex-col ${isFullscreen ? "is-fullscreen" : ""}`}>
          <Roster dragging={!!activeGuest}>
            <div className="border-b border-[#e9eddf] px-5 pb-4 pt-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#526345]">
                  <UsersRound size={16} strokeWidth={1.6} />
                  宾客名单
                  <span className="ml-1 rounded bg-[#f0f3ea] px-1.5 py-0.5 text-[10px] font-normal text-[#94a384]">
                    {state.guests.length}
                  </span>
                </h2>
                <button
                  className="icon-btn h-7! w-7! border border-[#e4eadc]"
                  onClick={() => setDialog({ type: "guest" })}
                  aria-label="添加宾客"
                >
                  <Plus size={15} />
                </button>
              </div>
              <div className="relative mb-3">
                <Search
                  size={14}
                  className="absolute left-3 top-3 text-[#a9b09d]"
                />
                <input
                  aria-label="搜索宾客"
                  className="field bg-[#fafbf8]! py-2.5! pl-9! text-[11px]!"
                  placeholder="搜索姓名、手机号或备注"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query ? (
                  <button
                    className="icon-btn absolute right-1 top-1 h-7! w-7!"
                    onClick={() => setQuery("")}
                    aria-label="清除搜索"
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </div>
              <div className="flex rounded-lg bg-[#f3f5ef] p-1 text-[10px]">
                {(
                  [
                    { id: "pending", label: "待安排", count: pendingCount },
                    { id: "seated", label: "已安排", count: seatedCount },
                    { id: "all", label: "全部", count: state.guests.length },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    aria-pressed={filter === f.id}
                    className={`flex-1 rounded-md px-1 py-2 transition-colors ${filter === f.id ? "bg-white font-medium text-[#657a52] shadow-[0_1px_4px_#576b3810]" : "text-[#9ba58e] hover:text-sage-600"}`}
                  >
                    {f.label}
                    <span
                      className={`ml-1.5 ${filter === f.id ? "text-[#8da378]" : "text-[#aeb7a2]"}`}
                    >
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <div className="flex items-center gap-1.5 text-[10px] text-[#a3ac96]">
                <MousePointer2 size={11} />
                拖动宾客到桌子或座位
              </div>
              <select
                aria-label="按分组筛选宾客"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="max-w-24 cursor-pointer border-0 bg-transparent py-1 text-[10px] text-[#839372] outline-none"
              >
                <option value="all">全部分组</option>
                {groups.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="max-h-[485px] min-h-48 flex-1 overflow-y-auto px-3 pb-3 max-md:max-h-64">
              {filteredGuests.length ? (
                filteredGuests.map((g) => {
                  const location = locations.get(g.id);
                  return (
                    <GuestRow
                      key={g.id}
                      disabled={editingLayout}
                      guest={g}
                      selected={selectedGuest === g.id}
                      location={
                        location ? `${location.tableNumber} 桌` : undefined
                      }
                      onSelect={() => {
                        if (editingLayout)
                          notify("点击「完成桌位调整」后即可为宾客排座");
                        else
                          setSelectedGuest(
                            selectedGuest === g.id ? null : g.id,
                          );
                      }}
                      onEdit={() => setDialog({ type: "guest", id: g.id })}
                      onDelete={() =>
                        setDialog({
                          type: "confirm",
                          action: "delete-guest",
                          id: g.id,
                        })
                      }
                    />
                  );
                })
              ) : (
                <div className="flex flex-col items-center px-3 py-10 text-center">
                  <div className="mb-3 rounded-full bg-[#f3f6ed] p-3">
                    <UsersRound
                      size={23}
                      strokeWidth={1.4}
                      className="text-[#bdc9ad]"
                    />
                  </div>
                  <p className="text-xs text-[#8c9b7d]">
                    {query || group !== "all"
                      ? "没有找到匹配的宾客"
                      : !state.guests.length
                        ? "邀请重要的人入席"
                        : filter === "pending"
                          ? "每一位宾客都有位置啦"
                          : "还没有宾客入座"}
                  </p>
                  <p className="mt-2 text-[10px] leading-5 text-[#b0bba1]">
                    {!state.guests.length
                      ? "导入 Excel 名单，或手动添加宾客"
                      : query || group !== "all"
                        ? "试试其他关键词或分组"
                        : filter === "pending"
                          ? "愿这场相聚满是欢喜"
                          : "从待安排名单开始安排吧"}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-auto border-t border-[#e8edde] p-4">
              <button
                className="btn w-full border-dashed! bg-[#fafcf7]! py-2.5! text-xs!"
                onClick={() => setDialog({ type: "guest" })}
              >
                <UserRoundPlus size={14} />
                手动添加宾客
              </button>
              <div className="mt-3 flex justify-center">
                <a
                  href={`${import.meta.env.BASE_URL}templates/guest-template.xlsx`}
                  download="婚礼宾客名单模板.xlsx"
                  className="flex items-center gap-1.5 text-[10px] text-[#99a589] hover:text-sage-600"
                >
                  <ArrowDownToLine size={11} />
                  下载 Excel 名单模板
                </a>
              </div>
            </div>
          </Roster>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="workspace-toolbar flex min-h-[64px] flex-wrap items-center justify-between gap-3 border-b border-[#e5eadc] px-5 py-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[14px] font-semibold text-[#536548]">
                  婚礼座位图
                </h2>
                <span className="rounded-md border border-[#e6ebdd] bg-[#fafbf7] px-2 py-1 text-[9px] text-[#9caa8f]">
                  圆桌 · 10 人 / 桌
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (!isFullscreen) setView("canvas");
                    setIsFullscreen((previous) => !previous);
                  }}
                  aria-pressed={isFullscreen}
                  title={isFullscreen ? "退出全屏（Esc）" : "全屏展示座位图"}
                  className="btn px-3! py-2! text-[11px]!"
                >
                  {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
                  {isFullscreen ? "退出全屏" : "全屏"}
                </button>
                <button
                  onClick={toggleLayout}
                  aria-pressed={editingLayout}
                  className={`btn px-3! py-2! text-[11px]! ${editingLayout ? "btn-primary" : ""}`}
                >
                  <Move size={13} />
                  {editingLayout ? "完成桌位调整" : "调整桌位"}
                </button>
                <div className="flex rounded-md border border-[#e3e9da] bg-[#f7f9f3] p-0.5">
                  <button
                    aria-label="圆桌视图"
                    aria-pressed={view === "canvas"}
                    onClick={() => setView("canvas")}
                    className={`flex h-7 w-8 items-center justify-center rounded ${view === "canvas" ? "bg-white text-sage-500 shadow-sm" : "text-[#a3af96]"}`}
                  >
                    <LayoutGrid size={14} />
                  </button>
                  <button
                    aria-label="列表视图"
                    aria-pressed={view === "list"}
                    onClick={() => {
                      setView("list");
                      setEditingLayout(false);
                      setSelectedTable(null);
                    }}
                    className={`flex h-7 w-8 items-center justify-center rounded ${view === "list" ? "bg-white text-sage-500 shadow-sm" : "text-[#a3af96]"}`}
                  >
                    <List size={15} />
                  </button>
                </div>
                <span className="h-5 w-px bg-[#e7ecdf]" />
                <button
                  onClick={addTable}
                  className="btn border-[#dde6d3]! bg-[#f4f7ee]! px-3! py-2! text-[11px]! text-[#7d926a]!"
                >
                  <Plus size={13} />
                  添加桌子
                </button>
              </div>
            </div>
            <div ref={canvasRef} className="canvas relative min-h-[588px] flex-1 overflow-auto">
              <div className="canvas-controls sticky left-0 top-0 z-10 flex min-h-11 flex-wrap items-center justify-between gap-2 bg-[#f8faf5]/95 px-5 py-2 backdrop-blur-sm">
                <span className="flex min-w-0 items-center gap-1.5 text-[9px] text-[#a0ad90]">
                  <Sparkles size={11} />
                  {editingLayout ? (
                    <span className="text-sage-600">
                      {selectedTable
                        ? "已选择桌子 · 点击空格移动，点击另一桌交换"
                        : "拖动整桌 · 自动对齐行列 · 舞台和过道留空"}
                    </span>
                  ) : selected ? (
                    <span className="truncate text-sage-600">
                      已选择 {selected.name} · 点击空位入座
                      {locations.has(selected.id) ? "，或点击已占座位交换" : ""}
                    </span>
                  ) : (
                    "拖动圆桌中心调整位置 · 点击编辑桌号 · Ctrl + 滚轮缩放"
                  )}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {view === "canvas" ? (
                    <label className="flex items-center gap-1.5 text-[10px] text-[#8d9d7c]">
                      每侧列数
                      <select
                        aria-label="每侧桌子列数"
                        className="rounded border border-[#e1e8d8] bg-white px-1 py-1 text-[10px]"
                        value={hallLayout.columnsPerSide}
                        onChange={(e) => {
                          commit(setHallColumns(state, Number(e.target.value)));
                          setSelectedTable(null);
                          notify("已调整每侧列数，桌子继续按行列对齐");
                        }}
                      >
                        {[1, 2, 3].map((n) => (
                          <option value={n} key={n}>
                            {n} 列
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <button
                    className="icon-btn h-6! w-6!"
                    disabled={!history.past.length}
                    onClick={undo}
                    aria-label="撤销上一步"
                    title="撤销上一步"
                  >
                    <RotateCcw size={13} />
                  </button>
                  {view === "canvas" ? (
                    <div className="flex items-center rounded-md border border-[#e1e8d8] bg-white/90 px-1">
                      <button
                        className="icon-btn h-6! w-6!"
                        aria-label="缩小座位图"
                        disabled={zoom <= 60}
                        onClick={() => setZoom((z) => Math.max(60, z - 10))}
                      >
                        <Minus size={12} />
                      </button>
                      <button
                        className="w-10 text-[9px] text-[#92a17f]"
                        onClick={() => setZoom(100)}
                        title="恢复默认缩放"
                      >
                        {zoom}%
                      </button>
                      <button
                        className="icon-btn h-6! w-6!"
                        aria-label="放大座位图"
                        disabled={zoom >= 200}
                        onClick={() => setZoom((z) => Math.min(200, z + 10))}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              {view === "canvas" ? (
                <Hall
                  tables={state.tables}
                  layout={hallLayout}
                  zoom={zoom}
                  editing={editingLayout}
                  draggingTable={!!activeTable}
                  selectedTable={selectedTable}
                  onSelectTable={(id) => {
                    if (selectedTable && selectedTable !== id) {
                      const position = hallLayout.positions.find(
                        (p) => p.tableId === id,
                      );
                      if (position) placeTable(selectedTable, position);
                    } else setSelectedTable(selectedTable === id ? null : id);
                  }}
                  onMoveTable={(position) => {
                    if (selectedTable) placeTable(selectedTable, position);
                    else notify("先选择一张桌子，或将桌子拖到这个空格");
                  }}
                  onAddTable={addTable}
                  renderTable={(table, number) => (
                    <RoundTable
                      table={table}
                      number={number}
                      guestMap={guestMap}
                      selectedGuest={selectedGuest}
                      onSeatClick={(seat, occupant) => {
                        if (selectedGuest)
                          assign(selectedGuest, table.id, seat);
                        else if (occupant) setSelectedGuest(occupant.id);
                        else notify("请先点击左侧宾客，或拖动宾客到这个空位");
                      }}
                      onTableClick={() => {
                        if (selectedGuest) assign(selectedGuest, table.id);
                        else setDialog({ type: "table", id: table.id });
                      }}
                      onEdit={() => setDialog({ type: "table", id: table.id })}
                    />
                  )}
                />
              ) : (
                <div className="space-y-4 p-5 pt-1">
                  {state.tables.length ? (
                    state.tables.map((table, index) => (
                      <div
                        key={table.id}
                        className="rounded-xl border border-[#e0e7d5] bg-[#fdfefb] p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="table-number text-[25px]!">
                              {String(tableNumber(table, index)).padStart(2, "0")}
                            </span>
                            <span className="text-xs font-medium text-[#718663]">
                              {table.name}
                            </span>
                            <span className="text-[10px] text-[#a7b198]">
                              {table.seats.filter(Boolean).length} / 10 人
                            </span>
                          </div>
                          <button
                            className="icon-btn"
                            aria-label={`管理第${tableNumber(table, index)}桌`}
                            onClick={() =>
                              setDialog({ type: "table", id: table.id })
                            }
                          >
                            <Pencil size={13} />
                          </button>
                        </div>
                        <div className="grid grid-cols-5 gap-2 max-lg:grid-cols-3">
                          {table.seats.map((id, seat) => {
                            const guest = id ? guestMap.get(id) : undefined;
                            return (
                              <button
                                key={seat}
                                onClick={() => {
                                  if (selectedGuest)
                                    assign(selectedGuest, table.id, seat);
                                  else if (guest) setSelectedGuest(guest.id);
                                  else notify("请先选择一位宾客");
                                }}
                                className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left ${guest ? `tone-${groupTone(guest.group)} border-[var(--tone-border)] bg-[var(--tone-bg)] text-[var(--tone-text)]` : "border-dashed border-[#e0e5d8] text-[#bdc6b1]"}`}
                              >
                                <span className="text-[9px]">{seat + 1}</span>
                                <span className="truncate text-[10px]">
                                  {guest?.name || "空位"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center text-xs text-[#9baa8e]">
                      还没有桌子，点击「添加桌子」开始安排。
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="workspace-footer flex min-h-11 flex-wrap items-center justify-between gap-2 border-t border-[#e4eadd] bg-[#fcfdf9] px-5 py-3">
              <div className="flex flex-wrap items-center gap-4">
                {DEFAULT_GROUPS.map((g) => (
                  <span
                    key={g}
                    className={`tone-${groupTone(g)} flex items-center gap-1.5 text-[9px] text-[#9ca78f]`}
                  >
                    <i className="group-dot" />
                    {g}
                  </span>
                ))}
              </div>
              <span className="flex items-center gap-1.5 text-[9px] text-[#a6b297]">
                <MousePointer2 size={10} />
                拖拽排座，也可点击宾客后选择空位
              </span>
            </div>
          </div>
        </section>
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] text-[#a7b19b]">
          <span
            className={`flex items-center gap-1.5 ${saveFailed ? "text-[#b98c75]" : ""}`}
          >
            <ShieldCheck size={12} />
            {saveFailed
              ? "本地保存失败 · 请导出备份"
              : "更改自动保存在此浏览器"}
            {state.isDemo ? (
              <span className="ml-2 rounded bg-[#eef2e7] px-1.5 py-0.5 text-[9px] text-[#94a383]">
                示例婚礼
              </span>
            ) : null}
          </span>
          <div className="flex items-center gap-4">
            {state.date ? (
              <span className="flex items-center gap-1.5">
                <CalendarDays size={11} />
                {state.date.replaceAll("-", ".")}
              </span>
            ) : null}
            {state.venue ? (
              <span className="flex items-center gap-1.5">
                <MapPin size={11} />
                {state.venue}
              </span>
            ) : null}
            {state.isDemo ? (
              <button
                className="demo-notice flex items-center gap-1 text-[#859872] hover:underline"
                onClick={() => setDialog({ type: "confirm", action: "clear" })}
              >
                清空示例，开始我的婚礼
                <ArrowUpRight size={11} />
              </button>
            ) : null}
          </div>
        </footer>
      </main>
      {selected && !activeGuest ? (
        <div className="toast fixed bottom-5 left-1/2 z-30 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 rounded-xl border border-[#cddcbd] bg-[#f8fbf2] px-4 py-3 shadow-lg">
          <Avatar guest={selected} small />
          <span className="text-xs text-sage-600">
            <b>{selected.name}</b> · 点击座位安排
          </span>
          {locations.has(selected.id) ? (
            <button
              className="shrink-0 text-[11px] text-[#9a8767] hover:underline"
              onClick={() => assign(selected.id, null)}
            >
              移回待安排
            </button>
          ) : null}
          <button
            onClick={() => setSelectedGuest(null)}
            className="icon-btn h-6! w-6!"
            aria-label="取消选择宾客"
          >
            <X size={13} />
          </button>
        </div>
      ) : null}
      {toast ? (
        <div
          role={toast.error ? "alert" : "status"}
          className={`toast fixed right-6 top-[88px] z-[70] flex max-w-[calc(100%-32px)] items-center gap-2 rounded-xl border bg-white px-4 py-3 text-xs shadow-lg ${toast.error ? "border-[#e9d5c6] text-[#b28b72]" : "border-[#dce7d0] text-sage-600"}`}
        >
          <Check size={15} />
          {toast.text}
          <button
            onClick={() => setToast(null)}
            className="ml-2 opacity-50"
            aria-label="关闭提示"
          >
            <X size={12} />
          </button>
        </div>
      ) : null}
      <DragOverlay
        dropAnimation={null}
        modifiers={activeGuest ? guestDragModifiers : undefined}
      >
        {activeTable && state.tables.some((t) => t.id === activeTable) ? (
          <TableMarker
            table={state.tables.find((t) => t.id === activeTable)!}
            number={tableNumber(state.tables.find((t) => t.id === activeTable)!, state.tables.findIndex((t) => t.id === activeTable))}
            dragging
          />
        ) : activeGuest && guestMap.has(activeGuest) ? (
          <div className="w-fit cursor-grabbing whitespace-nowrap rounded-xl border border-[#c6d5b7] bg-white px-4 py-3 text-xs text-sage-600 opacity-60 shadow-xl">
            {guestMap.get(activeGuest)!.name}
          </div>
        ) : null}
      </DragOverlay>
      {dialog?.type === "guest" ? (
        <GuestDialog
          key={dialog.id || "new"}
          guest={dialog.id ? guestMap.get(dialog.id) : undefined}
          groups={groups}
          onClose={() => setDialog(null)}
          onSave={(guest) => {
            commit({
              ...state,
              guests: dialog.id
                ? state.guests.map((g) => (g.id === guest.id ? guest : g))
                : [...state.guests, guest],
            });
            setDialog(null);
            if (!dialog.id) {
              setFilter("pending");
              setGroup("all");
              setQuery("");
            }
            notify(dialog.id ? "宾客信息已更新" : `已添加 ${guest.name}`);
          }}
          onDelete={(id) =>
            setDialog({ type: "confirm", action: "delete-guest", id })
          }
        />
      ) : null}
      {dialog?.type === "import" ? (
        <ImportDialog
          state={state}
          onClose={() => setDialog(null)}
          onImport={(guests) => {
            const result = importGuests(state, guests);
            commit(result.state);
            setDialog(null);
            setFilter(result.seated ? "all" : "pending");
            setGroup("all");
            setQuery("");
            notify(`成功导入 ${guests.length} 位宾客，已入座 ${result.seated} 人${result.overflow ? `，${result.overflow} 人因满桌待安排` : ""}`);
          }}
        />
      ) : null}
      {dialog?.type === "table" && inspectedTable ? (
        <TableDialog
          key={inspectedTable.id}
          table={inspectedTable}
          number={tableNumber(inspectedTable, state.tables.indexOf(inspectedTable))}
          usedNumbers={state.tables.filter((t) => t.id !== inspectedTable.id).map((t) => tableNumber(t, state.tables.indexOf(t)))}
          guestMap={guestMap}
          onClose={() => setDialog(null)}
          onSave={(name, number) => {
            const result = updateTable(state, inspectedTable.id, number, name);
            if (result.error) { notify(result.error, true); return; }
            commit(result.state);
            setDialog(null);
            notify("桌号和名称已更新");
          }}
          onRemove={(id) => assign(id, null)}
          onDelete={() =>
            setDialog({
              type: "confirm",
              action: "delete-table",
              id: inspectedTable.id,
            })
          }
        />
      ) : null}
      {dialog?.type === "settings" ? (
        <SettingsDialog
          state={state}
          onClose={() => setDialog(null)}
          onSave={(fields) => {
            commit({ ...state, ...fields });
            setDialog(null);
            notify("婚礼信息已保存");
          }}
          onClear={() => setDialog({ type: "confirm", action: "clear" })}
        />
      ) : null}
      {dialog?.type === "confirm" ? (
        <Modal
          title={
            dialog.action === "clear"
              ? "开始一场属于你的婚礼"
              : dialog.action === "delete-table"
                ? "删除这张桌子？"
                : "删除这位宾客？"
          }
          onClose={() => setDialog(null)}
        >
          <p className="text-sm leading-7 text-[#8b9b7b]">
            {dialog.action === "clear"
              ? "这会清空当前宾客和座位安排，并留下 3 张空桌。随后可导入你的宾客名单，或手动添加宾客。"
              : dialog.action === "delete-table"
                ? "本桌所有宾客会移回待安排名单，你可以为他们重新安排座位。"
                : "这位宾客会从名单移除，已占用的座位也会空出。"}
            <span className="mt-2 block text-xs text-[#a5b098]">
              操作后可通过座位图右上角的撤销按钮恢复。
            </span>
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button className="btn" onClick={() => setDialog(null)}>
              取消
            </button>
            <button className="btn btn-primary" onClick={confirmAction}>
              {dialog.action === "clear" ? "清空并开始" : "确认删除"}
            </button>
          </div>
        </Modal>
      ) : null}
      {dialog?.type === "help" ? (
        <Modal
          title="每一席，都可以轻松安排"
          subtitle="几步完成婚礼排座，把时间留给更重要的事。"
          onClose={() => setDialog(null)}
        >
          <div className="space-y-5">
            {[
              {
                icon: Upload,
                title: "01 · 邀请重要的人",
                text: "下载 Excel 模板，填写姓名、分组等信息后导入；也可以点击「手动添加宾客」。导入会追加到现有名单。",
              },
              {
                icon: MousePointer2,
                title: "02 · 安排一席欢喜",
                text: "将宾客拖到圆桌中央，自动分配空位；拖到指定空位可精确排座。也可以点击宾客，再点击座位，适合手机操作。",
              },
              {
                icon: Move,
                title: "03 · 排列每一桌",
                text: "点击「调整桌位」，将桌子拖到空格，落位自动对齐行列；拖到另一桌可以交换位置。可设置每侧 1～3 列，舞台和过道禁止放桌。也可以点击桌子再点击目标格子。",
              },
              {
                icon: Table2,
                title: "04 · 让相聚更自在",
                text: "每桌固定 10 人，可随时添加桌子。已入座宾客可跨桌移动，拖到已有宾客的座位可交换位置。拖回左侧名单可取消入座。",
              },
              {
                icon: Download,
                title: "05 · 留下美好的安排",
                text: "点击圆桌管理桌名和人员；更改自动保存在当前浏览器，导出 Excel 座位表便于备份或交给酒店。",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0f4e9] text-[#95a881]">
                  <item.icon size={17} />
                </span>
                <div>
                  <h3 className="text-xs font-medium text-sage-600">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[11px] leading-6 text-[#9aa78b]">
                    {item.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary mt-6 w-full"
            onClick={() => setDialog(null)}
          >
            开始安排美好的相聚
          </button>
        </Modal>
      ) : null}
    </DndContext>
  );
}
export default App;
