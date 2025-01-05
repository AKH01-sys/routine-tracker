/****************************************************
 * LocalStorage GET/SET
 ****************************************************/
function getData(key, defaultValue) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
}

function setData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Error setting localStorage:", error);
    alert("Failed to save data. localStorage might be full or unavailable.");
  }
}

/****************************************************
 * Constants & Initialization
 ****************************************************/
const ROUTINES_KEY = "routines";
const SETTINGS_KEY = "settings";
const COMPLETIONS_KEY = "completions";
const USAGE_KEY = "lastUsageDate"; // track last usage date for auto day off
const PERMANENT_NOTES_KEY = "permanentNotes"; // Key for permanent notes

function initAppData() {
  let routines = getData(ROUTINES_KEY, []);
  let settings = getData(SETTINGS_KEY, {
    dayOffLimit: 3,
    dayOffRecords: []
  });
  let completions = getData(COMPLETIONS_KEY, {});

  setData(ROUTINES_KEY, routines);
  setData(SETTINGS_KEY, settings);
  setData(COMPLETIONS_KEY, completions);

  // 1) Mark any missed days (between last usage and today) as day off
  autoMarkMissedDaysAsOff();

  // 2) Purge old day-off records from previous months
  purgeOldDayOffRecords();
}

initAppData();

/****************************************************
 * autoMarkMissedDaysAsOff()
 * - If user hasn’t opened site for X days, mark each missed day as day off
 ****************************************************/
function autoMarkMissedDaysAsOff() {
  const settings = getSettings();

  // read last usage date
  const lastUsageStr = localStorage.getItem(USAGE_KEY);
  const todayStr = formatDate();
  const todayDateObj = new Date(todayStr);

  if (!lastUsageStr) {
    // first-time usage => set lastUsageDate to today
    localStorage.setItem(USAGE_KEY, todayStr);
    return;
  }

  const lastUsageDateObj = new Date(lastUsageStr);
  // If same day, no missed days
  if (lastUsageDateObj.toDateString() === todayDateObj.toDateString()) {
    localStorage.setItem(USAGE_KEY, todayStr);
    return;
  }

  // Mark each missing day as day off
  let tempDate = new Date(lastUsageDateObj);
  tempDate.setDate(tempDate.getDate() + 1);

  while (tempDate < todayDateObj) {
    const checkStr = formatDate(tempDate);
    if (!settings.dayOffRecords.includes(checkStr)) {
      settings.dayOffRecords.push(checkStr);
    }
    tempDate.setDate(tempDate.getDate() + 1);
  }

  // Save and update usage date
  setData(SETTINGS_KEY, settings);
  localStorage.setItem(USAGE_KEY, todayStr);
}

/****************************************************
 * Date Helpers
 ****************************************************/
function formatDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getCurrentMonth() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

/****************************************************
 * Settings / Day Off
 ****************************************************/
function getSettings() {
  return getData(SETTINGS_KEY, { dayOffLimit: 3, dayOffRecords: [] });
}

function updateSettings(newSettings) {
  const settings = getSettings();
  Object.assign(settings, newSettings);
  setData(SETTINGS_KEY, settings);
}

/**
 * canTakeDayOff():
 * - not already day off for today
 * - not over dayOffLimit for the current month
 *
 * If dayOffRecords is bigger than the new limit, user can't take more day off
 * until next month resets. No errors thrown.
 */
function canTakeDayOff() {
  const settings = getSettings();
  const todayStr = formatDate();
  if (settings.dayOffRecords.includes(todayStr)) {
    return false;
  }
  const currentMonth = getCurrentMonth();
  const usedThisMonth = settings.dayOffRecords.filter(d => d.startsWith(currentMonth)).length;
  return usedThisMonth < settings.dayOffLimit;
}

function takeDayOff() {
  const settings = getSettings();
  const todayStr = formatDate();
  if (settings.dayOffRecords.includes(todayStr)) {
    return false; // already day off
  }
  settings.dayOffRecords.push(todayStr);
  setData(SETTINGS_KEY, settings);

  // update usage date
  localStorage.setItem(USAGE_KEY, todayStr);

  return true;
}

function undoDayOff() {
  const settings = getSettings();
  const todayStr = formatDate();
  const idx = settings.dayOffRecords.indexOf(todayStr);
  if (idx >= 0) {
    settings.dayOffRecords.splice(idx, 1);
    setData(SETTINGS_KEY, settings);
    return true;
  }
  return false;
}

function isDayOff(dateStr = formatDate()) {
  const settings = getSettings();
  return settings.dayOffRecords.includes(dateStr);
}

/****************************************************
 * Routines
 ****************************************************/
function getAllRoutines() {
  return getData(ROUTINES_KEY, []);
}

function getRoutineById(routineId) {
  return getAllRoutines().find(r => r.id === routineId);
}

function generateRoutineId() {
  return "routine-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
}

function addRoutine(name, habits) {
  const routines = getAllRoutines();
  const dup = routines.find(r => r.name.toLowerCase() === name.toLowerCase());
  if (dup) {
    alert("A routine with this name already exists!");
    return false;
  }
  const newRoutine = {
    id: generateRoutineId(),
    name,
    habits: habits.map(h => ({
      ...h,
      streak: 0,
      lastCompletedDate: ""
    }))
  };
  routines.push(newRoutine);
  setData(ROUTINES_KEY, routines);
  return true;
}

function updateRoutine(routineId, updatedObj) {
  let routines = getAllRoutines();
  const idx = routines.findIndex(r => r.id === routineId);
  if (idx < 0) return false;

  if (
    updatedObj.name &&
    updatedObj.name.toLowerCase() !== routines[idx].name.toLowerCase()
  ) {
    const conflict = routines.find(
      r => r.name.toLowerCase() === updatedObj.name.toLowerCase()
    );
    if (conflict) {
      alert("A routine with this name already exists!");
      return false;
    }
  }

  routines[idx] = { ...routines[idx], ...updatedObj };
  setData(ROUTINES_KEY, routines);
  return true;
}

function deleteRoutine(routineId) {
  let routines = getAllRoutines();
  routines = routines.filter(r => r.id !== routineId);
  setData(ROUTINES_KEY, routines);
}

/****************************************************
 * Habit Completion & Streak
 ****************************************************/
/**
 * completions[YYYY-MM-DD] = [ { routineId, habitIndex }, ... ]
 *
 * We preserve streak if the user hasn't completed a habit for X days, so long as
 * all missed days were day offs. This ensures switching routines or simply not
 * logging in doesn't break the streak for that routine.
 */
function completeHabit(routineId, habitIndex) {
  const routines = getAllRoutines();
  const routine = routines.find(r => r.id === routineId);
  if (!routine) return;

  const habit = routine.habits[habitIndex];
  const todayStr = formatDate();

  if (habit.lastCompletedDate === todayStr) {
    return; // already done
  }

  if (!habit.lastCompletedDate) {
    // first time
    habit.streak = 1;
  } else {
    const lastDone = new Date(habit.lastCompletedDate);
    const now = new Date(todayStr);
    const diffDays = Math.floor((now - lastDone) / (24 * 60 * 60 * 1000));

    if (diffDays === 1) {
      habit.streak += 1;
    } else if (diffDays > 1) {
      let allMissedAreOff = true;
      for (let i = 1; i < diffDays; i++) {
        const checkDate = new Date(lastDone);
        checkDate.setDate(lastDone.getDate() + i);
        const checkStr = formatDate(checkDate);
        if (!isDayOff(checkStr)) {
          allMissedAreOff = false;
          break;
        }
      }
      habit.streak = allMissedAreOff ? habit.streak + 1 : 1;
    }
  }

  habit.lastCompletedDate = todayStr;
  setData(ROUTINES_KEY, routines);

  // Log in COMPLETIONS_KEY
  let completions = getData(COMPLETIONS_KEY, {});
  if (!completions[todayStr]) {
    completions[todayStr] = [];
  }
  const alreadyLogged = completions[todayStr].some(
    c => c.routineId === routineId && c.habitIndex === habitIndex
  );
  if (!alreadyLogged) {
    completions[todayStr].push({ routineId, habitIndex });
  }
  setData(COMPLETIONS_KEY, completions);
}

function uncompleteHabit(routineId, habitIndex, sameDay = true) {
  const routines = getAllRoutines();
  const routine = routines.find(r => r.id === routineId);
  if (!routine) return;

  const habit = routine.habits[habitIndex];
  const todayStr = formatDate();

  let completions = getData(COMPLETIONS_KEY, {});
  if (completions[todayStr]) {
    completions[todayStr] = completions[todayStr].filter(
      c => !(c.routineId === routineId && c.habitIndex === habitIndex)
    );
    setData(COMPLETIONS_KEY, completions);
  }

  // revert if undone the same day
  if (sameDay && habit.lastCompletedDate === todayStr) {
    habit.lastCompletedDate = "";
    habit.streak = Math.max(habit.streak - 1, 0);
    setData(ROUTINES_KEY, routines);
  }
}

function getCompletionsByDate(dateStr) {
  const completions = getData(COMPLETIONS_KEY, {});
  return completions[dateStr] || [];
}

/****************************************************
 * Purge Old Day Off Records
 ****************************************************/
function purgeOldDayOffRecords() {
  const settings = getSettings();
  const currentMonth = getCurrentMonth();
  settings.dayOffRecords = settings.dayOffRecords.filter(d => d.startsWith(currentMonth));
  setData(SETTINGS_KEY, settings);
}

/****************************************************
 * Notes (Permanent & Daily)
 ****************************************************/
function getPermanentNotes() {
  return getData(PERMANENT_NOTES_KEY, "");
}
function setPermanentNotes(text) {
  setData(PERMANENT_NOTES_KEY, text);
}

function getDailyNotesKey(dateStr) {
  return `dailyNotes_${dateStr}`; 
}
function getDailyNotes(dateStr) {
  return getData(getDailyNotesKey(dateStr), "");
}
function setDailyNotes(dateStr, text) {
  setData(getDailyNotesKey(dateStr), text);
}
