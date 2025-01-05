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

/**
 * Initialize the app data
 */
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

  purgeOldDayOffRecords();
}

initAppData();

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
 * canTakeDayOff:
 * 1. Not already on day-off for today
 * 2. Not over the monthly dayOffLimit
 */
function canTakeDayOff() {
  const settings = getSettings();
  const todayStr = formatDate();
  // If today's date is in dayOffRecords, can't take day off again
  if (settings.dayOffRecords.includes(todayStr)) {
    return false;
  }
  const currentMonth = getCurrentMonth();
  // Count how many day-offs are used in the current month
  const usedThisMonth = settings.dayOffRecords.filter(d => d.startsWith(currentMonth)).length;
  return usedThisMonth < settings.dayOffLimit;
}

/** 
 * takeDayOff:
 * - Add today's date to dayOffRecords if not already present
 */
function takeDayOff() {
  const settings = getSettings();
  const todayStr = formatDate();
  if (settings.dayOffRecords.includes(todayStr)) {
    return false; // Already taken
  }
  settings.dayOffRecords.push(todayStr);
  setData(SETTINGS_KEY, settings);
  return true;
}

/**
 * undoDayOff:
 * - Removes today's date from dayOffRecords if present.
 * - Allows re-taking day off the same day if undone.
 */
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

/** 
 * isDayOff:
 *  - Check if the date is in dayOffRecords
 */
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

  // If name changed, check duplicates
  if (
    updatedObj.name &&
    updatedObj.name.toLowerCase() !== routines[idx].name.toLowerCase()
  ) {
    const conflict = routines.find(r => r.name.toLowerCase() === updatedObj.name.toLowerCase());
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
 */
function completeHabit(routineId, habitIndex) {
  const routines = getAllRoutines();
  const routine = routines.find(r => r.id === routineId);
  if (!routine) return;

  const habit = routine.habits[habitIndex];
  const todayStr = formatDate();

  // If already completed today, do nothing
  if (habit.lastCompletedDate === todayStr) {
    return;
  }

  // Streak logic
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
      // Check if all missed days were day offs
      let allDayOff = true;
      for (let i = 1; i < diffDays; i++) {
        const checkDate = new Date(lastDone);
        checkDate.setDate(lastDone.getDate() + i);
        if (!isDayOff(formatDate(checkDate))) {
          allDayOff = false;
          break;
        }
      }
      habit.streak = allDayOff ? habit.streak + 1 : 1;
    }
  }
  habit.lastCompletedDate = todayStr;

  // Save updated routine
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

/**
 * uncompleteHabit => remove from completions & revert streak if undone same day
 */
function uncompleteHabit(routineId, habitIndex, sameDay = true) {
  const routines = getAllRoutines();
  const routine = routines.find(r => r.id === routineId);
  if (!routine) return;

  const habit = routine.habits[habitIndex];
  const todayStr = formatDate();

  // Remove from completions
  let completions = getData(COMPLETIONS_KEY, {});
  if (completions[todayStr]) {
    completions[todayStr] = completions[todayStr].filter(
      c => !(c.routineId === routineId && c.habitIndex === habitIndex)
    );
    setData(COMPLETIONS_KEY, completions);
  }

  // Revert streak if undone the same day
  if (sameDay && habit.lastCompletedDate === todayStr) {
    habit.lastCompletedDate = "";
    habit.streak = Math.max(habit.streak - 1, 0);
    setData(ROUTINES_KEY, routines);
  }
}

/** 
 * getCompletionsByDate => returns array of { routineId, habitIndex } for the date
 */
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
  // Remove day-off records that are from older months
  settings.dayOffRecords = settings.dayOffRecords.filter(d => d.startsWith(currentMonth));
  setData(SETTINGS_KEY, settings);
}

/****************************************************
 * Notes Logic - Permanent & Daily
 ****************************************************/

/**
 * Permanent Notes => single key in localStorage
 */
const PERMANENT_NOTES_KEY = "permanentNotes";

function getPermanentNotes() {
  return getData(PERMANENT_NOTES_KEY, "");
}

function setPermanentNotes(text) {
  setData(PERMANENT_NOTES_KEY, text);
}

/**
 * Daily Notes => keyed by date, so each day is a blank slate
 */
function getDailyNotesKey(dateStr) {
  return `dailyNotes_${dateStr}`; 
}

function getDailyNotes(dateStr) {
  return getData(getDailyNotesKey(dateStr), "");
}

function setDailyNotes(dateStr, text) {
  setData(getDailyNotesKey(dateStr), text);
}
