function getData(key, defaultValue) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
}

function setData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const ROUTINES_KEY = 'routines';
const SETTINGS_KEY = 'settings';

function initAppData() {
  let routines = getData(ROUTINES_KEY, []);
  let settings = getData(SETTINGS_KEY, { dayOffLimit: 3, dayOffUsed: 0 });
  setData(ROUTINES_KEY, routines);
  setData(SETTINGS_KEY, settings);
}

function addRoutine(routineName, habitsArray) {
  let routines = getData(ROUTINES_KEY, []);
  routines.push({ name: routineName, habits: habitsArray });
  setData(ROUTINES_KEY, routines);
}

function getAllRoutines() {
  return getData(ROUTINES_KEY, []);
}

function canTakeDayOff() {
  const settings = getData(SETTINGS_KEY, { dayOffLimit: 3, dayOffUsed: 0 });
  return settings.dayOffUsed < settings.dayOffLimit;
}

function takeDayOff() {
  let settings = getData(SETTINGS_KEY, { dayOffLimit: 3, dayOffUsed: 0 });
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

initAppData();