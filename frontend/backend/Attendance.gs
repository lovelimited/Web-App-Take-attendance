/**
 * ============================================================
 * Attendance.gs — ระบบเช็คชื่อนักเรียน
 * ============================================================
 * - ดึงสถานะการเช็คชื่อแต่ละคาบ (สำหรับแสดง Cards)
 * - ดึงรายชื่อนักเรียน + สถานะเช็คชื่อ
 * - บันทึกเช็คชื่อ (ป้องกัน duplicate)
 * ============================================================
 */

/**
 * getAttendanceCards — ดึงสถานะการเช็คชื่อแต่ละคาบวันนี้
 * @param {string} teacherId
 * @param {string} date — YYYY-MM-DD (optional, default = วันนี้)
 * @returns {TextOutput}
 */
function getAttendanceCards(teacherId, date) {
  try {
    const targetDate = date || getTodayDate();
    const today = getThaiDayOfWeek(parseLocalDateString(targetDate));
    const schedules = getSheetData('Schedule');
    const attendance = getSheetData('Attendance');
    const students = getSheetData('Students');
    const currentPeriod = getCurrentPeriod();

    // กรองตารางสอนวันนี้ของครู
    const todaySchedules = schedules
      .filter(s =>
        String(s.teacher_id) === String(teacherId) &&
        String(s.day_of_week).trim() === today
      )
      .sort((a, b) => Number(a.period) - Number(b.period));

    // สร้าง cards
    const cards = todaySchedules.map(schedule => {
      const periodInfo = getPeriodInfo(schedule.period);

      // นับจำนวนนักเรียนทั้งหมดในห้อง
      const classStudents = students.filter(st =>
        String(st.class_room).trim() === String(schedule.class_name).trim() &&
        st.status === 'active'
      );
      const totalStudents = classStudents.length;

      // ดูว่าเช็คชื่อแล้วหรือยัง
      const attendanceRecords = attendance.filter(a =>
        String(a.schedule_id) === String(schedule.schedule_id) &&
        parseSheetDate(a.date) === targetDate
      );

      const isChecked = attendanceRecords.length > 0;
      const presentCount = attendanceRecords.filter(a => a.status === 'มา').length;

      return {
        scheduleId: schedule.schedule_id,
        className: schedule.class_name,
        subjectName: schedule.subject_name,
        period: Number(schedule.period),
        startTime: periodInfo ? periodInfo.start : schedule.start_time,
        endTime: periodInfo ? periodInfo.end : schedule.end_time,
        isCurrent: currentPeriod === Number(schedule.period),
        isChecked: isChecked,
        presentCount: presentCount,
        totalStudents: totalStudents
      };
    });

    return jsonResponse({
      success: true,
      data: {
        date: targetDate,
        dayOfWeek: today,
        currentPeriod: currentPeriod,
        cards: cards
      }
    });
  } catch (error) {
    Logger.log('getAttendanceCards error: ' + error.message);
    return errorResponse('ไม่สามารถโหลดข้อมูลเช็คชื่อได้');
  }
}

/**
 * getStudentsForAttendance — ดึงรายชื่อนักเรียนสำหรับเช็คชื่อ
 * @param {string} scheduleId
 * @param {string} date — YYYY-MM-DD
 * @returns {TextOutput}
 */
function getStudentsForAttendance(scheduleId, date) {
  try {
    const targetDate = date || getTodayDate();
    const schedules = getSheetData('Schedule');
    const students = getSheetData('Students');
    const attendance = getSheetData('Attendance');

    // หา schedule
    const schedule = schedules.find(s => String(s.schedule_id) === String(scheduleId));
    if (!schedule) {
      return errorResponse('ไม่พบข้อมูลตารางสอน');
    }

    // ดึงนักเรียนในห้อง
    const classStudents = students
      .filter(st =>
        String(st.class_room).trim() === String(schedule.class_name).trim() &&
        st.status === 'active'
      )
      .sort((a, b) => Number(String(a.student_id).replace(/\D/g, '')) - Number(String(b.student_id).replace(/\D/g, '')));

    // ดึง attendance ที่มีอยู่แล้ว
    const existingAttendance = attendance.filter(a =>
      String(a.schedule_id) === String(scheduleId) &&
      parseSheetDate(a.date) === targetDate
    );

    // Map นักเรียน + สถานะเช็คชื่อ
    const studentList = classStudents.map((st, index) => {
      const existing = existingAttendance.find(a =>
        String(a.student_id) === String(st.student_id)
      );

      return {
        studentId: st.student_id,
        no: index + 1,
        prefix: st.prefix,
        firstName: st.first_name,
        lastName: st.last_name,
        status: existing ? existing.status : null
      };
    });

    const periodInfo = getPeriodInfo(schedule.period);

    return jsonResponse({
      success: true,
      data: {
        schedule: {
          scheduleId: schedule.schedule_id,
          className: schedule.class_name,
          subjectName: schedule.subject_name,
          period: Number(schedule.period),
          startTime: periodInfo ? periodInfo.start : schedule.start_time,
          endTime: periodInfo ? periodInfo.end : schedule.end_time
        },
        date: targetDate,
        students: studentList,
        isChecked: existingAttendance.length > 0
      }
    });
  } catch (error) {
    Logger.log('getStudentsForAttendance error: ' + error.message);
    return errorResponse('ไม่สามารถโหลดรายชื่อนักเรียนได้');
  }
}

/**
 * saveAttendance — บันทึกเช็คชื่อนักเรียน
 * @param {string} teacherId
 * @param {string} scheduleId
 * @param {string} date — YYYY-MM-DD
 * @param {object[]} records — [{ studentId, status }, ...]
 * @returns {TextOutput}
 */
function saveAttendance(teacherId, scheduleId, date, records) {
  try {
    const err = validateInput({
      'ตารางสอน': scheduleId,
      'วันที่': date,
      'ข้อมูลเช็คชื่อ': records
    });
    if (err) return errorResponse(err);

    if (!Array.isArray(records) || records.length === 0) {
      return errorResponse('ไม่มีข้อมูลเช็คชื่อ');
    }

    const sheet = getSheet('Attendance');
    const existingData = sheet.getDataRange().getValues();
    const headers = existingData[0];
    const timestamp = new Date().toISOString();

    // หา column indexes
    const colIdx = {};
    headers.forEach((h, i) => { colIdx[h] = i; });

    // ลบ records เดิมของ schedule + date เดียวกัน (overwrite)
    const rowsToDelete = [];
    for (let i = existingData.length - 1; i >= 1; i--) {
      if (
        String(existingData[i][colIdx['schedule_id']]) === String(scheduleId) &&
        parseSheetDate(existingData[i][colIdx['date']]) === String(date)
      ) {
        rowsToDelete.push(i + 1); // 1-indexed for sheet
      }
    }

    // ลบจากล่างขึ้นบนเพื่อไม่ให้ index เลื่อน
    rowsToDelete.forEach(row => {
      sheet.deleteRow(row);
    });

    // เพิ่ม records ใหม่
    const newRows = records.map(r => [
      generateId(),           // attendance_id
      date,                   // date
      teacherId,              // teacher_id
      scheduleId,             // schedule_id
      r.studentId,            // student_id
      escapeHtml(r.status),   // status (มา/ขาด/ลา/สาย)
      timestamp               // timestamp
    ]);

    if (newRows.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, newRows.length, newRows[0].length)
        .setValues(newRows);
    }

    SpreadsheetApp.flush();

    // ล้างแคชของ Attendance
    clearSheetCache('Attendance');

    // นับจำนวนมาเรียน
    const presentCount = records.filter(r => r.status === 'มา').length;

    return jsonResponse({
      success: true,
      message: 'บันทึกเช็คชื่อสำเร็จ',
      data: {
        totalRecords: records.length,
        presentCount: presentCount
      }
    });
  } catch (error) {
    Logger.log('saveAttendance error: ' + error.message);
    return errorResponse('ไม่สามารถบันทึกเช็คชื่อได้: ' + error.message);
  }
}
