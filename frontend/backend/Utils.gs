/**
 * ============================================================
 * Utils.gs — Utility Functions
 * ============================================================
 * ฟังก์ชันช่วยเหลือต่างๆ
 * - JSON Response
 * - UUID Generator
 * - HTML Escape
 * - Thai Day of Week
 * - Google Drive URL Converter
 * ============================================================
 */

/**
 * jsonResponse — สร้าง JSON response สำหรับ ContentService
 * @param {object} data — ข้อมูลที่ต้องการส่ง
 * @returns {TextOutput}
 */
function jsonResponse(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * errorResponse — สร้าง error response
 * @param {string} message — ข้อความ error
 * @param {number} code — HTTP status code (ใช้เป็น reference เท่านั้น)
 * @returns {TextOutput}
 */
function errorResponse(message, code) {
  return jsonResponse({
    success: false,
    error: message,
    code: code || 500
  });
}

/**
 * generateId — สร้าง unique ID
 * @returns {string}
 */
function generateId() {
  return Utilities.getUuid();
}

/**
 * escapeHtml — ป้องกัน XSS
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let _cachedSpreadsheetTimeZone = null;

/**
 * getSpreadsheetTimeZoneCached — ดึง Timezone ของ Spreadsheet พร้อม Cache
 * @returns {string}
 */
function getSpreadsheetTimeZoneCached() {
  return "Asia/Bangkok";
}

/**
 * getAdjustedDate — แปลง Date object ให้ตรงกับ Timezone ของ Spreadsheet
 * @param {Date} date
 * @returns {Date}
 */
function getAdjustedDate(date) {
  const d = date || new Date();
  const tz = getSpreadsheetTimeZoneCached();
  const formattedStr = Utilities.formatDate(d, tz, "yyyy/MM/dd HH:mm:ss");
  return new Date(formattedStr);
}

/**
 * parseLocalDateString — แปลงสตริง YYYY-MM-DD ให้เป็น Date object ในเครื่อง (Local Script) โดยไม่ถูก timezone เลื่อน
 * @param {string} dateStr
 * @returns {Date}
 */
function parseLocalDateString(dateStr) {
  if (!dateStr) return getAdjustedDate();
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return getAdjustedDate();
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

/**
 * getThaiDayOfWeek — แปลงวันเป็นภาษาไทย
 * @param {Date} date — วันที่ (optional, default = วันนี้)
 * @returns {string} — จันทร์, อังคาร, พุธ, พฤหัสบดี, ศุกร์, เสาร์, อาทิตย์
 */
function getThaiDayOfWeek(date) {
  const d = date || getAdjustedDate();
  const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  return days[d.getDay()];
}

/**
 * getThaiDate — แปลงวันที่เป็นรูปแบบไทย
 * @param {Date} date
 * @returns {string}
 */
function getThaiDate(date) {
  const d = getAdjustedDate(date);
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear() + 543; // พ.ศ.
  return day + ' ' + month + ' ' + year;
}

/**
 * convertDriveUrl — แปลง Google Drive URL เป็น direct link
 * @param {string} url — Google Drive sharing URL
 * @returns {string} — direct image URL
 */
function convertDriveUrl(url) {
  if (!url) return '';

  // Pattern: https://drive.google.com/file/d/FILE_ID/view
  let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return 'https://drive.google.com/thumbnail?id=' + match[1] + '&sz=w1000';
  }

  // Pattern: https://drive.google.com/open?id=FILE_ID
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) {
    return 'https://drive.google.com/thumbnail?id=' + match[1] + '&sz=w1000';
  }

  // ถ้าเป็น URL อื่นให้คืนค่าเดิม
  return url;
}

/**
 * formatDate — แปลงวันที่เป็น YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const d = getAdjustedDate(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

/**
 * getTodayDate — วันที่วันนี้เป็น YYYY-MM-DD
 * @returns {string}
 */
function getTodayDate() {
  return formatDate(new Date());
}

/**
 * PERIODS — ข้อมูลคาบเรียนทั้ง 8 คาบ
 */
const PERIODS = [
  { period: 1, start: '09:00', end: '09:50', note: '' },
  { period: 2, start: '09:50', end: '10:40', note: '' },
  { period: 3, start: '10:40', end: '11:30', note: '' },
  { period: 4, start: '11:30', end: '12:30', note: 'รับประทานอาหาร' },
  { period: 5, start: '12:30', end: '13:20', note: '' },
  { period: 6, start: '13:20', end: '14:10', note: '' },
  { period: 7, start: '14:10', end: '15:00', note: '' },
  { period: 8, start: '15:00', end: '15:50', note: '' }
];

/**
 * getPeriodInfo — ดึงข้อมูลคาบตามหมายเลข
 * @param {number} periodNum
 * @returns {object|null}
 */
function getPeriodInfo(periodNum) {
  return PERIODS.find(p => p.period === Number(periodNum)) || null;
}

/**
 * getCurrentPeriod — หาคาบปัจจุบัน
 * @returns {number|null}
 */
function getCurrentPeriod() {
  const now = getAdjustedDate();
  const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  for (const p of PERIODS) {
    if (currentTime >= p.start && currentTime < p.end) {
      return p.period;
    }
  }
  return null;
}

/**
 * validateInput — ตรวจสอบ input ว่าไม่ว่างเปล่า
 * @param {object} fields — { fieldName: value, ... }
 * @returns {string|null} — error message หรือ null ถ้าผ่าน
 */
function validateInput(fields) {
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null || String(value).trim() === '') {
      return 'กรุณากรอก ' + name;
    }
  }
  return null;
}

/**
 * parseSheetDate — แปลงข้อมูลวันที่จาก Sheet เป็น YYYY-MM-DD เสมอ
 * @param {*} val
 * @returns {string}
 */
function parseSheetDate(val) {
  if (!val) return '';
  
  // ถ้าเป็นสตริง ISO หรือมีตัว T (เช่น ดึงมาจาก JSON cache) ให้แปลงเป็น Date แล้ว format ด้วยเขตเวลาไทย
  if (typeof val === 'string' && val.includes('T')) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return formatDate(d);
    }
  }

  if (val instanceof Date) {
    return formatDate(val);
  }
  
  // ถ้าเป็นสตริง
  const str = String(val).trim();
  
  // Case 1: YYYY-MM-DD
  let match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return match[0];
  }

  // Case 2: DD/MM/YYYY หรือ DD-MM-YYYY
  match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    let d = parseInt(match[1]);
    let m = parseInt(match[2]);
    let y = parseInt(match[3]);
    if (y > 2400) {
      y = y - 543; // แปลง พ.ศ. -> ค.ศ.
    }
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  // Case 3: YYYY/MM/DD
  match = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match) {
    let y = parseInt(match[1]);
    let m = parseInt(match[2]);
    let d = parseInt(match[3]);
    if (y > 2400) {
      y = y - 543; // แปลง พ.ศ. -> ค.ศ.
    }
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  return str;
}
