/**
 * ============================================================
 * Score.gs — ระบบเก็บคะแนน
 * ============================================================
 */

function getClassList(teacherId) {
  try {
    const schedules = getSheetData('Schedule');
    const classes = [...new Set(
      schedules.filter(s => String(s.teacher_id) === String(teacherId))
        .map(s => String(s.class_name).trim())
    )].sort();
    return jsonResponse({ success: true, data: classes });
  } catch (error) {
    return errorResponse('ไม่สามารถโหลดรายชื่อชั้นได้');
  }
}

function getSubjectList(teacherId, className) {
  try {
    const schedules = getSheetData('Schedule');
    const subjects = [...new Set(
      schedules.filter(s =>
        String(s.teacher_id) === String(teacherId) &&
        String(s.class_name).trim() === String(className).trim()
      ).map(s => String(s.subject_name).trim())
    )].sort();
    return jsonResponse({ success: true, data: subjects });
  } catch (error) {
    return errorResponse('ไม่สามารถโหลดรายชื่อวิชาได้');
  }
}

function getScoreConfigsSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('ScoreConfigs');
  if (!sheet) {
    sheet = ss.insertSheet('ScoreConfigs');
    const headers = ['class_name', 'subject_name', 'worksheet_count', 'worksheet_max_scores', 'worksheet_names'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
  } else {
    // ตรวจสอบว่ามีคอลัมน์ worksheet_names หรือยัง ถ้ายังไม่มีให้เพิ่ม
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.indexOf('worksheet_names') === -1) {
      const newCol = headers.length + 1;
      sheet.getRange(1, newCol).setValue('worksheet_names');
      SpreadsheetApp.flush();
      clearSheetCache('ScoreConfigs');
    }
  }
  return sheet;
}

function getScores(className, subjectName) {
  try {
    const students = getSheetData('Students');
    const scores = getSheetData('Scores');
    
    // โหลดจำนวนงานและคะแนนเต็มของวิชานี้
    let worksheetCount = 5;
    let worksheetMaxScores = [10, 10, 10, 10, 10];
    let worksheetNames = [];
    
    try {
      getScoreConfigsSheet(); // แน่ใจว่ามี sheet
      const configs = getSheetData('ScoreConfigs');
      const config = configs.find(c => 
        String(c.class_name).trim() === String(className).trim() &&
        String(c.subject_name).trim() === String(subjectName).trim()
      );
      if (config) {
        worksheetCount = Number(config.worksheet_count) || 5;
        worksheetMaxScores = String(config.worksheet_max_scores).split(',').map(Number);
        var wsNamesRaw = config.worksheet_names || '';
        worksheetNames = wsNamesRaw ? String(wsNamesRaw).split('|') : [];
      }
    } catch (e) {
      Logger.log('Error reading ScoreConfigs: ' + e.message);
    }

    const classStudents = students
      .filter(st => String(st.class_room).trim() === String(className).trim() && st.status === 'active')
      .sort((a, b) => ((a.first_name||'')+(a.last_name||'')).localeCompare((b.first_name||'')+(b.last_name||''), 'th'));

    if (classStudents.length === 0) {
      return jsonResponse({ success: true, data: { students: [], message: 'ไม่พบนักเรียน' } });
    }

    // ตรวจสอบหัวตารางเพื่อดึงค่าใบงานที่มีอยู่ทั้งหมด
    const scoresSheet = getSheet('Scores');
    const headers = scoresSheet.getDataRange().getValues()[0];
    const colIdx = {};
    headers.forEach((h, i) => { colIdx[h] = i; });

    // หาคอลัมน์ใบงานทั้งหมดที่มีในชีตปัจจุบัน
    const wsCols = headers.filter(h => h.startsWith('worksheet_') && h !== 'worksheet_total');

    const studentScores = classStudents.map((st, i) => {
      const sc = scores.find(s =>
        String(s.student_id) === String(st.student_id) &&
        String(s.class_name).trim() === String(className).trim() &&
        String(s.subject_name).trim() === String(subjectName).trim()
      );

      // ดึงคะแนนใบงานตามคอลัมน์จริงใน Google Sheets
      const worksheets = [];
      for (let w = 1; w <= wsCols.length; w++) {
        const val = sc ? sc['worksheet_' + w] : '';
        worksheets.push(val !== undefined && val !== null ? val : '');
      }

      return {
        no: i + 1,
        studentId: st.student_id,
        prefix: st.prefix,
        firstName: st.first_name,
        lastName: st.last_name,
        worksheets: worksheets,
        worksheetTotal: sc ? sc.worksheet_total : '',
        midtermScore: sc ? sc.midterm_score : '',
        midtermExam: sc ? sc.midterm_exam : '',
        finalExam: sc ? sc.final_exam : '',
        totalScore: sc ? sc.total_score : '',
        grade: sc ? sc.grade : ''
      };
    });

    return jsonResponse({
      success: true,
      data: {
        className,
        subjectName,
        worksheetCount,
        worksheetMaxScores,
        worksheetNames,
        students: studentScores
      }
    });
  } catch (error) {
    Logger.log('getScores error: ' + error.message);
    return errorResponse('ไม่สามารถโหลดคะแนนได้: ' + error.message);
  }
}

function saveScores(className, subjectName, dataPayload) {
  try {
    const records = dataPayload.records;
    const worksheetCount = Number(dataPayload.worksheetCount) || 5;
    const worksheetMaxScores = dataPayload.worksheetMaxScores || [];
    const worksheetNames = dataPayload.worksheetNames || [];

    if (!Array.isArray(records) || records.length === 0) return errorResponse('ไม่มีข้อมูลคะแนน');

    // 1. บันทึกโครงสร้างใบงานใน ScoreConfigs
    const configSheet = getScoreConfigsSheet();
    const configData = configSheet.getDataRange().getValues();
    const configHeaders = configData[0];
    const cfgColIdx = {};
    configHeaders.forEach((h, i) => { cfgColIdx[h] = i; });

    let existingCfgRow = -1;
    for (let i = 1; i < configData.length; i++) {
      if (String(configData[i][cfgColIdx['class_name']]).trim() === String(className).trim() &&
          String(configData[i][cfgColIdx['subject_name']]).trim() === String(subjectName).trim()) {
        existingCfgRow = i + 1;
        break;
      }
    }

    const cfgRowData = [
      className,
      subjectName,
      worksheetCount,
      worksheetMaxScores.join(','),
      worksheetNames.join('|')
    ];

    if (existingCfgRow > 0) {
      configSheet.getRange(existingCfgRow, 1, 1, cfgRowData.length).setValues([cfgRowData]);
    } else {
      configSheet.appendRow(cfgRowData);
    }
    clearSheetCache('ScoreConfigs');

    // 2. บันทึกคะแนนลงใน Scores
    const sheet = getSheet('Scores');
    let existingData = sheet.getDataRange().getValues();
    let headers = existingData[0];

    // ตรวจสอบว่าต้องขยายคอลัมน์เพิ่มหรือไม่
    let maxWorksheetInHeaders = 0;
    headers.forEach(h => {
      if (h.startsWith('worksheet_') && h !== 'worksheet_total') {
        const num = Number(h.split('_')[1]);
        if (num > maxWorksheetInHeaders) maxWorksheetInHeaders = num;
      }
    });

    if (worksheetCount > maxWorksheetInHeaders) {
      const totalColIdx = headers.indexOf('worksheet_total') + 1; // 1-indexed
      const colsToAdd = worksheetCount - maxWorksheetInHeaders;
      sheet.insertColumnsBefore(totalColIdx, colsToAdd);

      const newHeaders = [];
      for (let i = maxWorksheetInHeaders + 1; i <= worksheetCount; i++) {
        newHeaders.push('worksheet_' + i);
      }
      sheet.getRange(1, totalColIdx, 1, colsToAdd).setValues([newHeaders]);

      SpreadsheetApp.flush();
      existingData = sheet.getDataRange().getValues();
      headers = existingData[0];
    }

    const colIdx = {};
    headers.forEach((h, i) => { colIdx[h] = i; });

    records.forEach(record => {
      const ws = record.worksheets || [];
      let wsTotal = 0; ws.forEach(w => { wsTotal += Number(w) || 0; });
      let mxTotal = 0; worksheetMaxScores.forEach(m => { mxTotal += Number(m) || 0; });
      let midScore = (mxTotal > 0 && ws.length > 0) ? Math.round(((wsTotal * 70) / mxTotal) * 100) / 100 : '';
      const midExam = Number(record.midtermExam) || 0;
      const finExam = Number(record.finalExam) || 0;
      const total = (midScore || 0) + midExam + finExam;
      const grade = calculateGrade(total);

      let existingRow = -1;
      for (let i = 1; i < existingData.length; i++) {
        if (String(existingData[i][colIdx['student_id']]) === String(record.studentId) &&
            String(existingData[i][colIdx['class_name']]).trim() === String(className).trim() &&
            String(existingData[i][colIdx['subject_name']]).trim() === String(subjectName).trim()) {
          existingRow = i + 1; break;
        }
      }

      const rowData = new Array(headers.length).fill('');
      rowData[colIdx['score_id']] = existingRow > 0 ? existingData[existingRow-1][colIdx['score_id']] : generateId();
      rowData[colIdx['class_name']] = className;
      rowData[colIdx['subject_name']] = subjectName;
      rowData[colIdx['student_id']] = record.studentId;

      for (let i = 0; i < ws.length; i++) {
        const hName = 'worksheet_' + (i + 1);
        if (colIdx[hName] !== undefined) {
          rowData[colIdx[hName]] = ws[i] !== undefined && ws[i] !== null ? ws[i] : '';
        }
      }

      rowData[colIdx['worksheet_total']] = wsTotal || '';
      rowData[colIdx['midterm_score']] = midScore || '';
      rowData[colIdx['midterm_exam']] = midExam || '';
      rowData[colIdx['final_exam']] = finExam || '';
      rowData[colIdx['total_score']] = total || '';
      rowData[colIdx['grade']] = grade;

      if (existingRow > 0) {
        existingData[existingRow-1] = rowData;
      } else {
        existingData.push(rowData);
      }
    });

    // Write all scores to sheet in one single bulk operation
    sheet.getRange(1, 1, existingData.length, headers.length).setValues(existingData);

    SpreadsheetApp.flush();
    clearSheetCache('Scores');
    return jsonResponse({ success: true, message: 'บันทึกคะแนนสำเร็จ (' + records.length + ' คน)' });
  } catch (error) {
    return errorResponse('ไม่สามารถบันทึกคะแนนได้: ' + error.message);
  }
}

function calculateGrade(totalScore) {
  if (totalScore === '' || totalScore === null || totalScore === undefined) return '';
  const score = Number(totalScore);
  if (isNaN(score)) return '';
  if (score >= 79.5) return 4;
  if (score >= 74.5) return 3.5;
  if (score >= 69.5) return 3;
  if (score >= 64.5) return 2.5;
  if (score >= 59.5) return 2;
  if (score >= 54.5) return 1.5;
  if (score >= 49.5) return 1;
  return 0;
}
