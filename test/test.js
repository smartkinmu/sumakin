const assert = require('assert');
const { parseCsv, computeMonthlySummary } = require('./summary');

const sampleCsv = [
    '2025-06-01T09:00:00+09:00,start,7.75,"login"',
    '2025-06-02T09:00:00+09:00,start,8.00,"work"',
    '2025-07-01T09:00:00+09:00,start,7.00,"other"'
].join('\n');

const records = parseCsv(sampleCsv);
assert.strictEqual(records.length, 3);
assert.strictEqual(records[1].hours, 8.00);

const { workingDays, totalHours, overtime } = computeMonthlySummary(sampleCsv, 2025, 6);
assert.strictEqual(workingDays, 2);
assert.strictEqual(totalHours, 15.75);
assert.strictEqual(Number(overtime.toFixed(2)), 0.25);

console.log('All tests passed.');
