/**
 * 時刻文字列("HH:MM")を分単位の数値へ変換する。
 * @param {string} timeStr - HH:MM形式の時刻
 * @returns {number} 分単位の数値
 */
function toMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

/**
 * 保存された休憩時間を取得する。
 * @returns {{start:string,end:string}[]} 休憩時間リスト
 */
function getBreakTimes() {
    return [
        {
            start: localStorage.getItem('break1Start') || '12:00',
            end: localStorage.getItem('break1End') || '13:00'
        },
        {
            start: localStorage.getItem('break2Start') || '19:15',
            end: localStorage.getItem('break2End') || '19:45'
        }
    ];
}

/**
 * 勤務時間を計算する（設定済み休憩時間を差し引く）。
 * @param {string} startTime - 始業時刻 HH:MM
 * @param {string} endTime - 終業時刻 HH:MM
 * @returns {string} 勤務時間（小数点2桁の文字列）
 */
function calculateWorkingHours(startTime, endTime) {
    let totalMinutes = toMinutes(endTime) - toMinutes(startTime);
    const breaks = getBreakTimes();
    const workStart = toMinutes(startTime);
    const workEnd = toMinutes(endTime);
    breaks.forEach(b => {
        const breakStart = toMinutes(b.start);
        const breakEnd = toMinutes(b.end);
        if (workStart < breakEnd && workEnd > breakStart) {
            const overlapStart = Math.max(workStart, breakStart);
            const overlapEnd = Math.min(workEnd, breakEnd);
            totalMinutes -= overlapEnd - overlapStart;
        }
    });
    const workingHours = totalMinutes / 60;
    return (Math.round(workingHours * 100) / 100).toFixed(2);
}

/**
 * 2時刻間の純粋な経過時間を返す（休憩差し引きなし）。
 * 中断時間の長さ表示などに使用する。
 * @param {string} startTime - 開始時刻 HH:MM
 * @param {string} endTime - 終了時刻 HH:MM
 * @returns {string} 経過時間（小数点2桁の文字列）
 */
function durationHours(startTime, endTime) {
    return ((toMinutes(endTime) - toMinutes(startTime)) / 60).toFixed(2);
}

/**
 * ログが存在しない、または0バイトのときにバックアップから復元する。
 * @returns {string|null} ログデータ
 */
function restoreLogsIfNeeded() {
    let data = localStorage.getItem('logs');
    if (!data) {
        const backup = localStorage.getItem('logs_backup');
        if (backup) {
            localStorage.setItem('logs', backup);
            data = backup;
            alert('ログファイルを復元しました。');
        }
    }
    return data;
}

/**
 * CSVまたはメール本文の行を解析し標準化する。
 * @param {string} line - ログの1行
 * @returns {string|null} 解析結果（CSV形式）、解析不可の場合はnull
 */
function parseLogLine(line) {
    const simple = line.split(',');
    if (simple.length >= 5 && /^\d{4}-\d{2}-\d{2}$/.test(simple[0])) {
        return line;
    }
    const parts = line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
    if (parts.length >= 4 && /^\d{4}-\d{2}-\d{2}T/.test(parts[0])) {
        const body = parts[3].replace(/^"|"$/g, '').replace(/""/g, '"');
        const date = body.match(/日付\s*(\d{4}-\d{2}-\d{2})/);
        const start = body.match(/始業\s*(\d{2}:\d{2})/);
        const end = body.match(/終業\s*(\d{2}:\d{2})/);
        if (date && start && end) {
            const work = calculateWorkingHours(start[1], end[1]);
            const overtime = (parseFloat(work) - 7.75).toFixed(2);
            return `${date[1]},${start[1]},${end[1]},${work},${overtime}`;
        }
    }
    return null;
}

/**
 * 日付文字列を曜日付きの表示形式に変換する。
 * @param {string} dateStr - YYYY-MM-DD形式の日付
 * @returns {string} 例: "2024-1-15(月)"
 */
function formatDateWithDay(dateStr) {
    const d = new Date(dateStr);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}(${days[d.getDay()]})`;
}

/**
 * date/time/month入力欄の実際のpx幅を親要素から測定し、明示的に指定する。
 * SafariはこれらのネイティブUIに対してwidth:100%(パーセンテージ)の
 * 解決計算が崩れ、親要素の幅を無視して描画されることがあるため、
 * CSSのパーセンテージ指定に頼らずJSで測定したpx値を直接指定して回避する。
 * @param {ParentNode} [root=document] - 対象範囲のルート要素
 * @returns {void}
 */
/**
 * ログ1行(CSV形式)を確認ダイアログ表示用の短い文字列に変換する。
 * @param {string} line - "date,start,end,..."形式のログ1行
 * @returns {string} 例: "2024-1-15(月) 08:30〜17:15"
 */
function formatLogLineForPreview(line) {
    const [date, start, end] = line.split(',');
    return `${formatDateWithDay(date)} ${start}〜${end}`;
}

/**
 * ログ全体(改行区切りのCSV文字列)を日付をキーとしたMapに変換する。
 * @param {string} logsStr - ログ全体の文字列（nullや空文字も可）
 * @returns {Map<string, string>} 日付をキーとしたログ行のMap
 */
function parseLogsToMap(logsStr) {
    const map = new Map();
    if (!logsStr) return map;
    logsStr.split('\n').filter(line => line).forEach(line => {
        const date = line.split(',')[0];
        map.set(date, line);
    });
    return map;
}

/**
 * UNDO実行前に、現在のログと復元後のログを比較して変更内容の一覧を作る。
 * @param {string} currentLogsStr - 現在のログ(実行前)
 * @param {string} backupLogsStr - UNDOで復元されるログ
 * @returns {string[]} 変更内容を表す文字列の配列（変更がなければ空配列）
 */
function buildUndoPreview(currentLogsStr, backupLogsStr) {
    const currentMap = parseLogsToMap(currentLogsStr);
    const backupMap = parseLogsToMap(backupLogsStr);
    const changes = [];
    currentMap.forEach((line, date) => {
        if (!backupMap.has(date)) {
            changes.push(`${formatLogLineForPreview(line)} → 削除されます`);
        } else if (backupMap.get(date) !== line) {
            changes.push(`${formatLogLineForPreview(line)} → ${formatLogLineForPreview(backupMap.get(date))} に戻ります`);
        }
    });
    backupMap.forEach((line, date) => {
        if (!currentMap.has(date)) {
            changes.push(`${formatLogLineForPreview(line)} が復元されます`);
        }
    });
    return changes;
}

/**
 * キャッシュを全て削除し、最新のファイルを取得し直してページを再読み込みする。
 * 「更新」ボタンと画面を下に引く操作（pull-to-refresh）で共通に使用する。
 * @returns {Promise<void>}
 */
async function refreshApp() {
    const indicator = document.getElementById('refresh-indicator');
    if (indicator) {
        indicator.style.display = 'block';
    }
    // 他タブのログ画面にも更新を通知する
    localStorage.setItem('refreshLogs', Date.now().toString());
    if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ action: 'sync' });
        const reg = await navigator.serviceWorker.getRegistration();
        reg?.update();
    }
    setTimeout(() => location.reload(), 1500);
}

/**
 * 画面上端から下に引いたときに refreshApp() を実行する。
 * @returns {void}
 */
function setupPullToRefresh() {
    let startY = null;
    let triggered = false;
    window.addEventListener('touchstart', event => {
        startY = window.scrollY === 0 ? event.touches[0].pageY : null;
    });
    window.addEventListener('touchmove', event => {
        if (startY === null || triggered) return;
        if (window.scrollY === 0 && event.touches[0].pageY > startY + 50) {
            triggered = true;
            refreshApp();
        }
    });
    window.addEventListener('touchend', () => {
        startY = null;
    });
}

function fixNativeInputWidths(root) {
    const scope = root || document;
    const inputs = scope.querySelectorAll('input[type="date"], input[type="time"], input[type="month"]');
    inputs.forEach(input => {
        // 文字サイズ変更でレイアウト幅が変わるため、一度解除してから測り直す
        input.style.width = '';
        const container = input.parentElement;
        if (!container) return;
        const style = getComputedStyle(container);
        const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const width = container.clientWidth - paddingX;
        if (width > 0) {
            input.style.width = width + 'px';
        }
    });
}
