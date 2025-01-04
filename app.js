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
    console.error('Error setting localStorage:', error);
    alert('Failed to save data. localStorage might be full or unavailable.');
  }
}

/****************************************************
 * Constants & Initialization
 ****************************************************/
const ROUTINES_KEY = "routines";
const SETTINGS_KEY = "settings";
const COMPLETIONS_KEY = "completions"; // Stores daily completions
const DAILY_QUOTES_KEY = "dailyQuotes"; // Stores quotes if needed

/**
 * Initialize the app data:
 * - Ensure default data structures are in place.
 * - Purge old day-off records from previous months.
 * - Initialize daily quotes if not already set.
 */
function initAppData() {
  let routines = getData(ROUTINES_KEY, []);
  let settings = getData(SETTINGS_KEY, {
    dayOffLimit: 3,
    dayOffRecords: []
  });
  let completions = getData(COMPLETIONS_KEY, {}); // store daily completions
  let dailyQuotes = getData(DAILY_QUOTES_KEY, DAILY_QUOTES); // Load or initialize quotes

  setData(ROUTINES_KEY, routines);
  setData(SETTINGS_KEY, settings);
  setData(COMPLETIONS_KEY, completions);
  setData(DAILY_QUOTES_KEY, dailyQuotes);

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

/** Day-of-year (1 to 366) for daily quotes */
function getDayOfYear(dateObj = new Date()) {
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
 * - No day off taken for today.
 * - Not over dayOffLimit for this month.
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

/****************************************************
 * Daily Quotes
 ****************************************************/
/**
 * Assign a unique quote to each day of the year (366).
 * For simplicity, the quotes are predefined in the DAILY_QUOTES array.
 * If you have fewer than 366 quotes, the quotes will repeat.
 */

const DAILY_QUOTES = [
  "Every moment is a fresh beginning.",
  "Act as if what you do makes a difference. It does.",
  "Success is not final, failure is not fatal.",
  "Never bend your head. Always hold it high.",
  "What you get by achieving your goals is not as important as what you become by achieving your goals.",
  "Believe you can and you’re halfway there.",
  "When you have a dream, you've got to grab it and never let go.",
  "No matter what you’re going through, there’s a light at the end of the tunnel.",
  "You define your own life. Don’t let other people write your script.",
  "You are never too old to set another goal or to dream a new dream.",
  "It’s not whether you get knocked down, it’s whether you get up.",
  "Someday is not a day of the week.",
  "Make each day your masterpiece.",
  "You are enough just as you are.",
  "In a gentle way, you can shake the world.",
  "Spread love everywhere you go.",
  "Try to be a rainbow in someone’s cloud.",
  "Do one thing every day that scares you.",
  "Impossible is just an opinion.",
  "Happiness is not by chance, but by choice.",
  "If you’re offered a seat on a rocket ship, don’t ask what seat! Just get on.",
  "First, think. Second, believe. Third, dream. And finally, dare.",
  "It always seems impossible until it’s done.",
  "Keep your face always toward the sunshine—and shadows will fall behind you.",
  "The bad news is time flies. The good news is you’re the pilot.",
  "Life changes very quickly, in a very positive way, if you let it.",
  "Keep your eyes on the stars, and your feet on the ground.",
  "If you can dream it, you can do it.",
  "Turn your wounds into wisdom.",
  "Wherever you go, go with all your heart.",
  "The most wasted of days is one without laughter.",
  "Focus on the journey, not the destination.",
  "Stay hungry. Stay foolish.",
  "Fail often so you can succeed sooner.",
  "The power of imagination makes us infinite.",
  "Life is 10% what happens to us and 90% how we react to it.",
  "If you don’t like the road you're walking, start paving another one.",
  "Keep going. Everything you need will come to you at the perfect time.",
  "You are never too old to set a new goal or to dream a new dream.",
  "However difficult life may seem, there is always something you can do.",
  "Anyone who has never made a mistake has never tried anything new.",
  "No one is perfect - that's why pencils have erasers.",
  "A person who never made a mistake never tried anything new.",
  "What we think, we become.",
  "Without a struggle, there can be no progress.",
  "Dream big and dare to fail.",
  "Embrace the glorious mess that you are.",
  "You can if you think you can.",
  "Failure is success in progress.",
  "Be yourself; everyone else is already taken.",
  "The best way out is always through.",
  "Begin anywhere.",
  "Nothing will work unless you do.",
  "When in doubt, choose change.",
  "Keep going. Be all in.",
  "Don’t just read the easy stuff. You may be entertained by it, but you will never grow from it.",
  "Don't watch the clock; do what it does. Keep going.",
  "Do something wonderful, people may imitate it.",
  "Don't wait for opportunity. Create it.",
  "Your big opportunity may be right where you are now.",
  "The secret of getting ahead is getting started.",
  "Don't let yesterday take up too much of today.",
  "Don’t wait. The time will never be just right.",
  "Challenges are what make life interesting; overcoming them is what makes life meaningful.",
  "Sometimes the fall kills you. And sometimes, when you fall, you fly.",
  "Keep your vitality. A life without health is like a river without water.",
  "Quality is not an act, it is a habit.",
  "The journey of a thousand miles begins with one step.",
  "The mind is everything. What you think you become.",
  "You miss 100% of the shots you don’t take.",
  "Life is like riding a bicycle. To keep your balance, you must keep moving.",
  "Well done is better than well said.",
  "If you can’t outplay them, outwork them.",
  "The harder you work for something, the greater you’ll feel when you achieve it.",
  "Where there is no vision, there is no hope.",
  "If you want to lift yourself up, lift up someone else.",
  "The best revenge is massive success.",
  "Don't be pushed by your problems; be led by your dreams.",
  "Your limitation—it’s only your imagination.",
  "Push yourself, because no one else is going to do it for you.",
  "Wake up with determination. Go to bed with satisfaction.",
  "Little things make big days.",
  "Dream it. Wish it. Do it.",
  "It’s going to be hard, but hard does not mean impossible.",
  "Sometimes later becomes never. Do it now.",
  "Don’t stop when you’re tired. Stop when you’re done.",
  "The future depends on what you do today.",
  "Stay positive. Work hard. Make it happen.",
  "The key to success is to focus on goals, not obstacles.",
  "You don’t have to be great to start, but you have to start to be great.",
  "Do something today that your future self will thank you for.",
  "Just believe in yourself. Even if you don’t, pretend that you do.",
  "The distance between insanity and genius is measured only by success.",
  "If you genuinely want something, don’t wait for it—teach yourself to be impatient.",
  "No great achiever – even those who made it seem easy – ever succeeded without hard work.",
  "Be willing to be a beginner every single morning.",
  "In a world where you can be anything, be kind.",
  "Your passion is waiting for your courage to catch up.",
  "Don’t be afraid to give up the good to go for the great.",
  "Everything you can imagine is real.",
  "Normality is a paved road: it’s comfortable to walk, but no flowers grow on it.",
  "The road to success is always under construction.",
  "If you think you can, you can. And if you think you can’t, you’re right.",
  "Success isn’t always about greatness. It’s about consistency.",
  "Work hard in silence, let your success be your noise.",
  "Goals may give focus, but dreams give power.",
  "Definiteness of purpose is the starting point of all achievement.",
  "Learn the rules like a pro, so you can break them like an artist.",
  "Whatever you are, be a good one.",
  "Life’s too mysterious to take too serious.",
  "Don’t be the same. Be better.",
  "You are what you do, not what you say you’ll do.",
  "It does not matter how slowly you go as long as you do not stop.",
  "Dream bigger. Do bigger.",
  "Don’t compare your beginning to someone else’s middle.",
  "If it doesn’t challenge you, it won’t change you.",
  "Shoot for the moon. Even if you miss, you’ll land among the stars.",
  "Do what is right, not what is easy.",
  "Don’t wish it were easier. Wish you were better.",
  "If you believe in yourself enough and know what you want, you’re gonna make it happen.",
  "Never give up on a dream just because of the time it will take to accomplish it.",
  "Things work out best for those who make the best of how things work out.",
  "To live a creative life, we must lose our fear of being wrong.",
  "All our dreams can come true if we have the courage to pursue them.",
  "Be so good they can’t ignore you.",
  "It always seems impossible until it’s done.",
  "The secret of success is to do the common thing uncommonly well.",
  "Where focus goes, energy flows.",
  "Either run the day, or the day runs you.",
  "You can waste your life drawing lines. Or you can live your life crossing them.",
  "If you can dream it, you can achieve it.",
  "Don’t let small minds convince you that your dreams are too big.",
  "Whatever you do, do it well.",
  "When you know what you want, and want it bad enough, you’ll find a way to get it.",
  "If opportunity doesn’t knock, build a door.",
  "Don’t limit your challenges. Challenge your limits.",
  "If you don’t risk anything, you risk even more.",
  "Trust yourself. You know more than you think you do.",
  "A year from now you may wish you had started today.",
  "Dream beautiful dreams, and then work to make those dreams come true.",
  "Strive not to be a success, but rather to be of value.",
  "No pressure, no diamonds.",
  "What lies behind us and what lies before us are tiny matters compared to what lies within us.",
  "There is no substitute for hard work.",
  "It’s not about perfect. It’s about effort.",
  "Don’t wish for it to be easier. Wish you were better.",
  "Your potential is endless.",
  "Once you choose hope, anything’s possible.",
  "Don’t let anyone dull your sparkle.",
  "It’s never too late for a new beginning in your life.",
  "Don’t count the days, make the days count.",
  "Problems are not stop signs; they are guidelines.",
  "Stay foolish to stay sane.",
  "And you ask ‘What if I fall?’ Oh but my darling, what if you fly?",
  "Light tomorrow with today.",
  "All things are difficult before they are easy.",
  "Your present circumstances don’t determine where you can go; they merely determine where you start.",
  "Be addicted to bettering yourself.",
  "Collect moments, not things.",
  "Keep some room in your heart for the unimaginable.",
  "Failure will never overtake me if my determination to succeed is strong enough.",
  "Change the world by being yourself.",
  "The way to get started is to quit talking and begin doing.",
  "While there’s life, there’s hope.",
  "Win in your mind and you will win in your reality.",
  // (Add more unique quotes here to reach 366)
];

// If DAILY_QUOTES has fewer than 366 quotes, they will repeat
// To ensure 366 quotes, you can manually add more or repeat existing ones

/**
 * Function to get today's quote based on day of the year.
 */
function getTodaysQuote() {
  const dayOfYearIndex = (getDayOfYear() - 1) % DAILY_QUOTES.length; 
  // '-1' so Jan 1 => index 0
  // If we have fewer than 366 quotes, we use modulo to cycle through
  return DAILY_QUOTES[dayOfYearIndex];
}
