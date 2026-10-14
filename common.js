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
 * アプリのバージョン。index.html の表示と manifest.json の "version" と同じ値にする
 * （test/test.js で一致を確認している）。バックアップファイルに記録する。
 */
const APP_VERSION = '1.17.8';

/**
 * "YYYY-MM-DD" を端末の時間帯の0時として Date にする。
 * new Date("YYYY-MM-DD") はUTCの0時として読まれ、UTCより西の時間帯では
 * 前日になってしまうため、日付だけの文字列はこの関数で読む。
 * @param {string} dateStr - YYYY-MM-DD形式の日付
 * @returns {Date} その日の0時（端末の時間帯）
 */
function parseDateLocal(dateStr) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
    if (!match) {
        // 古いメール本文の記録などは、日時の文字列のまま読む
        return new Date(dateStr);
    }
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * 時間(100進数)の文字列を、小数2桁の整数（1.25時間なら125）にする。
 * 合計を浮動小数のまま足すと誤差で「-0.00」などが出るため、整数で足す。
 * @param {string|number} value - 時間
 * @returns {number} 100倍した整数（数値でなければ0）
 */
function toHundredths(value) {
    return Math.round((parseFloat(value) || 0) * 100);
}

/**
 * 小数2桁の整数（toHundredths の値）を、小数2桁の文字列に戻す。
 * @param {number} hundredths - 100倍した整数
 * @returns {string} 例: 125 → "1.25"、-0 → "0.00"
 */
function fromHundredths(hundredths) {
    return ((hundredths || 0) / 100).toFixed(2);
}

/**
 * 分単位の時間を、時間(100進数)の小数2桁の文字列にする。丸めはこの1回だけにする。
 * @param {number} minutes - 分
 * @returns {string} 時間（小数点2桁の文字列）
 */
function minutesToHoursString(minutes) {
    return (Math.round(minutes / 60 * 100) / 100).toFixed(2);
}

/**
 * 勤務時間の中にある範囲（休憩・中断）の長さを、重なりを1回にまとめて合計する。
 * 勤務時間の外にはみ出した部分は数えない。
 * @param {number} workStart - 始業(分)
 * @param {number} workEnd - 終業(分)
 * @param {{s:number,e:number}[]} ranges - 範囲(分)の配列
 * @returns {number} 差し引く分数
 */
function mergedMinutesWithin(workStart, workEnd, ranges) {
    const clipped = [];
    ranges.forEach(r => {
        const s = Math.max(workStart, r.s);
        const e = Math.min(workEnd, r.e);
        // 勤務時間の外にある範囲は、切り詰めると長さが0以下になるので除く
        if (s < e) clipped.push({ s, e });
    });
    clipped.sort((a, b) => a.s - b.s);
    let total = 0;
    let curStart = null;
    let curEnd = null;
    clipped.forEach(r => {
        if (curStart === null) {
            curStart = r.s;
            curEnd = r.e;
        } else if (r.s <= curEnd) {
            curEnd = Math.max(curEnd, r.e);
        } else {
            total += curEnd - curStart;
            curStart = r.s;
            curEnd = r.e;
        }
    });
    if (curStart !== null) {
        total += curEnd - curStart;
    }
    return total;
}

/**
 * 設定済みの休憩時間を、分単位の範囲の配列にする。
 * @returns {{s:number,e:number}[]} 休憩の範囲
 */
function getBreakRanges() {
    return getBreakTimes().map(b => ({ s: toMinutes(b.start), e: toMinutes(b.end) }));
}

/**
 * 中断時間の組を、分単位の範囲の配列にする。開始・終了がそろわないもの、
 * 開始が終了より後のものは除く。
 * @param {string[]} times - [中断開始1, 中断終了1, 中断開始2, 中断終了2]
 * @returns {{s:number,e:number}[]} 中断の範囲
 */
function toInterruptRanges(times) {
    const ranges = [];
    for (let i = 0; i + 1 < times.length; i += 2) {
        const s = times[i];
        const e = times[i + 1];
        if (!s || !e) continue;
        if (toMinutes(s) < toMinutes(e)) {
            ranges.push({ s: toMinutes(s), e: toMinutes(e) });
        }
    }
    return ranges;
}

/**
 * 勤務時間を分単位で求める。休憩時間と中断時間を、重なりを1回にまとめて差し引く。
 * @param {string} start - 始業時刻 HH:MM
 * @param {string} end - 終業時刻 HH:MM
 * @param {string} [b1s] - 中断開始(1)
 * @param {string} [b1e] - 中断終了(1)
 * @param {string} [b2s] - 中断開始(2)
 * @param {string} [b2e] - 中断終了(2)
 * @returns {number} 勤務時間(分)
 */
function calculateWorkingMinutes(start, end, b1s, b1e, b2s, b2e) {
    const workStart = toMinutes(start);
    const workEnd = toMinutes(end);
    const ranges = getBreakRanges().concat(toInterruptRanges([b1s, b1e, b2s, b2e]));
    return workEnd - workStart - mergedMinutesWithin(workStart, workEnd, ranges);
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
    return minutesToHoursString(calculateWorkingMinutes(startTime, endTime));
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
 * 標準休憩時間と中断時間が重なっていても二重に差し引かないよう、
 * 両方をまとめた上で重なりを1回にまとめてから勤務時間を計算する。
 * 半休の加算は加味しない（ログの記録からは半休の有無が分からないため）。
 * @param {string} start - 始業時刻 HH:MM
 * @param {string} end - 終業時刻 HH:MM
 * @param {string} [b1s] - 中断開始(1)
 * @param {string} [b1e] - 中断終了(1)
 * @param {string} [b2s] - 中断開始(2)
 * @param {string} [b2e] - 中断終了(2)
 * @returns {string} 勤務時間（小数点2桁の文字列）
 */
function calculateWorkingHoursExact(start, end, b1s, b1e, b2s, b2e) {
    return minutesToHoursString(calculateWorkingMinutes(start, end, b1s, b1e, b2s, b2e));
}

/**
 * 中断時間が標準休憩時間と重なっていても二重に差し引いてしまう、
 * 修正前のバグと同じ計算式で勤務時間を求める。
 * 保存済みログがこの式と一致するかどうかで、当時バグの影響を受けて
 * 保存されたものかどうかを判定するために使う。
 * 当時の式を再現するため、休憩時間を休憩ごとに引いて小数2桁に丸め、
 * そこから中断時間を引く（丸めが2回ある）。
 * @param {string} start - 始業時刻 HH:MM
 * @param {string} end - 終業時刻 HH:MM
 * @param {string} [b1s] - 中断開始(1)
 * @param {string} [b1e] - 中断終了(1)
 * @param {string} [b2s] - 中断開始(2)
 * @param {string} [b2e] - 中断終了(2)
 * @returns {string} 勤務時間（小数点2桁の文字列）
 */
function calculateWorkingHoursDoubleCounted(start, end, b1s, b1e, b2s, b2e) {
    let interruptMinutes = 0;
    [[b1s, b1e], [b2s, b2e]].forEach(([s, e]) => {
        if (s && e && toMinutes(e) > toMinutes(s)) {
            interruptMinutes += toMinutes(e) - toMinutes(s);
        }
    });
    const workStart = toMinutes(start);
    const workEnd = toMinutes(end);
    let grossMinutes = workEnd - workStart;
    getBreakRanges().forEach(b => {
        if (workStart < b.e && workEnd > b.s) {
            grossMinutes -= Math.min(workEnd, b.e) - Math.max(workStart, b.s);
        }
    });
    const gross = Math.round(grossMinutes / 60 * 100) / 100;
    return (gross - interruptMinutes / 60).toFixed(2);
}

/**
 * ログ1行の勤務時間・残業時間に、標準休憩時間と中断時間の重複による
 * 二重差し引きの誤りがないか確認し、あれば修正した行を返す。
 * 半休が適用された行は、保存されている勤務時間が
 * calculateWorkingHoursDoubleCounted() の結果と一致しないため、
 * 誤って修正しないよう自動的に対象から外れる。
 * @param {string} line - ログ1行(CSV形式)
 * @returns {{line: string, oldWork: string, newWork: string, oldOvertime: string, newOvertime: string}|null}
 *          修正が必要なければ null
 */
function findLogCalculationFix(line) {
    const parts = line.split(',');
    const [date, start, end, work] = parts;
    if (!date || !start || !end || start === '年休') return null;
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
    const [b1s, b1e, b2s, b2e] = [parts[5] || '', parts[6] || '', parts[7] || '', parts[8] || ''];
    const doubleCounted = calculateWorkingHoursDoubleCounted(start, end, b1s, b1e, b2s, b2e);
    // 保存値がこの式と一致しない場合は、半休加算など他の要因が絡んでいる可能性があり
    // 正しく判定できないため、対象から外す（触らない）
    if (doubleCounted !== work) return null;
    // 二重に引かれた分（中断時間のうち、休憩と重なる部分と勤務時間の外にはみ出した部分）。
    // これが無い行は、丸めの違いで値がわずかに異なるだけなので直さない
    const interrupts = toInterruptRanges([b1s, b1e, b2s, b2e]);
    const interruptTotal = interrupts.reduce((sum, r) => sum + (r.e - r.s), 0);
    const workStart = toMinutes(start);
    const workEnd = toMinutes(end);
    const breaks = getBreakRanges();
    const extraMinutes = interruptTotal
        - (mergedMinutesWithin(workStart, workEnd, breaks.concat(interrupts))
            - mergedMinutesWithin(workStart, workEnd, breaks));
    if (extraMinutes <= 0) return null;
    const correct = calculateWorkingHoursExact(start, end, b1s, b1e, b2s, b2e);
    if (correct === work) return null;
    // ずれが二重に引かれた分と合わない行は、別の理由によるものなので直さない（丸めの差は1分まで許す）
    const diffMinutes = (parseFloat(correct) - parseFloat(work)) * 60;
    if (Math.abs(diffMinutes - extraMinutes) > 1) return null;
    const oldOvertime = parts[4] || '';
    const newOvertime = (parseFloat(correct) - 7.75).toFixed(2);
    const newParts = parts.slice();
    newParts[3] = correct;
    newParts[4] = newOvertime;
    return {
        line: newParts.join(','),
        oldWork: work,
        newWork: correct,
        oldOvertime,
        newOvertime,
    };
}

/**
 * ログ全体(改行区切りのCSV文字列)を検査し、標準休憩時間と中断時間の
 * 重複による二重差し引きの誤りを修正する。
 * @param {string} logsStr - ログ全体の文字列(nullや空文字も可)
 * @returns {{fixed: string, changes: {date: string, oldWork: string, newWork: string, oldOvertime: string, newOvertime: string}[]}}
 */
function fixLogsCalculations(logsStr) {
    if (!logsStr) return { fixed: logsStr, changes: [] };
    const changes = [];
    const lines = logsStr.split('\n').map(line => {
        if (!line) return line;
        const fix = findLogCalculationFix(line);
        if (!fix) return line;
        changes.push({
            date: line.split(',')[0],
            oldWork: fix.oldWork,
            newWork: fix.newWork,
            oldOvertime: fix.oldOvertime,
            newOvertime: fix.newOvertime,
        });
        return fix.line;
    });
    return { fixed: lines.join('\n'), changes };
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
 * ログをすべて消す。消す前の内容は logs_undo に入れ、UNDOで戻せるようにする。
 * logs_backup も消す（残すと restoreLogsIfNeeded() がすぐ書き戻してしまうため）。
 * @returns {void}
 */
function clearAllLogs() {
    localStorage.setItem('logs_undo',
        localStorage.getItem('logs') || localStorage.getItem('logs_backup') || '');
    forgetRestoreUndo();
    localStorage.removeItem('logs');
    localStorage.removeItem('logs_backup');
}

/**
 * ログ全体をまとめて書き換える。空なら logs と logs_backup の両方を消す。
 * @param {string} updated - 新しいログ全体の文字列
 * @returns {void}
 */
function writeLogs(updated) {
    forgetRestoreUndo();
    if (updated) {
        localStorage.setItem('logs', updated);
        localStorage.setItem('logs_backup', updated);
    } else {
        localStorage.removeItem('logs');
        localStorage.removeItem('logs_backup');
    }
}

/**
 * 保存されている勤務時間が、AM休・PM休で足した分を含んでいるなら、その分(分)を返す。
 * 保存値と計算値の差が、今の昼休みの設定でのAM休・PM休の分と合う（±1分）ときだけ半休とみなす
 * （丸めの違いや休憩の設定を変えたことによる差を、半休と取り違えないため）。
 * @param {string} work - 保存されている勤務時間
 * @param {string} start - 始業 HH:MM
 * @param {string} end - 終業 HH:MM
 * @param {string} b1s - 中断開始(1)
 * @param {string} b1e - 中断終了(1)
 * @param {string} b2s - 中断開始(2)
 * @param {string} b2e - 中断終了(2)
 * @returns {number} 半休で足した分(分)。半休でなければ0
 */
function findHalfDayLeaveMinutes(work, start, end, b1s, b1e, b2s, b2e) {
    return detectHalfDayLeave(work, start, end, b1s, b1e, b2s, b2e).minutes;
}

/**
 * 保存されている勤務時間から、AM休・PM休のどちらだったかを見分ける。
 * 考え方は findHalfDayLeaveMinutes() と同じ。
 * @param {string} work - 保存されている勤務時間
 * @param {string} start - 始業 HH:MM
 * @param {string} end - 終業 HH:MM
 * @param {string} b1s - 中断開始(1)
 * @param {string} b1e - 中断終了(1)
 * @param {string} b2s - 中断開始(2)
 * @param {string} b2e - 中断終了(2)
 * @returns {{type: string, minutes: number}} type は 'am'・'pm'・''（半休でない）
 */
function detectHalfDayLeave(work, start, end, b1s, b1e, b2s, b2e) {
    const diffMinutes = (toHundredths(work)
        - toHundredths(calculateWorkingHoursExact(start, end, b1s, b1e, b2s, b2e))) * 60 / 100;
    const lunch = getBreakTimes()[0];
    const candidates = [
        { type: 'am', minutes: calculateWorkingMinutes('08:30', lunch.start) },
        { type: 'pm', minutes: calculateWorkingMinutes(lunch.end, '17:15') },
    ];
    const match = candidates.find(c => c.minutes > 0 && Math.abs(diffMinutes - c.minutes) <= 1);
    return match || { type: '', minutes: 0 };
}

/**
 * ログ1行の日付・始業・終業を編集した結果を作る。
 * - 日付を、ほかに記録がある日に変えることはできない（同じ日付の行が2つになるため）
 * - 時刻を変えていなければ、勤務時間・残業時間はそのまま残す（年休・半休の記録を崩さない）
 * - 時刻を変えたときは計算し直す。半休で足していた分は引き継ぐ（findHalfDayLeaveMinutes）
 * @param {string} logsStr - ログ全体の文字列
 * @param {string} oldDate - 編集する行の日付
 * @param {string} newDate - 新しい日付
 * @param {string} start - 新しい始業 HH:MM
 * @param {string} end - 新しい終業 HH:MM
 * @returns {{error: string}|{updated: string, changed: boolean}} 失敗した理由、または編集後のログ全体
 */
function editLogLine(logsStr, oldDate, newDate, start, end) {
    const lines = (logsStr || '').split('\n').filter(line => line);
    const index = lines.findIndex(line => line.split(',')[0] === oldDate);
    if (index === -1) {
        return { error: '指定した日付のデータはありません' };
    }
    if (newDate !== oldDate && lines.some(line => line.split(',')[0] === newDate)) {
        return { error: `${newDate} のログは既にあります。先にそちらを削除するか、別の日付にしてください` };
    }
    const kept = lines[index].split(',');
    while (kept.length <= MAILED_INDEX) {
        kept.push('');
    }
    const [, oldStart, oldEnd, oldWork, oldOvertime, b1s, b1e, b2s, b2e] = kept;
    const isAnnualLeave = oldStart === '年休';
    // 年休の行は、編集画面に 08:30〜17:15 を出している。そのままなら年休のまま残す
    const timesUnchanged = isAnnualLeave
        ? (start === '08:30' && end === '17:15')
        : (start === oldStart && end === oldEnd);
    let next;
    if (timesUnchanged) {
        next = kept.slice();
        next[0] = newDate;
    } else {
        let workMinutes = calculateWorkingMinutes(start, end, b1s, b1e, b2s, b2e);
        if (!isAnnualLeave && /^\d{2}:\d{2}$/.test(oldStart) && /^\d{2}:\d{2}$/.test(oldEnd)) {
            workMinutes += findHalfDayLeaveMinutes(oldWork, oldStart, oldEnd, b1s, b1e, b2s, b2e);
        }
        const work = minutesToHoursString(workMinutes);
        const overtime = fromHundredths(toHundredths(work) - 775);
        next = [newDate, start, end, work, overtime, b1s, b1e, b2s, b2e, kept[MAILED_INDEX]];
    }
    const newLine = next.join(',');
    // 古い行は項目が少ないことがあるため、足りない項目を補った形で比べる
    if (newLine === kept.join(',')) {
        return { updated: lines.join('\n'), changed: false };
    }
    lines[index] = newLine;
    return { updated: lines.join('\n'), changed: true };
}

/**
 * UNDOで戻すログを作る。メール作成済みの印は、戻したあとも残す
 * （メールを作ったことは取り消せないため、印だけが消えないようにする）。
 * @param {string} currentLogsStr - 今のログ
 * @param {string} undoLogsStr - 戻す先のログ
 * @returns {string} 戻したあとのログ
 */
function buildUndoLogs(currentLogsStr, undoLogsStr) {
    if (!undoLogsStr) return '';
    const mailedDates = new Set();
    parseLogsToMap(currentLogsStr).forEach((line, date) => {
        if (line.split(',')[MAILED_INDEX] === '1') mailedDates.add(date);
    });
    return undoLogsStr.split('\n').map(line => {
        if (!line) return line;
        const parts = line.split(',');
        if (!mailedDates.has(parts[0]) || parts[MAILED_INDEX] === '1') return line;
        while (parts.length <= MAILED_INDEX) {
            parts.push('');
        }
        parts[MAILED_INDEX] = '1';
        return parts.join(',');
    }).join('\n');
}

/**
 * 日付の範囲に入るログを、日付ごとに1件（同じ日付が複数あれば後の行）にして日付順に返す。
 * @param {string} logsStr - ログ全体の文字列
 * @param {string} [startDate] - 開始日 YYYY-MM-DD（含む）。省略すると制限しない
 * @param {string} [endDate] - 終了日 YYYY-MM-DD（含む）。省略すると制限しない
 * @returns {string[][]} 各行を項目に分けた配列（日付順）
 */
function selectLogRows(logsStr, startDate, endDate) {
    const map = parseLogsToMap(logsStr);
    return [...map.keys()]
        .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .filter(date => (!startDate || date >= startDate) && (!endDate || date <= endDate))
        .sort()
        .map(date => map.get(date).split(','));
}

/**
 * ログの行から、勤務日数・合計時間・残業時間を求める。
 * 残業は「合計時間 − 勤務日数 × 7.75」とする。
 * @param {string[][]} rows - selectLogRows() の結果
 * @returns {{days: number, hours: string, overtime: string}} 集計結果
 */
function summarizeLogRows(rows) {
    const total = rows.reduce((sum, parts) => sum + toHundredths(parts[3]), 0);
    return {
        days: rows.length,
        hours: fromHundredths(total),
        overtime: fromHundredths(total - rows.length * 775),
    };
}

/** CSVの見出し。ログ1行の項目の並びと合わせる */
const CSV_HEADER = 'Date,Start,End,Work Hours,Overtime,Break1 Start,Break1 End,Break2 Start,Break2 End,Mailed';

/**
 * ログの行からCSVの文字列を作る。Excelで文字化けしないよう先頭にBOMを付ける。
 * 最後の行に勤務時間・残業時間の合計を付ける。
 * @param {string[][]} rows - selectLogRows() の結果
 * @returns {string} CSVの文字列
 */
function buildLogsCsv(rows) {
    const lines = rows.map(parts => {
        const filled = parts.slice(0, MAILED_INDEX + 1);
        while (filled.length <= MAILED_INDEX) {
            filled.push('');
        }
        return filled.join(',');
    });
    const totalWork = rows.reduce((sum, parts) => sum + toHundredths(parts[3]), 0);
    const totalOvertime = rows.reduce((sum, parts) => sum + toHundredths(parts[4]), 0);
    lines.push(`Total,,,${fromHundredths(totalWork)},${fromHundredths(totalOvertime)},,,,,`);
    return '﻿' + CSV_HEADER + '\r\n' + lines.join('\r\n') + '\r\n';
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
    const d = parseDateLocal(dateStr);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}(${days[d.getDay()]})`;
}

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
 * サービスワーカーに、キャッシュしているファイルを最新のものに取り替えてもらう。
 * 取り替えが終わるか、時間切れになるまで待つ。
 * @param {ServiceWorker} worker - 今このページを制御しているサービスワーカー
 * @returns {Promise<boolean>} 取り替えられたら true
 */
function requestCacheRefresh(worker) {
    return new Promise(resolve => {
        const channel = new MessageChannel();
        // 回線が遅くても途中で失敗と言わないよう、長めに待つ
        const timer = setTimeout(() => resolve(false), 30000);
        channel.port1.onmessage = event => {
            clearTimeout(timer);
            resolve(!!(event.data && event.data.ok));
        };
        worker.postMessage({ action: 'refresh' }, [channel.port2]);
    });
}

/**
 * 最新のファイルを取得し直してページを再読み込みする。
 * 「更新」ボタンと画面を下に引く操作（pull-to-refresh）で共通に使用する。
 * キャッシュは先に消さず、最新のファイルがそろったときだけ取り替える
 * （オフラインや取得の失敗でキャッシュが空になり、アプリが開けなくなるのを防ぐ）。
 * @returns {Promise<void>}
 */
async function refreshApp() {
    if (navigator.onLine === false) {
        alert('オフラインのため更新できません。電波のある所でもう一度お試しください。');
        return;
    }
    const indicator = document.getElementById('refresh-indicator');
    if (indicator) {
        indicator.style.display = 'block';
    }
    if (navigator.serviceWorker?.controller) {
        const ok = await requestCacheRefresh(navigator.serviceWorker.controller);
        if (!ok) {
            if (indicator) {
                indicator.style.display = 'none';
            }
            alert('最新版を取得できませんでした。電波のある所でもう一度お試しください。');
            return;
        }
        const reg = await navigator.serviceWorker.getRegistration();
        reg?.update();
    }
    // 他タブのログ画面にも更新を通知する（最新版を取り込めたときだけ）
    localStorage.setItem('refreshLogs', Date.now().toString());
    location.reload();
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
        // 更新できなかったとき（オフラインなど）に、もう一度引けるようにする
        triggered = false;
    });
}

/**
 * メールアドレスとして成立する形式か確認する。
 * 実在するかまでは判定できないため、明らかな誤りを弾く程度に留める。
 * @param {string} value - 確認する文字列
 * @returns {boolean} 形式が正しければ true
 */
function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * ログ1行(CSV)の項目位置。
 * 日付,始業,終業,勤務時間,残業時間,中断開始1,中断終了1,中断開始2,中断終了2,メール作成済み
 * 最後のメール作成済み項目は後から追加したため、古いログでは存在しない（未作成として扱う）。
 */
const MAILED_INDEX = 9;

/**
 * 指定日のログに「メール作成済み」の記録を付ける。
 * 対象日のログが無い場合は何もしない（メール作成はログを登録しないため）。
 * UNDO用の logs_undo は書き換えない。表示上の目印であり、
 * 直前の登録・削除を元に戻すための記録を潰さないようにするため。
 * @param {string} date - YYYY-MM-DD形式の日付
 * @returns {void}
 */
function markLogAsMailed(date) {
    const existing = localStorage.getItem('logs');
    if (!existing) return;
    const lines = existing.split('\n');
    const index = lines.findIndex(line => line.split(',')[0] === date);
    if (index === -1) return;
    const parts = lines[index].split(',');
    while (parts.length <= MAILED_INDEX) {
        parts.push('');
    }
    if (parts[MAILED_INDEX] === '1') return;
    parts[MAILED_INDEX] = '1';
    lines[index] = parts.join(',');
    const updated = lines.join('\n');
    localStorage.setItem('logs', updated);
    localStorage.setItem('logs_backup', updated);
}

/**
 * 指定日のログが「メール作成済み」かどうかを返す。
 * @param {string} date - YYYY-MM-DD形式の日付
 * @returns {boolean} メール作成済みなら true
 */
function isDateMailed(date) {
    if (!date) return false;
    const existing = localStorage.getItem('logs');
    if (!existing) return false;
    const line = existing.split('\n').find(l => l.split(',')[0] === date);
    return !!line && line.split(',')[MAILED_INDEX] === '1';
}

/** 日付ごとの入力内容（業務の内容など）を入れる localStorage のキー */
const LOG_DETAILS_KEY = 'log_details';

/**
 * 日付ごとの入力内容をすべて読み出す。
 * 中身は { "YYYY-MM-DD": { groupCount, leave, tasks: [{number, category, hours, title}] } }。
 * leave は 'am'・'pm'・'annual'・''。
 * @returns {Object<string, Object>} 日付をキーにした入力内容（読めなければ空）
 */
function loadLogDetails() {
    try {
        const details = JSON.parse(localStorage.getItem(LOG_DETAILS_KEY) || '{}');
        return details && typeof details === 'object' && !Array.isArray(details) ? details : {};
    } catch (error) {
        return {};
    }
}

/**
 * 日付ごとの入力内容を書き込む。ログにもUNDO用の控えにも無い日付の分は、
 * もう使わないので消す（削除をUNDOで戻したときにも使えるよう、控えにある分は残す）。
 * @param {Object<string, Object>} details - 日付をキーにした入力内容
 * @returns {void}
 */
function writeLogDetails(details) {
    const inUse = new Set([
        ...parseLogsToMap(localStorage.getItem('logs') || localStorage.getItem('logs_backup')).keys(),
        ...parseLogsToMap(localStorage.getItem('logs_undo')).keys(),
    ]);
    const kept = {};
    Object.keys(details).forEach(date => {
        if (inUse.has(date)) kept[date] = details[date];
    });
    localStorage.setItem(LOG_DETAILS_KEY, JSON.stringify(kept));
}

/**
 * 指定日の入力内容を保存する（ログを保存したあとに呼ぶ）。
 * @param {string} date - YYYY-MM-DD形式の日付
 * @param {Object} detail - 入力内容
 * @returns {void}
 */
function saveLogDetail(date, detail) {
    const details = loadLogDetails();
    details[date] = detail;
    writeLogDetails(details);
}

/**
 * 指定日の入力内容を返す。
 * @param {string} date - YYYY-MM-DD形式の日付
 * @returns {Object|null} 入力内容（保存されていなければ null）
 */
function getLogDetail(date) {
    const detail = loadLogDetails()[date];
    return detail && typeof detail === 'object' ? detail : null;
}

/**
 * ログの日付を変えたときに、入力内容も新しい日付へ移す。
 * @param {string} oldDate - 元の日付
 * @param {string} newDate - 新しい日付
 * @returns {void}
 */
function moveLogDetail(oldDate, newDate) {
    if (oldDate === newDate) return;
    const details = loadLogDetails();
    if (!details[oldDate]) return;
    details[newDate] = details[oldDate];
    delete details[oldDate];
    writeLogDetails(details);
}

/**
 * バックアップに含めない一時的なキー（他タブへの通知用、復元の取り消し用の控え）。
 * 復元のときも、これらのキーは消さず、ファイルの値で上書きもしない。
 */
const BACKUP_EXCLUDED_KEYS = ['refreshLogs', 'restore_undo'];

/**
 * localStorageの内容をバックアップ用のオブジェクトにまとめる。
 * @returns {{app: string, format: number, exportedAt: string, appVersion: string, data: Object}}
 */
function createBackup() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (BACKUP_EXCLUDED_KEYS.includes(key)) continue;
        data[key] = localStorage.getItem(key);
    }
    return {
        app: 'sumakin',
        format: 1,
        exportedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        data,
    };
}

/**
 * バックアップの内容を要約する（復元前の確認表示に使用）。
 * @param {Object} backup - createBackup()が作る形式のオブジェクト
 * @returns {string[]} 表示用の行
 */
function summarizeBackup(backup) {
    const lines = [];
    if (backup.exportedAt) {
        const d = new Date(backup.exportedAt);
        if (!isNaN(d)) {
            lines.push(`書き出し日時: ${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
        }
    }
    const logs = parseLogsToMap(backup.data ? backup.data.logs : '');
    if (logs.size > 0) {
        const dates = [...logs.keys()].sort();
        lines.push(`ログ: ${logs.size}件（${formatDateWithDay(dates[0])} 〜 ${formatDateWithDay(dates[dates.length - 1])}）`);
    } else {
        lines.push('ログ: 0件');
    }
    return lines;
}

/**
 * バックアップの形式を検証する。
 * @param {*} backup - 読み込んだJSON
 * @returns {boolean} スマ勤のバックアップとして扱えるか
 */
function isValidBackup(backup) {
    return !!backup && backup.app === 'sumakin'
        && (backup.format === undefined || backup.format === 1)
        && !!backup.data && typeof backup.data === 'object' && !Array.isArray(backup.data)
        // localStorage には文字列しか入らない。null や数を入れると "null" などの文字になり、
        // ログが壊れるため、すべて文字列のものだけを受け付ける
        && Object.values(backup.data).every(value => typeof value === 'string');
}

/**
 * localStorage を、渡した内容にそっくり置き換える。BACKUP_EXCLUDED_KEYS のキーは残す。
 * @param {Object<string, string>} data - 新しい内容
 * @returns {void}
 */
function replaceStorage(data) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i));
    }
    keys.forEach(key => {
        if (!BACKUP_EXCLUDED_KEYS.includes(key)) localStorage.removeItem(key);
    });
    Object.keys(data).forEach(key => {
        if (BACKUP_EXCLUDED_KEYS.includes(key)) return;
        localStorage.setItem(key, data[key]);
    });
}

/**
 * バックアップの時点の内容に、localStorage をそっくり置き換える。
 * 置き換える前の内容は restore_undo に控え、undoRestore() で戻せるようにする。
 * ログ画面のUNDOでも、ログだけは復元する前に戻せるよう logs_undo に入れる。
 * @param {Object} backup - createBackup()が作る形式のオブジェクト
 * @returns {void}
 */
function restoreBackup(backup) {
    const before = createBackup().data;
    const beforeLogs = localStorage.getItem('logs') || '';
    localStorage.setItem('restore_undo', JSON.stringify({ at: new Date().toISOString(), data: before }));
    replaceStorage(backup.data);
    localStorage.setItem('logs_undo', beforeLogs);
}

/**
 * 復元の取り消し用の控えを消す。復元のあとにログを変えたら、取り消すとその変更まで
 * 消えてしまうため、ログを書き換えるときに呼ぶ。
 * @returns {void}
 */
function forgetRestoreUndo() {
    localStorage.removeItem('restore_undo');
}

/**
 * 復元の取り消し用の控えがあれば、復元した日時を返す。
 * @returns {Date|null} 復元した日時（控えが無ければ null）
 */
function getRestoreUndoTime() {
    const saved = localStorage.getItem('restore_undo');
    if (!saved) return null;
    try {
        const at = new Date(JSON.parse(saved).at);
        return isNaN(at) ? null : at;
    } catch (error) {
        return null;
    }
}

/**
 * 直前の復元を取り消し、復元する前の内容に戻す。
 * @returns {boolean} 戻せたら true（控えが無ければ false）
 */
function undoRestore() {
    const saved = localStorage.getItem('restore_undo');
    if (!saved) return false;
    let data;
    try {
        data = JSON.parse(saved).data;
    } catch (error) {
        return false;
    }
    if (!data || typeof data !== 'object') return false;
    replaceStorage(data);
    localStorage.removeItem('restore_undo');
    return true;
}

/**
 * 2項目を横並びにしている.field-rowについて、入力欄が本来必要とする幅を実測し、
 * 横並びでは収まらない場合だけ縦積み(.stacked)に切り替える。
 * ネイティブのdate/time入力の必要幅は端末・文字サイズ・時刻表記(12/24時間)で
 * 変わるため、固定のルールではなく実測で判断する。
 * @param {ParentNode} [root=document] - 対象範囲のルート要素
 * @returns {void}
 */
function layoutFieldRows(root) {
    const scope = root || document;
    const rows = scope.querySelectorAll('.field-row');
    rows.forEach(row => {
        if (row.clientWidth === 0) return;  // 折りたたみ中などで測れない場合は据え置く
        if (row.querySelectorAll('.input-group').length < 2) return;
        // 幅が足りないと崩れるのはネイティブUIを持つdate/time/month入力だけ。
        // 通常のテキスト入力は自由に縮むので、常に横並びのままでよい
        const natives = row.querySelectorAll('input[type="date"], input[type="time"], input[type="month"]');
        if (natives.length === 0) return;
        const gap = 10;
        row.classList.remove('stacked');
        let needed = 0;
        natives.forEach(input => {
            const saved = input.style.width;
            input.style.width = 'max-content';
            needed = Math.max(needed, input.getBoundingClientRect().width);
            input.style.width = saved;
        });
        if (needed > (row.clientWidth - gap) / 2) {
            row.classList.add('stacked');
        }
    });
}

/**
 * date/time/month入力欄の実際のpx幅を親要素から測定し、明示的に指定する。
 * SafariはこれらのネイティブUIに対してwidth:100%(パーセンテージ)の
 * 解決計算が崩れ、親要素の幅を無視して描画されることがあるため、
 * CSSのパーセンテージ指定に頼らずJSで測定したpx値を直接指定して回避する。
 * 測定前に layoutFieldRows() で横並び/縦積みを確定させる。
 * @param {ParentNode} [root=document] - 対象範囲のルート要素
 * @returns {void}
 */
function fixNativeInputWidths(root) {
    const scope = root || document;
    layoutFieldRows(scope);
    const inputs = scope.querySelectorAll('input[type="date"], input[type="time"], input[type="month"]');
    inputs.forEach(input => {
        // 文字サイズ変更でレイアウト幅が変わるため、一度解除してから測り直す
        input.style.width = '';
        // 右に曜日を並べる日付欄は、中身どおりの自然な幅のままにする
        if (input.closest('.date-row')) return;
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
