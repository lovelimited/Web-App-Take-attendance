/**
 * ============================================================
 * SheetSetup.gs — Auto Create Sheets & Headers
 * ============================================================
 * สร้าง Google Sheets Structure อัตโนมัติ
 * - ตรวจสอบว่ามี Sheet หรือยัง
 * - ถ้าไม่มีให้สร้างใหม่พร้อม headers
 * - ไม่ลบข้อมูลที่มีอยู่แล้ว
 * ============================================================
 */

/**
 * setupAllSheets — สร้าง sheets ทั้งหมดที่จำเป็น
 * @returns {TextOutput}
 */
function setupAllSheets() {
  try {
    const ss = getSpreadsheet();
    const results = [];

    // 1. Teachers Sheet
    results.push(createSheetIfNotExists(ss, 'Teachers', [
      'teacher_id', 'username', 'password', 'full_name', 'role', 'status'
    ]));

    // 2. Students Sheet
    results.push(createSheetIfNotExists(ss, 'Students', [
      'student_id', 'prefix', 'first_name', 'last_name', 'class_room', 'status'
    ]));

    // 3. Schedule Sheet
    results.push(createSheetIfNotExists(ss, 'Schedule', [
      'schedule_id', 'teacher_id', 'class_name', 'subject_name',
      'day_of_week', 'period', 'start_time', 'end_time'
    ]));

    // 4. Attendance Sheet
    results.push(createSheetIfNotExists(ss, 'Attendance', [
      'attendance_id', 'date', 'teacher_id', 'schedule_id',
      'student_id', 'status', 'timestamp'
    ]));

    // 5. Scores Sheet
    results.push(createSheetIfNotExists(ss, 'Scores', [
      'score_id', 'class_name', 'subject_name', 'student_id',
      'worksheet_1', 'worksheet_2', 'worksheet_3', 'worksheet_4', 'worksheet_5',
      'worksheet_total', 'midterm_score', 'midterm_exam', 'final_exam',
      'total_score', 'grade'
    ]));

    // 5.5 ScoreConfigs Sheet
    results.push(createSheetIfNotExists(ss, 'ScoreConfigs', [
      'class_name', 'subject_name', 'worksheet_count', 'worksheet_max_scores'
    ]));

    // 6. Settings Sheet (key-value)
    results.push(createSheetIfNotExists(ss, 'Settings', [
      'key', 'value'
    ]));

    // ใส่ default settings ถ้ายังไม่มี
    setupDefaultSettings(ss);

    // ใส่ sample teacher ถ้ายังไม่มี
    setupSampleTeacher(ss);

    return jsonResponse({
      success: true,
      message: 'สร้าง/ตรวจสอบ Sheets เสร็จสิ้น',
      results: results
    });
  } catch (error) {
    Logger.log('setupAllSheets error: ' + error.message);
    return errorResponse('ไม่สามารถสร้าง Sheets ได้: ' + error.message);
  }
}

/**
 * createSheetIfNotExists — สร้าง sheet ถ้ายังไม่มี
 * @param {Spreadsheet} ss
 * @param {string} sheetName
 * @param {string[]} headers
 * @returns {object} — ผลลัพธ์
 */
function createSheetIfNotExists(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);

  if (sheet) {
    return { sheet: sheetName, status: 'already_exists' };
  }

  // สร้าง sheet ใหม่
  sheet = ss.insertSheet(sheetName);

  // ใส่ headers
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);

  // Format headers
  headerRange
    .setFontWeight('bold')
    .setBackground('#1a73e8')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // Freeze header row
  sheet.setFrozenRows(1);

  // Auto resize columns
  for (let i = 1; i <= headers.length; i++) {
    sheet.setColumnWidth(i, 150);
  }

  return { sheet: sheetName, status: 'created' };
}

/**
 * setupDefaultSettings — ใส่ค่าเริ่มต้นใน Settings sheet
 * @param {Spreadsheet} ss
 */
function setupDefaultSettings(ss) {
  const sheet = ss.getSheetByName('Settings');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();

  // ถ้ามีข้อมูลแล้ว (มากกว่าแค่ header) ไม่ต้องเพิ่ม
  if (data.length > 1) return;

  const defaults = [
    ['school_name', 'โรงเรียนตัวอย่าง'],
    ['logo_url', ''],
    ['theme_color', '#1a73e8'],
    ['footer_credit', 'พัฒนาโดยทีมงาน IT โรงเรียน'],
    ['system_version', 'v1.0.0']
  ];

  sheet.getRange(2, 1, defaults.length, 2).setValues(defaults);
}

/**
 * setupSampleTeacher — ใส่ครูตัวอย่างถ้ายังไม่มี
 * @param {Spreadsheet} ss
 */
function setupSampleTeacher(ss) {
  const sheet = ss.getSheetByName('Teachers');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();

  // ถ้ามีข้อมูลแล้ว (มากกว่าแค่ header) ไม่ต้องเพิ่ม
  if (data.length > 1) return;

  const sampleTeacher = [
    generateId(), 'admin', '1234', 'ผู้ดูแลระบบ', 'admin', 'active'
  ];

  sheet.getRange(2, 1, 1, sampleTeacher.length).setValues([sampleTeacher]);
}
