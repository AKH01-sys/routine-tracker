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

function initAppData() {
  let routines = getData(ROUTINES_KEY, []);
  let settings = getData(SETTINGS_KEY, { dayOffLimit: 3, dayOffUsed: 0 });
  setData(ROUTINES_KEY, routines);
  setData(SETTINGS_KEY, settings);
}

// Unique ID generator for routines
function generateRoutineId() {
  return 'routine-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
}

/********************************************
 * Routines
 ********************************************/
function addRoutine(routineName, habitsArray) {
  let routines = getAllRoutines();

  // Optional: Check for duplicate routine name
  const duplicate = routines.find(r => r.name.toLowerCase() === routineName.toLowerCase());
  if (duplicate) {
    alert('A routine with this name already exists. Please choose a different name.');
    return false;
  }

  // Create new routine with unique ID
  routines.push({ 
    id: generateRoutineId(),
    name: routineName,
    habits: habitsArray
  });

  setData(ROUTINES_KEY, routines);
  return true;
}

function getAllRoutines() {
  return getData(ROUTINES_KEY, []);
}

function deleteRoutine(routineId) {
  const routines = getAllRoutines().filter(r => r.id !== routineId);
  setData(ROUTINES_KEY, routines);
}

function getRoutineById(routineId) {
  return getAllRoutines().find(r => r.id === routineId);
}

/********************************************
 * Day Off / Settings
 ********************************************/
function canTakeDayOff() {
  const settings = getSettings();
  return settings.dayOffUsed < settings.dayOffLimit;
}

function takeDayOff() {
  let settings = getSettings();
  settings.dayOffUsed += 1;
  setData(SETTINGS_KEY, settings);
}

function getSettings() {
  return getData(SETTINGS_KEY, { dayOffLimit: 3, dayOffUsed: 0 });
}

function updateSettings(updates) {
  let settings = getSettings();
  Object.assign(settings, updates);
  setData(SETTINGS_KEY, settings);
}

/********************************************
 * Initialize Data on App Load
 ********************************************/
initAppData();
