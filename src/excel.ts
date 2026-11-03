import type { ImportedGuest, WeddingState } from "./model.ts";
import { uid, locateGuest } from "./model.ts";
export type ImportPreview = {
  guests: ImportedGuest[];
  skipped: number;
  filename: string;
};

export async function readGuestFile(file: File): Promise<ImportPreview> {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name))
    throw new Error("请选择 .xlsx、.xls 或 .csv 文件");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("文件不能超过 5 MB，请分批导入");
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: false,
    sheetRows: 2002,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("文件中没有可读取的工作表");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });
  const headers = (rows[0] ?? []).map((h) => String(h).trim());
  const nameIndex = headers.findIndex((h) => h === "姓名" || h === "宾客姓名");
  if (nameIndex === -1)
    throw new Error("第一行需要包含「姓名」列，请参考 Excel 模板");
  if (rows.length > 2001)
    throw new Error("每次最多导入 2000 位宾客，请拆分文件后导入");
  const groupIndex = headers.findIndex((h) =>
    ["分组", "宾客分组", "关系"].includes(h),
  );
  const phoneIndex = headers.findIndex((h) =>
    ["手机号", "手机号码", "电话"].includes(h),
  );
  const noteIndex = headers.indexOf("备注");
  const tableIndex = headers.indexOf("桌号");
  const get = (row: unknown[], index: number) =>
    index < 0 ? "" : String(row[index] ?? "").trim();
  const guests: ImportedGuest[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    if (
      [nameIndex, groupIndex, phoneIndex, noteIndex, tableIndex].every((i) => !get(row, i))
    )
      continue;
    const name = get(row, nameIndex);
    if (
      !name ||
      name.length > 30 ||
      get(row, groupIndex).length > 30 ||
      get(row, phoneIndex).length > 30 ||
      get(row, noteIndex).length > 200
    ) {
      skipped++;
      continue;
    }
    const tableText = get(row, tableIndex);
    if (tableText && (!/^\d+$/.test(tableText) || Number(tableText) < 1 || Number(tableText) > 200))
      throw new Error(`宾客「${name}」的桌号无效，请填写 1～200 的整数，或留空待安排`);
    guests.push({
      tableNumber: tableText ? Number(tableText) : undefined,
      id: uid(),
      name,
      group: get(row, groupIndex) || "其他宾客",
      phone: get(row, phoneIndex),
      note: get(row, noteIndex),
    });
  }
  if (!guests.length)
    throw new Error("没有有效的宾客记录，请检查姓名列（最多 30 字）");
  return { guests, skipped, filename: file.name };
}

export async function exportSeating(state: WeddingState) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const rows = state.guests.map((g) => {
    const location = locateGuest(state, g.id);
    return {
      姓名: g.name,
      分组: g.group,
      手机号: g.phone,
      备注: g.note,
      桌号: location ? state.tables.indexOf(location.table) + 1 : "",
      桌名: location?.table.name ?? "待安排",
      座位号: location ? location.seat + 1 : "",
    };
  });
  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: ["姓名", "分组", "手机号", "备注", "桌号", "桌名", "座位号"],
  });
  sheet["!cols"] = [
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 32 },
    { wch: 10 },
    { wch: 20 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, "宾客座位表");
  const overview = XLSX.utils.json_to_sheet(
    state.tables.map((t, i) => ({
      桌号: i + 1,
      桌名: t.name,
      已安排: t.seats.filter(Boolean).length,
      容量: 10,
    })),
  );
  overview["!cols"] = [{ wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, overview, "桌次概览");
  XLSX.writeFile(
    workbook,
    `${state.title.replace(/[\\/:*?"<>|]/g, "-") || "婚礼"}-座位表.xlsx`,
  );
}
