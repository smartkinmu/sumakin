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

    // 更新ボタンのクリックイベントリスナー
    refreshButton.addEventListener('click', function() {
        refreshIndicator.style.display = 'block';
        setTimeout(() => {
            location.reload();
        }, 1500);
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

    // 業務データ入力ボックスにもblurイベントを追加
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`task-number${i}`).addEventListener('blur', saveTaskData);
        document.getElementById(`category${i}`).addEventListener('blur', saveTaskData);
        document.getElementById(`title${i}`).addEventListener('blur', saveTaskData);
    }

    // 勤務時間を計算する関数
    function calculateWorkingHours(startTime, endTime) {
        const start = new Date(`1970-01-01T${startTime}:00`);
        const end = new Date(`1970-01-01T${endTime}:00`);
        let totalMinutes = (end - start) / (1000 * 60);

        const breaks = [
            { start: "12:15", end: "13:15" },
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

        return (totalMinutes / 60).toFixed(2);
    }

    // 入力工数を計算する関数
    function calculateTotalTaskHours() {
        let totalTaskHours = 0;
        for (let i = 1; i <= 6; i++) {
            const taskHours = parseFloat(document.getElementById(`task-hours${i}`).value) || 0;
            totalTaskHours += taskHours;
        }
        return totalTaskHours;
    }

    // 業務データを保存する関数
    function saveTaskData() {
        for (let i = 1; i <= 6; i++) {
            localStorage.setItem(`title${i}`, document.getElementById(`title${i}`).value);
            localStorage.setItem(`task-number${i}`, document.getElementById(`task-number${i}`).value);
            localStorage.setItem(`category${i}`, document.getElementById(`category${i}`).value);
        }
        localStorage.setItem('email', emailInput.value);
        localStorage.setItem('startTime', startTimeInput.value);
        localStorage.setItem('endTime', endTimeInput.value);
    }

    // 業務データをロードする関数
    function loadTaskData() {
        for (let i = 1; i <= 6; i++) {
            document.getElementById(`title${i}`).value = localStorage.getItem(`title${i}`) || '';
            document.getElementById(`task-number${i}`).value = localStorage.getItem(`task-number${i}`) || '';
            document.getElementById(`category${i}`).value = localStorage.getItem(`category${i}`) || '';
        }
        document.getElementById(`email`).value = localStorage.getItem(`email`) || '';
        document.getElementById(`startTime`).value = localStorage.getItem(`startTime`) || '';
        document.getElementById(`endTime`).value = localStorage.getItem(`endTime`) || '';
    }

    // 入力チェックボタンのクリックイベントリスナー
    submitButton.addEventListener('click', function() {
        const selectedDate = dateInput.value;
        const selectedDayOfWeek = getDayOfWeek(selectedDate);
        const selectedStartTime = startTimeInput.value;
        const selectedEndTime = endTimeInput.value;
        const workingHours = calculateWorkingHours(selectedStartTime, selectedEndTime);
        let totalTaskHours = calculateTotalTaskHours();

        let issuesFound = false;
        let firstEmptyTaskHoursIndex = -1;
        let allTaskCategoriesFilled = 0;

        // 現在の日付を取得
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // 今日以外の日付が指定された場合の警告表示
        if (selectedDate !== today) {
            alert("今日以外の日付が指定されています。");
            issuesFound = true;
        }

        // 空の工数フィールドを自動的に埋める処理と業務情報が入力されているかのチェック
        for (let i = 1; i <= 6; i++) {
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
        for (let i = 1; i <= 6; i++) {
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
