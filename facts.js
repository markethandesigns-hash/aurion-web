/* Aurion's grounded facts (1.2.3): things a small AI brain gets wrong, worked out exactly instead.
   - today's date / time / day of week
   - western (tropical) zodiac sign for any date, month or "today", with the exact date ranges
   facts.answer(text, now) -> { direct } a full answer for pure fact questions (no AI needed), or { facts, sign } extra
   facts for the AI plus the sign it must use, or null when the question has nothing to do with dates/astrology.
   facts.today(now) -> one stable line for the system prompt (changes once a day so the brain's prompt cache holds).
   facts.wrongSign(reply, sign) -> true when the AI names a different sign than the one it was given. */
(function(root){
'use strict';
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const MON3 = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
/* [sign, start month (0-based), start day, end month, end day, element, ruling planet] */
const SIGNS = [
  ['Capricorn', 11, 22, 0, 19, 'earth', 'Saturn'], ['Aquarius', 0, 20, 1, 18, 'air', 'Uranus'], ['Pisces', 1, 19, 2, 20, 'water', 'Neptune'],
  ['Aries', 2, 21, 3, 19, 'fire', 'Mars'], ['Taurus', 3, 20, 4, 20, 'earth', 'Venus'], ['Gemini', 4, 21, 5, 20, 'air', 'Mercury'],
  ['Cancer', 5, 21, 6, 22, 'water', 'the Moon'], ['Leo', 6, 23, 7, 22, 'fire', 'the Sun'], ['Virgo', 7, 23, 8, 22, 'earth', 'Mercury'],
  ['Libra', 8, 23, 9, 22, 'air', 'Venus'], ['Scorpio', 9, 23, 10, 21, 'water', 'Pluto and Mars'], ['Sagittarius', 10, 22, 11, 21, 'fire', 'Jupiter']];
const NAMES = SIGNS.map(s => s[0]);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const range = s => cap(MONTHS[s[1]]).slice(0, 3) + ' ' + s[2] + ' to ' + cap(MONTHS[s[3]]).slice(0, 3) + ' ' + s[4];
function signOf(m, d){   // m 0-11
  for(const s of SIGNS){ if((m === s[1] && d >= s[2]) || (m === s[3] && d <= s[4])) return s; }
  return SIGNS[0];
}
function monthSigns(m){ const a = SIGNS.find(s => s[3] === m), b = SIGNS.find(s => s[1] === m); return [a, b]; }
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const fmtDate = n => DAYS[n.getDay()] + ', ' + cap(MONTHS[n.getMonth()]) + ' ' + n.getDate() + ', ' + n.getFullYear();
const fmtTime = n => { let h = n.getHours(), m = n.getMinutes(); const ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; return h + ':' + String(m).padStart(2, '0') + ' ' + ap; };
function today(now){ const n = now || new Date(), s = signOf(n.getMonth(), n.getDate());
  return 'Today is ' + fmtDate(n) + '. The sun is in ' + s[0] + ' (' + range(s) + '). Western zodiac dates: ' + SIGNS.map(x => x[0] + ' ' + range(x)).join('; ') + '.'; }
const ord = w => ({ first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, 'twenty-first': 21, 'twenty first': 21, 'twenty-second': 22, 'twenty second': 22, 'twenty-third': 23, 'twenty third': 23, 'twenty-fourth': 24, 'twenty fourth': 24, 'twenty-fifth': 25, 'twenty fifth': 25, 'twenty-sixth': 26, 'twenty sixth': 26, 'twenty-seventh': 27, 'twenty seventh': 27, 'twenty-eighth': 28, 'twenty eighth': 28, 'twenty-ninth': 29, 'twenty ninth': 29, thirtieth: 30, 'thirty-first': 31, 'thirty first': 31 })[w];
/* find a month (and maybe a day) in what was said */
function findDate(t){
  const mre = '(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\\.?';
  const dre = '(\\d{1,2})(?:st|nd|rd|th)?|((?:twenty|thirty)[ -]\\w+|\\w+(?:st|nd|rd|th))';
  let m = t.match(new RegExp('\\b' + mre + '\\s+(?:the\\s+)?(?:' + dre + ')\\b', 'i'));
  const mon = s => { s = s.toLowerCase().replace('.', ''); return MONTHS.indexOf(s) >= 0 ? MONTHS.indexOf(s) : MON3[s]; };
  const day = (a, b) => a ? +a : ord(String(b || '').toLowerCase());
  if(m && (m[1].toLowerCase() !== 'may' || /\d/.test(m[2] || '') || ord(String(m[3] || '').toLowerCase()))){ const d = day(m[2], m[3]); if(d >= 1 && d <= 31) return { m: mon(m[1]), d }; }
  m = t.match(new RegExp('\\b(?:the\\s+)?(?:' + dre + ')\\s+of\\s+' + mre + '\\b', 'i'));
  if(m){ const d = day(m[1], m[2]); if(d >= 1 && d <= 31) return { m: mon(m[3]), d }; }
  m = t.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-]\d{2,4})?\b/);   // US style 10/30
  if(m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31) return { m: +m[1] - 1, d: +m[2] };
  m = t.match(new RegExp('\\b(?:in|for|of|during|born in|this)\\s+' + mre + '(?!\\s+\\d)\\b', 'i')) || t.match(new RegExp('\\b' + mre + '\\s+(?:sign|horoscope|zodiac|birthday|babies|born)', 'i'));
  if(m && !/^may$/i.test(m[1])) return { m: mon(m[1]) };
  if(m && /^may$/i.test(m[1]) && /\b(in|for|born in|during)\s+may\b/i.test(t)) return { m: 4 };
  m = t.match(/\b(january|february|march|april|june|july|august|september|october|november|december)\b/i);   // 1.2.3: any full month name
  if(m) return { m: mon(m[1]) };
  return null;
}
const ASTRO = /\b(horoscope|zodiac|star ?sign|sun ?sign|astrolog\w*|what sign|which sign|my sign|sign (is|am)|sign for|signs? (are |is )?(in|for|of)|birthday|born (on|in)|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\b/i;
const reading = s => ({ fire: 'bold, warm energy', earth: 'steady, grounded energy', air: 'curious, social energy', water: 'deep, intuitive energy' })[s[5]];
function answer(text, now){
  const t = String(text || ''), n = now || new Date(), lt = t.toLowerCase();
  /* plain date/time questions: answered exactly, no AI */
  if(/\bwhat('?s| is)? (the )?(time|hour)\b|\bwhat time is it\b/i.test(lt)) return { direct: 'It is ' + fmtTime(n) + ' on ' + fmtDate(n) + '.' };
  if(/\b(what('?s| is)? (the |today'?s )?date|what day is (it|today)|what('?s| is) today|today'?s date|what month is it|what year is it)\b/i.test(lt)) return { direct: 'Today is ' + fmtDate(n) + '.' };
  if(!ASTRO.test(lt)) return null;
  const dt = findDate(t), todaySign = signOf(n.getMonth(), n.getDate());
  const about = s => s[0] + ' runs ' + range(s) + ', ' + (s[5] === 'air' || s[5] === 'earth' ? 'an ' : 'a ') + s[5] + ' sign ruled by ' + s[6] + '.';
  /* a specific date: one exact sign */
  if(dt && dt.d){ const s = signOf(dt.m, dt.d), when = cap(MONTHS[dt.m]) + ' ' + dt.d;
    if(/\bhoroscope|reading|forecast|energy|vibe\b/i.test(lt)) return { sign: s[0], facts: 'FACT: ' + when + ' falls in ' + s[0] + ' (' + range(s) + '), a ' + s[5] + ' sign ruled by ' + s[6] + '. Use exactly this sign.', lead: when + ' makes you a ' + s[0] + '.' };
    return { direct: when + ' is ' + s[0] + '. ' + about(s) };
  }
  /* a month only: most months hold two signs */
  if(dt){ const [a, b] = monthSigns(dt.m), mn = cap(MONTHS[dt.m]);
    const line = mn + ' has two signs: ' + a[0] + ' until ' + mn + ' ' + a[4] + ', then ' + b[0] + ' from ' + mn + ' ' + b[2] + '.';
    const nm = NAMES.find(x => new RegExp('\\b' + x + '\\b', 'i').test(t));
    if(nm){ const s = SIGNS.find(x => x[0] === nm), yes = nm === a[0] || nm === b[0];
      return { direct: (yes ? 'Partly. ' : 'No. ') + line + (yes ? '' : ' ' + about(s)) }; }
    if(/\bhoroscope|reading|forecast|energy|vibe\b/i.test(lt)) return { sign: null, signs: [a[0], b[0]], facts: 'FACT: ' + line + ' Mention both, never any other sign.', lead: line };
    return { direct: line + ' Tell me the day and I will tell you exactly.' };
  }
  /* "my horoscope", "today's horoscope", "what sign is it now" */
  if(/\b(today|now|this (week|month)|current|right now|horoscope)\b/i.test(lt) && !/\bmy sign\b|\bwhat('?s| is) my\b|\bi am\b|\bi'?m\b/i.test(lt) || /\btoday'?s horoscope|horoscope (for )?today|sign (is it|are we in)\b/i.test(lt)){
    return { sign: todaySign[0], facts: 'FACT: Today is ' + fmtDate(n) + '; the sun is in ' + todaySign[0] + ' (' + range(todaySign) + '), a ' + todaySign[5] + ' sign ruled by ' + todaySign[6] + '. Use exactly this sign.', lead: 'Right now the sun is in ' + todaySign[0] + ', ' + reading(todaySign) + '.' };
  }
  /* "what's my sign" without a date */
  if(/\b(my|what) (sign|zodiac)|what('?s| is) my (star|sun|zodiac)? ?sign\b/i.test(lt)) return { direct: 'Tell me your birthday, month and day, and I will tell you your sign exactly.' };
  /* a sign named: give its real dates */
  const named = NAMES.find(x => new RegExp('\\b' + x + '\\b', 'i').test(t));
  if(named){ const s = SIGNS.find(x => x[0] === named); return { sign: named, facts: 'FACT: ' + about(s) + ' Use exactly these dates.', lead: null }; }
  return { sign: null, facts: 'FACT: ' + today(n) };
}
/* the AI named a sign it was not given */
function wrongSign(reply, allowed){ if(!allowed || !allowed.length) return false; const said = NAMES.filter(x => new RegExp('\\b' + x + 's?\\b', 'i').test(reply));
  return said.some(x => allowed.indexOf(x) < 0); }
const api = { answer, today, signOf: (m, d) => signOf(m, d)[0], wrongSign, findDate, SIGNS, fmtDate, fmtTime };
if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.Facts = api;
})(typeof window !== 'undefined' ? window : globalThis);
