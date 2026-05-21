/**
 * ============================================================
 * Schedule.gs — ตารางสอน
 * ============================================================
 * - ดึงตารางสอนวันนี้ของครู
 * - ดึงตารางสอนทั้งสัปดาห์
 * - Highlight คาบปัจจุบัน
 * ============================================================
 */

/**
 * getTodaySchedule — ดึงตารางสอนวันนี้ของครู
 * @param {string} teacherId
 * @returns {TextOutput}
 */
function getTodaySchedule(teacherId) {
  try {
    const today = getThaiDayOfWeek();
    const schedules = getSheetData('Schedule');
    const currentPeriod = getCurrentPeriod();

    // กรองเฉพาะตารางของครูคนนี้ + วันนี้
    const todaySchedule = schedules
      .filter(s =>
        String(s.teacher_id) === String(teacherId) &&
        String(s.day_of_week).trim() === today
      )
      .map(s => {
        const periodInfo = getPeriodInfo(s.period);
        return {
          scheduleId: s.schedule_id,
          className: s.class_name,
          subjectName: s.subject_name,
          period: Number(s.period),
          startTime: periodInfo ? periodInfo.start : s.start_time,
          endTime: periodInfo ? periodInfo.end : s.end_time,
          note: periodInfo ? periodInfo.note : '',
          isCurrent: currentPeriod === Number(s.period)
        };
      })
      .sort((a, b) => a.period - b.period);

    return jsonResponse({
      success: true,
      data: {
        date: getTodayDate(),
        dayOfWeek: today,
        currentPeriod: currentPeriod,
        schedules: todaySchedule
      }
    });
  } catch (error) {
    Logger.log('getTodaySchedule error: ' + error.message);
    return errorResponse('ไม่สามารถโหลดตารางสอนได้');
  }
}

/**
 * getWeekSchedule — ดึงตารางสอนทั้งสัปดาห์ของครู
 * @param {string} teacherId
 * @returns {TextOutput}
 */
function getWeekSchedule(teacherId) {
  try {
    const schedules = getSheetData('Schedule');
    const today = getThaiDayOfWeek();
    const currentPeriod = getCurrentPeriod();

    // กรองเฉพาะตารางของครูคนนี้
    const teacherSchedules = schedules
      .filter(s => String(s.teacher_id) === String(teacherId))
      .map(s => {
        const periodInfo = getPeriodInfo(s.period);
        return {
          scheduleId: s.schedule_id,
          className: s.class_name,
          subjectName: s.subject_name,
          dayOfWeek: s.day_of_week,
          period: Number(s.period),
          startTime: periodInfo ? periodInfo.start : s.start_time,
          endTime: periodInfo ? periodInfo.end : s.end_time,
          note: periodInfo ? periodInfo.note : '',
          isToday: String(s.day_of_week).trim() === today,
          isCurrent: String(s.day_of_week).trim() === today && currentPeriod === Number(s.period)
        };
      })
      .sort((a, b) => {
        const dayOrder = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];
        const dayDiff = dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek);
        if (dayDiff !== 0) return dayDiff;
        return a.period - b.period;
      });

    // จัดกลุ่มตามวัน
    const weekData = {};
    const days = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];
    days.forEach(day => {
      weekData[day] = teacherSchedules.filter(s => s.dayOfWeek === day);
    });

    return jsonResponse({
      success: true,
      data: {
        today: today,
        currentPeriod: currentPeriod,
        periods: PERIODS,
        week: weekData,
        all: teacherSchedules
      }
    });
  } catch (error) {
    Logger.log('getWeekSchedule error: ' + error.message);
    return errorResponse('ไม่สามารถโหลดตารางสอนได้');
  }
}

/**
 * addSchedule — เพิ่มคาบสอนใหม่
 * @param {string} teacherId
 * @param {object} data
 * @returns {TextOutput}
 */
function addSchedule(teacherId, data) {
  try {
    const className = String(data.className || '').trim();
    const subjectName = String(data.subjectName || '').trim();
    const dayOfWeek = String(data.dayOfWeek || '').trim();
    const period = Number(data.period);

    // ตรวจสอบความถูกต้องของ input
    const validationError = validateInput({
      'ห้องเรียน': className,
      'วิชา': subjectName,
      'วัน': dayOfWeek,
      'คาบเรียน': data.period
    });
    if (validationError) return errorResponse(validationError);

    if (isNaN(period) || period < 1 || period > 8) {
      return errorResponse('คาบเรียนต้องอยู่ระหว่าง 1 ถึง 8');
    }

    const validDays = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];
    if (!validDays.includes(dayOfWeek)) {
      return errorResponse('วันไม่ถูกต้อง (ต้องเป็น จันทร์, อังคาร, พุธ, พฤหัสบดี, ศุกร์)');
    }

    // ตรวจสอบคาบซ้ำของครูคนนี้ในวันและคาบเดียวกัน
    const sheet = getSheet('Schedule');
    const existingData = sheet.getDataRange().getValues();
    const headers = existingData[0];
    const colIdx = {};
    headers.forEach((h, i) => { colIdx[h] = i; });

    for (let i = 1; i < existingData.length; i++) {
      const row = existingData[i];
      if (String(row[colIdx['teacher_id']]) === String(teacherId) &&
          String(row[colIdx['day_of_week']]).trim() === dayOfWeek &&
          Number(row[colIdx['period']]) === period) {
        return errorResponse('ท่านมีคาบสอนในวันและคาบนี้อยู่แล้ว (' + row[colIdx['subject_name']] + ' ห้อง ' + row[colIdx['class_name']] + ')');
      }
    }

    // ดึงเวลาเริ่มและสิ้นสุดคาบ
    const periodInfo = getPeriodInfo(period);
    const startTime = periodInfo ? periodInfo.start : '';
    const endTime = periodInfo ? periodInfo.end : '';

    const newRow = [
      generateId(),
      teacherId,
      className,
      subjectName,
      dayOfWeek,
      period,
      startTime,
      endTime
    ];

    sheet.appendRow(newRow);
    clearSheetCache('Schedule');
    return jsonResponse({ success: true, message: 'เพิ่มคาบสอนสำเร็จ' });
  } catch (error) {
    Logger.log('addSchedule error: ' + error.message);
    return errorResponse('ไม่สามารถเพิ่มคาบสอนได้: ' + error.message);
  }
}

/**
 * deleteSchedule — ลบคาบสอน
 * @param {string} teacherId
 * @param {string} scheduleId
 * @returns {TextOutput}
 */
function deleteSchedule(teacherId, scheduleId) {
  try {
    if (!scheduleId) return errorResponse('ไม่พบรหัสคาบสอน');

    const sheet = getSheet('Schedule');
    const existingData = sheet.getDataRange().getValues();
    const headers = existingData[0];
    const colIdx = {};
    headers.forEach((h, i) => { colIdx[h] = i; });

    let deleteRowIdx = -1;
    for (let i = 1; i < existingData.length; i++) {
      const row = existingData[i];
      if (String(row[colIdx['schedule_id']]) === String(scheduleId) &&
          String(row[colIdx['teacher_id']]) === String(teacherId)) {
        deleteRowIdx = i + 1;
        break;
      }
    }

    if (deleteRowIdx === -1) {
      return errorResponse('ไม่พบคาบสอนนี้ในระบบ หรือท่านไม่มีสิทธิ์ลบคาบสอนนี้');
    }

    sheet.deleteRow(deleteRowIdx);
    clearSheetCache('Schedule');
    return jsonResponse({ success: true, message: 'ลบคาบสอนสำเร็จ' });
  } catch (error) {
    Logger.log('deleteSchedule error: ' + error.message);
    return errorResponse('ไม่สามารถลบคาบสอนได้: ' + error.message);
  }
}

/**
 * getAllClassrooms — ดึงรายชื่อห้องเรียนทั้งหมดที่มีนักเรียนอยู่
 * @returns {TextOutput}
 */
function getAllClassrooms() {
  try {
    const students = getSheetData('Students');
    const classrooms = [...new Set(
      students.filter(st => st.class_room)
        .map(st => String(st.class_room).trim())
    )].sort();
    return jsonResponse({ success: true, data: classrooms });
  } catch (error) {
    Logger.log('getAllClassrooms error: ' + error.message);
    return errorResponse('ไม่สามารถโหลดรายชื่อห้องเรียนได้');
  }
}
