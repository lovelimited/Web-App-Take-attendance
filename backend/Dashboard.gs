/**
 * ============================================================
 * Dashboard.gs — Dashboard Combined API
 * ============================================================
 * รวม getProfile + getAttendanceCards + getWeekSchedule
 * เป็น API เดียวเพื่อลดจำนวน request และเพิ่มความเร็ว
 * ============================================================
 */

/**
 * getDashboardData — ดึงข้อมูลทั้งหมดสำหรับ Dashboard ในครั้งเดียว
 * @param {string} teacherId
 * @returns {TextOutput}
 */
function getDashboardData(teacherId) {
  try {
    // === อ่าน Sheet ทั้งหมดครั้งเดียว ===
    const schedules = getSheetData('Schedule');
    const attendance = getSheetData('Attendance');
    const students = getSheetData('Students');
    const teachers = getSheetData('Teachers');
    const settings = getSheetData('Settings');

    const targetDate = getTodayDate();
    const today = getThaiDayOfWeek(parseLocalDateString(targetDate));
    const currentPeriod = getCurrentPeriod();

    // === 1. Profile ===
    const teacher = teachers.find(t => String(t.teacher_id) === String(teacherId));
    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });

    const profile = teacher ? {
      teacherId: teacher.teacher_id,
      fullName: teacher.full_name,
      role: teacher.role,
      schoolName: settingsMap.school_name || 'โรงเรียน',
      logoUrl: convertDriveUrl(settingsMap.logo_url || ''),
      footerCredit: settingsMap.footer_credit || 'พัฒนาโดยทีมงาน'
    } : null;

    // === 2. Attendance Cards ===
    const todaySchedules = schedules
      .filter(s =>
        String(s.teacher_id) === String(teacherId) &&
        String(s.day_of_week).trim() === today
      )
      .sort((a, b) => Number(a.period) - Number(b.period));

    const cards = todaySchedules.map(schedule => {
      const periodInfo = getPeriodInfo(schedule.period);
      const classStudents = students.filter(st =>
        String(st.class_room).trim() === String(schedule.class_name).trim() &&
        st.status === 'active'
      );
      const attendanceRecords = attendance.filter(a =>
        String(a.schedule_id) === String(schedule.schedule_id) &&
        parseSheetDate(a.date) === targetDate
      );

      return {
        scheduleId: schedule.schedule_id,
        className: schedule.class_name,
        subjectName: schedule.subject_name,
        period: Number(schedule.period),
        startTime: periodInfo ? periodInfo.start : schedule.start_time,
        endTime: periodInfo ? periodInfo.end : schedule.end_time,
        isCurrent: currentPeriod === Number(schedule.period),
        isChecked: attendanceRecords.length > 0,
        presentCount: attendanceRecords.filter(a => a.status === 'มา').length,
        absentCount: attendanceRecords.filter(a => a.status === 'ขาด').length,
        leaveCount: attendanceRecords.filter(a => a.status === 'ลา').length,
        lateCount: attendanceRecords.filter(a => a.status === 'สาย').length,
        totalStudents: classStudents.length
      };
    });

    // === 3. Week Schedule ===
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

    const weekData = {};
    ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'].forEach(day => {
      weekData[day] = teacherSchedules.filter(s => s.dayOfWeek === day);
    });

    return jsonResponse({
      success: true,
      data: {
        profile: profile,
        attendance: {
          date: targetDate,
          dayOfWeek: today,
          currentPeriod: currentPeriod,
          cards: cards
        },
        weekSchedule: {
          today: today,
          currentPeriod: currentPeriod,
          periods: PERIODS,
          week: weekData,
          all: teacherSchedules
        }
      }
    });
  } catch (error) {
    Logger.log('getDashboardData error: ' + error.message);
    return errorResponse('ไม่สามารถโหลดข้อมูล Dashboard ได้: ' + error.message);
  }
}
