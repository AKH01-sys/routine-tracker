/********************************************
 * Utility Functions
 ********************************************/
function getData(key, defaultValue) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
}

function setData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error setting localStorage:', error);
    alert('Failed to save data. localStorage might be full or unavailable.');
  }
}

/********************************************
 * Constants & Initialization
 ********************************************/
const ROUTINES_KEY = 'routines';
const SETTINGS_KEY = 'settings';

/** 
 * Settings structure:
 * {
 *   dayOffLimit: 3,
 *   dayOffRecords: ['2025-01-05', '2025-01-10', ...] // Days off taken this month
 * }
 *
 * Routine structure:
 * {
 *   id: 'routine-...',
 *   name: 'Morning Routine',
 *   habits: [
 *     {
 *       title: 'Drink Water',
 *       time: '07:00',
 *       streak: 0,
 *       lastCompletedDate: ''
 *     },
 *     ...
 *   ]
 * }
 */

function initAppData() {
  // Ensure default data is set
  const routines = getData(ROUTINES_KEY, []);
  const settings = getData(SETTINGS_KEY, { dayOffLimit: 3, dayOffRecords: [] });

  setData(ROUTINES_KEY, routines);
  setData(SETTINGS_KEY, settings);

  // Purge day-off records from previous months
  purgeOldDayOffRecords();
}

/**
 * Remove dayOffRecords that are outside the current month.
 * So each new month starts fresh.
 */
function purgeOldDayOffRecords() {
  let settings = getSettings();
  const currentMonth = getCurrentMonth(); // e.g. "2025-01"

  // Keep only those day-offs that start with currentMonth
  settings.dayOffRecords = settings.dayOffRecords.filter(dateStr =>
    dateStr.startsWith(currentMonth)
  );

  setData(SETTINGS_KEY, settings);
}

initAppData();

/********************************************
 * Helper Functions
 ********************************************/
function formatDate(dateObj = new Date()) {
  // Returns 'YYYY-MM-DD'
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCurrentMonth() {
  // Returns 'YYYY-MM'
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

function generateRoutineId() {
  return 'routine-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
}

/********************************************
 * Routines
 ********************************************/
function getAllRoutines() {
  return getData(ROUTINES_KEY, []);
}

function getRoutineById(routineId) {
  return getAllRoutines().find(r => r.id === routineId);
}

function saveRoutines(routines) {
  setData(ROUTINES_KEY, routines);
}

/**
 * Creates a new routine
 */
function addRoutine(routineName, habitsArray) {
  const routines = getAllRoutines();

  // Check for duplicate name (case-insensitive)
  const duplicate = routines.find(
    r => r.name.toLowerCase() === routineName.toLowerCase()
  );
  if (duplicate) {
    alert('A routine with this name already exists. Please choose a different name.');
    return false;
  }

  const newRoutine = {
    id: generateRoutineId(),
    name: routineName,
    habits: habitsArray.map(h => ({
      ...h,
      streak: 0,
      lastCompletedDate: ''
    }))
  };

  routines.push(newRoutine);
  saveRoutines(routines);
  return true;
}

/**
 * Updates an existing routine
 */
function updateRoutine(routineId, updatedData) {
  let routines = getAllRoutines();
  const idx = routines.findIndex(r => r.id === routineId);
  if (idx < 0) {
    return false;
  }

  // If user changed the name, check for duplicates
  if (
    updatedData.name &&
    updatedData.name.toLowerCase() !== routines[idx].name.toLowerCase()
  ) {
    const conflict = routines.find(
      r =>
        r.name.toLowerCase() === updatedData.name.toLowerCase() &&
        r.id !== routineId
    );
    if (conflict) {
      alert('A routine with this name already exists. Choose a different name.');
      return false;
    }
  }

  // Merge new data
  routines[idx] = {
    ...routines[idx],
    ...updatedData
  };

  saveRoutines(routines);
  return true;
}

/**
 * Delete a routine entirely
 */
function deleteRoutine(routineId) {
  const routines = getAllRoutines().filter(r => r.id !== routineId);
  saveRoutines(routines);
}

/********************************************
 * Habit Completion & Streaks
 ********************************************/
function completeHabit(routineId, habitIndex) {
  const todayStr = formatDate();
  const routines = getAllRoutines();
  const routine = routines.find(r => r.id === routineId);
  if (!routine) return;

  let habit = routine.habits[habitIndex];
  if (!habit) return;

  // If the habit was already completed today, do nothing
  if (habit.lastCompletedDate === todayStr) {
    return;
  }

  // If first time completing, start streak at 1
  if (!habit.lastCompletedDate) {
    habit.streak = 1;
  } else {
    const lastDate = new Date(habit.lastCompletedDate);
    const diffDays = Math.floor(
      (new Date(todayStr) - lastDate) / (24 * 60 * 60 * 1000)
    );

    if (diffDays === 1) {
      // consecutive day
      habit.streak += 1;
    } else if (diffDays > 1) {
      // check if all missed days were day-offs
      let isAllDayOff = true;
      for (let i = 1; i < diffDays; i++) {
        const missedDate = new Date(lastDate);
        missedDate.setDate(lastDate.getDate() + i);
        if (!isDayOff(formatDate(missedDate))) {
          isAllDayOff = false;
          break;
        }
      }
      if (isAllDayOff) {
        habit.streak += 1;
      } else {
        habit.streak = 1; // reset
      }
    }
  }

  habit.lastCompletedDate = todayStr;
  saveRoutines(routines);
}

/********************************************
 * Settings / Day Off
 ********************************************/
function getSettings() {
  return getData(SETTINGS_KEY, {
    dayOffLimit: 3,
    dayOffRecords: []
  });
}

function updateSettings(updates) {
  let settings = getSettings();
  Object.assign(settings, updates);
  setData(SETTINGS_KEY, settings);
}

/**
 * Check if the user can take a day off today.
 * - No day off taken for today's date
 * - # used this month < dayOffLimit
 */
function canTakeDayOff() {
  const settings = getSettings();
  const todayStr = formatDate();

  // Already took a day off today?
  if (settings.dayOffRecords.includes(todayStr)) {
    return false;
  }

  // Count how many day-offs in current month
  const currentMonth = getCurrentMonth();
  const usedThisMonth = settings.dayOffRecords.filter(d => d.startsWith(currentMonth)).length;
  return usedThisMonth < settings.dayOffLimit;
}

/**
 * Mark today as a day off
 */
function takeDayOff() {
  const todayStr = formatDate();
  let settings = getSettings();

  // In case user tries again
  if (settings.dayOffRecords.includes(todayStr)) {
    return false;
  }

  settings.dayOffRecords.push(todayStr);
  setData(SETTINGS_KEY, settings);
  return true;
}

/**
 * Undo today's day off
 */
function undoDayOff() {
  const todayStr = formatDate();
  let settings = getSettings();

  const idx = settings.dayOffRecords.indexOf(todayStr);
  if (idx >= 0) {
    settings.dayOffRecords.splice(idx, 1);
    setData(SETTINGS_KEY, settings);
    return true;
  }
  return false;
}

/**
 * Check if a given date is a day off
 */
function isDayOff(dateStr = formatDate()) {
  const settings = getSettings();
  return settings.dayOffRecords.includes(dateStr);
}
