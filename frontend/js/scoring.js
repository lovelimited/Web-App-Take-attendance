/**
 * ============================================================
 * scoring.js — ระบบเก็บคะแนน
 * ============================================================
 */

let scoringData = null;
let scoringDirty = false;
let worksheetCount = 5;
let worksheetMaxScores = [10, 10, 10, 10, 10];
let worksheetNames = [];
let scoreSubjectsByClass = {}; // แคชวิชาตามห้องเรียน

async function renderScoring() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `
    <div class="animate-fadeInUp space-y-6">
      <h1 class="text-xl font-bold text-gray-800">เก็บคะแนน</h1>
      <div class="card p-4 flex flex-wrap gap-4 items-end">
        <div class="flex-1 min-w-[180px]">
          <label class="block text-sm font-medium text-gray-600 mb-1">ชั้นเรียน</label>
          <select id="scoreClass" onchange="loadSubjectsForScore()" class="custom-select w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary-500 outline-none transition-all text-sm">
            <option value="">-- เลือกชั้น --</option>
          </select>
        </div>
        <div class="flex-1 min-w-[180px]">
          <label class="block text-sm font-medium text-gray-600 mb-1">วิชา</label>
          <select id="scoreSubject" onchange="loadScoreTable()" class="custom-select w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary-500 outline-none transition-all text-sm">
            <option value="">-- เลือกวิชา --</option>
          </select>
        </div>
      </div>
      <div id="scoreTableWrapper"></div>
    </div>
  `;

  // ดึงห้องเรียนและวิชาแบบออฟไลน์/แคช ทันที 0ms
  const { classes, subjectsByClass } = await getMyClassesAndSubjects();
  scoreSubjectsByClass = subjectsByClass;

  const sel = document.getElementById('scoreClass');
  if (sel) {
    sel.innerHTML = '<option value="">-- เลือกชั้น --</option>';
    classes.forEach(c => { sel.innerHTML += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`; });
  }
}

function loadSubjectsForScore() {
  const className = document.getElementById('scoreClass').value;
  const sel = document.getElementById('scoreSubject');
  sel.innerHTML = '<option value="">-- เลือกวิชา --</option>';
  document.getElementById('scoreTableWrapper').innerHTML = '';
  if (!className) return;

  // โหลดวิชาจากแคชทันที 0ms
  const subjects = scoreSubjectsByClass[className] || [];
  subjects.forEach(s => { sel.innerHTML += `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`; });
}

async function loadScoreTable() {
  const className = document.getElementById('scoreClass').value;
  const subjectName = document.getElementById('scoreSubject').value;
  const wrapper = document.getElementById('scoreTableWrapper');
  if (!className || !subjectName) { wrapper.innerHTML = ''; return; }

  const result = await callApi('getScores', { className, subjectName });
  if (!result || !result.success) return;

  scoringData = result.data;
  worksheetCount = Number(scoringData.worksheetCount) || 5;
  worksheetMaxScores = scoringData.worksheetMaxScores || Array(worksheetCount).fill(10);
  worksheetNames = scoringData.worksheetNames || [];
  
  const students = scoringData.students || [];

  if (students.length === 0) {
    wrapper.innerHTML = '<div class="card p-8 text-center text-gray-400">ไม่พบข้อมูลนักเรียน</div>';
    return;
  }
  renderScoreTable(students);
  recalcAll();
}

function syncInputsToState() {
  if (!scoringData || !scoringData.students) return;

  // 0. Sync worksheet names
  worksheetNames = [];
  for (let i = 1; i <= worksheetCount; i++) {
    const nameInp = document.getElementById(`wsName${i}`);
    worksheetNames.push(nameInp ? nameInp.value : `งาน ${i}`);
  }

  // 1. Sync max scores
  worksheetMaxScores = [];
  for (let i = 1; i <= worksheetCount; i++) {
    const inp = document.getElementById(`maxScore${i}`);
    worksheetMaxScores.push(inp ? Number(inp.value) || 0 : 10);
  }

  // 2. Sync student scores
  scoringData.students.forEach(st => {
    const worksheets = [];
    for (let i = 0; i < worksheetCount; i++) {
      const inp = document.querySelector(`.ws-input[data-student="${st.studentId}"][data-ws="${i}"]`);
      worksheets.push(inp ? inp.value : (st.worksheets && st.worksheets[i] !== undefined ? st.worksheets[i] : ''));
    }
    st.worksheets = worksheets;

    const midInp = document.getElementById(`midExam_${st.studentId}`);
    if (midInp) st.midtermExam = midInp.value;

    const finInp = document.getElementById(`finExam_${st.studentId}`);
    if (finInp) st.finalExam = finInp.value;
  });
}

function renderScoreTable(students) {
  const wrapper = document.getElementById('scoreTableWrapper');
  let wsHeaders = '', wsMaxInputs = '';
  for (let i = 1; i <= worksheetCount; i++) {
    const wsName = worksheetNames[i-1] || `งาน ${i}`;
    wsHeaders += `<th class="!text-center !p-0" style="min-width:45px;max-width:55px"><input type="text" class="ws-name-input" id="wsName${i}" value="${escapeHtml(wsName)}" style="writing-mode:vertical-lr;transform:rotate(180deg);text-orientation:mixed;width:100%;border:none;background:transparent;text-align:center;font-size:0.7rem;font-weight:600;padding:6px 2px;outline:none;cursor:text;max-height:80px;overflow:hidden" onchange="recalcAll(true)"></th>`;
    wsMaxInputs += `<th class="!text-center !p-1"><input type="number" class="score-input !w-10 !p-0.5 text-center text-xs" id="maxScore${i}" value="${worksheetMaxScores[i-1] !== undefined ? worksheetMaxScores[i-1] : 10}" min="0" max="100" onchange="recalcAll(true)"></th>`;
  }

  wrapper.innerHTML = `
    <div class="card overflow-hidden">
      <!-- Toolbar จัดการงาน -->
      <div class="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-gray-700">📋 จัดการงาน:</span>
          <button onclick="addWorksheet()" class="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all font-semibold text-xs flex items-center gap-1">➕ เพิ่มงาน</button>
          <button onclick="removeWorksheet()" class="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all font-semibold text-xs flex items-center gap-1">➖ ลบงาน</button>
        </div>
        <div class="text-xs text-gray-500">
          จำนวนงานปัจจุบัน: <span class="font-bold text-gray-700 text-sm" id="worksheetCountBadge">${worksheetCount}</span> ชิ้น
        </div>
      </div>

      <div class="table-container score-table-container" style="max-height:65vh;overflow:auto">
        <table class="data-table" id="scoreTable" style="border-collapse:collapse">
          <thead>
            <tr>
              <th class="!text-center !p-1" style="width:30px;font-size:0.7rem" rowspan="2">ที่</th>
              <th class="!p-1" style="min-width:120px;font-size:0.7rem" rowspan="2">ชื่อ-สกุล</th>
              ${wsHeaders}
              <th class="!text-center !p-1 !bg-blue-50" style="font-size:0.65rem" rowspan="2">รวม<br>งาน</th>
              <th class="!text-center !p-1 !bg-indigo-50" style="font-size:0.65rem" rowspan="2">ระหว่าง<br>ภาค<br>(70%)</th>
              <th class="!text-center !p-1 !bg-purple-50" style="font-size:0.65rem" rowspan="2">กลาง<br>ภาค<br>(15%)</th>
              <th class="!text-center !p-1 !bg-pink-50" style="font-size:0.65rem" rowspan="2">ปลาย<br>ภาค<br>(15%)</th>
              <th class="!text-center !p-1 !bg-orange-50" style="font-size:0.65rem" rowspan="2">รวม<br>(100)</th>
              <th class="!text-center !p-1 !bg-green-50" style="font-size:0.65rem" rowspan="2">เกรด</th>
            </tr>
            <tr class="!bg-gray-100">${wsMaxInputs}</tr>
          </thead>
          <tbody id="scoreTableBody">
            ${students.map(st => renderScoreRow(st)).join('')}
          </tbody>
        </table>
      </div>
      <div class="p-4 border-t border-gray-100 flex justify-end">
        <button onclick="saveCurrentScores()" class="px-8 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-xl hover:from-primary-600 hover:to-primary-700">💾 บันทึกคะแนน</button>
      </div>
    </div>
  `;
}

function renderScoreRow(st) {
  let wsInputs = '';
  const wsValues = st.worksheets || [];
  for (let i = 0; i < worksheetCount; i++) {
    wsInputs += `
      <td class="!text-center !p-0">
        <input type="number" class="score-input ws-input !w-10 !h-6 !p-0 text-center text-xs border border-gray-200 rounded focus:border-primary-500 focus:outline-none" data-student="${st.studentId}" data-ws="${i}" value="${wsValues[i] !== undefined && wsValues[i] !== null ? wsValues[i] : ''}" min="0" oninput="validateAndRecalc(this, '${st.studentId}', ${i})">
      </td>`;
  }
  return `
    <tr data-student-id="${st.studentId}">
      <td class="!text-center !p-0.5 !font-bold" style="font-size:0.75rem">${st.no}</td>
      <td class="!p-1" style="font-size:0.75rem">${escapeHtml(st.prefix)}${escapeHtml(st.firstName)} ${escapeHtml(st.lastName)}</td>
      ${wsInputs}
      <td class="!text-center !p-0.5 !font-bold !bg-blue-50" style="font-size:0.75rem" id="wsTotal_${st.studentId}">-</td>
      <td class="!text-center !p-0.5 !font-bold !bg-indigo-50" style="font-size:0.75rem" id="midScore_${st.studentId}">-</td>
      <td class="!text-center !p-0.5"><input type="number" class="score-input !w-10 !h-6 !p-0 text-center text-xs" id="midExam_${st.studentId}" value="${st.midtermExam !== undefined && st.midtermExam !== null ? st.midtermExam : ''}" min="0" max="15" oninput="validateExamInput(this, 15); recalcRow('${st.studentId}', true)"></td>
      <td class="!text-center !p-0.5"><input type="number" class="score-input !w-10 !h-6 !p-0 text-center text-xs" id="finExam_${st.studentId}" value="${st.finalExam !== undefined && st.finalExam !== null ? st.finalExam : ''}" min="0" max="15" oninput="validateExamInput(this, 15); recalcRow('${st.studentId}', true)"></td>
      <td class="!text-center !p-0.5 !font-bold !bg-orange-50" style="font-size:0.75rem" id="totalScore_${st.studentId}">-</td>
      <td class="!text-center !p-0.5 !font-bold !bg-green-50" style="font-size:0.8rem" id="grade_${st.studentId}">-</td>
    </tr>
  `;
}

/**
 * validateAndRecalc — ตรวจสอบคะแนนไม่เกินเต็ม + เตือน
 */
function validateAndRecalc(input, studentId, wsIndex) {
  const maxInp = document.getElementById(`maxScore${wsIndex + 1}`);
  const maxVal = maxInp ? parseInt(maxInp.value, 10) || 10 : 10;
  const val = parseInt(input.value, 10);

  if (!isNaN(val) && val > maxVal) {
    input.style.background = '#fee2e2';
    input.style.borderColor = '#ef4444';
    input.title = `⚠️ คะแนนเกิน! (เต็ม ${maxVal})`;
    showToast(`⚠️ คะแนนเกินเต็ม ${maxVal}!`, 'error');
  } else if (!isNaN(val) && val < 0) {
    input.style.background = '#fee2e2';
    input.style.borderColor = '#ef4444';
    input.title = '⚠️ คะแนนต้องไม่ติดลบ';
  } else {
    input.style.background = '';
    input.style.borderColor = '';
    input.title = '';
  }
  recalcRow(studentId, true);
}

/**
 * validateExamInput — ตรวจสอบคะแนนสอบไม่เกินเต็ม
 */
function validateExamInput(input, maxVal) {
  const val = parseInt(input.value, 10);
  if (!isNaN(val) && val > maxVal) {
    input.style.background = '#fee2e2';
    input.style.borderColor = '#ef4444';
    input.title = `⚠️ คะแนนเกิน! (เต็ม ${maxVal})`;
    showToast(`⚠️ คะแนนเกินเต็ม ${maxVal}!`, 'error');
  } else if (!isNaN(val) && val < 0) {
    input.style.background = '#fee2e2';
    input.style.borderColor = '#ef4444';
    input.title = '⚠️ คะแนนต้องไม่ติดลบ';
  } else {
    input.style.background = '';
    input.style.borderColor = '';
    input.title = '';
  }
}

function recalcRow(studentId, isUserEdit = false) {
  if (isUserEdit) {
    scoringDirty = true;
  }
  let wsTotal = 0;
  document.querySelectorAll(`.ws-input[data-student="${studentId}"]`).forEach(inp => { wsTotal += Number(inp.value) || 0; });

  let maxTotal = 0;
  for (let i = 1; i <= worksheetCount; i++) {
    const maxValInp = document.getElementById(`maxScore${i}`);
    maxTotal += maxValInp ? (Number(maxValInp.value) || 0) : 10;
  }

  let midScore = maxTotal > 0 ? Math.round((wsTotal * 70 / maxTotal) * 100) / 100 : 0;
  const midExam = Number(document.getElementById(`midExam_${studentId}`).value) || 0;
  const finExam = Number(document.getElementById(`finExam_${studentId}`).value) || 0;
  const total = midScore + midExam + finExam;
  const grade = calcGrade(total);

  document.getElementById(`wsTotal_${studentId}`).textContent = wsTotal || '-';
  document.getElementById(`midScore_${studentId}`).textContent = midScore || '-';
  document.getElementById(`totalScore_${studentId}`).textContent = total || '-';

  const gradeEl = document.getElementById(`grade_${studentId}`);
  if (grade !== '' && grade !== undefined) {
    gradeEl.textContent = grade;
    const gn = Number(grade);
    if (gn >= 3) { gradeEl.style.background = '#dcfce7'; gradeEl.style.color = '#166534'; }
    else if (gn >= 1) { gradeEl.style.background = '#fef3c7'; gradeEl.style.color = '#92400e'; }
    else { gradeEl.style.background = '#fee2e2'; gradeEl.style.color = '#991b1b'; }
  } else {
    gradeEl.textContent = '-';
    gradeEl.style.background = '';
    gradeEl.style.color = '';
  }
}

function recalcAll(isUserEdit = false) {
  if (isUserEdit) {
    scoringDirty = true;
  }
  // Sync the 'max' attributes of the student score inputs to match the header max score inputs
  for (let i = 0; i < worksheetCount; i++) {
    const maxValInp = document.getElementById(`maxScore${i + 1}`);
    const maxVal = maxValInp ? parseInt(maxValInp.value, 10) || 0 : 10;
    document.querySelectorAll(`.ws-input[data-ws="${i}"]`).forEach(inp => {
      inp.setAttribute('max', maxVal);
      // Re-validate existing values
      const val = parseInt(inp.value, 10);
      if (!isNaN(val) && val > maxVal) {
        inp.style.background = '#fee2e2';
        inp.style.borderColor = '#ef4444';
        inp.title = `⚠️ คะแนนเกิน! (เต็ม ${maxVal})`;
      } else {
        inp.style.background = '';
        inp.style.borderColor = '';
        inp.title = '';
      }
    });
  }
  if (!scoringData || !scoringData.students) return;
  scoringData.students.forEach(st => recalcRow(st.studentId, isUserEdit));
}

function adjustScore(studentId, wsIndex, change) {
  const inp = document.querySelector(`.ws-input[data-student="${studentId}"][data-ws="${wsIndex}"]`);
  if (inp) {
    let val = parseInt(inp.value, 10);
    if (isNaN(val)) val = 0;
    val = Math.max(0, val + change);
    
    // Limit to max score of this worksheet
    const maxInp = document.getElementById(`maxScore${wsIndex + 1}`);
    const maxVal = maxInp ? parseInt(maxInp.value, 10) || 10 : 10;
    
    if (val > maxVal) {
      inp.value = maxVal;
      showToast(`⚠️ คะแนนเต็ม ${maxVal} แล้ว!`, 'warning');
    } else {
      inp.value = val;
    }
    // Clear warning style since we auto-clamped
    inp.style.background = '';
    inp.style.borderColor = '';
    inp.title = '';
    recalcRow(studentId, true);
  }
}

function calcGrade(score) {
  if (!score && score !== 0) return '';
  if (score >= 79.5) return 4;
  if (score >= 74.5) return 3.5;
  if (score >= 69.5) return 3;
  if (score >= 64.5) return 2.5;
  if (score >= 59.5) return 2;
  if (score >= 54.5) return 1.5;
  if (score >= 49.5) return 1;
  return 0;
}

function addWorksheet() {
  syncInputsToState();
  worksheetCount++;
  worksheetMaxScores.push(10);
  worksheetNames.push(`งาน ${worksheetCount}`);
  if (scoringData && scoringData.students) {
    scoringData.students.forEach(st => {
      if (!st.worksheets) st.worksheets = [];
      st.worksheets.push('');
    });
  }
  renderScoreTable(scoringData.students);
  recalcAll(true);
  scoringDirty = true;
}

function removeWorksheet() {
  if (worksheetCount <= 1) return;
  syncInputsToState();
  worksheetCount--;
  worksheetMaxScores.pop();
  worksheetNames.pop();
  if (scoringData && scoringData.students) {
    scoringData.students.forEach(st => {
      if (st.worksheets) st.worksheets.pop();
    });
  }
  renderScoreTable(scoringData.students);
  recalcAll(true);
  scoringDirty = true;
}

async function saveCurrentScores() {
  if (!scoringData) return;
  syncInputsToState();
  const className = document.getElementById('scoreClass').value;
  const subjectName = document.getElementById('scoreSubject').value;
  
  const records = scoringData.students.map(st => {
    return {
      studentId: st.studentId,
      worksheets: st.worksheets,
      midtermExam: st.midtermExam,
      finalExam: st.finalExam
    };
  });

  const payload = {
    className,
    subjectName,
    records: records,
    worksheetCount: worksheetCount,
    worksheetMaxScores: worksheetMaxScores,
    worksheetNames: worksheetNames
  };

  const result = await callApi('saveScores', payload);
  if (result && result.success) {
    scoringDirty = false;
    showToast('บันทึกคะแนนสำเร็จ ✓', 'success');
    loadScoreTable();
  }
}

function hasUnsavedScores() {
  return scoringDirty;
}

function clearUnsavedScores() {
  scoringDirty = false;
}