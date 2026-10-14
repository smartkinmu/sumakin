/**
 * ログ表示（logs.html）と納期ログ表示（due_logs.html）で共通の処理。
 * 2つの画面の違いは、表示する日付の範囲の決め方だけなので、その部分を mode で受け取る。
 *
 * @param {Object} mode - 画面ごとの処理
 * @param {function(function(): void): void} mode.setup - 範囲の入力欄を準備する。値が変わったら引数の関数を呼ぶ
 * @param {function(): ({start: string, end: string}|null)} mode.getRange - 表示する範囲（YYYY-MM-DD、両端を含む）。決まっていなければ null
 * @param {function(): {start: (string|undefined), end: (string|undefined)}} mode.getCsvRange - CSVに出す範囲（省略した端は制限しない）
 * @param {function(): void} [mode.afterUpdate] - 表示を更新したあとに呼ぶ
 * @returns {void}
 */
function initLogPage(mode) {
    const logBody = document.getElementById('log-body');
    // 「更新」ボタンと画面を下に引く操作で、最新版を取得する
    document.getElementById('refresh-button').addEventListener('click', refreshApp);
    setupPullToRefresh();
    // date/time入力欄の実際のpx幅を測定して明示指定する（Safari対策）
    fixNativeInputWidths();
    window.addEventListener('resize', () => fixNativeInputWidths());
    const editDialog = document.getElementById('edit-dialog');
    const editDate = document.getElementById('edit-date');
    const editStart = document.getElementById('edit-start');
    const editEnd = document.getElementById('edit-end');
    const editSave = document.getElementById('edit-save');
    const editCancel = document.getElementById('edit-cancel');
    const editDelete = document.getElementById('edit-delete');
    const editToInput = document.getElementById('edit-to-input');
    const undoBtn = document.getElementById('undo-delete-btn');
    let originalDate = '';

    /**
     * UNDOボタンの有効/無効を、復元可能なデータの有無に応じて切り替える。
     * @returns {void}
     */
    function updateUndoState() {
        undoBtn.disabled = localStorage.getItem('logs_undo') === null;
    }

    /**
     * 指定した日付のログを削除する。
     * @param {string} date - YYYY-MM-DD
     * @returns {boolean} 削除したら true
     */
    function deleteLogByDate(date) {
        const logsStr = restoreLogsIfNeeded();
        if (!logsStr) {
            alert('ログはありません');
            return false;
        }
        const lines = logsStr.split('\n').filter(line => line);
        const remaining = lines.filter(line => line.split(',')[0] !== date);
        if (remaining.length === lines.length) {
            alert('指定した日付のデータはありません');
            return false;
        }
        if (!confirm(`${date} のログを削除しますか？`)) {
            return false;
        }
        localStorage.setItem('logs_undo', logsStr);
        writeLogs(remaining.join('\n'));
        return true;
    }

    /**
     * 直前の保存・削除・編集・クリア・計算チェック・バックアップの復元を取り消す。
     * logs_undo は index.html の保存によるログ上書き、
     * および logs.html/due_logs.html 上での操作の直前の状態を保持する。
     * @returns {void}
     */
    function undoLastChange() {
        const backup = localStorage.getItem('logs_undo');
        if (backup === null) {
            alert('元に戻せる操作はありません');
            return;
        }
        const current = localStorage.getItem('logs') || '';
        const restored = buildUndoLogs(current, backup);
        const changes = buildUndoPreview(current, restored);
        const message = changes.length > 0
            ? `以下の内容が変更されます。\n\n${changes.join('\n')}\n\n元に戻しますか？`
            : '元に戻しますか？';
        if (!confirm(message)) {
            return;
        }
        writeLogs(restored);
        localStorage.removeItem('logs_undo');
        updateSummary();
    }

    /**
     * ログ1行の日付・始業・終業を書き換える。
     * 内容が変わらないときは、UNDOで戻れる地点を潰さないよう何もしない。
     * @param {string} oldDate - 編集する行の日付
     * @param {string} newDate - 新しい日付
     * @param {string} start - 始業 HH:MM
     * @param {string} end - 終業 HH:MM
     * @returns {boolean} 編集を終えてよければ true
     */
    function updateLog(oldDate, newDate, start, end) {
        const logsStr = restoreLogsIfNeeded();
        if (!logsStr) {
            alert('ログはありません');
            return false;
        }
        const result = editLogLine(logsStr, oldDate, newDate, start, end);
        if (result.error) {
            alert(result.error);
            return false;
        }
        if (!result.changed) {
            return true;
        }
        localStorage.setItem('logs_undo', logsStr);
        writeLogs(result.updated);
        // 入力画面に戻すときに使う業務の内容も、新しい日付へ移す
        moveLogDetail(oldDate, newDate);
        return true;
    }

    /**
     * 編集ダイアログを開く。開いたときに日付のピッカーが出ないようにする。
     * @param {string} date - 日付 YYYY-MM-DD
     * @param {string} start - 始業 HH:MM（年休は「年休」）
     * @param {string} end - 終業 HH:MM（年休は「年休」）
     * @returns {void}
     */
    function openEditDialog(date, start, end) {
        originalDate = date;
        // iPhoneのカレンダーの「リセット」で、このログの元の日付に戻るようにする（初期値）
        editDate.defaultValue = date;
        editDate.value = date;
        if (start === '年休') {
            // 年休はデフォルト時間を入力欄に設定する。時刻を変えずに保存すれば年休のまま残る
            editStart.value = '08:30';
            editEnd.value = '17:15';
        } else {
            editStart.value = start;
            editEnd.value = end;
        }
        // 時刻も、ピッカーの「リセット」で開いたときの時刻に戻るようにする
        editStart.defaultValue = editStart.value;
        editEnd.defaultValue = editEnd.value;
        // showModal() は、ふつう最初の入力欄（日付）に焦点を移す。iPhoneではそれだけで
        // カレンダーが開いてしまうため、ダイアログそのものに焦点を置く（autofocus）
        editDialog.autofocus = true;
        editDialog.showModal();
        if (document.activeElement !== editDialog) {
            if (document.activeElement) document.activeElement.blur();
            editDialog.focus({ preventScroll: true });
        }
        fixNativeInputWidths(editDialog);
    }

    /**
     * ログ1件分のカードを作る。値はすべて textContent で入れる。
     * @param {string[]} parts - ログ1行を項目に分けたもの
     * @returns {HTMLElement} カード
     */
    function createRow(parts) {
        const [date, start, end, work, overtime] = parts;
        const [b1s, b1e, b2s, b2e] = [parts[5] || '', parts[6] || '', parts[7] || '', parts[8] || ''];
        const mailed = parts[MAILED_INDEX] || '';
        const card = document.createElement('div');
        card.className = 'log-card';

        const top = document.createElement('div');
        top.className = 'log-top';

        const dateWrap = document.createElement('div');
        const dateWithDay = formatDateWithDay(date);
        const dowMatch = dateWithDay.match(/^(.*)(\(.\))$/);
        const dateSpan = document.createElement('span');
        dateSpan.className = 'log-date';
        dateSpan.textContent = dowMatch ? dowMatch[1] : dateWithDay;
        dateWrap.appendChild(dateSpan);
        if (mailed) {
            // メール作成済みの目印（登録だけの日と区別するため）
            const mailMark = document.createElement('span');
            mailMark.className = 'mail-mark';
            mailMark.title = 'メール作成済み';
            mailMark.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg>';
            dateSpan.appendChild(mailMark);
        }
        if (dowMatch) {
            const dowSpan = document.createElement('span');
            dowSpan.className = 'log-dow';
            dowSpan.textContent = dowMatch[2];
            dateWrap.appendChild(dowSpan);
        }
        top.appendChild(dateWrap);

        const editBtn = document.createElement('button');
        editBtn.textContent = '✎';
        editBtn.title = '編集';
        editBtn.className = 'edit-btn';
        editBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            openEditDialog(date, start, end);
        });
        top.appendChild(editBtn);
        card.appendChild(top);

        const mid = document.createElement('div');
        mid.className = 'log-mid';
        const times = document.createElement('span');
        times.className = 'log-times';
        times.textContent = `${start} → ${end}`;
        mid.appendChild(times);

        const workChip = document.createElement('span');
        workChip.className = 'chip';
        workChip.textContent = `${work}h`;
        mid.appendChild(workChip);

        const overtimeNum = parseFloat(overtime) || 0;
        if (overtimeNum !== 0) {
            const overtimeChip = document.createElement('span');
            overtimeChip.className = overtimeNum > 0 ? 'chip overtime' : 'chip short';
            overtimeChip.textContent = overtimeNum > 0 ? `+${overtime}h` : `${overtime}h`;
            mid.appendChild(overtimeChip);
        }
        card.appendChild(mid);

        if (b1s && b1e) {
            const sub = document.createElement('div');
            sub.className = 'log-sub';
            sub.textContent = `中断(1) ${b1s}–${b1e}（${durationHours(b1s, b1e)}h）`;
            card.appendChild(sub);
        }
        if (b2s && b2e) {
            const sub = document.createElement('div');
            sub.className = 'log-sub';
            sub.textContent = `中断(2) ${b2s}–${b2e}（${durationHours(b2s, b2e)}h）`;
            card.appendChild(sub);
        }
        return card;
    }

    function renderEmptyState() {
        logBody.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'empty-state';
        div.textContent = 'ログはありません';
        logBody.appendChild(div);
    }

    /**
     * 集計の数字を表示する。
     * @param {{days: number, hours: string, overtime: string}} summary - summarizeLogRows() の結果
     * @returns {void}
     */
    function renderSummary(summary) {
        document.getElementById('stat-days').innerHTML = `${summary.days}<span class="stat-unit"> 日</span>`;
        document.getElementById('stat-hours').innerHTML = `${summary.hours}<span class="stat-unit">h</span>`;
        document.getElementById('stat-overtime').innerHTML = `${summary.overtime}<span class="stat-unit">h</span>`;
    }

    /**
     * 古い形式（メール本文の記録など）の行を、今の形式にそろえて保存し直す。
     * 読めない行は除く。1行も読めないときは、何も書き換えない（バックアップを残すため）。
     * @returns {void}
     */
    function normalizeStoredLogs() {
        const data = restoreLogsIfNeeded();
        if (!data) return;
        const normalized = data.split('\n').filter(line => line)
            .map(line => parseLogLine(line))
            .filter(line => line)
            .join('\n');
        if (normalized && normalized !== data) {
            localStorage.setItem('logs', normalized);
        }
    }

    /**
     * 選んでいる範囲のログと集計を表示し直す。ログが無いときは 0 件として表示する。
     * @returns {void}
     */
    function updateSummary() {
        updateUndoState();
        const range = mode.getRange();
        if (!range) return;
        const rows = selectLogRows(restoreLogsIfNeeded() || '', range.start, range.end);
        logBody.innerHTML = '';
        if (rows.length === 0) {
            renderEmptyState();
        } else {
            rows.forEach(parts => logBody.appendChild(createRow(parts)));
        }
        renderSummary(summarizeLogRows(rows));
        if (mode.afterUpdate) mode.afterUpdate();
    }

    /**
     * 保存済みログを検査し、標準休憩時間と中断時間の重複による
     * 二重差し引きの誤りがあれば確認のうえ修正する。
     * 修正前の状態は logs_undo に保存するため、UNDOボタンで元に戻せる。
     * @returns {void}
     */
    function verifyAndFixLogs() {
        const current = restoreLogsIfNeeded();
        if (!current) {
            alert('ログはありません');
            return;
        }
        const { fixed, changes } = fixLogsCalculations(current);
        if (changes.length === 0) {
            alert('計算の誤りは見つかりませんでした。');
            return;
        }
        const lines = changes.map(c =>
            `${formatDateWithDay(c.date)} 勤務 ${c.oldWork}→${c.newWork}h 残業 ${c.oldOvertime}→${c.newOvertime}h`);
        const message = `以下の勤務時間・残業時間の計算に誤りが見つかりました。\n\n${lines.join('\n')}\n\n`
            + '今の休憩時間の設定で計算しています。その日のあとで休憩時間の設定を変えた場合は、'
            + '正しくないことがあります。\n\n修正しますか？';
        if (!confirm(message)) {
            return;
        }
        localStorage.setItem('logs_undo', current);
        writeLogs(fixed);
        updateSummary();
        alert(`${changes.length}件を修正しました。UNDOで元に戻せます。`);
    }

    /**
     * ログをすべて消す。UNDOで戻せる。
     * @returns {void}
     */
    function clearLogs() {
        if (!localStorage.getItem('logs') && !localStorage.getItem('logs_backup')) {
            alert('ログはありません');
            return;
        }
        if (!confirm('ログをすべて削除しますか？（UNDOで元に戻せます）')) {
            return;
        }
        clearAllLogs();
        updateSummary();
    }

    /**
     * ログをCSVファイルでダウンロードする。
     * @returns {void}
     */
    function downloadLogs() {
        const range = mode.getCsvRange();
        const rows = selectLogRows(restoreLogsIfNeeded() || '', range.start, range.end);
        if (rows.length === 0) {
            alert('ログはありません');
            return;
        }
        const rangeStart = formatDateWithDay(rows[0][0]);
        const rangeEnd = formatDateWithDay(rows[rows.length - 1][0]);
        if (!confirm(`期間: ${rangeStart} 〜 ${rangeEnd}（${rows.length}件）\n\nこの期間のCSVをダウンロードしますか？`)) {
            return;
        }
        const blob = new Blob([buildLogsCsv(rows)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'logs.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    document.getElementById('clear-logs').addEventListener('click', clearLogs);
    document.getElementById('download-logs').addEventListener('click', downloadLogs);
    document.getElementById('verify-logs-btn').addEventListener('click', verifyAndFixLogs);
    undoBtn.addEventListener('click', undoLastChange);

    editCancel.addEventListener('click', function () {
        editDialog.close();
    });

    // その日の内容を入力画面に戻す。保存だけしてメールを作っていない日に、あとからメールを作るため
    editToInput.addEventListener('click', function () {
        const message = `${formatDateWithDay(originalDate)} の内容を入力画面に戻しますか？\n`
            + '今の入力（日付・時刻・業務の内容）は、この日の内容に置き換わります。';
        if (!confirm(message)) {
            return;
        }
        try {
            sessionStorage.setItem('restoreLogDate', originalDate);
        } catch (error) {
            alert('入力画面に戻せませんでした。');
            return;
        }
        location.href = 'index.html';
    });

    editDelete.addEventListener('click', function () {
        if (deleteLogByDate(originalDate)) {
            editDialog.close();
            updateSummary();
        }
    });

    editSave.addEventListener('click', function (e) {
        e.preventDefault();
        const newDate = editDate.value;
        const newStart = editStart.value;
        const newEnd = editEnd.value;
        if (!newDate || !newStart || !newEnd) {
            alert('日付と時刻を入力してください');
            return;
        }
        if (toMinutes(newStart) > toMinutes(newEnd)) {
            alert('始業時刻が終業時刻より遅くなっています');
            return;
        }
        if (updateLog(originalDate, newDate, newStart, newEnd)) {
            editDialog.close();
            updateSummary();
        }
    });

    normalizeStoredLogs();
    mode.setup(updateSummary);
    updateSummary();

    /**
     * ほかの画面で「更新」を押したら、この画面も読み込み直す。
     * @param {StorageEvent} e - storageイベント
     * @returns {void}
     */
    window.addEventListener('storage', function (e) {
        if (e.key === 'refreshLogs') {
            location.reload();
        }
    });
}
