function parseCsv(csv) {
    return csv.trim().split('\n').map(line => {
        const parts = line.split(',');
        const date = new Date(parts[0]);
        return { date: date, hours: parseFloat(parts[3]) || 0 };
    });
}

function computeMonthlySummary(csv, year, month) {
    const records = parseCsv(csv);
    let totalHours = 0;
    const days = new Set();
    records.forEach(r => {
        if (r.date.getFullYear() === year && r.date.getMonth() + 1 === month) {
            const y = r.date.getFullYear();
            const m = String(r.date.getMonth() + 1).padStart(2, '0');
            const d = String(r.date.getDate()).padStart(2, '0');
            const dayStr = `${y}-${m}-${d}`;
            days.add(dayStr);
            totalHours += r.hours;
        }
    });
    const workingDays = days.size;
    const base = workingDays * 7.75;
    const overtime = totalHours - base;
    return { workingDays, totalHours, overtime };
}

module.exports = { parseCsv, computeMonthlySummary };
