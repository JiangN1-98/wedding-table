import { CAPACITY } from "./model";

export const HALL_CELL_WIDTH = 278;
export const HALL_ROW_HEIGHT = 288;
export const HALL_AISLE_WIDTH = 88;
export const HALL_GAP = 12;
export const HALL_PADDING = 16;
export const HALL_STAGE_HEIGHT = 82;

export function hallWidth(columns: number, cellWidth = HALL_CELL_WIDTH) {
  return columns * 2 * (cellWidth + HALL_GAP) + HALL_AISLE_WIDTH + HALL_PADDING * 2;
}

export const seatCenters = Array.from({ length: CAPACITY }, (_, i) => {
  const angle = ((-90 + i * 36) * Math.PI) / 180;
  return { x: 139 + Math.cos(angle) * 106, y: 126 + Math.sin(angle) * 107 };
});
