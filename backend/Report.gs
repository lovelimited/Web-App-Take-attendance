/**
 * ============================================================
 * Report.gs — ระบบรายงาน
 * ============================================================
 */

function getAttendanceReport(teacherId, className, subjectName, month, term) {
  try {
    const attendance = getSheetData('Attendance');
    const students = getSheetData('Students');
    const schedules = getSheetData('Schedule');

    // หา scheduleIds ของครู + ชั้น + วิชา
    let scheduleIds = schedules
      .filter(s => String(s.teacher_id) === String(teacherId))
      .filter(s => !className || String(s.class_name).trim() === String(className).trim())
      .filter(s => !subjectName || String(s.subject_name).trim() === String(subjectName).trim())
      .map(s => String(s.schedule_id).trim());

    // กรอง attendance ตาม scheduleIds + month/term
    let filtered = attendance.filter(a => scheduleIds.includes(String(a.schedule_id).trim()));
    if (month) {
      filtered = filtered.filter(a => {
        const d = parseSheetDate(a.date);
        return d && d.substring(0, 7) === month; // YYYY-MM
      });
    } else if (term) {
      filtered = filtered.filter(a => {
        const d = parseSheetDate(a.date); // YYYY-MM-DD
        if (!d || d.length < 10) return false;
        const m = parseInt(d.substring(5, 7));
        if (term === '1') {
          // ภาคเรียนที่ 1 เดือน พ.ค.-ต.ค. (5, 6, 7, 8, 9, 10)
          return m >= 5 && m <= 10;
        } else if (term === '2') {
          // ภาคเรียนที่ 2 เดือน พ.ย.-มี.ค. (11, 12, 1, 2, 3)
          return m === 11 || m === 12 || (m >= 1 && m <= 3);
        }
        return true;
      });
    }

    // ดึงนักเรียนที่เกี่ยวข้อง
    const targetClass = className || '';
    const classStudents = targetClass
      ? students.filter(st => String(st.class_room).trim() === targetClass && st.status === 'active')
        .sort((a, b) => ((a.first_name||'')).localeCompare(b.first_name||'', 'th'))
      : [];

    // สรุปรายนักเรียน
    const summary = classStudents.map((st, i) => {
      const stRecords = filtered.filter(a => String(a.student_id) === String(st.student_id));
      return {
        no: i + 1,
        studentId: st.student_id,
        prefix: st.prefix,
        firstName: st.first_name,
        lastName: st.last_name,
        present: stRecords.filter(r => r.status === 'มา').length,
        absent: stRecords.filter(r => r.status === 'ขาด').length,
        leave: stRecords.filter(r => r.status === 'ลา').length,
        late: stRecords.filter(r => r.status === 'สาย').length,
        total: stRecords.length
      };
    });

    // สรุปรวม
    const totalPresent = filtered.filter(a => a.status === 'มา').length;
    const totalAbsent = filtered.filter(a => a.status === 'ขาด').length;
    const totalLeave = filtered.filter(a => a.status === 'ลา').length;
    const totalLate = filtered.filter(a => a.status === 'สาย').length;

    return jsonResponse({
      success: true,
      data: {
        className: className || 'ทุกชั้น',
        subjectName: subjectName || 'ทุกวิชา',
        month: month || 'ทั้งหมด',
        term: term || '',
        students: summary,
        totals: { present: totalPresent, absent: totalAbsent, leave: totalLeave, late: totalLate, all: filtered.length }
      }
    });
  } catch (error) {
    Logger.log('getAttendanceReport error: ' + error.message);
    return errorResponse('ไม่สามารถโหลดรายงานเช็คชื่อได้');
  }
}

function getScoreReport(className, subjectName) {
  try {
    const students = getSheetData('Students');
    const scores = getSheetData('Scores');

    // โหลดจำนวนงานและคะแนนเต็มของวิชานี้
    let worksheetCount = 0;
    let worksheetMaxScores = [];
    let worksheetNames = [];
    
    try {
      getScoreConfigsSheet(); // แน่ใจว่ามี sheet
      const configs = getSheetData('ScoreConfigs');
      const config = configs.find(c => 
        String(c.class_name).trim() === String(className).trim() &&
        String(c.subject_name).trim() === String(subjectName).trim()
      );
      if (config) {
        worksheetCount = Number(config.worksheet_count) || 0;
        worksheetMaxScores = String(config.worksheet_max_scores).split(',').map(Number);
        var wsNamesRaw = config.worksheet_names || '';
        worksheetNames = wsNamesRaw ? String(wsNamesRaw).split('|') : [];
      }
    } catch (e) {
      Logger.log('Error reading ScoreConfigs in report: ' + e.message);
    }

    // ถ้ายังไม่มี config ให้ดูจากหัวตาราง Scores
    if (worksheetCount === 0) {
      try {
        const scoresSheet = getSheet('Scores');
        const headers = scoresSheet.getDataRange().getValues()[0];
        const wsCols = headers.filter(h => h.startsWith('worksheet_') && h !== 'worksheet_total');
        worksheetCount = wsCols.length;
        worksheetMaxScores = new Array(worksheetCount).fill(10);
      } catch (e) {
        Logger.log('Error reading Scores headers: ' + e.message);
      }
    }

    const classStudents = students
      .filter(st => String(st.class_room).trim() === String(className).trim() && st.status === 'active')
      .sort((a, b) => ((a.first_name||'')).localeCompare(b.first_name||'', 'th'));

    const report = classStudents.map((st, i) => {
      const sc = scores.find(s =>
        String(s.student_id) === String(st.student_id) &&
        String(s.class_name).trim() === String(className).trim() &&
        String(s.subject_name).trim() === String(subjectName).trim()
      );

      // ดึงคะแนนใบงานย่อยแต่ละชิ้น
      const worksheets = [];
      for (let w = 1; w <= worksheetCount; w++) {
        const val = sc ? sc['worksheet_' + w] : '';
        worksheets.push(val !== undefined && val !== null ? val : '');
      }

      return {
        no: i + 1, studentId: st.student_id, prefix: st.prefix,
        firstName: st.first_name, lastName: st.last_name,
        worksheets: worksheets,
        worksheetTotal: sc ? sc.worksheet_total : '',
        midtermScore: sc ? sc.midterm_score : '',
        midtermExam: sc ? sc.midterm_exam : '',
        finalExam: sc ? sc.final_exam : '',
        totalScore: sc ? sc.total_score : '',
        grade: sc ? sc.grade : ''
      };
    });

    // สถิติเกรด
    const gradeStats = { '4': 0, '3.5': 0, '3': 0, '2.5': 0, '2': 0, '1.5': 0, '1': 0, '0': 0 };
    report.forEach(r => {
      if (r.grade !== '') gradeStats[String(r.grade)] = (gradeStats[String(r.grade)] || 0) + 1;
    });

    return jsonResponse({
      success: true,
      data: { className, subjectName, worksheetCount, worksheetMaxScores, worksheetNames, students: report, gradeStats }
    });
  } catch (error) {
    return errorResponse('ไม่สามารถโหลดรายงานคะแนนได้');
  }
}

function getSettingsData() {
  try {
    const settings = getSheetData('Settings');
    const map = {};
    settings.forEach(s => { map[s.key] = s.value; });
    map.logo_url = convertDriveUrl(map.logo_url || '');
    return jsonResponse({ success: true, data: map });
  } catch (error) {
    return errorResponse('ไม่สามารถโหลดการตั้งค่าได้');
  }
}

function saveSettings(school_name, logo_url, footer_credit) {
  try {
    const sheet = getSheet('Settings');
    const existingData = sheet.getDataRange().getValues();
    const headers = existingData[0];
    const colIdx = {};
    headers.forEach((h, i) => { colIdx[h] = i; });

    const updates = [
      { key: 'school_name', value: school_name },
      { key: 'logo_url', value: logo_url },
      { key: 'footer_credit', value: footer_credit }
    ];

    updates.forEach(update => {
      let found = false;
      for (let i = 1; i < existingData.length; i++) {
        if (String(existingData[i][colIdx['key']]) === update.key) {
          sheet.getRange(i + 1, colIdx['value'] + 1).setValue(update.value);
          found = true;
          break;
        }
      }
      if (!found) {
        sheet.appendRow([update.key, update.value]);
      }
    });

    clearSheetCache('Settings');
    return jsonResponse({ success: true, message: 'บันทึกการตั้งค่าสำเร็จ' });
  } catch (error) {
    Logger.log('saveSettings error: ' + error.message);
    return errorResponse('ไม่สามารถบันทึกการตั้งค่าได้: ' + error.message);
  }
}
