/****************************************************
 * LocalStorage GET/SET
 ****************************************************/
function getData(key, defaultValue) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
}

function setData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/****************************************************
 * Constants & Initialization
 ****************************************************/
const ROUTINES_KEY = "routines";
const SETTINGS_KEY = "settings";
/**
 * We'll store daily habit completions in a separate object:
 * {
 *   "YYYY-MM-DD": [
 *     { routineId: "...", habitIndex: 0 },
 *     { routineId: "...", habitIndex: 1 },
 *   ],
 *   ...
 * }
 */
const COMPLETIONS_KEY = "completions";

initAppData();

/** 
 *  - Ensure default data is in place
 *  - Purge old day-off records from previous months
 */
function initAppData() {
  let routines = getData(ROUTINES_KEY, []);
  let settings = getData(SETTINGS_KEY, {
    dayOffLimit: 3,
    dayOffRecords: []
  });
  let completions = getData(COMPLETIONS_KEY, {}); // store daily completions
  setData(ROUTINES_KEY, routines);
  setData(SETTINGS_KEY, settings);
  setData(COMPLETIONS_KEY, completions);

  purgeOldDayOffRecords();
}

/**
 * Remove dayOffRecords from previous months
 */
function purgeOldDayOffRecords() {
  const settings = getSettings();
  const currentMonth = getCurrentMonth(); // e.g., "2025-01"
  // Keep only records from this month
  settings.dayOffRecords = settings.dayOffRecords.filter(d => d.startsWith(currentMonth));
  setData(SETTINGS_KEY, settings);
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

/** Day-of-year (1 to 366) for daily quotes */
function getDayOfYear(dateObj = new Date()) {
  // Jan 1 is day 1; Dec 31 is day 365 or 366 in leap years
  const start = new Date(dateObj.getFullYear(), 0, 0);
  const diff = dateObj - start + (start.getTimezoneOffset() - dateObj.getTimezoneOffset()) * 60 * 1000;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
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
 * canTakeDayOff:
 * - no day off taken for today
 * - not over dayOffLimit for this month
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
    return false; // already taken
  }
  settings.dayOffRecords.push(todayStr);
  setData(SETTINGS_KEY, settings);
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
/**
 * Routine shape:
 * {
 *   id: "routine-<timestamp>-<rand>",
 *   name: "Morning Routine",
 *   habits: [
 *     {
 *       title: "Drink Water",
 *       time: "07:00",
 *       streak: 0,
 *       lastCompletedDate: ""
 *     }, ...
 *   ]
 * }
 */
function generateRoutineId() {
  return "routine-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
}

function getAllRoutines() {
  return getData(ROUTINES_KEY, []);
}

function getRoutineById(routineId) {
  return getAllRoutines().find(r => r.id === routineId);
}

function addRoutine(name, habits) {
  const routines = getAllRoutines();
  // Check duplicate name
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

  // If changing name, check duplicates
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
 * We'll also record completions in COMPLETIONS_KEY:
 * completions[YYYY-MM-DD] = [ {routineId, habitIndex}, ... ]
 */
function completeHabit(routineId, habitIndex) {
  const routines = getAllRoutines();
  const routine = routines.find(r => r.id === routineId);
  if (!routine) return;

  let habit = routine.habits[habitIndex];
  const todayStr = formatDate();
  if (habit.lastCompletedDate === todayStr) {
    return; // already done
  }
  if (!habit.lastCompletedDate) {
    // first time
    habit.streak = 1;
  } else {
    const lastDone = new Date(habit.lastCompletedDate);
    const diffDays = Math.floor(
      (new Date(todayStr) - lastDone) / (24 * 60 * 60 * 1000)
    );
    if (diffDays === 1) {
      habit.streak += 1;
    } else if (diffDays > 1) {
      // Check if all missed days were day-offs
      let isAllDayOff = true;
      for (let i = 1; i < diffDays; i++) {
        const checkDate = new Date(lastDone);
        checkDate.setDate(lastDone.getDate() + i);
        if (!isDayOff(formatDate(checkDate))) {
          isAllDayOff = false;
          break;
        }
      }
      if (isAllDayOff) {
        habit.streak += 1;
      } else {
        habit.streak = 1;
      }
    }
  }
  habit.lastCompletedDate = todayStr;
  setData(ROUTINES_KEY, routines);

  // Also log it in COMPLETIONS_KEY
  let completions = getData(COMPLETIONS_KEY, {});
  if (!completions[todayStr]) {
    completions[todayStr] = [];
  }
  // If not already in today's completions, add it
  const alreadyLogged = completions[todayStr].some(
    x => x.routineId === routineId && x.habitIndex === habitIndex
  );
  if (!alreadyLogged) {
    completions[todayStr].push({ routineId, habitIndex });
  }
  setData(COMPLETIONS_KEY, completions);
}

/** Retrieve completions data for a given date */
function getCompletionsByDate(dateStr) {
  const completions = getData(COMPLETIONS_KEY, {});
  return completions[dateStr] || [];
}
