import { importGuests, type ImportedGuest } from "./model";
import { useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
  X,
} from "lucide-react";
import type { Guest, WeddingState, WeddingTable } from "./model";
import { DEFAULT_GROUPS, groupTone, uid } from "./model";
import { Modal, Avatar } from "./components";
import { readGuestFile } from "./excel";
import type { ImportPreview } from "./excel";

export function GuestDialog({
  guest,
  groups,
  onSave,
  onDelete,
  onClose,
}: {
  guest?: Guest;
  groups: string[];
  onSave: (guest: Guest) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(guest?.name ?? "");
  const [group, setGroup] = useState(guest?.group ?? DEFAULT_GROUPS[0]);
  const [phone, setPhone] = useState(guest?.phone ?? "");
  const [note, setNote] = useState(guest?.note ?? "");
  return (
    <Modal
      title={guest ? "编辑宾客" : "添加一位宾客"}
      subtitle="记下每一位重要的人，让相聚井然有序。"
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim())
            onSave({
              id: guest?.id ?? uid(),
              name: name.trim(),
              group,
              phone: phone.trim(),
              note: note.trim(),
            });
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="guest-name" className="field-label">
            宾客姓名 <span className="text-[#b99883]">*</span>
          </label>
          <input
            id="guest-name"
            className="field"
            placeholder="请输入宾客姓名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={30}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="guest-group" className="field-label">
              宾客分组
            </label>
            <select
              id="guest-group"
              className="field"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="guest-phone" className="field-label">
              手机号{" "}
              <span className="text-[11px] font-normal text-[#a0a697]">
                选填
              </span>
            </label>
            <input
              id="guest-phone"
              className="field"
              type="tel"
              placeholder="方便联系"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
            />
          </div>
        </div>
        <div>
          <label htmlFor="guest-note" className="field-label">
            备注{" "}
            <span className="text-[11px] font-normal text-[#a0a697]">选填</span>
          </label>
          <textarea
            id="guest-note"
            className="field min-h-24 resize-y"
            placeholder="例如：素食、带儿童、希望与家人同桌…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="flex items-center justify-between border-t border-[#edf0e8] pt-5">
          {guest ? (
            <button
              type="button"
              className="text-xs text-[#b37f73] hover:underline"
              onClick={() => onDelete(guest.id)}
            >
              删除宾客
            </button>
          ) : (
            <span className="text-[11px] text-[#a0a697]">
              添加后可拖动安排座位
            </span>
          )}
          <div className="flex gap-2">
            <button className="btn" type="button" onClick={onClose}>
              取消
            </button>
            <button
              className="btn btn-primary"
              disabled={!name.trim()}
              type="submit"
            >
              {guest ? "保存修改" : "添加宾客"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function ImportDialog({
  state,
  onImport,
  onClose,
}: {
  state: WeddingState;
  onImport: (guests: ImportedGuest[]) => void;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const plan = preview ? importGuests(state, preview.guests) : null;
  async function read(file?: File) {
    if (!file) return;
    const token = ++request.current;
    setError("");
    setPreview(null);
    setBusy(true);
    try {
      const result = await readGuestFile(file);
      if (token === request.current) setPreview(result);
    } catch (e) {
      if (token === request.current)
        setError(e instanceof Error ? e.message : "读取失败，请检查文件格式");
    } finally {
      if (token === request.current) setBusy(false);
    }
  }
  return (
    <Modal
      title="从 Excel 导入宾客"
      subtitle="先下载模板填写名单，再一次性邀请所有重要的人。"
      onClose={onClose}
      wide
    >
      <div className="mb-4 flex items-center justify-between rounded-lg border border-[#e6ebdf] bg-[#f3f6ed] px-4 py-3">
        <div className="flex items-center gap-3">
          <FileSpreadsheet size={22} className="text-sage-500" />
          <div>
            <p className="text-xs font-medium text-[#5d6c50]">
              宾客名单模板.xlsx
            </p>
            <p className="mt-1 text-[10px] text-[#929d83]">
              姓名、分组、手机号、备注、桌号 · 含填写示例
            </p>
          </div>
        </div>
        <a
          href={`${import.meta.env.BASE_URL}templates/guest-template.xlsx`}
          download="婚礼宾客名单模板.xlsx"
          className="btn px-3! py-2! text-xs!"
        >
          <Download size={13} />
          下载模板
        </a>
      </div>
      <input
        ref={input}
        type="file"
        className="hidden"
        accept=".xlsx,.xls,.csv"
        aria-label="选择宾客名单文件"
        onChange={(e) => {
          void read(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void read(e.dataTransfer.files[0]);
        }}
        className={`flex w-full flex-col items-center rounded-xl border-2 border-dashed px-5 py-8 transition-colors ${over ? "border-sage-500 bg-sage-50" : "border-[#dce4d3] bg-[#fafcf7] hover:bg-sage-50"}`}
      >
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#edf2e6] text-[#859975]">
          {busy ? (
            <LoaderCircle size={22} className="animate-spin" />
          ) : (
            <Upload size={22} />
          )}
        </span>
        <span className="text-sm font-medium text-[#667759]">
          {busy ? "正在读取名单…" : "点击选择，或将文件拖到这里"}
        </span>
        <span className="mt-2 text-[11px] text-[#9ba48f]">
          支持 .xlsx、.xls、.csv，最大 5 MB，每次最多 2000 人
        </span>
      </button>
      {error ? (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg bg-[#fcf0ec] p-3 text-xs leading-5 text-[#b17d6b]"
        >
          <AlertCircle size={15} className="mt-0.5" />
          {error}
        </p>
      ) : null}
      {preview ? (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-sage-600">
              <Check size={14} />
              识别到 {preview.guests.length} 位宾客
            </span>
            <span className="max-w-[230px] truncate text-[#9ca592]">
              {preview.filename}
            </span>
          </div>
          <div className="max-h-52 overflow-y-auto rounded-lg border border-[#e5eade]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#f2f5ee] text-[#7b8c6c]">
                <tr>
                  {["姓名", "分组", "手机号", "备注", "桌号"].map((h) => (
                    <th key={h} className="px-3 py-2.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.guests.map((g) => (
                  <tr key={g.id} className="border-t border-[#edf0e7]">
                    <td className="px-3 py-2.5">{g.name}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`tone-${groupTone(g.group)} flex items-center gap-1.5`}
                      >
                        <i className="group-dot" />
                        {g.group}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[#8c9682]">
                      {g.phone || "—"}
                    </td>
                    <td
                      className="max-w-36 truncate px-3 py-2.5 text-[#8c9682]"
                      title={g.note}
                    >
                      {g.note || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{g.tableNumber ? `${g.tableNumber} 桌` : "待安排"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan ? <p className="mt-3 text-xs leading-5 text-sage-600">
            将入座 {plan.seated} 人，待安排 {preview.guests.length - plan.seated} 人，新增 {plan.addedTables} 桌。
            {plan.overflow ? `其中 ${plan.overflow} 人因对应桌已满，保留为待安排。` : ""}
          </p> : null}
          {preview.skipped ? (
            <p className="mt-2 text-[11px] text-[#b49367]">
              跳过 {preview.skipped}{" "}
              行：姓名为空或字段过长（姓名、分组、电话最多30字，备注最多200字）。
            </p>
          ) : null}
          <p className="mt-3 text-[11px] leading-5 text-[#9ca592]">
            导入会追加到当前名单。同名宾客会保留为不同的人，请避免重复导入同一份文件。
          </p>
        </div>
      ) : (
        <p className="mt-4 text-[11px] leading-5 text-[#9ca592]">
          第一行保留「姓名」列，其他信息可选填。桌号填写 1～200 的整数，自动补建缺少的桌子；留空或满桌则待安排。只读取第一个工作表。
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2 border-t border-[#edf0e8] pt-4">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button
          className="btn btn-primary"
          disabled={!preview || busy}
          onClick={() => {
            if (preview) onImport(preview.guests);
          }}
        >
          <Upload size={14} />
          {preview ? `导入 ${preview.guests.length} 位宾客` : "确认导入"}
        </button>
      </div>
    </Modal>
  );
}

export function TableDialog({
  table,
  number,
  usedNumbers,
  guestMap,
  onSave,
  onRemove,
  onDelete,
  onClose,
}: {
  table: WeddingTable;
  number: number;
  usedNumbers: number[];
  guestMap: Map<string, Guest>;
  onSave: (name: string, number: number) => void;
  onRemove: (id: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(table.name);
  const [numberText, setNumberText] = useState(String(number));
  const nextNumber = Number(numberText);
  const error = !/^\d+$/.test(numberText) || !Number.isInteger(nextNumber) || nextNumber < 1 || nextNumber > 200
    ? "桌号需要填写 1～200 的整数"
    : usedNumbers.includes(nextNumber) ? `第 ${nextNumber} 桌已存在，请使用其他桌号` : "";
  return (
    <Modal
      title={`第 ${String(number).padStart(2, "0")} 桌 · 桌次管理`}
      subtitle={`${table.seats.filter(Boolean).length} / 10 位宾客，愿这一桌的相聚满是欢喜。`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && !error) onSave(name.trim(), nextNumber);
        }}
      >
        <label htmlFor="table-number" className="field-label">桌号</label>
        <input id="table-number" className="field mb-2" inputMode="numeric" value={numberText}
          onChange={(e) => setNumberText(e.target.value)} required aria-invalid={!!error} aria-describedby="table-number-help" />
        <p id="table-number-help" className={`mb-4 text-xs ${error ? "text-red-600" : "text-[#859575]"}`} role={error ? "alert" : undefined}>
          {error || "桌号为 1～200，不可与其他桌子重复。"}
        </p>
        <label htmlFor="table-name" className="field-label">
          桌子名称
        </label>
        <div className="flex gap-2">
          <input
            id="table-name"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            required
          />
          <button className="btn btn-primary shrink-0" disabled={!name.trim() || !!error}>
            保存
          </button>
        </div>
      </form>
      <h3 className="mb-3 mt-6 text-xs font-medium text-[#859575]">本桌宾客</h3>
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {table.seats.map((id, index) => {
          const guest = id ? guestMap.get(id) : undefined;
          return (
            <div
              key={index}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#f4f7ee]"
            >
              <span className="w-4 text-[10px] text-[#a3ad97]">
                {String(index + 1).padStart(2, "0")}
              </span>
              {guest ? (
                <>
                  <Avatar guest={guest} small />
                  <span className="min-w-0 flex-1 text-xs">
                    <span className="block truncate">{guest.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-[#9aa58e]">
                      {guest.group}
                      {guest.note ? ` · ${guest.note}` : ""}
                    </span>
                  </span>
                  <button
                    className="icon-btn"
                    onClick={() => onRemove(guest.id)}
                    title="移回待安排名单"
                    aria-label={`将${guest.name}移回待安排`}
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <span className="text-xs text-[#bac2b0]">空位</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-[#e8edde] pt-4">
        <button
          className="text-xs text-[#b37f73] hover:underline"
          onClick={onDelete}
        >
          删除这张桌子
        </button>
        <button className="btn" onClick={onClose}>
          完成
        </button>
      </div>
    </Modal>
  );
}

export function SettingsDialog({
  state,
  onSave,
  onClear,
  onClose,
}: {
  state: WeddingState;
  onSave: (fields: Pick<WeddingState, "title" | "date" | "venue">) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(state.title);
  const [date, setDate] = useState(state.date);
  const [venue, setVenue] = useState(state.venue);
  return (
    <Modal
      title="我们的婚礼"
      subtitle="为这场特别的相聚，写下专属的信息。"
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim())
            onSave({ title: title.trim(), date, venue: venue.trim() });
        }}
      >
        <div>
          <label htmlFor="wedding-title" className="field-label">
            婚礼名称
          </label>
          <input
            id="wedding-title"
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={40}
          />
        </div>
        <div>
          <label htmlFor="wedding-date" className="field-label">
            婚礼日期
          </label>
          <input
            id="wedding-date"
            type="date"
            className="field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="wedding-venue" className="field-label">
            婚礼地点
          </label>
          <input
            id="wedding-venue"
            className="field"
            placeholder="例如：杭州 · 湖畔花园"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            maxLength={60}
          />
        </div>
        <p className="rounded-lg bg-[#f1f5eb] p-3 text-[11px] leading-5 text-[#8d9c7e]">
          名单与座位保存在当前浏览器。使用「导出座位表」可备份宾客与桌次信息。
        </p>
        <div className="flex items-center justify-between border-t border-[#e8edde] pt-4">
          <button
            type="button"
            className="text-xs text-[#b37f73] hover:underline"
            onClick={onClear}
          >
            清空名单与座位
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="btn btn-primary"
          >
            保存婚礼信息
          </button>
        </div>
      </form>
    </Modal>
  );
}
