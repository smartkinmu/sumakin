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
function fixNativeInputWidths(root) {
    const scope = root || document;
    const inputs = scope.querySelectorAll('input[type="date"], input[type="time"], input[type="month"]');
    inputs.forEach(input => {
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
