const assert = require('assert');
const { parseCsv, computeMonthlySummary } = require('./summary');

const sampleCsv = [
    '2025-06-01,08:30,17:15,7.75,0.00',
    '2025-06-02,08:30,17:30,8.00,0.25',
    '2025-07-01,08:30,16:30,7.00,0.00'
].join('\n');

const records = parseCsv(sampleCsv);
assert.strictEqual(records.length, 3);
assert.strictEqual(records[1].hours, 8.00);

const { workingDays, totalHours, overtime } = computeMonthlySummary(sampleCsv, 2025, 6);
assert.strictEqual(workingDays, 2);
assert.strictEqual(totalHours, 15.75);
assert.strictEqual(Number(overtime.toFixed(2)), 0.25);

console.log('All tests passed.');
