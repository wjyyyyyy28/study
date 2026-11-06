(() => {
  "use strict";

  const STORAGE_KEY = "yantu-data-v1";
  const SUBJECTS = ["政治", "英语", "数学", "专业课", "其他"];
  const SUBJECT_COLORS = {
    政治: "#e77954",
    英语: "#708c7b",
    数学: "#d0a653",
    专业课: "#7f95ac",
    其他: "#a09b90"
  };
  const SUBJECT_CLASSES = {
    政治: "",
    英语: "english",
    数学: "math",
    专业课: "major",
    其他: "other"
  };
  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
  const QUOTES = [
    "慢一点没关系，只要一直在向前。",
    "把今天该走的路走好，答案会在路上出现。",
    "稳定的重复，胜过偶尔的全力以赴。",
    "不用和别人比速度，你只需要比昨天更笃定。",
    "那些看似普通的一天，正在悄悄拉开差距。",
    "把书翻到下一页，就是离目标更近一步。",
    "允许自己疲惫，但不要轻易否定自己。",
    "今天的专注，会成为考场上的底气。",
    "不必每天都耀眼，只要每天都算数。",
    "先完成，再完善；先出发，再抵达。",
    "真正的进步，常常安静得只有自己知道。",
    "你记住的每一个知识点，都在为未来铺路。",
    "所有认真度过的日子，都不会白费。",
    "坚持不是一直热血，而是今天仍然愿意打开书。",
  ];

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  function pad(number) {
    return String(number).padStart(2, "0");
  }

  function dateKey(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseDate(key) {
    if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    const [year, month, day] = key.split("-").map(Number);
    const date = new Date(year, month - 1, day, 12);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function startOfDay(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, amount) {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  }

  function daysBetween(start, end) {
    const startDay = startOfDay(start);
    const endDay = startOfDay(end);
    return Math.round((endDay - startDay) / 86400000);
  }

  function thirdSaturdayDecember(year) {
    const date = new Date(year, 11, 1, 12);
    const offset = (6 - date.getDay() + 7) % 7;
    date.setDate(1 + offset + 14);
    return dateKey(date);
  }

  function defaultData() {
    const now = new Date();
    const targetYear = now.getFullYear() + 1;
    return {
      version: 1,
      name: "",
      settings: {
        targetYear,
        examDate: thirdSaturdayDecember(targetYear - 1),
        dailyGoalMinutes: 240,
        targetSchool: "",
        targetTotalScore: 0,
        targetSubjectScores: {
          政治: 0,
          英语: 0,
          数学: 0,
          专业课: 0,
        },
      },
      sessions: [],
      timer: {
        status: "idle",
        startedAt: null,
        accumulatedSeconds: 0,
        subject: "数学",
      },
    };
  }

  function normalizeData(input) {
    const base = defaultData();
    if (!input || typeof input !== "object") return base;

    const settings = input.settings && typeof input.settings === "object" ? input.settings : {};
    const targetYear = Number(settings.targetYear);
    const examDate = parseDate(settings.examDate)
      ? settings.examDate
      : thirdSaturdayDecember((Number.isFinite(targetYear) ? targetYear : base.settings.targetYear) - 1);
    const goal = Number(settings.dailyGoalMinutes);
    const targetScores =
      settings.targetSubjectScores && typeof settings.targetSubjectScores === "object"
        ? settings.targetSubjectScores
        : {};
    const timer = input.timer && typeof input.timer === "object" ? input.timer : {};

    return {
      version: 1,
      name: typeof input.name === "string" ? input.name.slice(0, 12) : "",
      settings: {
        targetYear:
          Number.isFinite(targetYear) && targetYear >= 2000
            ? targetYear
            : base.settings.targetYear,
        examDate,
        dailyGoalMinutes:
          Number.isFinite(goal) && goal >= 60 && goal <= 720 ? goal : base.settings.dailyGoalMinutes,
        targetSchool:
          typeof settings.targetSchool === "string"
            ? settings.targetSchool.trim().slice(0, 30)
            : "",
        targetTotalScore: clampTargetScore(settings.targetTotalScore, 500),
        targetSubjectScores: Object.fromEntries(
          SUBJECTS.slice(0, 4).map((subject) => [
            subject,
            clampTargetScore(targetScores[subject], 150),
          ])
        ),
      },
      sessions: Array.isArray(input.sessions)
        ? input.sessions.filter(isValidSession).map((session) => ({
            id: String(session.id || createId()),
            date: session.date,
            subject: SUBJECTS.includes(session.subject) ? session.subject : "其他",
            durationMinutes: Math.max(1, Math.min(1440, Number(session.durationMinutes) || 1)),
            content: String(session.content || "").slice(0, 500),
            mood: ["一般", "专注", "高效"].includes(session.mood) ? session.mood : "专注",
            createdAt: session.createdAt || new Date().toISOString(),
            updatedAt: session.updatedAt || null,
            source: session.source === "timer" ? "timer" : "manual",
          }))
        : [],
      timer: {
        status: ["idle", "running", "paused"].includes(timer.status) ? timer.status : "idle",
        startedAt: Number(timer.startedAt) || null,
        accumulatedSeconds: Math.max(0, Number(timer.accumulatedSeconds) || 0),
        subject: SUBJECTS.includes(timer.subject) ? timer.subject : "数学",
      },
    };
  }

  function isValidSession(session) {
    return (
      session &&
      typeof session === "object" &&
      Boolean(parseDate(session.date)) &&
      Number(session.durationMinutes) > 0 &&
      String(session.content || "").trim().length > 0
    );
  }

  function clampTargetScore(value, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(max, Math.round(number)));
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeData(JSON.parse(raw)) : defaultData();
    } catch (error) {
      console.warn("无法读取本地数据，将使用默认设置。", error);
      return defaultData();
    }
  }

  let data = loadData();
  let activeView = "today";
  let selectedDate = null;
  let selectedSubject = "数学";
  let selectedMood = "专注";
  let recordTimerSeconds = null;
  let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let timerInterval = null;
  let toastTimeout = null;
  let confirmCallback = null;
  let deferredInstallPrompt = null;

  const recordModal = $("#recordModal");
  const confirmModal = $("#confirmModal");
  const timerScreen = $("#timerScreen");

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      showToast("本地存储空间不足");
      console.error("保存失败", error);
    }
  }

  function createId() {
    if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getSessionsForDate(key) {
    return data.sessions.filter((session) => session.date === key);
  }

  function totalMinutes(sessions) {
    return sessions.reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);
  }

  function uniqueStudyDays(sessions = data.sessions) {
    return new Set(sessions.map((session) => session.date)).size;
  }

  function calculateStreak() {
    const studied = new Set(data.sessions.map((session) => session.date));
    if (!studied.size) return 0;
    let cursor = startOfDay(new Date());
    if (!studied.has(dateKey(cursor))) cursor = addDays(cursor, -1);
    let streak = 0;
    while (studied.has(dateKey(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function calculateBestStreak() {
    const keys = [...new Set(data.sessions.map((session) => session.date))].sort();
    if (!keys.length) return 0;
    let best = 1;
    let current = 1;
    for (let index = 1; index < keys.length; index += 1) {
      if (daysBetween(parseDate(keys[index - 1]), parseDate(keys[index])) === 1) {
        current += 1;
        best = Math.max(best, current);
      } else {
        current = 1;
      }
    }
    return best;
  }

  function formatDuration(minutes) {
    const rounded = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(rounded / 60);
    const rest = rounded % 60;
    if (hours && rest) return `${hours} 小时 ${rest} 分钟`;
    if (hours) return `${hours} 小时`;
    return `${rest} 分钟`;
  }

  function formatCompactDuration(minutes) {
    const value = Math.max(0, Number(minutes) || 0);
    if (value < 60) return `${Math.round(value)}m`;
    const hours = value / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
  }

  function formatHoursNumber(minutes) {
    const value = Math.max(0, Number(minutes) || 0);
    if (!value) return "0";
    const hours = value / 60;
    if (hours < 0.1) return "0.1";
    if (hours >= 10) return String(Math.round(hours));
    return hours.toFixed(1).replace(/\.0$/, "");
  }

  function formatClock(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(
      seconds % 60
    )}`;
  }

  function formatDateLong(key) {
    const date = parseDate(key);
    if (!date) return "";
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  }

  function formatDateShort(key) {
    const date = parseDate(key);
    if (!date) return "";
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  }

  function relativeDateLabel(key) {
    const today = dateKey();
    const yesterday = dateKey(addDays(new Date(), -1));
    if (key === today) return "今天";
    if (key === yesterday) return "昨天";
    return WEEKDAYS[parseDate(key).getDay()] === "日" ? "周日" : `周${WEEKDAYS[parseDate(key).getDay()]}`;
  }

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 5) return "夜深了";
    if (hour < 11) return "早上好";
    if (hour < 14) return "中午好";
    if (hour < 18) return "下午好";
    return "晚上好";
  }

  function getTodayLabel() {
    const now = new Date();
    return `${now.getMonth() + 1} 月 ${now.getDate()} 日 · 星期${WEEKDAYS[now.getDay()]}`;
  }

  function getCurrentWeek() {
    const today = startOfDay(new Date());
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = addDays(today, -mondayOffset);
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  }

  function getLastSevenDays() {
    const today = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));
  }

  function renderHeader() {
    const displayName = data.name.trim() || "同学";
    const avatarText = data.name.trim().slice(0, 1) || "研";
    $("#todayDate").textContent = getTodayLabel();
    $("#todayTitle").innerHTML = `${getGreeting()}，<span id="greetName">${escapeHtml(
      displayName
    )}</span>`;
    $("#avatarLetter").textContent = avatarText;
    $("#largeAvatar").textContent = avatarText;
  }

  function renderExam() {
    const examDate = parseDate(data.settings.examDate) || new Date();
    const daysLeft = Math.max(0, daysBetween(new Date(), examDate));
    const totalWindow = 365;
    const progress = Math.min(100, Math.max(2, ((totalWindow - daysLeft) / totalWindow) * 100));
    const expectedDate = thirdSaturdayDecember(data.settings.targetYear - 1);
    const isExpected = expectedDate === data.settings.examDate;

    $("#examYear").textContent = data.settings.targetYear;
    $("#daysLeft").textContent = daysLeft;
    $("#examDateLabel").textContent = `${examDate.getFullYear()}.${pad(
      examDate.getMonth() + 1
    )}.${pad(examDate.getDate())}`;
    $("#examDateHint").textContent = isExpected ? "预计考试日" : "自定义考试日";
    $("#examProgressBar").style.width = `${progress}%`;
    $("#examProgressText").textContent =
      daysLeft === 0
        ? "考试日已到，愿你从容落笔"
        : `距离目标还有 ${daysLeft} 天`;
  }

  function getDailyIndex() {
    return Math.floor(
      (startOfDay(new Date()) - new Date(new Date().getFullYear(), 0, 0)) / 86400000
    );
  }

  function getSchoolEncouragement() {
    const dailyIndex = getDailyIndex();
    const school = data.settings.targetSchool.trim();
    if (school) {
      const schoolQuotes = [
        `今天多弄懂一道题，就离${school}更近一步。`,
        `想去${school}，就把今天这一步走稳。`,
        `你现在认真写下的每一个字，都在铺向${school}的路。`,
        `下一站，${school}。现在先读完这一页。`,
        `为了${school}，今天也请稳稳向前。`,
        `把向往${school}的心，变成今天专注的每一分钟。`,
        `通往${school}的路上，慢一点也没关系，别停下。`,
        `你与${school}之间，只隔着今天愿意完成的那一点。`,
      ];
      return schoolQuotes[dailyIndex % schoolQuotes.length];
    }

    const genericQuotes = [
      "写下心之所向，让今天每一次努力都有方向。",
      "不用一开始就看见终点，先把眼前这页书读好。",
      "每一次坐回书桌前，都是对未来的一次回答。",
      "稳定地向前，比偶尔用力更重要。",
      "今天多学一点点，明天就多一分从容。",
    ];
    return genericQuotes[dailyIndex % genericQuotes.length];
  }

  function displayTargetScore(score) {
    return Number(score) > 0 ? String(score) : "--";
  }

  function renderTargetProfile() {
    const school = data.settings.targetSchool.trim();
    const total = data.settings.targetTotalScore;
    const encouragement = getSchoolEncouragement();

    $("#targetYearBadge").textContent = data.settings.targetYear;
    $("#targetSchoolName").textContent = school || "设置你的目标院校";
    $("#targetSchoolName").classList.toggle("empty", !school);
    $("#targetTotalScore").textContent = displayTargetScore(total);
    $("#schoolEncouragement").textContent = encouragement;
    $("#welcomeTarget").textContent = school ? `下一站 · ${school}` : "等待你写下目标院校";
    $("#welcomeQuote").textContent = encouragement;

    $$("[data-target-subject]").forEach((element) => {
      const score = data.settings.targetSubjectScores[element.dataset.targetSubject] || 0;
      element.textContent = displayTargetScore(score);
    });
  }

  function renderToday() {
    const sessions = getSessionsForDate(dateKey());
    const minutes = totalMinutes(sessions);
    const goal = data.settings.dailyGoalMinutes;
    const percent = Math.min(100, Math.round((minutes / goal) * 100));

    $("#todayDuration").textContent = formatDuration(minutes);
    $("#goalPercent").textContent = `${percent}%`;
    $("#goalRing").style.setProperty("--progress", percent);
    $("#streakStat").textContent = calculateStreak();
    $("#totalHoursStat").textContent = formatHoursNumber(totalMinutes(data.sessions));
    $("#checkinStat").textContent = data.sessions.length;

    if (!minutes) {
      $("#goalMessage").textContent = "今天还没有开始，先学 25 分钟吧";
    } else if (minutes < goal) {
      $("#goalMessage").textContent = `再学 ${formatDuration(goal - minutes)} 就完成今日目标`;
    } else {
      $("#goalMessage").textContent = "今日目标已完成，做得很好";
    }

    $("#startFocusButton span").textContent =
      data.timer.status === "running"
        ? "计时进行中"
        : data.timer.status === "paused"
          ? "继续专注"
          : "开始学习";
    $("#startFocusButton use").setAttribute(
      "href",
      data.timer.status === "running" ? "#icon-pause" : "#icon-play"
    );

    const dailyIndex = getDailyIndex();
    $("#dailyQuote").textContent = QUOTES[dailyIndex % QUOTES.length];
    $("#sidebarQuote").textContent = QUOTES[(dailyIndex + 3) % QUOTES.length];
  }

  function renderWeek() {
    const studied = new Set(data.sessions.map((session) => session.date));
    $("#weekStrip").innerHTML = getCurrentWeek()
      .map((date) => {
        const key = dateKey(date);
        const isToday = key === dateKey();
        const isDone = studied.has(key);
        return `
          <div class="week-day ${isToday ? "today" : ""} ${isDone ? "done" : ""}"
            aria-label="${formatDateShort(key)}${isDone ? "，有学习记录" : ""}">
            <span>${WEEKDAYS[date.getDay()]}</span>
            <strong>${date.getDate()}</strong>
          </div>`;
      })
      .join("");
  }

  function renderTodayRecords() {
    const sessions = getSessionsForDate(dateKey()).sort(sortSessionsNewest);
    const container = $("#todayRecords");
    if (!sessions.length) {
      container.innerHTML = `
        <div class="empty-today">
          <svg><use href="#icon-sparkle"></use></svg>
          <p>今天的记录还是空白</p>
          <span>学完一点，就记下一点</span>
        </div>`;
      return;
    }

    container.innerHTML = sessions
      .slice(0, 3)
      .map(
        (session) => `
          <button class="today-record" type="button" data-record-id="${session.id}">
            <i class="record-dot ${dotClass(session.subject)}"></i>
            <div>
              <p>${escapeHtml(session.content)}</p>
              <span>${escapeHtml(session.subject)} · ${escapeHtml(session.mood)}</span>
            </div>
            <strong>${formatCompactDuration(session.durationMinutes)}</strong>
          </button>`
      )
      .join("");
  }

  function sortSessionsNewest(a, b) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }

  function dotClass(subject) {
    if (subject === "英语") return "sage";
    if (subject === "数学") return "gold";
    if (subject === "其他") return "ink";
    return "";
  }

  function renderCalendar() {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const firstDay = new Date(year, month, 1, 12);
    const offset = (firstDay.getDay() + 6) % 7;
    const gridStart = addDays(firstDay, -offset);
    const studied = new Set(data.sessions.map((session) => session.date));
    const today = dateKey();

    $("#calendarMonth").textContent = `${year} 年 ${month + 1} 月`;

    const cells = Array.from({ length: 42 }, (_, index) => {
      const date = addDays(gridStart, index);
      const key = dateKey(date);
      const outside = date.getMonth() !== month;
      const classes = [
        "calendar-day",
        outside ? "outside" : "",
        studied.has(key) ? "has-study" : "",
        key === today ? "today" : "",
        key === selectedDate ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button class="${classes}" type="button" data-calendar-date="${key}" ${
        outside ? 'data-outside="true"' : ""
      } aria-label="${formatDateLong(key)}${studied.has(key) ? "，有学习记录" : ""}">${date.getDate()}</button>`;
    });

    $("#calendarGrid").innerHTML = cells.join("");
  }

  function renderRecordsList() {
    const filter = $("#subjectFilter").value;
    let sessions = [...data.sessions];
    if (selectedDate) sessions = sessions.filter((session) => session.date === selectedDate);
    if (filter !== "all") sessions = sessions.filter((session) => session.subject === filter);
    sessions.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return sortSessionsNewest(a, b);
    });

    $("#recordsHeading").textContent = selectedDate
      ? `${formatDateShort(selectedDate)} · ${relativeDateLabel(selectedDate)}`
      : filter === "all"
        ? "全部记录"
        : `${filter}记录`;

    const container = $("#recordsList");
    if (!sessions.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-illustration"><svg><use href="#icon-book"></use></svg></div>
          <h3>${selectedDate ? "这一天还没有记录" : "从第一笔开始"}</h3>
          <p>${
            selectedDate
              ? "如果想起那天复习了什么，可以补记一笔；也可以换一天看看。"
              : "记录学习时长和复习内容，慢慢看见自己的积累。"
          }</p>
          <button class="primary-button compact" type="button" data-empty-add="true">
            <svg><use href="#icon-plus"></use></svg> 记一笔
          </button>
        </div>`;
      return;
    }

    const groups = sessions.reduce((result, session) => {
      if (!result[session.date]) result[session.date] = [];
      result[session.date].push(session);
      return result;
    }, {});

    container.innerHTML = Object.entries(groups)
      .map(
        ([date, group]) => `
          <div class="record-group">
            <div class="record-date-heading">
              <strong>${relativeDateLabel(date)} · ${formatDateShort(date)}</strong>
              <span>${formatCompactDuration(totalMinutes(group))} · ${group.length} 条</span>
            </div>
            ${group.map(renderRecordCard).join("")}
          </div>`
      )
      .join("");
  }

  function renderRecordCard(session) {
    return `
      <button class="record-card" type="button" data-record-id="${session.id}">
        <span class="subject-pill ${SUBJECT_CLASSES[session.subject]}">${escapeHtml(
          session.subject
        )}</span>
        <div class="record-card-body">
          <p>${escapeHtml(session.content)}</p>
          <div class="record-meta">
            <span><svg><use href="#icon-clock"></use></svg>${formatDuration(
              session.durationMinutes
            )}</span>
            <span>${escapeHtml(session.mood)}</span>
          </div>
        </div>
        <span class="record-card-duration">${session.source === "timer" ? "计时" : "补记"}</span>
      </button>`;
  }

  function renderStats() {
    const recentDays = getLastSevenDays();
    const recentKeys = recentDays.map(dateKey);
    const recentSessions = data.sessions.filter((session) => recentKeys.includes(session.date));
    const weekMinutes = totalMinutes(recentSessions);
    const weekPercent = Math.round((weekMinutes / (data.settings.dailyGoalMinutes * 7)) * 100);

    $("#weekHoursStat").innerHTML = `${formatHoursNumber(weekMinutes)}<small>h</small>`;
    $("#allDaysStat").innerHTML = `${uniqueStudyDays()}<small>天</small>`;
    $("#bestStreakStat").innerHTML = `${calculateBestStreak()}<small>天</small>`;
    $("#weekCompare").textContent = weekMinutes
      ? `完成周目标的 ${weekPercent}%`
      : "本周的数据会出现在这里";

    renderBarChart(recentDays, recentSessions);
    renderSubjectDonut();
    renderInsight(weekMinutes, recentSessions);
  }

  function renderBarChart(days, sessions) {
    const values = days.map((day) =>
      totalMinutes(sessions.filter((session) => session.date === dateKey(day)))
    );
    const maxValue = Math.max(...values, data.settings.dailyGoalMinutes, 60);
    $("#barChart").innerHTML = days
      .map((day, index) => {
        const minutes = values[index];
        const height = minutes ? Math.max(4, (minutes / maxValue) * 100) : 2;
        const label = day.getDate() === new Date().getDate() && day.getMonth() === new Date().getMonth()
          ? "今天"
          : `周${WEEKDAYS[day.getDay()]}`;
        return `
          <div class="bar-column ${dateKey(day) === dateKey() ? "today" : ""} ${
            minutes ? "" : "zero"
          }">
            <span class="bar-value">${minutes ? formatCompactDuration(minutes) : ""}</span>
            <i class="bar" style="height: ${height}%"></i>
            <span class="bar-label">${label}</span>
          </div>`;
      })
      .join("");
  }

  function renderSubjectDonut() {
    const totals = SUBJECTS.map((subject) => ({
      subject,
      minutes: totalMinutes(data.sessions.filter((session) => session.subject === subject)),
    })).filter((item) => item.minutes > 0);
    const allMinutes = totals.reduce((sum, item) => sum + item.minutes, 0);
    $("#donutTotal").textContent = `${formatHoursNumber(allMinutes)}h`;

    if (!allMinutes) {
      $("#subjectDonut").style.background =
        "conic-gradient(var(--paper-deep) 0 100%)";
      $("#subjectLegend").innerHTML = `<p class="storage-note">有学习记录后，这里会显示各科目的时间占比。</p>`;
      return;
    }

    let cursor = 0;
    const segments = totals.map((item) => {
      const start = cursor;
      cursor += (item.minutes / allMinutes) * 360;
      return `${SUBJECT_COLORS[item.subject]} ${start}deg ${cursor}deg`;
    });
    $("#subjectDonut").style.background = `conic-gradient(${segments.join(", ")})`;
    $("#subjectLegend").innerHTML = totals
      .map(
        (item) => `
          <div class="subject-legend-item">
            <span><i style="background:${SUBJECT_COLORS[item.subject]}"></i>${escapeHtml(
              item.subject
            )}</span>
            <strong>${Math.round((item.minutes / allMinutes) * 100)}%</strong>
          </div>`
      )
      .join("");
  }

  function renderInsight(weekMinutes, recentSessions) {
    if (!weekMinutes) {
      $("#insightTitle").textContent = "从今天的 25 分钟开始";
      $("#insightText").textContent = "学习不是一场冲刺，而是一段每天向前一点的旅程。";
      return;
    }

    const subjectTotals = SUBJECTS.map((subject) => ({
      subject,
      minutes: totalMinutes(recentSessions.filter((session) => session.subject === subject)),
    })).sort((a, b) => b.minutes - a.minutes);
    const topSubject = subjectTotals[0];
    const studiedDays = new Set(recentSessions.map((session) => session.date)).size;
    $("#insightTitle").textContent = `近 7 天完成了 ${formatHoursNumber(weekMinutes)} 小时`;
    $("#insightText").textContent = topSubject?.minutes
      ? `共学习 ${studiedDays} 天，${topSubject.subject}投入最多。保持现在的节奏，你正在稳步接近目标。`
      : "保持现在的节奏，你正在稳步接近目标。";
  }

  function renderSettings() {
    $("#studentName").value = data.name;
    $("#examDateInput").value = data.settings.examDate;
    $("#targetSchoolInput").value = data.settings.targetSchool;
    $("#targetTotalScoreInput").value =
      data.settings.targetTotalScore > 0 ? data.settings.targetTotalScore : "";
    $$("[data-subject-score]").forEach((input) => {
      const score = data.settings.targetSubjectScores[input.dataset.subjectScore] || 0;
      input.value = score > 0 ? score : "";
    });
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, index) => currentYear + 1 + index);
    if (!years.includes(data.settings.targetYear)) years.push(data.settings.targetYear);
    $("#yearOptions").innerHTML = years
      .sort((a, b) => a - b)
      .map(
        (year) => `
          <button class="year-option ${
            year === data.settings.targetYear ? "selected" : ""
          }" type="button" data-year="${year}">${year}</button>`
      )
      .join("");

    const goalHours = data.settings.dailyGoalMinutes / 60;
    $("#dailyGoalRange").value = goalHours;
    $("#goalSettingValue").textContent = Number.isInteger(goalHours)
      ? goalHours
      : goalHours.toFixed(1);
    updateRangeFill();
  }

  function updateRangeFill() {
    const range = $("#dailyGoalRange");
    const percent = ((Number(range.value) - Number(range.min)) / (Number(range.max) - Number(range.min))) * 100;
    range.style.background = `linear-gradient(90deg, var(--coral) ${percent}%, var(--paper-deep) ${percent}%)`;
  }

  function renderAll() {
    renderHeader();
    renderExam();
    renderTargetProfile();
    renderToday();
    renderWeek();
    renderTodayRecords();
    renderCalendar();
    renderRecordsList();
    renderStats();
    renderSettings();
    renderTimer();
  }

  function navigate(view) {
    if (!["today", "records", "stats", "settings"].includes(view)) return;
    activeView = view;
    $$(".view").forEach((section) => section.classList.toggle("active", section.id === `view-${view}`));
    $$("[data-view]").forEach((button) =>
      button.classList.toggle("active", button.dataset.view === view)
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openRecordModal(options = {}) {
    const session = options.session || null;
    recordTimerSeconds = Number.isFinite(options.timerSeconds) ? options.timerSeconds : null;
    $("#recordForm").reset();
    $("#recordId").value = session?.id || "";
    $("#recordModalTitle").textContent = session ? "编辑学习记录" : "记下今天的进展";
    $("#deleteRecordButton").hidden = !session;
    $("#clearTimerSegmentRecord").hidden = recordTimerSeconds === null;
    selectedSubject = session?.subject || data.timer.subject || "数学";
    selectedMood = session?.mood || "专注";

    const initialMinutes = session
      ? Number(session.durationMinutes)
      : recordTimerSeconds
        ? Math.max(1, Math.round(recordTimerSeconds / 60))
        : 60;
    $("#durationHours").value = Math.floor(initialMinutes / 60);
    $("#durationMinutes").value = initialMinutes % 60;
    $("#recordDate").value = session?.date || selectedDate || dateKey();
    $("#recordContent").value = session?.content || "";
    updateContentCount();
    renderRecordOptions();
    openModal(recordModal);
  }

  function renderRecordOptions() {
    $("#recordSubjects").innerHTML = SUBJECTS.map(
      (subject) => `
        <button type="button" data-subject="${subject}" class="${
          selectedSubject === subject ? "selected" : ""
        }">${subject}</button>`
    ).join("");
    $("#moodOptions").innerHTML = ["一般", "专注", "高效"]
      .map(
        (mood) => `
          <button type="button" data-mood="${mood}" class="${
            selectedMood === mood ? "selected" : ""
          }">${mood}</button>`
      )
      .join("");
  }

  function updateContentCount() {
    $("#contentCount").textContent = $("#recordContent").value.length;
  }

  function openModal(element) {
    element.classList.add("open");
    element.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeModal(element) {
    element.classList.remove("open");
    element.setAttribute("aria-hidden", "true");
    if (!recordModal.classList.contains("open") && !confirmModal.classList.contains("open")) {
      document.body.classList.remove("modal-open");
    }
  }

  function showConfirm(title, text, label, callback) {
    $("#confirmTitle").textContent = title;
    $("#confirmText").textContent = text;
    $("#confirmAction").textContent = label;
    confirmCallback = callback;
    openModal(confirmModal);
  }

  function showToast(message) {
    window.clearTimeout(toastTimeout);
    $("#toastText").textContent = message;
    $("#toast").classList.add("show");
    toastTimeout = window.setTimeout(() => $("#toast").classList.remove("show"), 2400);
  }

  function showWelcomeScreen() {
    const welcome = $("#welcomeScreen");
    $("#welcomeDate").textContent = getTodayLabel();
    renderTargetProfile();
    welcome.hidden = false;
    welcome.setAttribute("aria-hidden", "false");
    document.body.classList.add("welcome-open");
    requestAnimationFrame(() => welcome.classList.add("open"));
  }

  function hideWelcomeScreen() {
    const welcome = $("#welcomeScreen");
    welcome.classList.remove("open");
    welcome.setAttribute("aria-hidden", "true");
    document.body.classList.remove("welcome-open");
    window.setTimeout(() => {
      welcome.hidden = true;
    }, 420);
  }

  function saveRecord(event) {
    event.preventDefault();
    const hours = Math.max(0, Number($("#durationHours").value) || 0);
    const minutes = Math.max(0, Number($("#durationMinutes").value) || 0);
    const duration = Math.min(1440, Math.round(hours * 60 + minutes));
    const content = $("#recordContent").value.trim();
    const recordDate = $("#recordDate").value;

    if (!duration) {
      showToast("请填写学习时长");
      $("#durationHours").focus();
      return;
    }
    if (!content) {
      showToast("请写下今天复习了什么");
      $("#recordContent").focus();
      return;
    }
    if (!parseDate(recordDate)) {
      showToast("请选择学习日期");
      $("#recordDate").focus();
      return;
    }

    const editId = $("#recordId").value;
    if (editId) {
      const session = data.sessions.find((item) => item.id === editId);
      if (session) {
        Object.assign(session, {
          date: recordDate,
          subject: selectedSubject,
          durationMinutes: duration,
          content: content.slice(0, 500),
          mood: selectedMood,
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      data.sessions.push({
        id: createId(),
        date: recordDate,
        subject: selectedSubject,
        durationMinutes: duration,
        content: content.slice(0, 500),
        mood: selectedMood,
        createdAt: new Date().toISOString(),
        updatedAt: null,
        source: recordTimerSeconds ? "timer" : "manual",
      });
    }

    const wasTimer = recordTimerSeconds !== null;
    recordTimerSeconds = null;
    if (wasTimer) {
      resetTimer();
      closeTimer();
    }
    saveData();
    closeModal(recordModal);
    renderAll();
    showToast(editId ? "学习记录已更新" : "打卡成功，今天也向前了一步");
  }

  function editRecord(id) {
    const session = data.sessions.find((item) => item.id === id);
    if (session) openRecordModal({ session });
  }

  function deleteCurrentRecord() {
    const id = $("#recordId").value;
    const session = data.sessions.find((item) => item.id === id);
    if (!session) return;
    showConfirm("删除这条学习记录？", "删除后，这一天会显示为没有学习记录。", "确认删除", () => {
      data.sessions = data.sessions.filter((item) => item.id !== id);
      saveData();
      closeModal(confirmModal);
      closeModal(recordModal);
      renderAll();
      showToast("学习记录已删除");
    });
  }

  function getTimerElapsedSeconds() {
    const accumulated = Number(data.timer.accumulatedSeconds) || 0;
    if (data.timer.status === "running" && data.timer.startedAt) {
      return accumulated + Math.max(0, Math.floor((Date.now() - data.timer.startedAt) / 1000));
    }
    return accumulated;
  }

  function renderTimer() {
    const elapsed = getTimerElapsedSeconds();
    $("#timerDisplay").textContent = formatClock(elapsed);
    $("#timerStatus").textContent =
      data.timer.status === "running"
        ? "正在专注"
        : data.timer.status === "paused"
          ? "已暂停"
          : "准备专注";
    timerScreen.classList.toggle("running", data.timer.status === "running");
    $("#timerHint").textContent =
      data.timer.status === "running"
        ? "保持专注，慢慢积累"
        : data.timer.status === "paused"
          ? "已暂停，休息一下再继续"
          : "准备好后开始";
    $("#timerToggle span").textContent =
      data.timer.status === "running"
        ? "暂停一下"
        : data.timer.status === "paused"
          ? "继续专注"
          : "开始专注";
    $("#timerToggle use").setAttribute(
      "href",
      data.timer.status === "running" ? "#icon-pause" : "#icon-play"
    );
    $("#finishTimer").hidden = data.timer.status === "idle";
    $("#clearTimerSegment").hidden =
      data.timer.status !== "paused" || elapsed < 1;
    $("#timerRing").style.setProperty("--progress", ((elapsed % 3600) / 3600) * 100);
    renderTimerSubjects();
  }

  function renderTimerSubjects() {
    $("#timerSubjects").innerHTML = SUBJECTS.map(
      (subject) => `
        <button type="button" data-timer-subject="${subject}" class="${
          data.timer.subject === subject ? "selected" : ""
        }">${subject}</button>`
    ).join("");
  }

  function startTimerTick() {
    window.clearInterval(timerInterval);
    if (data.timer.status === "running") {
      timerInterval = window.setInterval(renderTimer, 1000);
    }
  }

  function openTimer() {
    timerScreen.classList.add("open");
    timerScreen.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    renderTimer();
    startTimerTick();
  }

  function closeTimer() {
    timerScreen.classList.remove("open");
    timerScreen.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    window.clearInterval(timerInterval);
  }

  function toggleTimer() {
    if (data.timer.status === "running") {
      data.timer.accumulatedSeconds = getTimerElapsedSeconds();
      data.timer.status = "paused";
      data.timer.startedAt = null;
    } else {
      data.timer.startedAt = Date.now();
      data.timer.status = "running";
    }
    saveData();
    renderTimer();
    renderToday();
    startTimerTick();
  }

  function finishTimerSession() {
    const elapsed = getTimerElapsedSeconds();
    if (elapsed < 1) {
      showToast("先专注一会儿，再结束计时");
      return;
    }
    if (data.timer.status === "running") {
      data.timer.accumulatedSeconds = elapsed;
      data.timer.status = "paused";
      data.timer.startedAt = null;
      saveData();
      renderTimer();
    }
    openRecordModal({ timerSeconds: elapsed });
  }

  function resetTimer() {
    data.timer = {
      status: "idle",
      startedAt: null,
      accumulatedSeconds: 0,
      subject: data.timer.subject || "数学",
    };
    window.clearInterval(timerInterval);
    saveData();
  }

  function exportBackup() {
    const payload = {
      app: "yantu",
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
    const serialized = JSON.stringify(payload, null, 2);
    const fileName = `研途备份-${dateKey()}.json`;
    if (
      window.AndroidBridge &&
      typeof window.AndroidBridge.saveBackup === "function"
    ) {
      window.AndroidBridge.saveBackup(fileName, serialized);
      showToast("请选择备份文件的保存位置");
      return;
    }
    const blob = new Blob([serialized], {
      type: "application/json;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast("备份文件已生成");
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const source = parsed.data || parsed;
        if (!source || typeof source !== "object" || !Array.isArray(source.sessions)) {
          throw new Error("备份格式不正确");
        }
        const restored = normalizeData(source);
        showConfirm(
          "恢复这份备份？",
          `将导入 ${restored.sessions.length} 条学习记录，并覆盖当前设备上的数据。`,
          "确认恢复",
          () => {
            data = restored;
            saveData();
            closeModal(confirmModal);
            renderAll();
            showToast(`已恢复 ${restored.sessions.length} 条学习记录`);
          }
        );
      } catch (error) {
        console.error(error);
        showToast("无法识别这个备份文件");
      }
    };
    reader.readAsText(file);
    $("#importFile").value = "";
  }

  function clearAllData() {
    showConfirm(
      "确认清除全部数据？",
      "全部学习记录、目标和设置都会被删除，且无法恢复。",
      "确认清除",
      () => {
        localStorage.removeItem(STORAGE_KEY);
        window.clearInterval(timerInterval);
        data = defaultData();
        selectedDate = null;
        calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        saveData();
        closeModal(confirmModal);
        closeTimer();
        renderAll();
        navigate("today");
        showToast("数据已清除，可以重新开始");
      }
    );
  }

  function clearCurrentTimerSegment(origin) {
    const elapsed =
      origin === "record" && recordTimerSeconds !== null
        ? recordTimerSeconds
        : getTimerElapsedSeconds();
    if (elapsed < 1) {
      showToast("本次还没有计时内容");
      return;
    }
    showConfirm(
      "确认清零本次学习时间？",
      `本次计时 ${formatClock(elapsed)} 会归零。已经保存的其他学习记录不会受影响。`,
      "确认清零",
      () => {
        closeModal(confirmModal);
        recordTimerSeconds = null;
        resetTimer();
        if (origin === "record") closeModal(recordModal);
        closeTimer();
        renderAll();
        showToast("本次学习时间已清零，其他记录未改变");
      }
    );
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function bindEvents() {
    $$("[data-view]").forEach((button) =>
      button.addEventListener("click", () => navigate(button.dataset.view))
    );
    $$("[data-go-view]").forEach((button) =>
      button.addEventListener("click", () => navigate(button.dataset.goView))
    );

    $("#profileShortcut").addEventListener("click", () => navigate("settings"));
    $("#openExamSettings").addEventListener("click", () => navigate("settings"));
    $("#enterApp").addEventListener("click", hideWelcomeScreen);
    $("#editTargetButton").addEventListener("click", () => {
      navigate("settings");
      window.setTimeout(() => {
        $("#targetSettingsPanel").scrollIntoView({ behavior: "smooth", block: "center" });
      }, 180);
    });
    $("#startFocusButton").addEventListener("click", openTimer);
    $("#statsFocusButton").addEventListener("click", openTimer);
    $("#quickRecordButton").addEventListener("click", () => openRecordModal());
    $("#addTodayRecord").addEventListener("click", () => openRecordModal());
    $("#addPastRecord").addEventListener("click", () => openRecordModal());
    $("#bottomNavAdd").addEventListener("click", () =>
      openRecordModal({ session: null })
    );

    $("#todayRecords").addEventListener("click", (event) => {
      const record = event.target.closest("[data-record-id]");
      if (record) editRecord(record.dataset.recordId);
    });

    $("#recordsList").addEventListener("click", (event) => {
      const record = event.target.closest("[data-record-id]");
      if (record) {
        editRecord(record.dataset.recordId);
        return;
      }
      if (event.target.closest("[data-empty-add]")) openRecordModal();
    });

    $("#recordSubjects").addEventListener("click", (event) => {
      const button = event.target.closest("[data-subject]");
      if (!button) return;
      selectedSubject = button.dataset.subject;
      renderRecordOptions();
    });

    $("#moodOptions").addEventListener("click", (event) => {
      const button = event.target.closest("[data-mood]");
      if (!button) return;
      selectedMood = button.dataset.mood;
      renderRecordOptions();
    });

    $("#recordContent").addEventListener("input", updateContentCount);
    $("#recordForm").addEventListener("submit", saveRecord);
    $("#closeRecordModal").addEventListener("click", () => {
      recordTimerSeconds = null;
      closeModal(recordModal);
      renderTimer();
    });
    $("#deleteRecordButton").addEventListener("click", deleteCurrentRecord);

    recordModal.addEventListener("click", (event) => {
      if (event.target === recordModal) {
        recordTimerSeconds = null;
        closeModal(recordModal);
        renderTimer();
      }
    });

    $("#confirmCancel").addEventListener("click", () => {
      confirmCallback = null;
      closeModal(confirmModal);
    });
    $("#confirmAction").addEventListener("click", () => {
      if (typeof confirmCallback === "function") confirmCallback();
      confirmCallback = null;
    });
    confirmModal.addEventListener("click", (event) => {
      if (event.target === confirmModal) {
        confirmCallback = null;
        closeModal(confirmModal);
      }
    });

    $("#calendarGrid").addEventListener("click", (event) => {
      const day = event.target.closest("[data-calendar-date]");
      if (!day) return;
      selectedDate = day.dataset.calendarDate;
      if (day.dataset.outside === "true") {
        const date = parseDate(selectedDate);
        calendarCursor = new Date(date.getFullYear(), date.getMonth(), 1);
      }
      renderCalendar();
      renderRecordsList();
    });

    $("#prevMonth").addEventListener("click", () => {
      calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
      selectedDate = null;
      renderCalendar();
      renderRecordsList();
    });

    $("#nextMonth").addEventListener("click", () => {
      calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
      selectedDate = null;
      renderCalendar();
      renderRecordsList();
    });

    $("#subjectFilter").addEventListener("change", renderRecordsList);

    $("#studentName").addEventListener("input", (event) => {
      data.name = event.target.value.slice(0, 12);
      saveData();
      renderHeader();
    });

    $("#targetSchoolInput").addEventListener("input", (event) => {
      data.settings.targetSchool = event.target.value.slice(0, 30);
      saveData();
      renderTargetProfile();
    });

    $("#targetTotalScoreInput").addEventListener("input", (event) => {
      data.settings.targetTotalScore = clampTargetScore(event.target.value, 500);
      saveData();
      renderTargetProfile();
    });

    $$("[data-subject-score]").forEach((input) => {
      input.addEventListener("input", (event) => {
        const subject = event.target.dataset.subjectScore;
        data.settings.targetSubjectScores[subject] = clampTargetScore(event.target.value, 150);
        saveData();
        renderTargetProfile();
      });
      input.addEventListener("change", () => {
        const score = data.settings.targetSubjectScores[input.dataset.subjectScore] || 0;
        input.value = score > 0 ? score : "";
      });
    });

    $("#targetTotalScoreInput").addEventListener("change", (event) => {
      event.target.value =
        data.settings.targetTotalScore > 0 ? data.settings.targetTotalScore : "";
    });

    $("#yearOptions").addEventListener("click", (event) => {
      const option = event.target.closest("[data-year]");
      if (!option) return;
      data.settings.targetYear = Number(option.dataset.year);
      data.settings.examDate = thirdSaturdayDecember(data.settings.targetYear - 1);
      saveData();
      renderExam();
      renderTargetProfile();
      renderSettings();
      showToast(`已设置 ${data.settings.targetYear} 考研目标`);
    });

    $("#examDateInput").addEventListener("change", (event) => {
      if (!parseDate(event.target.value)) return;
      data.settings.examDate = event.target.value;
      saveData();
      renderExam();
      showToast("考试日期已更新");
    });

    $("#dailyGoalRange").addEventListener("input", (event) => {
      data.settings.dailyGoalMinutes = Math.round(Number(event.target.value) * 60);
      const goalHours = data.settings.dailyGoalMinutes / 60;
      $("#goalSettingValue").textContent = Number.isInteger(goalHours)
        ? goalHours
        : goalHours.toFixed(1);
      updateRangeFill();
      saveData();
      renderToday();
      renderStats();
    });

    $("#exportButton").addEventListener("click", exportBackup);
    $("#importButton").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", (event) => importBackup(event.target.files[0]));
    $("#clearDataButton").addEventListener("click", clearAllData);
    $("#installButton").addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        return;
      }
      showToast("请从浏览器菜单选择“添加到主屏幕”");
    });

    $("#closeTimer").addEventListener("click", closeTimer);
    $("#timerToggle").addEventListener("click", toggleTimer);
    $("#finishTimer").addEventListener("click", finishTimerSession);
    $("#clearTimerSegment").addEventListener("click", () =>
      clearCurrentTimerSegment("timer")
    );
    $("#clearTimerSegmentRecord").addEventListener("click", () =>
      clearCurrentTimerSegment("record")
    );
    $("#timerSubjects").addEventListener("click", (event) => {
      const button = event.target.closest("[data-timer-subject]");
      if (!button) return;
      data.timer.subject = button.dataset.timerSubject;
      saveData();
      renderTimerSubjects();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if ($("#welcomeScreen").classList.contains("open")) {
        hideWelcomeScreen();
      } else if (confirmModal.classList.contains("open")) {
        confirmCallback = null;
        closeModal(confirmModal);
      } else if (recordModal.classList.contains("open")) {
        recordTimerSeconds = null;
        closeModal(recordModal);
      } else if (timerScreen.classList.contains("open")) {
        closeTimer();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && data.timer.status === "running") {
        renderTimer();
      }
    });

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
    });
    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      showToast("研途已安装到桌面");
    });
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("离线缓存未能启用。", error);
      });
    }
  }

  function init() {
    if (window.AndroidBridge) {
      document.documentElement.classList.add("native-app");
    }
    bindEvents();
    renderAll();
    showWelcomeScreen();
    startTimerTick();
    if (data.timer.status === "running") {
      showToast("学习计时正在继续");
    }
    registerServiceWorker();
  }

  init();
})();
