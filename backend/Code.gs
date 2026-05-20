/**
 * ============================================================
 * Code.gs — Main Router
 * ============================================================
 * จุดเข้าหลักของ Google Apps Script Web App
 * - doGet: รับ GET requests
 * - doPost: รับ POST requests พร้อม routing
 * ============================================================
 */

// ============================================================
// CONFIG — เปลี่ยน SPREADSHEET_ID เป็น ID ของ Google Sheets คุณ
// ============================================================
const SPREADSHEET_ID = '1FH7j3mjBw30HuEdLvBN4Iqs86CREyyLbQvSczsAISDc';

/**
 * doGet — Handle GET requests
 * ใช้สำหรับทดสอบว่า API ทำงาน
 */
function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : null;

  // ถ้ามี action ให้ route ไปที่ handleAction
  if (action) {
    return handleAction(action, e.parameter);
  }

  // Default: ส่ง status
  return jsonResponse({
    status: 'ok',
    message: 'Teaching Attendance API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
}

/**
 * doPost — Handle POST requests
 * รับ JSON body → route ไปตาม action
 */
function doPost(e) {
  try {
    // Parse request body
    let data = {};
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }

    const action = data.action || '';
    return handleAction(action, data);
  } catch (error) {
    return errorResponse('เกิดข้อผิดพลาด: ' + error.message);
  }
}

/**
 * handleAction — Route action ไปยัง function ที่ถูกต้อง
 * @param {string} action — ชื่อ action
 * @param {object} data — ข้อมูลที่ส่งมา
 */
function handleAction(action, data) {
  try {
    // === Actions ที่ไม่ต้อง login ===
    switch (action) {
      case 'login':
        return login(data.username, data.password);
      case 'getTeacherList':
        return getTeacherList();
      case 'getSettings':
        return getSettingsData();
      case 'setupSheets':
        return setupAllSheets();
      case 'ping':
        return jsonResponse({ status: 'ok', message: 'pong' });
    }

    // === Actions ที่ต้อง login — validate session ก่อน ===
    const session = validateSession(data.token);
    if (!session) {
      return errorResponse('Session หมดอายุ กรุณา Login ใหม่', 401);
    }

    const teacherId = session.teacherId;

    switch (action) {
      // --- Auth ---
      case 'logout':
        return logout(data.token);
      case 'getProfile':
        return getProfile(teacherId);
      case 'getDashboardData':
        return getDashboardData(teacherId);

      // --- Schedule ---
      case 'getTodaySchedule':
        return getTodaySchedule(teacherId);
      case 'getWeekSchedule':
        return getWeekSchedule(teacherId);
      case 'addSchedule':
        return addSchedule(teacherId, data);
      case 'deleteSchedule':
        return deleteSchedule(teacherId, data.scheduleId);
      case 'getAllClassrooms':
        return getAllClassrooms();

      // --- Attendance ---
      case 'getAttendanceCards':
        return getAttendanceCards(teacherId, data.date);
      case 'getStudentsForAttendance':
        return getStudentsForAttendance(data.scheduleId, data.date);
      case 'saveAttendance':
        return saveAttendance(teacherId, data.scheduleId, data.date, data.records);

      // --- Scores ---
      case 'getClassList':
        return getClassList(teacherId);
      case 'getSubjectList':
        return getSubjectList(teacherId, data.className);
      case 'getScores':
        return getScores(data.className, data.subjectName);
      case 'saveScores':
        return saveScores(data.className, data.subjectName, data);

      // --- Reports ---
      case 'getAttendanceReport':
        return getAttendanceReport(teacherId, data.className, data.subjectName, data.month, data.term);
      case 'getScoreReport':
        return getScoreReport(data.className, data.subjectName);

      // --- Settings ---
      case 'saveSettings':
        return saveSettings(data.school_name, data.logo_url, data.footer_credit);

      default:
        return errorResponse('ไม่รู้จัก action: ' + action);
    }
  } catch (error) {
    Logger.log('Error in handleAction: ' + error.message);
    return errorResponse('เกิดข้อผิดพลาดภายในระบบ: ' + error.message);
  }
}

/**
 * getSpreadsheet — เปิด Google Sheets พร้อมแคชออบเจกต์ในตัวแปร global
 * @returns {Spreadsheet}
 */
let _cachedSpreadsheet = null;
function getSpreadsheet() {
  if (!_cachedSpreadsheet) {
    _cachedSpreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return _cachedSpreadsheet;
}

/**
 * getSheet — ดึง sheet ตามชื่อ
 * @param {string} sheetName
 * @returns {Sheet}
 */
function getSheet(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('ไม่พบ Sheet: ' + sheetName + ' — กรุณารัน Setup Sheets ก่อน');
  }
  return sheet;
}

/**
 * getSheetData — ดึงข้อมูลทั้งหมดจาก sheet พร้อมระบบแคชแบบแยกส่วน (Chunked CacheService)
 * แก้ปัญหาข้อจำกัด 100 KB ของ Google Apps Script Cache เพื่อรองรับข้อมูลขนาดใหญ่
 * @param {string} sheetName
 * @returns {object[]}
 */
function getSheetData(sheetName) {
  const cacheKey = 'sheet_data_' + sheetName;
  try {
    const cache = CacheService.getScriptCache();
    const metaStr = cache.get(cacheKey);
    if (metaStr) {
      const meta = JSON.parse(metaStr);
      if (meta && meta.chunks !== undefined) {
        let dataStr = '';
        let validCache = true;
        for (let i = 0; i < meta.chunks; i++) {
          const chunk = cache.get(cacheKey + '_chunk_' + i);
          if (!chunk) {
            validCache = false;
            break;
          }
          dataStr += chunk;
        }
        if (validCache) {
          return JSON.parse(dataStr);
        }
      }
    }
  } catch (e) {
    Logger.log('Cache read error for ' + sheetName + ': ' + e.message);
  }

  // ถ้าไม่มีในแคช ให้โหลดจาก Sheet จริง
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // มีแค่ header

  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }

  // เก็บลงแคชแบบแยกส่วน (อายุ 600 วินาที)
  try {
    const cache = CacheService.getScriptCache();
    const dataStr = JSON.stringify(rows);
    const chunkSize = 80 * 1024; // 80 KB chunks
    const numChunks = Math.ceil(dataStr.length / chunkSize);
    const expiration = 600; // 10 นาที
    
    cache.put(cacheKey, JSON.stringify({ chunks: numChunks }), expiration);
    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize;
      const chunk = dataStr.substring(start, start + chunkSize);
      cache.put(cacheKey + '_chunk_' + i, chunk, expiration);
    }
  } catch (e) {
    Logger.log('Cache write error for ' + sheetName + ': ' + e.message);
  }

  return rows;
}

/**
 * clearSheetCache — ลบแคชแบบแยกส่วนของ Sheet เมื่อมีข้อมูลเปลี่ยน
 * @param {string} sheetName
 */
function clearSheetCache(sheetName) {
  const cacheKey = 'sheet_data_' + sheetName;
  try {
    const cache = CacheService.getScriptCache();
    const metaStr = cache.get(cacheKey);
    if (metaStr) {
      const meta = JSON.parse(metaStr);
      if (meta && meta.chunks !== undefined) {
        for (let i = 0; i < meta.chunks; i++) {
          cache.remove(cacheKey + '_chunk_' + i);
        }
      }
    }
    cache.remove(cacheKey);
  } catch (e) {
    Logger.log('Cache clear error for ' + sheetName + ': ' + e.message);
  }
}

function runClearCache() {
  clearSheetCache('Attendance');
  clearSheetCache('Schedule');
  clearSheetCache('Students');
  clearSheetCache('Teachers');
  clearSheetCache('Settings');
}
