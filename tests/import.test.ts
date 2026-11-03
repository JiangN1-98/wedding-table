import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { readGuestFile } from '../src/excel.ts';
import { importGuests, createInitialState, isWeddingState, type ImportedGuest } from '../src/model.ts';

const guest = (id: string, tableNumber?: number): ImportedGuest => ({ id, name: id, group: '其他宾客', phone: '', note: '', tableNumber });
function file(rows: unknown[][]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), '名单');
  return new File([XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })], 'guests.xlsx');
}

test('Excel table numbers seat guests and create missing tables without altering the original', async () => {
  const preview = await readGuestFile(file([['姓名','桌号'],['甲',1],['乙',5],['丙','']]));
  const original = createInitialState();
  const result = importGuests(original, preview.guests);
  assert.equal(result.seated, 2);
  assert.equal(result.addedTables, 2);
  assert.equal(result.state.tables[0].seats[0], preview.guests[0].id);
  assert.equal(result.state.tables[4].seats[0], preview.guests[1].id);
  assert.equal(original.tables.length, 3);
  assert.equal(original.guests.length, 0);
  assert.ok(isWeddingState(result.state));
  assert.ok(!('tableNumber' in result.state.guests[0]));
});

test('full tables preserve existing occupants and overflow stays pending', () => {
  const initial = importGuests(createInitialState(), Array.from({ length: 9 }, (_, i) => guest(`old-${i}`, 1))).state;
  const result = importGuests(initial, [guest('a',1),guest('b',1),guest('c',2)]);
  assert.equal(result.seated, 2);
  assert.equal(result.overflow, 1);
  assert.equal(result.state.guests.length, 12);
  assert.equal(result.state.tables[0].seats[9], 'a');
  assert.ok(!result.state.tables.flatMap(t => t.seats).includes('b'));
  assert.equal(initial.tables[0].seats[9], null);
  assert.ok(isWeddingState(result.state));
});

test('old spreadsheets remain compatible and invalid table numbers are rejected', async () => {
  const old = await readGuestFile(file([['姓名'],['甲']]));
  assert.equal(importGuests(createInitialState(),old.guests).seated, 0);
  for (const value of ['-1','0','1.5','abc','201']) {
    await assert.rejects(readGuestFile(file([['姓名','桌号'],['甲',value]])), /桌号无效/);
  }
  assert.throws(() => importGuests(createInitialState(), [guest('bad', NaN)]), /桌号/);
});

test('download template has table number examples and imports successfully', async () => {
  const { readFile } = await import('node:fs/promises');
  const data = await readFile(new URL('../public/templates/guest-template.xlsx',import.meta.url));
  const preview = await readGuestFile(new File([data], 'template.xlsx'));
  assert.equal(preview.guests.length, 3);
  assert.deepEqual(preview.guests.map(g=>g.tableNumber), [1,2,undefined]);
  assert.equal(importGuests(createInitialState(),preview.guests).seated, 2);
});
