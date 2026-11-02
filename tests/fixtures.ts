import { DEFAULT_GROUPS, newTable, type WeddingState } from "../src/model.ts";

export function createDemo(): WeddingState {
  const names = [
    "林建国",
    "王秀兰",
    "林志远",
    "周美琴",
    "林晓",
    "林小满",
    "张文博",
    "李淑芬",
    "陈明远",
    "刘雅琴",
    "陈一宁",
    "许静",
    "陈子涵",
    "吴文华",
    "赵安",
    "沈知夏",
    "许嘉禾",
    "苏晚",
    "宋清",
    "周予安",
    "徐星",
    "陆景",
    "江沐",
    "顾念",
    "王浩",
    "李欣",
    "张晨",
    "刘悦",
    "赵宇",
    "陈静",
    "林清",
    "郑可",
    "黄思远",
    "方宁",
    "程雨",
    "叶青",
    "徐安然",
    "许梦",
    "周子墨",
    "沈悦",
    "杨帆",
    "唐甜",
    "蒋文",
    "何欢",
    "吴桐",
    "白露",
    "陆川",
    "宋时",
  ];
  const guests = names.map((name, i) => ({
    id: `demo-${i}`,
    name,
    group: DEFAULT_GROUPS[i < 8 ? 0 : i < 16 ? 1 : i < 30 ? 2 : i % 3],
    phone: "",
    note: i === 5 ? "儿童，需儿童餐具" : i === 9 ? "素食" : "",
  }));
  const tables = [
    "新郎家人",
    "新娘家人",
    "挚友相聚",
    "同窗时光",
    "亲友欢聚",
    "美好相逢",
  ].map(newTable);
  const counts = [8, 6, 6, 5, 5, 0];
  let index = 0;
  tables.forEach((table, i) => {
    for (let j = 0; j < counts[i]; j++) table.seats[j] = guests[index++].id;
  });
  return {
    version: 1,
    title: "林予 & 陈愿的婚礼",
    date: "2026-11-22",
    venue: "杭州 · 湖畔花园",
    isDemo: true,
    guests,
    tables,
  };
}

