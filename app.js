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

// Settings structure example:
// {
//   dayOffLimit: 3,
//   dayOffRecords: ['2025-01-01', '2025-01-15'], // if user took day off on these dates
// }
function initAppData() {
  let routines = getData(ROUTINES_KEY, []);
  let settings = getData(SETTINGS_KEY, {
    dayOffLimit: 3,
    dayOffRecords: []
  });
  setData(ROUTINES_KEY, routines);
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
// Routine structure example:
// {
//   id: 'routine-1234567-8910',
//   name: 'Morning Routine',
//   habits: [
//     { title: 'Drink Water', time: '07:00', streak: 0, lastCompletedDate: '' },
//     ...
//   ]
// }

function getAllRoutines() {
  return getData(ROUTINES_KEY, []);
}

function getRoutineById(routineId) {
  return getAllRoutines().find(r => r.id === routineId);
}

function saveRoutines(routines) {
  setData(ROUTINES_KEY, routines);
}

function addRoutine(routineName, habitsArray) {
  const routines = getAllRoutines();

  // Check duplicate routine name (case-insensitive)
  const duplicate = routines.find(
    r => r.name.toLowerCase() === routineName.toLowerCase()
  );
  if (duplicate) {
    alert('A routine with this name already exists. Please choose a different name.');
    return false;
  }

  // Create new routine with unique ID
  const newRoutine = {
    id: generateRoutineId(),
    name: routineName,
    habits: habitsArray.map(h => ({
      ...h,
      // Initialize streak fields
      streak: 0,
      lastCompletedDate: ''
    }))
  };

  routines.push(newRoutine);
  saveRoutines(routines);
  return true;
}

function updateRoutine(routineId, updatedData) {
  // updatedData should be an object with new name/habits/etc.
  let routines = getAllRoutines();
  const idx = routines.findIndex(r => r.id === routineId);
  if (idx < 0) return false;

  // Check for routine name duplicates if name is changed
  if (
    updatedData.name &&
    updatedData.name.toLowerCase() !== routines[idx].name.toLowerCase()
  ) {
    const conflict = routines.find(
      r => r.name.toLowerCase() === updatedData.name.toLowerCase() && r.id !== routineId
    );
    if (conflict) {
      alert('A routine with this name already exists. Choose a different name.');
      return false;
    }
  }

  // Update the routine with new properties
  routines[idx] = {
    ...routines[idx],
    ...updatedData
  };
  saveRoutines(routines);
  return true;
}

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

  // Check if we missed days since last completion
  // If exactly 1 day passed or if all missed days were day-offs, we keep streak
  // If more days passed without day-offs, reset streak
  if (habit.lastCompletedDate) {
    const lastDate = new Date(habit.lastCompletedDate);
    const diffDays = Math.floor(
      (new Date(todayStr) - lastDate) / (24 * 60 * 60 * 1000)
    );

    if (diffDays === 1) {
      // consecutive day
      habit.streak += 1;
    } else if (diffDays > 1) {
      // check if day-offs for missed days
      let isAllDayOff = true;
      for (let i = 1; i < diffDays; i++) {
        const missedDate = new Date(lastDate);
        missedDate.setDate(lastDate.getDate() + i);
        const missedDateStr = formatDate(missedDate);
        if (!isDayOff(missedDateStr)) {
          isAllDayOff = false;
          break;
        }
      }
      if (isAllDayOff) {
        habit.streak += 1;
      } else {
        habit.streak = 1; // reset to 1 for today's completion
      }
    }
  } else {
    // First time completion
    habit.streak = 1;
  }

  habit.lastCompletedDate = todayStr;
  saveRoutines(routines);
}

function isDayOff(dateStr = formatDate()) {
  const settings = getSettings();
  return settings.dayOffRecords.includes(dateStr);
}

/********************************************
 * Settings / Day Off
 ********************************************/
// Settings structure example:
// {
//   dayOffLimit: 3,
//   dayOffRecords: ['2025-01-01', '2025-01-15']
// }
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
 * Check if user can take a day off today:
 * - user hasn't taken a day off for today's date
 * - # day-offs in current month < dayOffLimit
 */
function canTakeDayOff() {
  const settings = getSettings();
  const todayStr = formatDate();
  // Already taken a day off for today?
  if (settings.dayOffRecords.includes(todayStr)) {
    return false;
  }
  // Check how many day-offs this month
  const currentMonth = getCurrentMonth();
  const usedThisMonth = settings.dayOffRecords.filter(dateStr =>
    dateStr.startsWith(currentMonth)
  ).length;
  return usedThisMonth < settings.dayOffLimit;
}

function takeDayOff() {
  let settings = getSettings();
  const todayStr = formatDate();
  settings.dayOffRecords.push(todayStr);
  setData(SETTINGS_KEY, settings);
}

/**
 * Undo a day off for today only
 */
function undoDayOff() {
  let settings = getSettings();
  const todayStr = formatDate();
  const index = settings.dayOffRecords.indexOf(todayStr);
  if (index >= 0) {
    settings.dayOffRecords.splice(index, 1);
    setData(SETTINGS_KEY, settings);
    return true;
  }
  return false;
}
