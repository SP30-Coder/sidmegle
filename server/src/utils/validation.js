const xss = require('xss');

const MAX_MESSAGE_LENGTH = 500;
const ALLOWED_INTERESTS = [
  'gaming', 'music', 'movies', 'technology', 'sports', 'study',
  'travel', 'food', 'art', 'fitness', 'books', 'random',
];
const ALLOWED_REPORT_REASONS = ['harassment', 'nudity', 'hate-speech', 'spam', 'threats', 'gender-misrepresentation', 'other'];
const ALLOWED_GENDERS = ['male', 'female'];
const ALLOWED_GENDER_PREFERENCES = ['any', ...ALLOWED_GENDERS];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_RE = /^room_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function isUuidish(value) { return typeof value === 'string' && UUID_RE.test(value); }
function isRoomId(value) { return typeof value === 'string' && ROOM_RE.test(value); }
function isSafeSdp(value, maxLength = 20000) {
  return typeof value === 'string' && value.length <= maxLength && value.includes('v=') && value.includes('m=') && !/[<>]/.test(value);
}
function isSafeIceCandidate(value, maxBytes = 5000) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const allowed = ['candidate', 'sdpMid', 'sdpMLineIndex', 'usernameFragment'];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return false;
  if (typeof value.candidate !== 'string' || value.candidate.length > 2000) return false;
  if (value.sdpMid !== undefined && typeof value.sdpMid !== 'string') return false;
  if (value.sdpMLineIndex !== undefined && !Number.isInteger(value.sdpMLineIndex)) return false;
  return Buffer.byteLength(JSON.stringify(value), 'utf8') <= maxBytes;
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
  isUuidish,
  isRoomId,
  isSafeSdp,
  isSafeIceCandidate,
};
