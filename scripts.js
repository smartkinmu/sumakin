if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
}

document.addEventListener('DOMContentLoaded', function() {
    const emailInput = document.getElementById('email');
    const dateInput = document.getElementById('date');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');
    const resultDiv = document.getElementById('result');
    const submitButton = document.getElementById('submit-button');
    const emailButton = document.getElementById('email-button');
    const refreshButton = document.getElementById('refresh-button');
    const refreshIndicator = document.getElementById('refresh-indicator');
    const copyTask1Button = document.getElementById('copy-task1-button');

    const groupCountPicker = document.getElementById("group-count");
    const taskGroupsContainer = document.getElementById("task-groups-container");

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

    // ログ保存用関数
    // 日付,始業,終業,勤務時間,残業時間 の形式で保存する
    function saveLog(date, start, end, work, overtime) {
        const line = `${date},${start},${end},${work},${overtime}`;
        const existing = localStorage.getItem('logs');
        const updated = existing ? `${existing}\n${line}` : line;
        localStorage.setItem('logs', updated);
    }

    function saveTaskDataToStorage() {
        const totalGroups = 10;  // 最大20グループまで保存
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
    
    // 更新ボタンのクリックイベントリスナー
    refreshButton.addEventListener('click', async () => {
        if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ action: 'sync' });
            const reg = await navigator.serviceWorker.getRegistration();
            reg?.update();
        }
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

    // 今日の日付をデフォルト値として設定
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    dateInput.value = today;

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

    // 勤務時間を計算する関数
    function calculateWorkingHours(startTime, endTime) {
        const start = new Date(`1970-01-01T${startTime}:00`);
        const end = new Date(`1970-01-01T${endTime}:00`);
        let totalMinutes = (end - start) / (1000 * 60);
    
        const breaks = [
            { start: "11:45", end: "12:45" },
            { start: "19:15", end: "19:45" }
        ];
    
        // 休憩時間を差し引く処理
        breaks.forEach(b => {
            const breakStart = new Date(`1970-01-01T${b.start}:00`);
            const breakEnd = new Date(`1970-01-01T${b.end}:00`);
            if (start < breakEnd && end > breakStart) {
                const overlapStart = start < breakStart ? breakStart : start;
                const overlapEnd = end > breakEnd ? breakEnd : end;
                totalMinutes -= (overlapEnd - overlapStart) / (1000 * 60);
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
        const start = new Date(`1970-01-01T${startTime}:00`);
        const end = new Date(`1970-01-01T${endTime}:00`);
        return start <= end;
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
        const workingHours = calculateWorkingHours(selectedStartTime, selectedEndTime);
        let issuesFound = false;
        let firstEmptyTaskHoursIndex = -1;
        let allTaskCategoriesFilled = 0;
        if (!isStartTimeBeforeEndTime(selectedStartTime, selectedEndTime)) {
            alert("始業時刻が終業時刻より遅くなっています。");
            issuesFound = true;
        }
        let totalTaskHours = calculateTotalTaskHours();

        // 現在の日付を取得
        const now = new Date();
        const today = now.toISOString().split('T')[0];

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

        resultDiv.innerHTML = `<p>日付 ${selectedDate} (${selectedDayOfWeek})<br>始業 ${selectedStartTime}<br>終業 ${selectedEndTime}<br>勤務時間 ${workingHours} 時間<br>入力工数 ${totalTaskHours.toFixed(2)} 時間</p>`;
        saveTaskData();  // データを保存
    });

    // メール作成ボタンのクリックイベントリスナー
    emailButton.addEventListener('click', function() {
        const email = emailInput.value;
        const selectedDate = dateInput.value;
        const selectedStartTime = startTimeInput.value;
        const selectedEndTime = endTimeInput.value;
        const workingHours = calculateWorkingHours(selectedStartTime, selectedEndTime);
        const totalTaskHours = calculateTotalTaskHours();

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
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // 今日以外の日付が指定された場合の確認
        if (selectedDate !== today) {
            const confirmSend = confirm("今日以外の日付が指定されています。続行しますか？");
            if (!confirmSend) {
                return;
            }
        }
        saveTaskData();  // データを保存
        const overtime = (Math.max(0, parseFloat(workingHours) - 7.75)).toFixed(2);
        saveLog(selectedDate, selectedStartTime, selectedEndTime, workingHours, overtime);
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
        document.querySelector(`input[name="newline"][value="${savedNewline}"]`).checked = true;

        const savedMailFormat = localStorage.getItem('mailformat') || 'plain';
        document.querySelector(`input[name="mailformat"][value="${savedMailFormat}"]`).checked = true;
    });

    // サービスワーカーが変更された場合の処理
    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
        if (refreshing) return;
        window.location.reload();
        refreshing = true;
    });
});
