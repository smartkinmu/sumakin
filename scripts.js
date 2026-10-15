if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
}

document.addEventListener('DOMContentLoaded', function() {
    const dateInput = document.getElementById('date');
    const dateText = document.getElementById('date-text');
    const dateHoliday = document.getElementById('date-holiday');
    const dateLabelText = document.getElementById('date-label-text');
    const startTimeText = document.getElementById('start-time-text');
    const endTimeText = document.getElementById('end-time-text');
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
    const copyTask1Button = document.getElementById('copy-task1-button');

    const groupCountPicker = document.getElementById("group-count");
    const taskGroupsContainer = document.getElementById("task-groups-container");
    const interruptLeaveSection = document.getElementById("interrupt-leave-section");

    // date/time入力欄の実際のpx幅を測定して明示指定する（Safari対策）
    fixNativeInputWidths();
    window.addEventListener('resize', () => fixNativeInputWidths());
    if (interruptLeaveSection) {
        // 折りたたみが開いた際、中の中断時間欄は幅0で測定されているため開いた直後に再測定する
        interruptLeaveSection.addEventListener('toggle', () => fixNativeInputWidths());
    }

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
        // 休暇の保存はすべて「工数保存」ボタンから行うため、休暇選択時も有効のままにする
        submitButton.disabled = false;
        // 休暇の日はメールを送信しないため、メール作成ボタンを無効化する
        emailButton.disabled = annualLeaveCheckbox.checked ||
            amLeaveCheckbox.checked || pmLeaveCheckbox.checked;
    }

    [annualLeaveCheckbox, amLeaveCheckbox, pmLeaveCheckbox].forEach(checkbox => {
        checkbox.addEventListener('change', updateLeaveControls);
        checkbox.addEventListener('change', updateLiveResult);
    });

    /**
     * 業務1つ分の入力欄を作る。左の列に業務・分類、右の列に備考・工数を上下に並べる。
     * 列ごとにまとめるので、キーボードの「次へ」は業務→分類→備考→工数の順に進む。
     * @param {number} index - 業務の番号（1から）
     * @returns {string} 入力欄のHTML
     */
    function createTaskGroup(index) {
        return `
            <div class="task-group">
                <div class="field-columns">
                    <div class="field-column">
                        <div class="input-group narrow">
                            <label for="task-number${index}">業務${index}</label>
                            <input type="text" id="task-number${index}" name="task-number${index}">
                        </div>
                        <div class="input-group narrow">
                            <label for="category${index}">分類${index}</label>
                            <input type="text" id="category${index}" name="category${index}" maxlength="5" pattern="\\d{5}">
                        </div>
                    </div>
                    <div class="field-column">
                        <div class="input-group narrow">
                            <label for="title${index}">備考${index}</label>
                            <input type="text" id="title${index}" name="title${index}">
                        </div>
                        <div class="input-group narrow">
                            <label for="task-hours${index}">工数${index}</label>
                            <input type="number" id="task-hours${index}" name="task-hours${index}" step="0.01" min="0">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ログ保存用関数
    // 日付,始業,終業,勤務時間,残業時間,中断開始1,中断終了1,中断開始2,中断終了2 の形式で保存する
    // 同じ日付のログが既に存在する場合は上書きする。上書き前の内容は
    // logs_undo に保存し、ログ表示画面のUNDOボタンで復元できるようにする
    function saveLog(date, start, end, work, overtime,
                     b1s, b1e, b2s, b2e) {
        const existing = localStorage.getItem('logs');
        const lines = existing ? existing.split('\n') : [];
        const index = lines.findIndex(l => l.split(',')[0] === date);
        // メール作成済みの記録は、内容を登録し直しても引き継ぐ
        const mailed = index !== -1 ? (lines[index].split(',')[MAILED_INDEX] || '') : '';
        const line = `${date},${start},${end},${work},${overtime},${b1s || ''},${b1e || ''},${b2s || ''},${b2e || ''},${mailed}`;
        // 内容が変わらない場合は何もしない。登録に続けてメール作成した際などに、
        // UNDOで戻れる地点を無意味に潰さないため
        if (index !== -1 && lines[index] === line) {
            return;
        }
        localStorage.setItem('logs_undo', existing || '');
        forgetRestoreUndo();
        if (index !== -1) {
            lines[index] = line;
        } else {
            lines.push(line);
        }
        const updated = lines.join('\n');
        localStorage.setItem('logs', updated);
        localStorage.setItem('logs_backup', updated);
    }

    /**
     * 選んでいる休暇を返す。
     * @returns {string} 年休は 'annual'、AM休は 'am'、PM休は 'pm'、休暇でなければ ''
     */
    function getSelectedLeave() {
        if (annualLeaveCheckbox.checked) return 'annual';
        if (amLeaveCheckbox.checked) return 'am';
        if (pmLeaveCheckbox.checked) return 'pm';
        return '';
    }

    /**
     * 今の入力内容（業務の内容・表示するグループの数・休暇）を、その日のログと一緒に残す。
     * あとでログ画面の「入力画面に戻す」で、メールを作り直せるようにするため。
     * @param {string} date - YYYY-MM-DD形式の日付
     * @returns {void}
     */
    function saveInputDetail(date) {
        const count = parseInt(groupCountPicker.value, 10);
        const tasks = [];
        for (let i = 1; i <= count; i++) {
            tasks.push({
                number: document.getElementById(`task-number${i}`).value,
                category: document.getElementById(`category${i}`).value,
                hours: document.getElementById(`task-hours${i}`).value,
                title: document.getElementById(`title${i}`).value,
            });
        }
        saveLogDetail(date, { groupCount: count, leave: getSelectedLeave(), tasks });
    }

    /**
     * ログ画面の「入力画面に戻す」で頼まれた日の内容を、入力欄に戻す。
     * 業務の内容が残っていない古いログでは、日付・時刻・中断時間だけを戻す。
     * @returns {boolean} 頼まれた日の内容で入力欄を置き換えたら true
     */
    function applyRestoreRequest() {
        let date = null;
        try {
            date = sessionStorage.getItem('restoreLogDate');
            sessionStorage.removeItem('restoreLogDate');
        } catch (error) {
            return false;
        }
        if (!date) return false;
        const line = parseLogsToMap(restoreLogsIfNeeded()).get(date);
        if (!line) {
            afterFirstPaint(() => alert(`${date} のログが見つかりませんでした。`));
            return false;
        }
        const parts = line.split(',');
        const [, start, end, work] = parts;
        const [b1s, b1e, b2s, b2e] = [parts[5] || '', parts[6] || '', parts[7] || '', parts[8] || ''];
        const detail = getLogDetail(date);

        dateInput.value = date;
        autoDateValue = '';
        rememberSelectedDate();
        updateDateWeekday();

        let leave = detail ? detail.leave : '';
        if (start === '年休') {
            leave = 'annual';
        } else {
            startTimeInput.value = start;
            endTimeInput.value = end;
            if (!detail) {
                // 古いログは休暇の記録が無いため、勤務時間から半休かどうかを見分ける
                leave = detectHalfDayLeave(work, start, end, b1s, b1e, b2s, b2e).type;
            }
        }
        annualLeaveCheckbox.checked = leave === 'annual';
        amLeaveCheckbox.checked = leave === 'am';
        pmLeaveCheckbox.checked = leave === 'pm';
        updateLeaveControls();
        if (!leave) {
            break1StartInput.value = b1s;
            break1EndInput.value = b1e;
            break2StartInput.value = b2s;
            break2EndInput.value = b2e;
        }
        if (interruptLeaveSection && (leave || b1s || b2s)) {
            interruptLeaveSection.open = true;
        }

        if (detail && Array.isArray(detail.tasks)) {
            const count = Math.min(Math.max(parseInt(detail.groupCount, 10) || detail.tasks.length || 1, 1), 10);
            groupCountPicker.value = String(count);
            updateTaskGroups();
            for (let i = 1; i <= count; i++) {
                const task = detail.tasks[i - 1] || {};
                document.getElementById(`task-number${i}`).value = task.number || '';
                document.getElementById(`category${i}`).value = task.category || '';
                document.getElementById(`task-hours${i}`).value = task.hours || '';
                document.getElementById(`title${i}`).value = task.title || '';
            }
        }
        saveTaskDataToStorage();
        fixNativeInputWidths();
        updateLiveResult();
        if (!detail) {
            afterFirstPaint(() => alert('この日の業務の内容は保存されていないため、日付・時刻・中断時間だけを戻しました。'));
        }
        return true;
    }

    function saveTaskDataToStorage() {
        const totalGroups = 10;  // 最大10グループまで保存
        for (let i = 1; i <= totalGroups; i++) {
            const title = document.getElementById(`title${i}`);
            const taskNumber = document.getElementById(`task-number${i}`);
            const category = document.getElementById(`category${i}`);
            if (title) localStorage.setItem(`title${i}`, title.value);
            if (taskNumber) localStorage.setItem(`task-number${i}`, taskNumber.value);
            if (category) localStorage.setItem(`category${i}`, category.value);
        }
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
        }
        // 初めて使うときは、標準の勤務時間を入れておく
        startTimeInput.value = localStorage.getItem('startTime') || '08:30';
        endTimeInput.value = localStorage.getItem('endTime') || '17:15';
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

        // 現在のデータを控える。数を減らす前の欄の分も控えるため、今ある欄をすべて数える
        const currentCount = taskGroupsContainer.querySelectorAll('.task-group').length;
        for (let i = 1; i <= Math.max(selectedCount, currentCount); i++) {
            existingData[`title${i}`] = document.getElementById(`title${i}`)?.value || '';
            existingData[`task-number${i}`] = document.getElementById(`task-number${i}`)?.value || '';
            existingData[`category${i}`] = document.getElementById(`category${i}`)?.value || '';
            // 工数は保存しない項目なので、作り直す前の入力欄から引き継ぐ
            existingData[`task-hours${i}`] = document.getElementById(`task-hours${i}`)?.value || '';
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
            document.getElementById(`task-hours${i}`).value = existingData[`task-hours${i}`] || '';
        }

        // 動的に生成された入力ボックスにイベントリスナーを追加
        for (let i = 1; i <= selectedCount; i++) {
            document.getElementById(`task-number${i}`).addEventListener('blur', saveTaskDataToStorage);
            document.getElementById(`category${i}`).addEventListener('blur', saveTaskDataToStorage);
            document.getElementById(`title${i}`).addEventListener('blur', saveTaskDataToStorage);
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
    updateLiveResult();

    // 右上のメニュー（ログの画面と同じ形。common.js）
    setupMenu();

    // 文字サイズ切り替え（メニュー内）
    const fontSizeButtons = document.querySelectorAll('.font-size-option');
    function updateFontSizeButtons() {
        const current = localStorage.getItem('fontSize') || 'small';
        fontSizeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.size === current);
        });
    }
    fontSizeButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            localStorage.setItem('fontSize', btn.dataset.size);
            document.documentElement.setAttribute('data-font-size', btn.dataset.size);
            updateFontSizeButtons();
            fixNativeInputWidths();
        });
    });
    updateFontSizeButtons();

    // 更新ボタンのクリックイベントリスナー
    refreshButton.addEventListener('click', refreshApp);

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
        saveTaskDataToStorage();
    });

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

    /**
     * この時刻（日本時間）より前は、前の日の勤務として扱う。深夜まで働いた日を
     * 翌日の日付で記録してしまわないため。
     */
    const BUSINESS_DAY_START_HOUR = 4;

    function getDefaultDate() {
        const now = getJSTNow();
        if (now.getHours() < BUSINESS_DAY_START_HOUR) {
            now.setDate(now.getDate() - 1);
        }
        let date = now;
        if (isHolidayDate(date)) {
            date = getNearestWeekday(date);
        }
        return date;
    }

    function setDefaultDate() {
        dateInput.value = formatYmd(getDefaultDate());
        autoDateValue = dateInput.value;
        updateDateWeekday();
        // 日付が決まってから結果を描き直す。pageshowでも呼ばれるため、
        // メールアプリから戻ったときにメール作成済みの印が反映される
        updateLiveResult();
    }

    /**
     * 日付欄の表示（「10/12(月)」）と見出しを更新する。祝日の日は、見出しの「日付」の代わりに祝日名を出す。
     * ネイティブの日付入力は表示文字を変更できないため、透明にした入力欄の下に自前で描く。
     * 週休2日のため土日は休み扱いとし、祝日と同じく曜日を赤にする。
     * @returns {void}
     */
    function updateDateWeekday() {
        dateText.textContent = '';
        dateHoliday.textContent = '';
        dateLabelText.style.display = '';
        if (!dateInput.value) {
            dateText.textContent = '--/--';
            return;
        }
        const date = parseDateLocal(dateInput.value);
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const day = date.getDay();
        const holidayName = getHolidayName(date);
        const dow = document.createElement('span');
        dow.textContent = `(${days[day]})`;
        if (day === 0 || day === 6 || holidayName) {
            dow.className = 'holiday';
        }
        dateText.append(`${date.getMonth() + 1}/${date.getDate()}`, dow);
        dateHoliday.textContent = holidayName;
        dateLabelText.style.display = holidayName ? 'none' : '';
    }

    /**
     * 始業・終業・中断時間の箱の表示（「8:30」）を、入力欄の値に合わせて更新する。
     * 値は保存時の読み込みやログからの戻し、休暇を選んだときの中断時間の消去など
     * 色々な所で変わるため、計算結果を描き直すたびに合わせて呼ぶ。
     * @returns {void}
     */
    function updateTimeTexts() {
        startTimeText.textContent = startTimeInput.value ? formatTime(startTimeInput.value) : '--:--';
        endTimeText.textContent = endTimeInput.value ? formatTime(endTimeInput.value) : '--:--';
        refreshPickerBoxes(interruptLeaveSection);
    }

    /**
     * 「今日」を業務日基準（翌日午前4時までは前日扱い。BUSINESS_DAY_START_HOUR）で取得する。
     * @param {Date} now - 現在時刻
     * @returns {string} 業務日基準の今日の日付("YYYY-MM-DD")
     */
    function getBusinessToday(now) {
        const d = new Date(now);
        if (d.getHours() < BUSINESS_DAY_START_HOUR) {
            d.setDate(d.getDate() - 1);
        }
        return formatYmd(d);
    }

    /**
     * 現在時刻をHH:MM形式で取得する。
     * @returns {string} 現在時刻（例: "14:05"）
     */
    function getCurrentTimeHHMM() {
        const now = getJSTNow();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    }

    /**
     * iPhoneのピッカーの「リセット」は、入力欄の初期値（value属性 = defaultValue）に戻し、
     * 開いているピッカーの見た目もすぐその値に動かす。初期値が空だと見た目が変わらないため、
     * ピッカーを開くたびに、日付は今日、時刻は今の時刻を初期値にしておく。
     * （.value を一度でも入れた欄は、defaultValue を変えても今の値は変わらない）
     * @returns {void}
     */
    function setResetTargets() {
        dateInput.defaultValue = getBusinessToday(getJSTNow());
        const now = getCurrentTimeHHMM();
        startTimeInput.defaultValue = now;
        endTimeInput.defaultValue = now;
    }
    [dateInput, startTimeInput, endTimeInput].forEach(input => {
        input.addEventListener('focus', setResetTargets);
        input.addEventListener('pointerdown', setResetTargets);
    });

    // 時刻変更時にローカルストレージに保存
    // 'change'はピッカーのチェック（確定）ボタンを押した時にだけ発火する。
    // クリアして空欄のまま確定した場合は、その時点の現在時刻を入れる。
    startTimeInput.addEventListener('change', function() {
        if (!startTimeInput.value) {
            startTimeInput.value = getCurrentTimeHHMM();
        }
        localStorage.setItem('startTime', startTimeInput.value);
        saveTaskDataToStorage();  // データを保存
        updateLiveResult();
    });

    endTimeInput.addEventListener('change', function() {
        if (!endTimeInput.value) {
            endTimeInput.value = getCurrentTimeHHMM();
        }
        localStorage.setItem('endTime', endTimeInput.value);
        saveTaskDataToStorage();  // データを保存
        updateLiveResult();
    });

    // 日付欄も同様に、クリアして空欄のまま確定した場合は今日の日付を入れる。
    // 起動時の初期値(setDefaultDate)は土日・祝日を前の平日まで遡るが、
    // リセットは「今日にする」操作なので休日スキップは行わない。
    // 日付の「クリア」操作は端末によって'change'が発火しないことがあるため、
    // 'input'と確定後のblurでも保険として同じ判定を行う
    function fillDefaultDateIfEmpty() {
        if (!dateInput.value) {
            dateInput.value = getBusinessToday(getJSTNow());
        }
        updateDateWeekday();
    }
    // 画面を開いたときに自動で入れた日付。これと違う日付になったときだけ「選んだ日付」として控える
    let autoDateValue = '';

    // 日付が変わるとメール作成済みの印も変わるため、表示を更新する
    function handleDateChange() {
        fillDefaultDateIfEmpty();
        if (dateInput.value !== autoDateValue) {
            rememberSelectedDate();
        }
        updateLiveResult();
    }

    /**
     * 選んだ日付を、ほかの画面へ移って戻ったときのために控える。
     * 控えるのは、その時点の業務日と合わせて（日が変わったら使わない）。
     * @returns {void}
     */
    function rememberSelectedDate() {
        try {
            sessionStorage.setItem('selectedDate', JSON.stringify({
                date: dateInput.value,
                businessDay: getBusinessToday(getJSTNow()),
            }));
        } catch (error) {
            // 保存できない環境では、戻ったときに今日の日付になるだけなので何もしない
        }
    }

    /**
     * 画面を開いたときの日付を決める。同じ業務日のうちに選んだ日付があればそれを、
     * なければ今日（休日なら前の平日）を入れる。
     * @returns {void}
     */
    function setInitialDate() {
        let saved = null;
        try {
            saved = JSON.parse(sessionStorage.getItem('selectedDate'));
        } catch (error) {
            saved = null;
        }
        if (saved && saved.date && saved.businessDay === getBusinessToday(getJSTNow())) {
            dateInput.value = saved.date;
            autoDateValue = '';
            updateDateWeekday();
            // pageshowでも呼ばれるため、メールアプリから戻ったときにメール作成済みの印が反映される
            updateLiveResult();
            return;
        }
        setDefaultDate();
    }

    // 工数・中断時間・休暇は次の日に持ち越さないため端末には保存しないが、
    // ログ画面などへ移って戻ったときに消えないよう、その業務日のうちだけ控えておく
    const INPUT_DRAFT_KEY = 'inputDraft';
    // 控えを戻し終えるまでは控えない（読み込みの途中の空の入力で、控えを上書きしないため）
    let inputDraftReady = false;

    /**
     * 工数・中断時間・休暇の入力を、ほかの画面へ移って戻ったときのために控える。
     * 控えるのは、その時点の業務日と合わせて（日が変わったら使わない）。
     * @returns {void}
     */
    function saveInputDraft() {
        if (!inputDraftReady) return;
        const count = parseInt(groupCountPicker.value, 10);
        const hours = [];
        for (let i = 1; i <= count; i++) {
            hours.push(document.getElementById(`task-hours${i}`)?.value || '');
        }
        try {
            sessionStorage.setItem(INPUT_DRAFT_KEY, JSON.stringify({
                businessDay: getBusinessToday(getJSTNow()),
                hours,
                breaks: [break1StartInput.value, break1EndInput.value,
                    break2StartInput.value, break2EndInput.value],
                leave: getSelectedLeave(),
            }));
        } catch (error) {
            // 保存できない環境では、戻ったときに空になるだけなので何もしない
        }
    }

    /**
     * 控えておいた工数・中断時間・休暇を入力欄に戻す。同じ業務日の控えだけを使う。
     * @returns {void}
     */
    function restoreInputDraft() {
        let draft = null;
        try {
            draft = JSON.parse(sessionStorage.getItem(INPUT_DRAFT_KEY));
        } catch (error) {
            draft = null;
        }
        if (!draft || draft.businessDay !== getBusinessToday(getJSTNow())) return;
        const hours = Array.isArray(draft.hours) ? draft.hours : [];
        const count = parseInt(groupCountPicker.value, 10);
        for (let i = 1; i <= count; i++) {
            document.getElementById(`task-hours${i}`).value = hours[i - 1] || '';
        }
        const leave = draft.leave || '';
        annualLeaveCheckbox.checked = leave === 'annual';
        amLeaveCheckbox.checked = leave === 'am';
        pmLeaveCheckbox.checked = leave === 'pm';
        updateLeaveControls();
        const [b1s = '', b1e = '', b2s = '', b2e = ''] = Array.isArray(draft.breaks) ? draft.breaks : [];
        if (!leave) {
            break1StartInput.value = b1s;
            break1EndInput.value = b1e;
            break2StartInput.value = b2s;
            break2EndInput.value = b2e;
        }
        if (interruptLeaveSection && (leave || b1s || b1e || b2s || b2e)) {
            interruptLeaveSection.open = true;
        }
    }
    // 入力が変わるたびと、ほかの画面へ移るときに控える
    document.addEventListener('change', saveInputDraft);
    window.addEventListener('pagehide', saveInputDraft);

    dateInput.addEventListener('change', handleDateChange);
    dateInput.addEventListener('input', handleDateChange);

    // 中断時間が変わると勤務時間も変わるため、表示を更新する
    [break1StartInput, break1EndInput, break2StartInput, break2EndInput].forEach(input => {
        input.addEventListener('change', updateLiveResult);
    });

    // フォーカスが外れたときにデータを保存する
    dateInput.addEventListener('blur', function() {
        handleDateChange();
        saveTaskDataToStorage();
    });
    startTimeInput.addEventListener('blur', saveTaskDataToStorage);
    endTimeInput.addEventListener('blur', saveTaskDataToStorage);

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
     * 中断時間の入力の問題を集めて返す。アラートは出さないため、
     * 入力中の表示でも同じ判定を使える。
     * @param {number} start - 始業時刻(分)
     * @param {number} end - 終業時刻(分)
     * @returns {string[]} 問題の説明（問題が無ければ空配列）
     */
    function collectInterruptProblems(start, end) {
        const problems = [];
        const ranges = [];
        const pairs = [
            [break1StartInput, break1EndInput, '(1)'],
            [break2StartInput, break2EndInput, '(2)']
        ];
        pairs.forEach(([startInput, endInput, label]) => {
            if (!startInput.value || !endInput.value) return;
            const s = toMinutes(startInput.value);
            const e = toMinutes(endInput.value);
            if (s >= e) {
                problems.push(`中断時間${label}の開始が終了より後になっています`);
            } else if (s < start || e > end) {
                problems.push(`中断時間${label}が勤務時間外です`);
            } else {
                ranges.push({ s, e });
            }
        });
        if (ranges.length === 2
            && Math.max(ranges[0].s, ranges[1].s) < Math.min(ranges[0].e, ranges[1].e)) {
            problems.push('中断時間が重複しています');
        }
        // 標準休憩時間の重なり分はcalculateWorkingHours()側で自動的に引かれるため、
        // ここでも中断時間として引くと二重に差し引かれてしまう
        const breakRanges = getBreakTimes().map(b => ({ s: toMinutes(b.start), e: toMinutes(b.end) }));
        pairs.forEach(([startInput, endInput, label]) => {
            if (!startInput.value || !endInput.value) return;
            const s = toMinutes(startInput.value);
            const e = toMinutes(endInput.value);
            if (s >= e || s < start || e > end) return;  // 既に上で問題として報告済み
            breakRanges.forEach(b => {
                if (Math.max(s, b.s) < Math.min(e, b.e)) {
                    problems.push(`中断時間${label}が休憩時間と重なっています`);
                }
            });
        });
        return problems;
    }

    /**
     * 中断時間の入力が勤務時間内かつ重複していないか確認する。
     * @returns {boolean} 妥当なら true
     */
    function checkInterruptInput() {
        const problems = collectInterruptProblems(
            toMinutes(startTimeInput.value), toMinutes(endTimeInput.value));
        if (problems.length > 0) {
            alert(problems.join('\n'));
            return false;
        }
        return true;
    }

    /**
     * 計算結果を結果表示エリアに描画する。入力内容の自動表示と保存で共通に使用する。
     * @param {string} head - 見出し（日付や始業→終業）
     * @param {string} actual - 勤務時間(100進数)
     * @param {string} interrupt - 中断時間(100進数)
     * @param {string} overtime - 残業時間(100進数)
     * @param {string} [note] - 補足行（入力工数など）
     * @returns {void}
     */
    function renderResult(head, actual, interrupt, overtime, note) {
        // その日のメールを作成済みなら、ログ表示画面と同じ封筒の印を見出しに出す
        const mailMark = isDateMailed(dateInput.value)
            ? '<span class="mail-mark" title="メール作成済み"><svg width="15" height="15" viewBox="0 0 24 24"'
                + ' fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"'
                + ' stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/>'
                + '<polyline points="3 7 12 13 21 7"/></svg></span>'
            : '';
        // 残業の超過・不足を色で示す（ログ表示画面と同じ基準）
        const overtimeNum = parseFloat(overtime);
        let overtimeClass = '';
        if (overtimeNum > 0) {
            overtimeClass = ' overtime';
        } else if (overtimeNum < 0) {
            overtimeClass = ' short';
        }
        resultDiv.innerHTML = `
            <div class="result-head">${head}${mailMark}</div>
            <div class="stat-row">
                <div class="stat-tile">
                    <div class="stat-label">勤務時間</div>
                    <div class="stat-value">${actual}<span class="stat-unit">h</span></div>
                </div>
                <div class="stat-tile">
                    <div class="stat-label">中断</div>
                    <div class="stat-value">${interrupt}<span class="stat-unit">h</span></div>
                </div>
                <div class="stat-tile${overtimeClass}">
                    <div class="stat-label">残業</div>
                    <div class="stat-value">${formatSignedHours(overtime)}<span class="stat-unit">h</span></div>
                </div>
            </div>
            ${note ? `<div class="result-note">${note}</div>` : ''}`;
    }

    /**
     * 半休で勤務したものとして足す時間(分)を求める。
     * AM休は8:30から昼休み開始まで、PM休は昼休み終了から17:15まで。
     * @returns {number} 足す時間(分)。半休でなければ0
     */
    function calculateLeaveMinutes() {
        const lunch = getBreakTimes()[0];
        if (amLeaveCheckbox.checked) {
            return calculateWorkingMinutes('08:30', lunch.start);
        }
        if (pmLeaveCheckbox.checked) {
            return calculateWorkingMinutes(lunch.end, '17:15');
        }
        return 0;
    }

    /**
     * 休暇の選択状態を加味した勤務時間(100進数)を求める。中断時間は差し引かない。
     * @param {string} start - 始業時刻 HH:MM
     * @param {string} end - 終業時刻 HH:MM
     * @returns {string} 勤務時間（小数2桁）
     */
    function calculateWorkingHoursWithLeave(start, end) {
        return minutesToHoursString(calculateWorkingMinutes(start, end) + calculateLeaveMinutes());
    }

    /**
     * 中断時間を差し引き、休暇の選択状態を加味した、実際の勤務時間(100進数)を求める。
     * 分のまま計算して最後に1回だけ丸める（ログ画面の計算と値をそろえるため）。
     * @param {string} start - 始業時刻 HH:MM
     * @param {string} end - 終業時刻 HH:MM
     * @returns {string} 勤務時間（小数2桁）
     */
    function calculateActualHours(start, end) {
        return minutesToHoursString(
            calculateWorkingMinutes(start, end,
                break1StartInput.value, break1EndInput.value,
                break2StartInput.value, break2EndInput.value)
            + calculateLeaveMinutes());
    }

    /**
     * 計算できない理由を結果表示エリアに示す。数値は「--.--」とし、
     * 見出しを警告色にして気づけるようにする。
     * @param {string} message - 理由
     * @returns {void}
     */
    function renderResultProblem(message) {
        renderResult(message, '--.--', '--.--', '--.--');
        const head = resultDiv.querySelector('.result-head');
        if (head) {
            head.classList.add('problem');
        }
    }

    /**
     * 現在の入力内容から計算結果を常時表示する。
     * 入力途中でも状況が分かるよう、不備がある場合もアラートは出さず
     * 見出しで理由を示して数値は「--.--」とする。
     * @returns {void}
     */
    function updateLiveResult() {
        updateTimeTexts();
        const start = startTimeInput.value;
        const end = endTimeInput.value;
        if (annualLeaveCheckbox.checked) {
            // 年休は時刻を使わず固定値で登録されるため、その内容をそのまま示す
            renderResult('年休', '7.75', '0.00', '0.00');
            return;
        }
        if (!start || !end) {
            renderResultProblem('始業・終業時刻を入力してください');
            return;
        }
        if (!isStartTimeBeforeEndTime(start, end)) {
            renderResultProblem('始業時刻が終業時刻より遅くなっています');
            return;
        }
        // 中断時間が不正なまま計算すると誤った数値を見せてしまうため、理由を示す
        const problems = collectInterruptProblems(toMinutes(start), toMinutes(end));
        if (problems.length > 0) {
            renderResultProblem(problems[0]);
            return;
        }
        const interruptHours = calculateInterruptHours();
        const actual = calculateActualHours(start, end);
        const overtime = (parseFloat(actual) - 7.75).toFixed(2);
        renderResult(`${formatTime(start)} → ${formatTime(end)}`, actual, interruptHours.toFixed(2), overtime);
    }

    /**
     * 保存すると記録が壊れてしまう入力エラーを集めて返す。
     * 入力ミスの可能性を知らせるだけのものは警告として別に扱う。
     * @param {string} start - 始業時刻 HH:MM
     * @param {string} end - 終業時刻 HH:MM
     * @returns {string[]} エラーメッセージ（問題が無ければ空配列）
     */
    function collectInputErrors(start, end) {
        const errors = [];
        if (!isStartTimeBeforeEndTime(start, end)) {
            errors.push('始業時刻が終業時刻より遅くなっています。');
        }
        // 中断時間は開始と終了が揃っていないと計算されず、記録だけが残ってしまう
        const pairs = [
            [break1StartInput, break1EndInput, '(1)'],
            [break2StartInput, break2EndInput, '(2)']
        ];
        pairs.forEach(([startInput, endInput, label]) => {
            if (!startInput.value !== !endInput.value) {
                errors.push(`中断時間${label}は開始と終了の両方を入力してください。`);
            }
        });
        const selectedCount = parseInt(groupCountPicker.value, 10);
        for (let i = 1; i <= selectedCount; i++) {
            const hours = document.getElementById(`task-hours${i}`).value;
            if (hours !== '' && parseFloat(hours) < 0) {
                errors.push(`業務${i}の工数にマイナスの値が入力されています。`);
            }
        }
        return errors;
    }

    /**
     * 業務コード・分類の入力ミスの可能性を警告として集めて返す。
     * @param {number} count - 確認するグループ数
     * @returns {string[]} 警告メッセージ
     */
    function collectTaskWarnings(count) {
        const warnings = [];
        for (let i = 1; i <= count; i++) {
            const taskNumber = document.getElementById(`task-number${i}`).value;
            const category = document.getElementById(`category${i}`).value;
            if (taskNumber) {
                // 日本語などが入る例外があるため、英字始まりと数字始まりのみ確認する
                if (/^[A-Za-z]/.test(taskNumber)) {
                    if (taskNumber.length !== 10) {
                        warnings.push(`業務${i}の業務コードは10桁で入力してください。`);
                    }
                } else if (/^[0-9]/.test(taskNumber)) {
                    warnings.push(`業務${i}の業務コードが数字で始まっています。`);
                }
            }
            if (category && !/^\d{5}$/.test(category)) {
                warnings.push(`業務${i}の分類は数字5桁で入力してください。`);
            }
        }
        return warnings;
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

    setInitialDate();
    window.addEventListener('pageshow', setInitialDate);
    // 開いたままの画面に戻ったとき（翌朝など）にも、日付を今日に合わせ直す
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            setInitialDate();
        }
    });

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
        // 翌日午前4時までは前日を「今日」とみなす（まだ勤務中かもしれない日を警告しないため）
        let checked = 0;
        let d = parseDateLocal(getBusinessToday(getJSTNow()));
        while (checked < 2) {
            d.setDate(d.getDate() - 1);
            while (isHolidayDate(d)) {
                d.setDate(d.getDate() - 1);
            }
            const str = formatYmd(d);
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

    /**
     * 今日以外の日付で、その日の記録がすでにあるかを返す。
     * 前の日付のまま気づかずに保存し、その日の記録を上書きしてしまうのを防ぐために使う。
     * @param {string} date - YYYY-MM-DD形式の日付
     * @returns {boolean} 今日以外で記録があれば true
     */
    function overwritesOtherDay(date) {
        if (date === getBusinessToday(getJSTNow())) return false;
        return parseLogsToMap(localStorage.getItem('logs')).has(date);
    }

    // 工数保存ボタンのクリックイベントリスナー
    submitButton.addEventListener('click', function() {
        const selectedDate = dateInput.value;
        if (!selectedDate) {
            alert("日付が入力されていません。");
            return;
        }
        if (overwritesOtherDay(selectedDate)
            && !confirm(`${formatDateWithDay(selectedDate)} の記録を上書きします。よろしいですか？`)) {
            return;
        }

        // 年休は始業・終業時刻を使わず固定値でログに登録する（同じ日付があれば上書き）
        if (annualLeaveCheckbox.checked) {
            saveLog(selectedDate, '年休', '年休', '7.75', '0.00', '', '', '', '');
            saveInputDetail(selectedDate);
            resultDiv.innerHTML = `<div class="result-head">${formatDateWithDay(selectedDate)}</div>`
                + '<div class="result-message">年休として保存しました</div>';
            saveTaskDataToStorage();
            return;
        }

        const selectedStartTime = startTimeInput.value;
        const selectedEndTime = endTimeInput.value;
        if (!selectedStartTime || !selectedEndTime) {
            alert("始業時刻または終業時刻が入力されていません。");
            return;
        }
        // 記録が壊れる入力はまとめて知らせ、保存せずに中断する
        const inputErrors = collectInputErrors(selectedStartTime, selectedEndTime);
        if (inputErrors.length > 0) {
            alert(inputErrors.join('\n'));
            return;
        }
        if (!checkHalfDayInput() || !checkInterruptInput()) {
            return;
        }
        const workingHours = calculateWorkingHoursWithLeave(selectedStartTime, selectedEndTime);
        const interruptHours = calculateInterruptHours();
        // 入力工数との比較は、中断時間を差し引いた実際の勤務時間を基準にする
        const actual = calculateActualHours(selectedStartTime, selectedEndTime);
        // 見つかった問題点はここに集約し、最後にまとめて1回のalertで表示する
        const issueMessages = [];
        let firstEmptyTaskHoursIndex = -1;
        let allTaskCategoriesFilled = 0;
        if (selectedStartTime === selectedEndTime) {
            issueMessages.push("勤務時間が0時間です。");
        }
        if (parseFloat(workingHours) > 16) {
            issueMessages.push("勤務時間が16時間を超えています。");
        }
        let totalTaskHours = calculateTotalTaskHours();

        // 現在の日付を取得（翌日午前4時までは前日を「今日」とみなす）
        const now = getJSTNow();
        const today = getBusinessToday(now);

        // 今日以外の日付が指定された場合の警告表示
        if (selectedDate !== today) {
            issueMessages.push("今日以外の日付が指定されています。");
        }
        // 終業前でも入力内容の確認はできるようにするため、未来の日時は警告に留める
        if (new Date(`${selectedDate}T${selectedEndTime}`) > now) {
            issueMessages.push("未来の日時が入力されています。");
        }

        const selectedCount = parseInt(groupCountPicker.value, 10);
        issueMessages.push(...collectTaskWarnings(selectedCount));
        // 空の工数フィールドを自動的に埋める処理と業務情報が入力されているかのチェック
        for (let i = 1; i <= selectedCount; i++) {
            const taskNumber = document.getElementById(`task-number${i}`).value;
            const taskHours = document.getElementById(`task-hours${i}`).value;
            const category = document.getElementById(`category${i}`).value;
            if (taskNumber && !taskHours && firstEmptyTaskHoursIndex === -1) {
                firstEmptyTaskHoursIndex = i;
            }
            if (category) {
                allTaskCategoriesFilled++;
            }
        }

        // 勤務工数が作業工数より少ない場合のチェック
        if (parseFloat(actual) < totalTaskHours) {
            issueMessages.push("勤務時間が作業工数より少ないです。");
        }

        // 業務情報が一つ以上含まれている場合のみ補完処理を実行する。
        // 工数の合計が勤務時間を超えているときは、空欄に入れる値が無いので補完しない
        if (Math.abs(parseFloat(actual) - totalTaskHours) > 0.01) {
            const taskHours = parseFloat(actual) - totalTaskHours;
            if (taskHours > 0 && allTaskCategoriesFilled > 0 && firstEmptyTaskHoursIndex !== -1) {
                document.getElementById(`task-hours${firstEmptyTaskHoursIndex}`).value = taskHours.toFixed(2);
                totalTaskHours = calculateTotalTaskHours();
                issueMessages.push(`勤務時間と入力工数の差分は、業務${firstEmptyTaskHoursIndex}に反映します。`);
            } else {
                issueMessages.push("勤務時間と入力工数に差分があります。");
            }
        }

        // 警告があっても登録は行うため、登録した旨を必ず伝える
        if (issueMessages.length > 0) {
            alert(`${issueMessages.join('\n')}\n\n保存しました。`);
        } else {
            alert("保存しました。");
        }

        const overtime = (parseFloat(actual) - 7.75).toFixed(2);
        renderResult(
            `${formatDateWithDay(selectedDate)}　${formatTime(selectedStartTime)} → ${formatTime(selectedEndTime)}`,
            actual, interruptHours.toFixed(2), overtime,
            `入力工数 ${totalTaskHours.toFixed(2)} 時間`
        );
        // 「工数保存」を押した時点でログに保存する（同じ日付があれば上書き）
        saveLog(selectedDate, selectedStartTime, selectedEndTime, actual, overtime,
            break1StartInput.value, break1EndInput.value,
            break2StartInput.value, break2EndInput.value);
        saveInputDetail(selectedDate);
        saveTaskDataToStorage();  // データを保存
    });

    // メール作成ボタンのクリックイベントリスナー
    // メールを作成する日は勤務が確定しているため、登録もあわせて行う。
    // 休暇の日やメールを後で送る日は「工数保存」ボタンを使う
    emailButton.addEventListener('click', function() {
        if (annualLeaveCheckbox.checked || amLeaveCheckbox.checked || pmLeaveCheckbox.checked) {
            return;
        }
        // 宛先はメイン画面から外し、設定画面で管理している
        const email = localStorage.getItem('email') || '';
        const selectedDate = dateInput.value;
        const selectedStartTime = startTimeInput.value;
        const selectedEndTime = endTimeInput.value;
        if (!selectedDate || !selectedStartTime || !selectedEndTime) {
            alert("日付・始業時刻・終業時刻が入力されていません。");
            return;
        }
        // 記録が壊れる入力に加え、宛先が不正だとメールアプリが正しく起動しないため確認する
        const mailErrors = collectInputErrors(selectedStartTime, selectedEndTime);
        if (!email) {
            mailErrors.push('メニューの「設定」で宛先メールアドレスを設定してください。');
        } else if (!isValidEmail(email)) {
            mailErrors.push('宛先メールアドレスの形式が正しくありません。メニューの「設定」で修正してください。');
        }
        if (mailErrors.length > 0) {
            alert(mailErrors.join('\n'));
            return;
        }
        if (!checkInterruptInput()) {
            return;
        }
        const interruptHours = calculateInterruptHours();
        // 入力工数との比較は、中断時間を差し引いた実際の勤務時間を基準にする
        const actual = calculateActualHours(selectedStartTime, selectedEndTime);
        const totalTaskHours = calculateTotalTaskHours();

        const subject = "スマ勤";
        const newline = '\r\n';

        let body = `@基本${newline}日付 ${selectedDate}${newline}始業 ${selectedStartTime}${newline}終業 ${selectedEndTime}${newline}`;

        // 業務情報をメール本文に追加する。工数が0または空の業務は含めない。
        // 業務番号か分類があるのに工数が空の業務は、入れ忘れの可能性があるため確認に出す
        const selectedCount = parseInt(groupCountPicker.value, 10);
        const emptyHoursTasks = [];
        for (let i = 1; i <= selectedCount; i++) {
            const title = document.getElementById(`title${i}`).value;
            const taskNumber = document.getElementById(`task-number${i}`).value;
            const category = document.getElementById(`category${i}`).value;
            const taskHours = document.getElementById(`task-hours${i}`).value;
            if (!taskHours) {
                if (taskNumber || category) {
                    emptyHoursTasks.push(i);
                }
                continue;
            }
            if (parseFloat(taskHours) === 0) {
                continue;
            }
            const taskHoursConverted = parseFloat(taskHours).toFixed(2);
            body += `${newline}@業務${newline}業務 ${taskNumber}${newline}分類 ${category}${newline}工数 ${taskHoursConverted}${newline}備考 ${title}${newline}`;
        }

        // 現在の日付を取得（翌日午前4時までは前日を「今日」とみなす）
        const now = getJSTNow();
        const today = getBusinessToday(now);

        const selectedDateTime = new Date(`${selectedDate}T${selectedEndTime}`);
        if (selectedDateTime > now) {
            alert('未来の日時が入力されています');
            return;
        }

        // 確認が必要な項目はここに集約し、最後にまとめて1回のconfirmで表示する
        const confirmMessages = [];
        confirmMessages.push(...collectTaskWarnings(selectedCount));
        emptyHoursTasks.forEach(i => {
            confirmMessages.push(`業務${i}の工数が空のため、メールに含めません。`);
        });
        if (Math.abs(parseFloat(actual) - totalTaskHours) > 0.01) {
            confirmMessages.push("勤務時間と入力工数に差分があります。");
        }
        if (overwritesOtherDay(selectedDate)) {
            confirmMessages.push(`今日以外の日付です。${formatDateWithDay(selectedDate)} の記録を上書きします。`);
        } else if (selectedDate !== today) {
            confirmMessages.push("今日以外の日付が指定されています。");
        }
        if (confirmMessages.length > 0) {
            const confirmSend = confirm(confirmMessages.join('\n') + "\n続行しますか？");
            if (!confirmSend) {
                return;
            }
        }
        saveTaskDataToStorage();  // データを保存

        // 送信する内容をそのままログにも登録する（「工数保存」ボタンと同じ計算）
        const overtime = (parseFloat(actual) - 7.75).toFixed(2);
        saveLog(selectedDate, selectedStartTime, selectedEndTime, actual, overtime,
            break1StartInput.value, break1EndInput.value,
            break2StartInput.value, break2EndInput.value);
        saveInputDetail(selectedDate);
        // 登録だけなのかメールまで作成したのかを後から見分けられるよう、
        // ログ表示画面用に「メール作成済み」を記録する
        markLogAsMailed(selectedDate);
        // メールアプリから戻ったときに登録済みだと分かるようにする
        renderResult(
            `${formatDateWithDay(selectedDate)}　${formatTime(selectedStartTime)} → ${formatTime(selectedEndTime)}`,
            actual, interruptHours.toFixed(2), overtime,
            `入力工数 ${totalTaskHours.toFixed(2)} 時間`
        );
        window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });

    // Pull-to-refreshの実装（「更新」ボタンと同じ処理を行う）
    setupPullToRefresh();

    // ブラウザが自動で出すインストールの案内は出さない（「ホーム画面に追加」から入れてもらう）
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
    });

    // ページロード時の処理
    window.addEventListener('load', () => {
        loadTaskDataFromStorage();
        // ログ画面の「入力画面に戻す」から来たときは、その日の内容に置き換える。
        // それ以外は、ほかの画面へ移る前の工数・中断時間・休暇を戻す
        if (!applyRestoreRequest()) {
            restoreInputDraft();
        }
        inputDraftReady = true;
        updateLiveResult();
        // 起動時のみ一度だけ入力漏れ警告を表示する
        if (!sessionStorage.getItem('missingLogsChecked')) {
            sessionStorage.setItem('missingLogsChecked', '1');
            afterFirstPaint(checkMissingLogs);
        }
    });

    /**
     * 画面を描き終えてから処理を行う。読み込みの途中で alert を出すと、iPhone では
     * 画面が描かれる前に止まり、背景に何もない状態で知らせが出るため。
     * 描く処理（requestAnimationFrame）のあと、描いたものが画面に届くまで少し待つ。
     * @param {function(): void} fn - 描き終えてから行う処理
     * @returns {void}
     */
    function afterFirstPaint(fn) {
        requestAnimationFrame(() => setTimeout(fn, 100));
    }

    // サービスワーカーが変更された場合の処理
    let refreshing;
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', function() {
            if (refreshing) return;
            window.location.reload();
            refreshing = true;
        });
    }
});
