// common.js の計算・ログ操作・バックアップの処理を確かめるテスト。
// ブラウザの localStorage の代わりを用意して、common.js をそのまま読み込んで動かす。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

/**
 * localStorage の代わりを作る。
 * @returns {Object} getItem・setItem・removeItem・key・length を持つもの
 */
function createStorage() {
    const store = new Map();
    return {
        getItem: key => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: key => store.delete(key),
        key: i => [...store.keys()][i] ?? null,
        get length() {
            return store.size;
        },
        clear: () => store.clear(),
    };
}

const alerts = [];
const context = vm.createContext({
    localStorage: createStorage(),
    alert: message => alerts.push(message),
    console,
});
vm.runInContext(fs.readFileSync(path.join(root, 'common.js'), 'utf8'), context, { filename: 'common.js' });
const run = code => vm.runInContext(code, context);
const storage = context.localStorage;

/**
 * テストを1つ動かす。毎回 localStorage を空にしてから始める。
 * @param {string} name - テストの名前
 * @param {function(): void} fn - テストの中身
 * @returns {void}
 */
let failed = 0;
function test(name, fn) {
    storage.clear();
    alerts.length = 0;
    try {
        fn();
        console.log(`ok  ${name}`);
    } catch (error) {
        failed++;
        console.log(`NG  ${name}`);
        console.log(error.message);
    }
}

test('勤務時間：標準の勤務は7.75時間', () => {
    assert.strictEqual(run("calculateWorkingHours('08:30', '17:15')"), '7.75');
    assert.strictEqual(run("calculateWorkingHoursExact('08:30', '17:15')"), '7.75');
});

test('勤務時間：昼休みと夕休みが重なる設定でも、二重に引かない（画面ごとの食い違いがない）', () => {
    storage.setItem('break1Start', '12:00');
    storage.setItem('break1End', '13:00');
    storage.setItem('break2Start', '12:30');
    storage.setItem('break2End', '13:30');
    assert.strictEqual(run("calculateWorkingHours('08:30', '17:15')"), '7.25');
    assert.strictEqual(run("calculateWorkingHoursExact('08:30', '17:15')"), '7.25');
});

test('勤務時間：勤務時間の外にある中断は引かない（増えもしない）', () => {
    assert.strictEqual(run("calculateWorkingHoursExact('08:30', '17:15', '18:00', '18:30')"), '7.75');
});

test('計算チェック：丸めの違いだけの行は直さない', () => {
    // 修正前の保存の式（勤務時間を丸めてから中断を引く）で 7.91 になる行
    const line = '2026-10-01,08:00,17:05,7.91,0.16,08:00,08:10,,';
    assert.strictEqual(run(`findLogCalculationFix(${JSON.stringify(line)})`), null);
});

test('計算チェック：休憩と重なる中断で二重に引かれた行は直す', () => {
    const line = '2026-09-01,08:30,17:15,7.25,-0.50,12:00,12:30,,';
    const fix = run(`findLogCalculationFix(${JSON.stringify(line)})`);
    assert.ok(fix);
    assert.strictEqual(fix.newWork, '7.75');
    assert.strictEqual(fix.newOvertime, '0.00');
});

test('計算チェック：勤務時間の外の中断で引かれていた行は、正しい値（7.75）に直す', () => {
    const line = '2026-09-01,08:30,17:15,7.25,-0.50,18:00,18:30,,';
    const fix = run(`findLogCalculationFix(${JSON.stringify(line)})`);
    assert.ok(fix);
    assert.strictEqual(fix.newWork, '7.75');
});

test('計算チェック：休憩と重ならない中断の行は、5分刻みのどの組み合わせでも直さない', () => {
    // 修正前の保存の式と、今の保存の式の両方で作った行を確かめる
    const fixes = run(`(() => {
        const pad = n => String(n).padStart(2, '0');
        const hm = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
        let count = 0;
        let found = 0;
        for (let s = 8 * 60; s <= 9 * 60; s += 5) {
            for (let e = 17 * 60; e <= 18 * 60; e += 5) {
                for (let is = s; is < 12 * 60; is += 5) {
                    for (const len of [5, 10, 15, 20, 25, 35, 50]) {
                        const ie = is + len;
                        if (ie > 12 * 60) continue;
                        const legacy = calculateWorkingHoursDoubleCounted(hm(s), hm(e), hm(is), hm(ie), '', '');
                        const current = calculateWorkingHoursExact(hm(s), hm(e), hm(is), hm(ie), '', '');
                        for (const work of [legacy, current]) {
                            count++;
                            const line = ['2026-10-01', hm(s), hm(e), work, '0', hm(is), hm(ie), '', ''].join(',');
                            if (findLogCalculationFix(line)) found++;
                        }
                    }
                }
            }
        }
        return { count, found };
    })()`);
    assert.ok(fixes.count > 10000, `組み合わせが少なすぎる: ${fixes.count}`);
    assert.strictEqual(fixes.found, 0);
});

test('ログのクリア：バックアップから書き戻されず、UNDO用に控える', () => {
    storage.setItem('logs', '2026-10-01,08:30,17:15,7.75,0.00');
    storage.setItem('logs_backup', '2026-10-01,08:30,17:15,7.75,0.00');
    run('clearAllLogs()');
    assert.strictEqual(run('restoreLogsIfNeeded()'), null);
    assert.strictEqual(alerts.length, 0);
    assert.strictEqual(storage.getItem('logs_undo'), '2026-10-01,08:30,17:15,7.75,0.00');
});

test('ログのクリア：logs が空でバックアップだけあるときも、UNDO用に控える', () => {
    storage.setItem('logs_backup', '2026-10-01,08:30,17:15,7.75,0.00');
    run('clearAllLogs()');
    assert.strictEqual(storage.getItem('logs_undo'), '2026-10-01,08:30,17:15,7.75,0.00');
});

test('編集：ほかに記録がある日付には変えられない', () => {
    const logs = '2026-10-01,08:30,17:15,7.75,0.00\n2026-10-02,08:30,18:15,8.75,1.00';
    const result = run(`editLogLine(${JSON.stringify(logs)}, '2026-10-01', '2026-10-02', '08:30', '17:15')`);
    assert.ok(result.error);
});

test('編集：年休の行は、時刻を変えずに日付だけ変えても年休のまま', () => {
    const logs = '2026-10-01,年休,年休,7.75,0.00,,,,,';
    const result = run(`editLogLine(${JSON.stringify(logs)}, '2026-10-01', '2026-10-05', '08:30', '17:15')`);
    assert.strictEqual(result.updated, '2026-10-05,年休,年休,7.75,0.00,,,,,');
});

test('編集：AM休の行は、何も変えずに保存しても勤務時間が変わらない', () => {
    const logs = '2026-10-01,13:00,17:15,7.75,0.00,,,,,';
    const result = run(`editLogLine(${JSON.stringify(logs)}, '2026-10-01', '2026-10-01', '13:00', '17:15')`);
    assert.strictEqual(result.changed, false);
});

test('編集：AM休の行の終業を変えると、半休の分を残して計算し直す', () => {
    const logs = '2026-10-01,13:00,17:15,7.75,0.00,,,,,';
    const result = run(`editLogLine(${JSON.stringify(logs)}, '2026-10-01', '2026-10-01', '13:00', '17:30')`);
    assert.strictEqual(result.updated, '2026-10-01,13:00,17:30,8.00,0.25,,,,,');
});

test('編集：丸めの違いで0.01多く保存された行は、半休とみなさない', () => {
    const logs = '2026-10-01,08:30,17:16,7.74,-0.01,14:00,14:02,,';
    const result = run(`editLogLine(${JSON.stringify(logs)}, '2026-10-01', '2026-10-01', '08:30', '18:00')`);
    assert.strictEqual(result.updated.split(',')[3], '8.47');
});

test('編集：休憩の設定を長くしたあとの行は、差を半休とみなさない', () => {
    storage.setItem('break1Start', '12:00');
    storage.setItem('break1End', '13:15');
    const logs = '2024-01-16,08:30,17:15,7.75,0.00';
    const result = run(`editLogLine(${JSON.stringify(logs)}, '2024-01-16', '2024-01-16', '08:30', '18:00')`);
    assert.strictEqual(result.updated.split(',')[3], '8.25');
});

test('編集：中断時間とメール作成済みの印を引き継ぐ', () => {
    const logs = '2026-10-01,08:30,18:00,8.25,0.50,15:00,15:15,,,1';
    const result = run(`editLogLine(${JSON.stringify(logs)}, '2026-10-01', '2026-10-01', '08:30', '17:15')`);
    assert.strictEqual(result.updated, '2026-10-01,08:30,17:15,7.50,-0.25,15:00,15:15,,,1');
});

test('入力内容：日付ごとに残し、日付を変えると移り、使わなくなった分は消える', () => {
    storage.setItem('logs', '2026-10-01,08:30,17:15,7.75,0.00\n2026-10-02,08:30,17:15,7.75,0.00');
    const detail = { groupCount: 1, leave: '', tasks: [{ number: 'ABCDE12345', category: '12345', hours: '7.75', title: 'メモ' }] };
    run(`saveLogDetail('2026-10-01', ${JSON.stringify(detail)})`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(run("getLogDetail('2026-10-01')"))), detail);
    // ログの日付を 10/05 に変えたあと、入力内容も移す
    storage.setItem('logs', '2026-10-05,08:30,17:15,7.75,0.00\n2026-10-02,08:30,17:15,7.75,0.00');
    run("moveLogDetail('2026-10-01', '2026-10-05')");
    assert.strictEqual(run("getLogDetail('2026-10-01')"), null);
    assert.strictEqual(run("getLogDetail('2026-10-05')").tasks[0].number, 'ABCDE12345');
    // ログを消し、UNDOの控えにも無くなったら、次に保存するときに消える
    storage.setItem('logs', '2026-10-02,08:30,17:15,7.75,0.00');
    storage.removeItem('logs_undo');
    run(`saveLogDetail('2026-10-02', ${JSON.stringify(detail)})`);
    assert.strictEqual(run("getLogDetail('2026-10-05')"), null);
});

test('入力内容：古いログの勤務時間から、AM休・PM休を見分ける', () => {
    assert.strictEqual(run("detectHalfDayLeave('7.75', '13:00', '17:15', '', '', '', '')").type, 'am');
    assert.strictEqual(run("detectHalfDayLeave('7.75', '08:30', '12:00', '', '', '', '')").type, 'pm');
    assert.strictEqual(run("detectHalfDayLeave('7.75', '08:30', '17:15', '', '', '', '')").type, '');
});

test('UNDO：メール作成済みの印は残す', () => {
    const current = '2026-10-01,08:30,17:15,7.75,0.00,,,,,1';
    const undo = '2026-10-01,08:30,17:15,7.75,0.00\n2026-10-02,08:30,17:15,7.75,0.00';
    assert.strictEqual(run(`buildUndoLogs(${JSON.stringify(current)}, ${JSON.stringify(undo)})`),
        '2026-10-01,08:30,17:15,7.75,0.00,,,,,1\n2026-10-02,08:30,17:15,7.75,0.00');
});

test('集計：範囲は両端を含み、浮動小数の誤差で -0.00 にならない', () => {
    const logs = [
        '2026-09-30,08:30,17:15,9.00,1.25',
        '2026-10-01,08:30,17:15,7.75,0.00',
        '2026-10-02,08:30,17:10,7.70,-0.05',
        '2026-10-05,08:30,17:20,7.85,0.10',
        '2026-10-31,08:30,17:10,7.70,-0.05',
        '2026-11-01,08:30,17:15,9.00,1.25',
    ].join('\n');
    const summary = run(`summarizeLogRows(selectLogRows(${JSON.stringify(logs)}, '2026-10-01', '2026-10-31'))`);
    assert.strictEqual(summary.days, 4);
    assert.strictEqual(summary.hours, '31.00');
    assert.strictEqual(summary.overtime, '0.00');
});

test('CSV：BOM付きで、見出しとデータの列の数がそろい、日付順で同じ日付は1行', () => {
    const logs = '2026-10-02,08:30,17:15,7.75,0.00\n2026-10-01,08:30,18:15,8.75,1.00,,,,,1\n2026-10-02,08:30,17:45,8.25,0.50';
    const csv = run(`buildLogsCsv(selectLogRows(${JSON.stringify(logs)}))`);
    assert.ok(csv.startsWith('﻿'));
    const lines = csv.slice(1).trim().split('\r\n');
    const columns = lines[0].split(',').length;
    lines.forEach(line => assert.strictEqual(line.split(',').length, columns, line));
    assert.strictEqual(lines[1].split(',')[0], '2026-10-01');
    assert.strictEqual(lines[2], '2026-10-02,08:30,17:45,8.25,0.50,,,,,');
    assert.strictEqual(lines[3], 'Total,,,17.00,1.50,,,,,');
});

test('バックアップ：文字列でない値を含むファイルは受け付けない', () => {
    assert.strictEqual(run("isValidBackup({ app: 'sumakin', format: 1, data: { logs: null } })"), false);
    assert.strictEqual(run("isValidBackup({ app: 'sumakin', format: 1, data: { logs: 3 } })"), false);
    assert.strictEqual(run("isValidBackup({ app: 'sumakin', format: 1, data: { logs: '' } })"), true);
});

test('バックアップ：復元は置き換えで、取り消すと元に戻る', () => {
    storage.setItem('logs', '2026-10-01,08:30,17:15,7.75,0.00');
    storage.setItem('email', 'now@example.com');
    run("restoreBackup({ app: 'sumakin', format: 1, data: { email: 'old@example.com' } })");
    assert.strictEqual(storage.getItem('logs'), null);
    assert.strictEqual(storage.getItem('email'), 'old@example.com');
    assert.strictEqual(storage.getItem('logs_undo'), '2026-10-01,08:30,17:15,7.75,0.00');
    assert.strictEqual(run('undoRestore()'), true);
    assert.strictEqual(storage.getItem('logs'), '2026-10-01,08:30,17:15,7.75,0.00');
    assert.strictEqual(storage.getItem('email'), 'now@example.com');
    assert.strictEqual(storage.getItem('restore_undo'), null);
});

test('バックアップ：復元のあとにログを書き換えたら、復元は取り消せない', () => {
    storage.setItem('logs', '2026-10-01,08:30,17:15,7.75,0.00');
    run("restoreBackup({ app: 'sumakin', format: 1, data: {} })");
    assert.ok(run('getRestoreUndoTime()'));
    run("writeLogs('2026-10-02,08:30,17:15,7.75,0.00')");
    assert.strictEqual(run('getRestoreUndoTime()'), null);
    assert.strictEqual(run('undoRestore()'), false);
});

test('日付：古いメール本文の記録（日時の文字列）でも、日付を表示できる', () => {
    assert.ok(!run("formatDateWithDay('2024-01-15T09:00:00.000Z')").includes('NaN'));
});

test('日付：UTCより西の時間帯でも曜日がずれない', () => {
    const saved = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
        assert.strictEqual(run("formatDateWithDay('2026-10-14', new Date(2026, 0, 1))"), '10/14(水)');
    } finally {
        process.env.TZ = saved;
    }
});

test('日付：今年の日付は年を省き、ほかの年の日付は年を付ける（どの画面も同じ書き方）', () => {
    assert.strictEqual(run("formatDateWithDay('2026-10-01', new Date(2026, 5, 1))"), '10/1(木)');
    assert.strictEqual(run("formatDateWithDay('2025-12-26', new Date(2026, 0, 5))"), '2025/12/26(金)');
});

test('時刻：先頭の0を省き、時刻でないもの（年休など）はそのまま出す', () => {
    assert.strictEqual(run("formatTime('08:30')"), '8:30');
    assert.strictEqual(run("formatTime('18:00')"), '18:00');
    assert.strictEqual(run("formatTime('00:15')"), '0:15');
    assert.strictEqual(run("formatTime('年休')"), '年休');
    assert.strictEqual(run("formatTime('')"), '');
});

test('残業：プラスのときだけ「+」を付ける（0とマイナスはそのまま）', () => {
    assert.strictEqual(run("formatSignedHours('1.25')"), '+1.25');
    assert.strictEqual(run("formatSignedHours('0.00')"), '0.00');
    assert.strictEqual(run("formatSignedHours('-0.50')"), '-0.50');
});

test('日時：バックアップの日時も、日付と時刻と同じ書き方で出す', () => {
    assert.strictEqual(run("formatDateTime(new Date(2026, 9, 15, 9, 5), new Date(2026, 9, 16))"), '10/15(木) 9:05');
    assert.strictEqual(run("formatDateTime(new Date(2025, 11, 26, 18, 30), new Date(2026, 0, 5))"), '2025/12/26(金) 18:30');
});

test('祝日：振替休日と国民の休日も見分け、土日は休みとして扱う', () => {
    assert.strictEqual(run('getHolidayName(new Date(2026, 10, 3))'), '文化の日');
    assert.strictEqual(run('getHolidayName(new Date(2026, 4, 6))'), '振替休日');
    assert.strictEqual(run('getHolidayName(new Date(2026, 8, 22))'), '国民の休日');
    assert.strictEqual(run('getHolidayName(new Date(2026, 9, 16))'), '');
    assert.strictEqual(run('isHolidayDate(new Date(2026, 9, 17))'), true);
    assert.strictEqual(run('isHolidayDate(new Date(2026, 9, 16))'), false);
});

test('書き出し：保存を始めた直後には片付けず、時間をおいて片付ける（Androidで保存が失敗しないように）', () => {
    const events = [];
    const timers = [];
    context.document = {
        createElement: () => ({
            click() {
                events.push(`click:${this.href}:${this.download}`);
            },
        }),
    };
    context.URL = {
        createObjectURL: () => 'blob:test',
        revokeObjectURL: url => events.push(`revoke:${url}`),
    };
    context.setTimeout = (fn, ms) => timers.push({ fn, ms });
    try {
        run("downloadFile({}, 'logs.csv')");
        assert.deepStrictEqual(events, ['click:blob:test:logs.csv']);
        assert.strictEqual(timers.length, 1);
        assert.ok(timers[0].ms >= 10000, `片付けまでの時間が短い（${timers[0].ms}ミリ秒）`);
        timers[0].fn();
        assert.deepStrictEqual(events, ['click:blob:test:logs.csv', 'revoke:blob:test']);
    } finally {
        delete context.document;
        delete context.URL;
        delete context.setTimeout;
    }
});

test('バージョン：index.html・manifest.json・common.js が同じ値', () => {
    const indexVersion = fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/ver\.([\d.]+)/)[1];
    const manifestVersion = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).version;
    assert.strictEqual(indexVersion, manifestVersion);
    assert.strictEqual(run('APP_VERSION'), manifestVersion);
});

test('オフライン：service-worker.js が取り込むファイルがすべてある', () => {
    const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
    const list = sw.match(/const PRECACHE_URLS = \[([\s\S]*?)\]/)[1];
    const files = [...list.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(f => f);
    assert.ok(files.length > 10);
    files.forEach(f => assert.ok(fs.existsSync(path.join(root, f)), `${f} がない`));
});

if (failed > 0) {
    console.log(`\n${failed}件のテストが失敗しました。`);
    process.exit(1);
}
console.log('\nAll tests passed.');
