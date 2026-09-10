const xss = require('xss');

const MAX_MESSAGE_LENGTH = 500;
const ALLOWED_INTERESTS = [
  'gaming', 'music', 'movies', 'technology', 'sports', 'study',
  'travel', 'food', 'art', 'fitness', 'books', 'random',
];
const ALLOWED_REPORT_REASONS = ['harassment', 'nudity', 'hate-speech', 'spam', 'threats', 'gender-misrepresentation', 'other'];
const ALLOWED_GENDERS = ['male', 'female'];
const ALLOWED_GENDER_PREFERENCES = ['any', ...ALLOWED_GENDERS];

function sanitizeText(input, maxLen = MAX_MESSAGE_LENGTH) {
  if (typeof input !== 'string') return '';
  let t = input.trim().slice(0, maxLen);
  t = xss(t, { whiteList: {}, stripIgnoreTagBody: ['script'] });
  return t;
}

function sanitizeInterests(interests) {
  if (!Array.isArray(interests)) return [];
  const out = [];
  for (const i of interests) {
    if (typeof i !== 'string') continue;
    const v = i.trim().toLowerCase().slice(0, 30);
    if (ALLOWED_INTERESTS.includes(v) && !out.includes(v)) out.push(v);
    if (out.length >= 5) break;
  }
  return out;
}

function sanitizeGender(gender) {
  return ALLOWED_GENDERS.includes(gender) ? gender : null;
}

function sanitizeGenderPreference(preference) {
  return ALLOWED_GENDER_PREFERENCES.includes(preference) ? preference : 'any';
}

function isValidReason(reason) {
  return ALLOWED_REPORT_REASONS.includes(reason);
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  ALLOWED_INTERESTS,
  ALLOWED_REPORT_REASONS,
  ALLOWED_GENDERS,
  ALLOWED_GENDER_PREFERENCES,
  sanitizeText,
  sanitizeInterests,
  sanitizeGender,
  sanitizeGenderPreference,
  isValidReason,
};
