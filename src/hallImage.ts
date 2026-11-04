import {
  HALL_AISLE_WIDTH,
  HALL_CELL_WIDTH,
  HALL_GAP,
  HALL_PADDING,
  HALL_ROW_HEIGHT,
  HALL_STAGE_HEIGHT,
  hallWidth,
  seatCenters,
} from "./hallGeometry";
import { CAPACITY, groupTone, tableNumber } from "./model";
import type { Guest, HallLayout, WeddingState } from "./model";

const FONT = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
const XML_ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const PNG_SCALE = 2;
const MAX_PNG_EDGE = 8192;
const MAX_PNG_PIXELS = 24_000_000;

function xmlText(value: string) {
  return value.replace(/[\p{Cc}\uFFFE\uFFFF]/gu, " ").replace(/[&<>]/g, (character) => XML_ENTITIES[character]);
}

function createHallImage(
  tables: WeddingState["tables"],
  layout: HallLayout,
  guestMap: Map<string, Guest>,
) {
  const { columnsPerSide: columns, positions } = layout;
  const width = hallWidth(columns);
  const center = width / 2;
  const rowCount = Math.max(1, ...positions.map(({ row }) => row + 1));
  const columnStep = HALL_CELL_WIDTH + HALL_GAP;
  const rowStep = HALL_ROW_HEIGHT + HALL_GAP;
  const firstRow = HALL_PADDING + HALL_STAGE_HEIGHT + HALL_GAP;
  const aisleBottom = firstRow + rowCount * rowStep - HALL_GAP;
  const height = aisleBottom + 48;
  const positionByTable = new Map(positions.map((position) => [position.tableId, position]));
  const measure = document.createElement("canvas").getContext("2d");

  function fitLabel(label: string, size: number, maxWidth: number) {
    if (!measure) return label;
    measure.font = `${size}px ${FONT}`;
    if (measure.measureText(label).width <= maxWidth) return label;
    const characters = Array.from(label);
    while (characters.length && measure.measureText(`${characters.join("")}…`).width > maxWidth) {
      characters.pop();
    }
    return `${characters.join("")}…`;
  }

  const tableMarkup = tables.map((table, index) => {
    const position = positionByTable.get(table.id);
    if (!position) return "";
    const { side, row, column } = position;
    const x = side === "left"
      ? HALL_PADDING + (columns - 1 - column) * columnStep
      : center + HALL_AISLE_WIDTH / 2 + HALL_GAP + column * columnStep;
    const y = firstRow + row * rowStep;
    const count = table.seats.filter(Boolean).length;
    const seats = table.seats.map((id, seatIndex) => {
      const { x, y } = seatCenters[seatIndex];
      const guest = id ? guestMap.get(id) : undefined;
      const label = guest ? fitLabel(guest.name, 10, 56) : `+ ${seatIndex + 1}`;
      return `<g class="${guest ? groupTone(guest.group) : "empty"}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">
        ${guest ? `<title>${xmlText(guest.name)}</title>` : ""}
        <rect x="-33" y="-14" width="66" height="28" rx="7"/>
        <text y="4" font-size="10">${xmlText(label)}</text>
      </g>`;
    }).join("");

    return `<g transform="translate(${x} ${y})">
      <circle cx="139" cy="126" r="69" fill="#f0f4ea" stroke="#d4ddcc" stroke-width="1.5"/>
      <circle cx="139" cy="126" r="61" fill="none" stroke="#dce4d4"/>
      <text x="139" y="97" fill="#839674" font-size="8" letter-spacing="2.5">TABLE</text>
      <text class="table-number" x="139" y="130" fill="#6b7e5b" font-size="33">${String(tableNumber(table, index)).padStart(2, "0")}</text>
      <text x="139" y="149" font-size="11"><title>${xmlText(table.name)}</title>${xmlText(fitLabel(table.name, 11, 108))}</text>
      <text x="139" y="167" font-size="9">${count} / ${CAPACITY} 人</text>
      ${seats}
    </g>`;
  }).join("");

  const markup = `
    <style>
      text { font-family: ${FONT}; text-anchor: middle; }
      .table-number { font-family: Georgia, serif; }
      .sage rect { fill: #e8efe2; stroke: #d0ddc5; } .sage text { fill: #566e46; }
      .rose rect { fill: #f7e9e5; stroke: #edd4ca; } .rose text { fill: #935e51; }
      .lavender rect { fill: #eeebf5; stroke: #dcd5e9; } .lavender text { fill: #756691; }
      .sand rect { fill: #f5efdf; stroke: #e6dbbb; } .sand text { fill: #826c39; }
      .empty rect { fill: #fcfdf9; stroke: #d9dfd2; stroke-dasharray: 3 2; } .empty text { fill: #838d79; }
    </style>
    <rect width="${width}" height="${height}" fill="#f8faf5"/>
    <g fill="#607550">
      <rect x="${center - 38}" y="${firstRow - HALL_GAP}" width="76" height="${aisleBottom - firstRow + HALL_GAP}" rx="7" fill="#eff3e8" stroke="#dbe2d0"/>
      <text x="${center}" y="${firstRow + 42}" font-size="20">↑</text>
      <text x="${center}" y="${firstRow + 126}" font-size="13" writing-mode="vertical-rl" letter-spacing="8">中央过道</text>
      <text x="${center}" y="${aisleBottom - 24}" font-size="20">↑</text>
      <rect x="${HALL_PADDING}" y="${HALL_PADDING}" width="${width - HALL_PADDING * 2}" height="${HALL_STAGE_HEIGHT}" rx="12" fill="#e8efde" stroke="#c7d5ba"/>
      <text x="${center}" y="${HALL_PADDING + 32}" font-size="9" letter-spacing="2.5">THE WEDDING STAGE</text>
      <text x="${center}" y="${HALL_PADDING + 57}" font-size="19" letter-spacing="5">婚礼舞台</text>
      <text x="${center}" y="${aisleBottom + 29}" font-size="11" letter-spacing="3">宾客入口</text>
      ${tableMarkup}
    </g>`;

  return {
    width,
    height,
    svg: (scale: number) => new Blob([
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width} ${height}">${markup}</svg>`,
    ], { type: "image/svg+xml;charset=utf-8" }),
  };
}

async function rasterize(svg: Blob, width: number, height: number) {
  const url = URL.createObjectURL(svg);
  const canvas = document.createElement("canvas");
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  } catch {
    return null;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    URL.revokeObjectURL(url);
  }
}

export async function downloadHallImage(state: WeddingState, layout: HallLayout, guestMap: Map<string, Guest>) {
  const image = createHallImage(state.tables, layout, guestMap);
  const width = image.width * PNG_SCALE;
  const height = image.height * PNG_SCALE;
  const png = Math.max(width, height) <= MAX_PNG_EDGE && width * height <= MAX_PNG_PIXELS
    ? await rasterize(image.svg(PNG_SCALE), width, height)
    : null;
  const format = png ? "PNG" : "SVG";
  const url = URL.createObjectURL(png ?? image.svg(1));
  const filename = state.title.replace(/[\\/:*?"<>|\p{Cc}]/gu, "-").trim() || "婚礼";
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-座位图-100%.${format.toLowerCase()}`;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Give the browser time to start the download before releasing the file.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return format;
}
