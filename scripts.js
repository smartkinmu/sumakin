if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
}

document.addEventListener('DOMContentLoaded', function() {
    const emailInput = document.getElementById('email');
    const dateInput = document.getElementById('date');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');
    const break1StartInput = document.getElementById('break1-start');
    const break1EndInput = document.getElementById('break1-end');
    const break2StartInput = document.getElementById('break2-start');
    const break2EndInput = document.getElementById('break2-end');
    const annualLeaveCheckbox = document.getElementById('annual-leave');
    const amLeaveCheckbox = document.getElementById('am-leave');
    const pmLeaveCheckbox = document.getElementById('pm-leave');
    const resultDiv = document.getElementById('result');
    const submitButton = document.getElementById('submit-button');
    const emailButton = document.getElementById('email-button');
    const refreshButton = document.getElementById('refresh-button');
    const refreshIndicator = document.getElementById('refresh-indicator');
    const copyTask1Button = document.getElementById('copy-task1-button');
    const menuButton = document.getElementById('menu-button');
    const hamburgerMenu = document.getElementById('hamburger-menu');

    const groupCountPicker = document.getElementById("group-count");
    const taskGroupsContainer = document.getElementById("task-groups-container");

    /**
     * 休暇チェック状態に応じて入力欄の有効／無効を切り替える。
     * 選択肢は排他的で、別の項目を直接選び直せる。
     * @returns {void}
     */
    function updateLeaveControls() {
        if (annualLeaveCheckbox.checked) {
            amLeaveCheckbox.checked = false;
            pmLeaveCheckbox.checked = false;
        } else if (amLeaveCheckbox.checked) {
            annualLeaveCheckbox.checked = false;
            pmLeaveCheckbox.checked = false;
        } else if (pmLeaveCheckbox.checked) {
            annualLeaveCheckbox.checked = false;
            amLeaveCheckbox.checked = false;
        }

        const disableStartEnd = annualLeaveCheckbox.checked;
        const disableBreak = annualLeaveCheckbox.checked ||
            amLeaveCheckbox.checked || pmLeaveCheckbox.checked;
        startTimeInput.disabled = disableStartEnd;
        endTimeInput.disabled = disableStartEnd;
        break1StartInput.disabled = disableBreak;
        break1EndInput.disabled = disableBreak;
        break2StartInput.disabled = disableBreak;
        break2EndInput.disabled = disableBreak;
        if (disableBreak) {
            break1StartInput.value = '';
            break1EndInput.value = '';
            break2StartInput.value = '';
            break2EndInput.value = '';
        }
        submitButton.disabled = annualLeaveCheckbox.checked;
        const register = annualLeaveCheckbox.checked ||
            amLeaveCheckbox.checked || pmLeaveCheckbox.checked;
        emailButton.textContent = register ? '登録' : 'メール作成';
    }

    annualLeaveCheckbox.addEventListener('change', updateLeaveControls);
    amLeaveCheckbox.addEventListener('change', updateLeaveControls);
    pmLeaveCheckbox.addEventListener('change', updateLeaveControls);

    function createTaskGroup(index) {
        return `
            <div class="task-group">
                <div class="input-group">
                    <label for="task-number${index}">業務${index}:</label>
                    <input type="text" id="task-number${index}" name="task-number${index}">
                </div>
                <div class="input-group">
                    <label for="category${index}">分類${index}:</label>
                    <input type="text" id="category${index}" name="category${index}" maxlength="5" pattern="\\d{5}">
                </div>
                <div class="input-group">
                    <label for="task-hours${index}">工数${index}:</label>
                    <input type="number" id="task-hours${index}" name="task-hours${index}" step="0.01" min="0">
                </div>
                <div class="input-group">
                    <label for="title${index}">備考${index}:</label>
                    <input type="text" id="title${index}" name="title${index}">
                </div>
            </div>
            <hr>
        `;
    }

    // ログが存在しない、または0バイトのときにバックアップから復元する
    function restoreLogsIfNeeded() {
        let logs = localStorage.getItem('logs');
        if (!logs) {
            const backup = localStorage.getItem('logs_backup');
            if (backup) {
                localStorage.setItem('logs', backup);
                logs = backup;
                alert('ログファイルを復元しました。');
            }
        }
        return logs;
    }

    // ログ保存用関数
    // 日付,始業,終業,勤務時間,残業時間,中断開始1,中断終了1,中断開始2,中断終了2 の形式で保存する
    function saveLog(date, start, end, work, overtime,
                     b1s, b1e, b2s, b2e) {
        const line = `${date},${start},${end},${work},${overtime},${b1s || ''},${b1e || ''},${b2s || ''},${b2e || ''}`;
        const existing = localStorage.getItem('logs');
        const updated = existing ? `${existing}\n${line}` : line;
        localStorage.setItem('logs', updated);
        localStorage.setItem('logs_backup', updated);
    }

    function saveTaskDataToStorage() {
        const totalGroups = 10;  // 最大10グループまで保存
        for (let i = 1; i <= totalGroups; i++) {
            const title = document.getElementById(`title${i}`);
            const taskNumber = document.getElementById(`task-number${i}`);
            const category = document.getElementById(`category${i}`);
            const taskHours = document.getElementById(`task-hours${i}`);
            if (title) localStorage.setItem(`title${i}`, title.value);
            if (taskNumber) localStorage.setItem(`task-number${i}`, taskNumber.value);
            if (category) localStorage.setItem(`category${i}`, category.value);
   //         if (taskHours) localStorage.setItem(`task-hours${i}`, taskHours.value);
        }
        localStorage.setItem('email', emailInput.value);
        localStorage.setItem('startTime', startTimeInput.value);
        localStorage.setItem('endTime', endTimeInput.value);
        localStorage.setItem('groupCount', groupCountPicker.value);
        // 休暇選択状態は保存しない
        localStorage.removeItem('annualLeave');
        localStorage.removeItem('amLeave');
        localStorage.removeItem('pmLeave');
    }

    function loadTaskDataFromStorage() {
        const selectedCount = parseInt(groupCountPicker.value, 10);
        for (let i = 1; i <= selectedCount; i++) {
            document.getElementById(`title${i}`).value = localStorage.getItem(`title${i}`) || '';
            document.getElementById(`task-number${i}`).value = localStorage.getItem(`task-number${i}`) || '';
            document.getElementById(`category${i}`).value = localStorage.getItem(`category${i}`) || '';
     //       document.getElementById(`task-hours${i}`).value = localStorage.getItem(`task-hours${i}`) || '';
        }
        emailInput.value = localStorage.getItem('email') || '';
        startTimeInput.value = localStorage.getItem('startTime') || '';
        endTimeInput.value = localStorage.getItem('endTime') || '';
        annualLeaveCheckbox.checked = false;
        amLeaveCheckbox.checked = false;
        pmLeaveCheckbox.checked = false;
        localStorage.removeItem('annualLeave');
        localStorage.removeItem('amLeave');
        localStorage.removeItem('pmLeave');
        updateLeaveControls();
    }

    function updateTaskGroups() {
        const selectedCount = parseInt(groupCountPicker.value, 10);
        const existingData = {};

        // 現在のデータを保存
        for (let i = 1; i <= selectedCount; i++) {
            existingData[`title${i}`] = document.getElementById(`title${i}`)?.value || '';
            existingData[`task-number${i}`] = document.getElementById(`task-number${i}`)?.value || '';
            existingData[`category${i}`] = document.getElementById(`category${i}`)?.value || '';
      //      existingData[`task-hours${i}`] = document.getElementById(`task-hours${i}`)?.value || '';
        }

        taskGroupsContainer.innerHTML = '';
        for (let i = 1; i <= selectedCount; i++) {
            taskGroupsContainer.innerHTML += createTaskGroup(i);
        }

        // データを復元
        for (let i = 1; i <= selectedCount; i++) {
            document.getElementById(`title${i}`).value = localStorage.getItem(`title${i}`) || existingData[`title${i}`] || '';
            document.getElementById(`task-number${i}`).value = localStorage.getItem(`task-number${i}`) || existingData[`task-number${i}`] || '';
            document.getElementById(`category${i}`).value = localStorage.getItem(`category${i}`) || existingData[`category${i}`] || '';
         //   document.getElementById(`task-hours${i}`).value = localStorage.getItem(`task-hours${i}`) || existingData[`task-hours${i}`] || '';
        }

        // 動的に生成された入力ボックスにイベントリスナーを追加
        for (let i = 1; i <= selectedCount; i++) {
            document.getElementById(`task-number${i}`).addEventListener('blur', saveTaskData);
            document.getElementById(`category${i}`).addEventListener('blur', saveTaskData);
            document.getElementById(`title${i}`).addEventListener('blur', saveTaskData);
     //       document.getElementById(`task-hours${i}`).addEventListener('blur', saveTaskData);
        }
    }

    groupCountPicker.addEventListener("change", function() {
        saveTaskDataToStorage();
        updateTaskGroups();
    });

    // 初期表示の更新
    if (localStorage.getItem('groupCount')) {
        groupCountPicker.value = localStorage.getItem('groupCount');
    }
    updateTaskGroups();
    loadTaskDataFromStorage();

    menuButton.addEventListener('click', function (e) {
        e.stopPropagation();
        hamburgerMenu.style.display =
            hamburgerMenu.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', function (e) {
        if (e.target !== menuButton && !hamburgerMenu.contains(e.target)) {
            hamburgerMenu.style.display = 'none';
        }
    });
    
    // 更新ボタンのクリックイベントリスナー
    refreshButton.addEventListener('click', async () => {
        if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ action: 'sync' });
            const reg = await navigator.serviceWorker.getRegistration();
            reg?.update();
        }
        localStorage.setItem('refreshLogs', Date.now().toString());
        refreshIndicator.style.display = 'block';
        setTimeout(() => location.reload(), 1500);
    });

    function getFormat(str) {
        return Array.from(str).map(ch => {
            if (/[A-Za-z]/.test(ch)) {
                return 'A';
            } else if (/[0-9]/.test(ch)) {
                return '0';
            }
            return ch;
        }).join('');
    }

    // 業務1を他の業務番号にコピーするボタン
    copyTask1Button.addEventListener('click', function() {
        if (!confirm('業務1を他の業務番号へコピーしますか？')) {
            return;
        }
        const selectedCount = parseInt(groupCountPicker.value, 10);
        const taskNumber1 = document.getElementById('task-number1').value;
        const format1 = getFormat(taskNumber1);
        for (let i = 2; i <= selectedCount; i++) {
            const field = document.getElementById(`task-number${i}`);
            if (field) {
                const fieldFormat = getFormat(field.value);
                if (field.value === '' || fieldFormat === format1) {
                    field.value = taskNumber1;
                }
            }
        }
        saveTaskData();
    });

    // 曜日を取得する関数
    function getDayOfWeek(dateString) {
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const date = new Date(dateString);
        return days[date.getDay()];
    }

    // 日付入力の初期値を設定
    function getNearestWeekday(date) {
        const d = new Date(date);
        while (isHolidayDate(d)) {
            d.setDate(d.getDate() - 1);
        }
        return d;
    }

    function getJSTNow() {
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        return new Date(utc + 9 * 60 * 60000);
    }

    function getDefaultDate() {
        const now = getJSTNow();
        if (now.getHours() < 6) {
            now.setDate(now.getDate() - 1);
        }
        let date = now;
        if (isHolidayDate(date)) {
            date = getNearestWeekday(date);
        }
        return date;
    }

    function formatDate(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function setDefaultDate() {
        dateInput.value = formatDate(getDefaultDate());
    }

    // 時刻の初期値を設定（ローカルストレージから取得）
    startTimeInput.value = localStorage.getItem('startTime') || "08:30";
    endTimeInput.value = localStorage.getItem('endTime') || "17:15";

    // メールアドレスのデフォルト値を設定（ローカルストレージから取得）
    emailInput.value = localStorage.getItem('email') || 'mail@address.com';
    
    // 時刻変更時にローカルストレージに保存
    startTimeInput.addEventListener('change', function() {
        localStorage.setItem('startTime', startTimeInput.value);
        saveTaskData();  // データを保存
    });

    endTimeInput.addEventListener('change', function() {
        localStorage.setItem('endTime', endTimeInput.value);
        saveTaskData();  // データを保存
    });

    // フォーカスが外れたときにデータを保存する
    emailInput.addEventListener('blur', saveTaskData);
    dateInput.addEventListener('blur', saveTaskData);
    startTimeInput.addEventListener('blur', saveTaskData);
    endTimeInput.addEventListener('blur', saveTaskData);

    // 時刻文字列("HH:MM")を分単位の数値へ変換する
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

    // 勤務時間を計算する関数
    function calculateWorkingHours(startTime, endTime) {
        let totalMinutes = toMinutes(endTime) - toMinutes(startTime);

        const breaks = getBreakTimes();

        const workStart = toMinutes(startTime);
        const workEnd = toMinutes(endTime);

        // 休憩時間を差し引く処理
        breaks.forEach(b => {
            const breakStart = toMinutes(b.start);
            const breakEnd = toMinutes(b.end);
            if (workStart < breakEnd && workEnd > breakStart) {
                const overlapStart = Math.max(workStart, breakStart);
                const overlapEnd = Math.min(workEnd, breakEnd);
                totalMinutes -= overlapEnd - overlapStart;
            }
        });
    
        let workingHours = totalMinutes / 60;
        // 小数点第3位を四捨五入する処理
        return (Math.round(workingHours * 100) / 100).toFixed(2);
    }
    
    // 入力工数を計算する関数
    function calculateTotalTaskHours() {
        let totalTaskHours = 0;
        const selectedCount = parseInt(groupCountPicker.value, 10);
        for (let i = 1; i <= selectedCount; i++) {
            const taskHours = parseFloat(document.getElementById(`task-hours${i}`).value) || 0;
            totalTaskHours += taskHours;
        }
        return totalTaskHours;
    }

    function isStartTimeBeforeEndTime(startTime, endTime) {
        return toMinutes(startTime) <= toMinutes(endTime);
    }

    /**
     * 入力された中断時間の合計を計算する。
     * @returns {number} 中断時間の合計(時間)
     */
    function calculateInterruptHours() {
        const pairs = [
            [break1StartInput.value, break1EndInput.value],
            [break2StartInput.value, break2EndInput.value]
        ];
        let minutes = 0;
        pairs.forEach(p => {
            if (p[0] && p[1]) {
                minutes += toMinutes(p[1]) - toMinutes(p[0]);
            }
        });
        return minutes / 60;
    }

    /**
     * 中断時間の入力が勤務時間内かつ重複していないか確認する。
     * @returns {boolean} 妥当なら true
     */
    function checkInterruptInput() {
        const start = toMinutes(startTimeInput.value);
        const end = toMinutes(endTimeInput.value);
        const ranges = [];
        if (break1StartInput.value && break1EndInput.value) {
            const s = toMinutes(break1StartInput.value);
            const e = toMinutes(break1EndInput.value);
            if (s < start || e > end || s >= e) {
                alert('中断時間(1)が勤務時間外です');
                return false;
            }
            ranges.push({ s, e });
        }
        if (break2StartInput.value && break2EndInput.value) {
            const s = toMinutes(break2StartInput.value);
            const e = toMinutes(break2EndInput.value);
            if (s < start || e > end || s >= e) {
                alert('中断時間(2)が勤務時間外です');
                return false;
            }
            ranges.push({ s, e });
        }
        if (ranges.length === 2) {
            const r1 = ranges[0];
            const r2 = ranges[1];
            if (Math.max(r1.s, r2.s) < Math.min(r1.e, r2.e)) {
                alert('中断時間が重複しています');
                return false;
            }
        }
        return true;
    }

    /**
     * 半休時に入力された時刻が適切か確認する。
     * @returns {boolean} 入力が適切なら true
     */
    function checkHalfDayInput() {
        const lunch = getBreakTimes()[0];
        const lunchStart = lunch.start;
        const lunchEnd = lunch.end;
        const start = startTimeInput.value;
        const end = endTimeInput.value;
        if (amLeaveCheckbox.checked) {
            if (toMinutes(start) < toMinutes(lunchEnd) || toMinutes(end) < toMinutes(lunchEnd)) {
                alert('AM休では昼休み後の時間を入力してください');
                return false;
            }
        }
        if (pmLeaveCheckbox.checked) {
            if (toMinutes(start) > toMinutes(lunchStart) || toMinutes(end) > toMinutes(lunchStart)) {
                alert('PM休では昼休み前の時間を入力してください');
                return false;
            }
        }
        return true;
    }

    // 日本の祝日計算用補助関数
    function nthMonday(year, month, nth) {
        const first = new Date(year, month - 1, 1);
        const firstMonday = 1 + ((8 - first.getDay()) % 7);
        return firstMonday + (nth - 1) * 7;
    }

    const holidayCache = {};

    function getJapaneseHolidays(year) {
        if (holidayCache[year]) {
            return holidayCache[year];
        }
        const pad = n => n.toString().padStart(2, '0');
        const holidays = new Set();
        const add = (m, d) => holidays.add(`${year}-${pad(m)}-${pad(d)}`);

        add(1, 1); // 元日
        add(1, nthMonday(year, 1, 2)); // 成人の日
        add(2, 11); // 建国記念の日
        add(2, 23); // 天皇誕生日
        const spring = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
        add(3, spring); // 春分の日
        add(4, 29); // 昭和の日
        add(5, 3); // 憲法記念日
        add(5, 4); // みどりの日
        add(5, 5); // こどもの日
        add(7, nthMonday(year, 7, 3)); // 海の日
        add(8, 11); // 山の日
        add(9, nthMonday(year, 9, 3)); // 敬老の日
        const autumn = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
        add(9, autumn); // 秋分の日
        add(10, nthMonday(year, 10, 2)); // スポーツの日
        add(11, 3); // 文化の日
        add(11, 23); // 勤労感謝の日

        // 振替休日
        const addSubstitute = dateStr => {
            let d = new Date(dateStr);
            if (d.getDay() !== 0) return;
            do {
                d.setDate(d.getDate() + 1);
                const s = formatDate(d);
                if (!holidays.has(s)) {
                    holidays.add(s);
                    return;
                }
            } while (true);
        };
        Array.from(holidays).forEach(addSubstitute);

        // 国民の休日
        const daysInYear = (new Date(year, 11, 31) - new Date(year, 0, 1)) / 86400000 + 1;
        for (let i = 2; i < daysInYear; i++) {
            const d = new Date(year, 0, i);
            const prev = new Date(d);
            const next = new Date(d);
            prev.setDate(prev.getDate() - 1);
            next.setDate(next.getDate() + 1);
            const ds = formatDate(d);
            const prevStr = formatDate(prev);
            const nextStr = formatDate(next);
            if (!holidays.has(ds) && holidays.has(prevStr) && holidays.has(nextStr) && d.getDay() !== 0 && d.getDay() !== 6) {
                holidays.add(ds);
            }
        }

        holidayCache[year] = holidays;
        return holidays;
    }

    function isHolidayDate(date) {
        const holidays = getJapaneseHolidays(date.getFullYear());
        const dateStr = formatDate(date);
        if (holidays.has(dateStr)) return true;
        const day = date.getDay();
        return day === 0 || day === 6;
    }

    setDefaultDate();
    window.addEventListener('pageshow', setDefaultDate);

    // 過去2回の平日ログの有無を確認し、欠落があれば警告を表示する。
    // 引数: なし
    // 戻り値: なし
    function checkMissingLogs() {
        const logsStr = restoreLogsIfNeeded() || '';
        const loggedDates = new Set();
        logsStr.split('\n').forEach(line => {
            if (!line) return;
            const parts = line.split(',');
            if (parts[0]) {
                loggedDates.add(parts[0]);
            }
        });
        const messages = [];
        const today = getJSTNow();
        let checked = 0;
        let d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        while (checked < 2) {
            d.setDate(d.getDate() - 1);
            while (isHolidayDate(d)) {
                d.setDate(d.getDate() - 1);
            }
            const str = formatDate(d);
            if (!loggedDates.has(str)) {
                const m = d.getMonth() + 1;
                const day = d.getDate();
                const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
                messages.push(`${m}/${day}(${w})の入力がありません。ご確認ください。`);
            }
            checked++;
        }
        if (messages.length > 0) {
            alert(messages.join('\n'));
        }
    }

    // 業務データを保存する関数
    function saveTaskData() {
        saveTaskDataToStorage();
    }

    // 業務データをロードする関数
    function loadTaskData() {
        loadTaskDataFromStorage();
    }

    // 入力チェックボタンのクリックイベントリスナー
    submitButton.addEventListener('click', function() {
        const selectedDate = dateInput.value;
        const selectedDayOfWeek = getDayOfWeek(selectedDate);
        const selectedStartTime = startTimeInput.value;
        const selectedEndTime = endTimeInput.value;
        if (!checkHalfDayInput() || !checkInterruptInput()) {
            return;
        }
        let workingHours = calculateWorkingHours(selectedStartTime, selectedEndTime);
        const lunch = getBreakTimes()[0];
        const lunchStart = lunch.start;
        const lunchEnd = lunch.end;
        if (amLeaveCheckbox.checked) {
            workingHours = (
                parseFloat(calculateWorkingHours('08:30', lunchStart)) +
                parseFloat(workingHours)
            ).toFixed(2);
        } else if (pmLeaveCheckbox.checked) {
            workingHours = (
                parseFloat(calculateWorkingHours(lunchEnd, '17:15')) +
                parseFloat(workingHours)
            ).toFixed(2);
        }
        const interruptHours = calculateInterruptHours();
        let issuesFound = false;
        let firstEmptyTaskHoursIndex = -1;
        let allTaskCategoriesFilled = 0;
        if (!isStartTimeBeforeEndTime(selectedStartTime, selectedEndTime)) {
            alert("始業時刻が終業時刻より遅くなっています。");
            issuesFound = true;
        }
        let totalTaskHours = calculateTotalTaskHours();

        // 現在の日付を取得
        const now = getJSTNow();
        const today = formatDate(now);

        // 今日以外の日付が指定された場合の警告表示
        if (selectedDate !== today) {
            alert("今日以外の日付が指定されています。");
            issuesFound = true;
        }

        const selectedCount = parseInt(groupCountPicker.value, 10);
        // 空の工数フィールドを自動的に埋める処理と業務情報が入力されているかのチェック
        for (let i = 1; i <= selectedCount; i++) {
            const taskNumber = document.getElementById(`task-number${i}`).value;
            const taskHours = document.getElementById(`task-hours${i}`).value;
            const category = document.getElementById(`category${i}`).value;
            if (/^[A-Za-z]/.test(taskNumber) && taskNumber.length !== 10) {
                alert(`業務${i}の業務コードは10桁で入力してください。`);
                issuesFound = true;
            }
            if (taskNumber && !taskHours && firstEmptyTaskHoursIndex === -1) {
                firstEmptyTaskHoursIndex = i;
            }
            if (category) {
                allTaskCategoriesFilled++;
            }
        }

        // 勤務工数が作業工数より少ない場合のチェック
        if (workingHours < totalTaskHours) {
            alert("勤務時間が作業工数より少ないです。");
            issuesFound = true;
        }

        // 業務情報が一つ以上含まれている場合のみ補完処理を実行
        if (Math.abs(workingHours - totalTaskHours) > 0.01) {
            if (allTaskCategoriesFilled > 0 && firstEmptyTaskHoursIndex !== -1) {
                let taskHours = workingHours - totalTaskHours;
                if (taskHours < 0) {
                    taskHours = 0;
                }
                document.getElementById(`task-hours${firstEmptyTaskHoursIndex}`).value = taskHours.toFixed(2);
                totalTaskHours = calculateTotalTaskHours();
                alert(`勤務時間と入力工数の差分は、業務${firstEmptyTaskHoursIndex}に反映します。`);
                issuesFound = true;
            } else {
                alert("勤務時間と入力工数に差分があります。");
                issuesFound = true;
            }
        }

        if (!issuesFound) {
            alert("問題は見つかりませんでした。");
        }

        const actual = (parseFloat(workingHours) - interruptHours).toFixed(2);
        const overtime = (parseFloat(actual) - 7.75).toFixed(2);
        resultDiv.innerHTML = `<p>日付 ${selectedDate} (${selectedDayOfWeek})<br>始業 ${selectedStartTime}<br>終業 ${selectedEndTime}<br>勤務時間 ${actual}（入力時間 ${totalTaskHours.toFixed(2)} 時間）<br>中断時間 ${interruptHours.toFixed(2)} 時間<br>残業時間 ${overtime} 時間</p>`;
        saveTaskData();  // データを保存
    });

    // メール作成ボタンのクリックイベントリスナー
    emailButton.addEventListener('click', function() {
        const email = emailInput.value;
        const selectedDate = dateInput.value;
        const selectedStartTime = startTimeInput.value;
        const selectedEndTime = endTimeInput.value;
        if (!checkHalfDayInput() || !checkInterruptInput()) {
            return;
        }
        let workingHours = calculateWorkingHours(selectedStartTime, selectedEndTime);
        const lunch = getBreakTimes()[0];
        const lunchStart = lunch.start;
        const lunchEnd = lunch.end;
        if (amLeaveCheckbox.checked) {
            workingHours = (
                parseFloat(calculateWorkingHours('08:30', lunchStart)) +
                parseFloat(workingHours)
            ).toFixed(2);
        } else if (pmLeaveCheckbox.checked) {
            workingHours = (
                parseFloat(calculateWorkingHours(lunchEnd, '17:15')) +
                parseFloat(workingHours)
            ).toFixed(2);
        }
        const interruptHours = calculateInterruptHours();
        const totalTaskHours = calculateTotalTaskHours();

        if (annualLeaveCheckbox.checked) {
            saveLog(selectedDate, '年休', '年休', '7.75', '0.00', '', '', '', '');
            alert('年休を登録しました');
            saveTaskData();
            return;
        } else if (amLeaveCheckbox.checked || pmLeaveCheckbox.checked) {
            const actual = (parseFloat(workingHours) - interruptHours).toFixed(2);
            const overtime = (parseFloat(actual) - 7.75).toFixed(2);
            saveLog(
                selectedDate,
                selectedStartTime,
                selectedEndTime,
                actual,
                overtime,
                break1StartInput.value,
                break1EndInput.value,
                break2StartInput.value,
                break2EndInput.value
            );
            const type = amLeaveCheckbox.checked ? 'AM休' : 'PM休';
            alert(`${type}を登録しました`);
            saveTaskData();
            return;
        }

        const subject = "スマ勤";
        const newline = '\r\n';

        let body = `@基本${newline}日付 ${selectedDate}${newline}始業 ${selectedStartTime}${newline}終業 ${selectedEndTime}${newline}`;

        // 業務情報をメール本文に追加
        const selectedCount = parseInt(groupCountPicker.value, 10);
        for (let i = 1; i <= selectedCount; i++) {
            const title = document.getElementById(`title${i}`).value;
            const taskNumber = document.getElementById(`task-number${i}`).value;
            const category = document.getElementById(`category${i}`).value;
            let taskHours = document.getElementById(`task-hours${i}`).value;
            if (category && !taskHours) {
                taskHours = '0';
            }
            if (taskHours != 0) {
                const taskHoursConverted = parseFloat(taskHours).toFixed(2);
                body += `${newline}@業務${newline}業務 ${taskNumber}${newline}分類 ${category}${newline}工数 ${taskHoursConverted}${newline}備考 ${title}${newline}`;
            }
        }

        // 勤務工数と作業工数に違いがある場合のチェック
        if (Math.abs(workingHours - totalTaskHours) > 0.01) {
            const confirmSend = confirm("勤務時間と入力工数に差分があります。続行しますか？");
        if (!confirmSend) {
                return;
            }
        }

        // 現在の日付を取得
        const now = getJSTNow();
        const today = formatDate(now);

        const selectedDateTime = new Date(`${selectedDate}T${selectedEndTime}`);
        if (selectedDateTime > now) {
            alert('未来の日時が入力されています');
            return;
        }

        // 今日以外の日付が指定された場合の確認
        if (selectedDate !== today) {
            const confirmSend = confirm("今日以外の日付が指定されています。続行しますか？");
            if (!confirmSend) {
                return;
            }
        }
        saveTaskData();  // データを保存
        const actual = (parseFloat(workingHours) - interruptHours).toFixed(2);
        const overtime = (parseFloat(actual) - 7.75).toFixed(2);
        saveLog(selectedDate, selectedStartTime, selectedEndTime, actual, overtime,
            break1StartInput.value, break1EndInput.value,
            break2StartInput.value, break2EndInput.value);
        window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });

    // Pull-to-refreshの実装
    let startY;
    let isRefreshing = false;

    window.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            startY = e.touches[0].pageY;
        }
    });

    window.addEventListener('touchmove', (e) => {
        const y = e.touches[0].pageY;
        if (window.scrollY === 0 && y > startY + 50 && !isRefreshing) {
            isRefreshing = true;
            refreshIndicator.style.display = 'block';
            setTimeout(() => {
                location.reload();
            }, 1500);
        }
    });

    window.addEventListener('touchend', () => {
        isRefreshing = false;
        refreshIndicator.style.display = 'none';
    });

    // インストールプロンプトの処理
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
    });

    // ページロード時の処理
    window.addEventListener('load', () => {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            navigator.serviceWorker.ready.then(function(sw) {
                return sw.sync.register('sync');
            });
        }
        loadTaskData();
        const savedNewline = localStorage.getItem('newline') || 'CRLF';
        const newlineInput = document.querySelector(
            `input[name="newline"][value="${savedNewline}"]`
        );
        if (newlineInput) {
            newlineInput.checked = true;
        }

        const savedMailFormat = localStorage.getItem('mailformat') || 'plain';
        const mailFormatInput = document.querySelector(
            `input[name="mailformat"][value="${savedMailFormat}"]`
        );
        if (mailFormatInput) {
            mailFormatInput.checked = true;
        }
        // 起動時のみ一度だけ入力漏れ警告を表示する
        if (!sessionStorage.getItem('missingLogsChecked')) {
            checkMissingLogs();
            sessionStorage.setItem('missingLogsChecked', '1');
        }
    });

    // サービスワーカーが変更された場合の処理
    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
        if (refreshing) return;
        window.location.reload();
        refreshing = true;
    });
});
