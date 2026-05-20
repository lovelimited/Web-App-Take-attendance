/**
 * ============================================================
 * reports.js — รายงาน Page
 * ============================================================
 */

let currentReportTab = 'attendance';
let lastReportData = null;

async function renderReports() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `
    <div class="animate-fadeInUp space-y-6">
      <h1 class="text-xl font-bold text-gray-800">รายงาน</h1>
      <div class="flex gap-2">
        <button class="tab-btn active" id="tabAtt" onclick="switchReportTab('attendance')">📋 รายงานเช็คชื่อ</button>
        <button class="tab-btn" id="tabScore" onclick="switchReportTab('score')">📊 รายงานคะแนน</button>
      </div>
      <div class="card p-4 flex flex-wrap gap-4 items-end">
        <div class="min-w-[160px]">
          <label class="block text-sm font-medium text-gray-600 mb-1">ชั้นเรียน</label>
          <select id="reportClass" onchange="loadReportSubjects()" class="custom-select w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 outline-none text-sm">
            <option value="">-- ทุกชั้น --</option>
          </select>
        </div>
        <div class="min-w-[160px]">
          <label class="block text-sm font-medium text-gray-600 mb-1">วิชา</label>
          <select id="reportSubject" class="custom-select w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 outline-none text-sm">
            <option value="">-- ทุกวิชา --</option>
          </select>
        </div>
        <div class="min-w-[140px]" id="monthFilter">
          <label class="block text-sm font-medium text-gray-600 mb-1">เดือน</label>
          <input type="month" id="reportMonth" oninput="document.getElementById('reportTerm').value = ''" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 outline-none text-sm">
        </div>
        <div class="min-w-[160px]" id="termFilter">
          <label class="block text-sm font-medium text-gray-600 mb-1">ภาคเรียน</label>
          <select id="reportTerm" onchange="document.getElementById('reportMonth').value = ''" class="custom-select w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 outline-none text-sm">
            <option value="">-- ทั้งหมด/เลือกเดือน --</option>
            <option value="1">ภาคเรียนที่ 1 (พ.ค. - ต.ค.)</option>
            <option value="2">ภาคเรียนที่ 2 (พ.ย. - มี.ค.)</option>
          </select>
        </div>
        <button onclick="loadReport()" class="px-6 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 transition-all">🔍 ดูรายงาน</button>
      </div>
      <div class="flex flex-wrap gap-2 no-print" id="exportBtns" style="display:none">
        <button onclick="exportReportCSV()" class="px-4 py-2 bg-green-500 text-white text-sm rounded-xl hover:bg-green-600">📥 CSV</button>
        <button onclick="exportReportExcel()" class="px-4 py-2 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600">📥 Excel</button>
        <button onclick="printElement('reportPrintArea')" class="px-4 py-2 bg-gray-600 text-white text-sm rounded-xl hover:bg-gray-700">🖨️ พิมพ์ A4</button>
      </div>
      <div id="reportContent"></div>
    </div>
  `;
  currentReportTab = 'attendance';
  
  // ดึงห้องเรียนและวิชาแบบออฟไลน์/แคช ทันที 0ms
  const { classes, subjectsByClass } = await getMyClassesAndSubjects();
  reportSubjectsByClass = subjectsByClass;

  const sel = document.getElementById('reportClass');
  if (sel) {
    sel.innerHTML = '<option value="">-- ทุกชั้น --</option>';
    classes.forEach(c => { sel.innerHTML += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`; });
  }
}

let reportSubjectsByClass = {}; // แคชวิชาสำหรับรายงาน

function switchReportTab(tab) {
  currentReportTab = tab;
  document.getElementById('tabAtt').classList.toggle('active', tab === 'attendance');
  document.getElementById('tabScore').classList.toggle('active', tab === 'score');
  document.getElementById('monthFilter').style.display = tab === 'attendance' ? '' : 'none';
  document.getElementById('termFilter').style.display = tab === 'attendance' ? '' : 'none';
  document.getElementById('reportContent').innerHTML = '';
  document.getElementById('exportBtns').style.display = 'none';
}

function loadReportSubjects() {
  const className = document.getElementById('reportClass').value;
  const sel = document.getElementById('reportSubject');
  sel.innerHTML = '<option value="">-- ทุกวิชา --</option>';
  if (!className) return;
  
  // โหลดวิชาจากแคชทันที 0ms
  const subjects = reportSubjectsByClass[className] || [];
  subjects.forEach(s => { sel.innerHTML += `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`; });
}

async function loadReport() {
  const className = document.getElementById('reportClass').value;
  const subjectName = document.getElementById('reportSubject').value;
  if (currentReportTab === 'attendance') await loadAttendanceReport(className, subjectName);
  else await loadScoreReport(className, subjectName);
}

async function loadAttendanceReport(className, subjectName) {
  if (!className) { showToast('กรุณาเลือกชั้นเรียน', 'warning'); return; }
  const month = document.getElementById('reportMonth').value || '';
  const term = document.getElementById('reportTerm').value || '';
  const result = await callApi('getAttendanceReport', { className, subjectName, month, term });
  if (!result || !result.success) return;
  lastReportData = result.data;
  const students = result.data.students || [];
  const totals = result.data.totals || {};

  const termText = term === '1' ? 'ภาคเรียนที่ 1 (พ.ค. - ต.ค.)' : term === '2' ? 'ภาคเรียนที่ 2 (พ.ย. - มี.ค.)' : '';
  const filterDesc = term ? termText : (month ? 'เดือน ' + month : '');

  document.getElementById('exportBtns').style.display = 'flex';
  document.getElementById('reportContent').innerHTML = `
    <div id="reportPrintArea">
      <div class="text-center mb-4 hidden print:block">
        <h2 class="text-lg font-bold">รายงานเช็คชื่อ</h2>
        <h3 class="text-sm">ชั้น ${escapeHtml(className)} ${subjectName ? '| วิชา ' + escapeHtml(subjectName) : ''} ${filterDesc ? '| ' + filterDesc : ''}</h3>
      </div>
      <div class="card overflow-hidden">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gray-50 border-b">
          <div class="text-center"><span class="text-lg font-bold text-green-600">${totals.present || 0}</span><br><span class="text-xs text-gray-400">มา</span></div>
          <div class="text-center"><span class="text-lg font-bold text-red-600">${totals.absent || 0}</span><br><span class="text-xs text-gray-400">ขาด</span></div>
          <div class="text-center"><span class="text-lg font-bold text-amber-600">${totals.leave || 0}</span><br><span class="text-xs text-gray-400">ลา</span></div>
          <div class="text-center"><span class="text-lg font-bold text-indigo-600">${totals.late || 0}</span><br><span class="text-xs text-gray-400">สาย</span></div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead><tr>
              <th class="!text-center w-12">ที่</th><th>ชื่อ-สกุล</th>
              <th class="!text-center">มา</th><th class="!text-center">ขาด</th>
              <th class="!text-center">ลา</th><th class="!text-center">สาย</th>
              <th class="!text-center">รวม</th>
            </tr></thead>
            <tbody>
              ${students.map(st => `<tr>
                <td class="!text-center">${st.no}</td>
                <td>${escapeHtml(st.prefix)}${escapeHtml(st.firstName)} ${escapeHtml(st.lastName)}</td>
                <td class="!text-center !text-green-600 !font-bold">${st.present}</td>
                <td class="!text-center !text-red-600 !font-bold">${st.absent}</td>
                <td class="!text-center !text-amber-600 !font-bold">${st.leave}</td>
                <td class="!text-center !text-indigo-600 !font-bold">${st.late}</td>
                <td class="!text-center !font-bold">${st.total}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

async function loadScoreReport(className, subjectName) {
  if (!className || !subjectName) { showToast('กรุณาเลือกชั้นและวิชา', 'warning'); return; }
  const result = await callApi('getScoreReport', { className, subjectName });
  if (!result || !result.success) return;
  lastReportData = result.data;
  const students = result.data.students || [];
  const stats = result.data.gradeStats || {};
  const wsCount = result.data.worksheetCount || 0;
  const wsMax = result.data.worksheetMaxScores || [];
  const wsNames = result.data.worksheetNames || [];

  // ฟังก์ชันเลือกสีเกรด
  function gradeColor(g) {
    const gn = Number(g);
    if (gn >= 3) return 'badge-green';
    if (gn >= 1) return 'badge-yellow';
    return 'badge-red';
  }
  function gradeCellColor(g) {
    const gn = Number(g);
    if (gn >= 3) return 'background:#dcfce7;color:#166534;';
    if (gn >= 1) return 'background:#fef3c7;color:#92400e;';
    return 'background:#fee2e2;color:#991b1b;';
  }

  // เรียงเกรดตามลำดับ 4, 3.5, 3, 2.5, 2, 1.5, 1, 0
  const gradeOrder = [4, 3.5, 3, 2.5, 2, 1.5, 1, 0];
  const sortedStats = gradeOrder
    .filter(g => stats[g] !== undefined && stats[g] > 0)
    .map(g => [String(g), stats[g]]);

  // สร้างหัวตารางงานย่อย (แนวตั้ง)
  let wsHeaders = '';
  let wsMaxRow = '';
  for (let i = 0; i < wsCount; i++) {
    const wsName = wsNames[i] || `งาน ${i + 1}`;
    wsHeaders += `<th class="!text-center !p-0" style="min-width:35px;max-width:45px"><span style="writing-mode:vertical-lr;transform:rotate(180deg);text-orientation:mixed;display:inline-block;font-size:0.65rem;font-weight:600;padding:4px 1px;max-height:70px;overflow:hidden">${escapeHtml(wsName)}</span></th>`;
    wsMaxRow += `<td class="!text-center !p-0" style="font-size:0.65rem;color:#9ca3af">(${wsMax[i] || '-'})</td>`;
  }

  document.getElementById('exportBtns').style.display = 'flex';
  document.getElementById('reportContent').innerHTML = `
    <div id="reportPrintArea">
      <div class="text-center mb-4 hidden print:block">
        <h2 class="text-lg font-bold">รายงานคะแนน</h2>
        <h3 class="text-sm">ชั้น ${escapeHtml(className)} | วิชา ${escapeHtml(subjectName)}</h3>
      </div>
      <div class="card overflow-hidden">
        <div class="flex flex-wrap gap-2 p-4 bg-gray-50 border-b">
          ${sortedStats.map(([g, count]) => `<span class="badge ${gradeColor(g)}">เกรด ${g}: ${count} คน</span>`).join('')}
        </div>
        <div class="table-container score-table-container" style="max-height:65vh;overflow:auto">
          <table class="data-table" style="border-collapse:collapse">
            <thead>
              <tr>
                <th class="!text-center !p-1" style="width:30px;font-size:0.7rem" rowspan="2">ที่</th>
                <th class="!p-1" style="min-width:120px;font-size:0.7rem" rowspan="2">ชื่อ-สกุล</th>
                ${wsCount > 0 ? wsHeaders : ''}
                <th class="!text-center !p-1 !bg-blue-50" style="font-size:0.65rem" rowspan="2">รวม<br>งาน</th>
                <th class="!text-center !p-1 !bg-indigo-50" style="font-size:0.65rem" rowspan="2">ระหว่าง<br>ภาค</th>
                <th class="!text-center !p-1 !bg-purple-50" style="font-size:0.65rem" rowspan="2">กลาง<br>ภาค</th>
                <th class="!text-center !p-1 !bg-pink-50" style="font-size:0.65rem" rowspan="2">ปลาย<br>ภาค</th>
                <th class="!text-center !p-1 !bg-orange-50" style="font-size:0.65rem" rowspan="2">รวม<br>(100)</th>
                <th class="!text-center !p-1 !bg-green-50" style="font-size:0.65rem" rowspan="2">เกรด</th>
              </tr>
              ${wsCount > 0 ? `<tr>${wsMaxRow}</tr>` : ''}
            </thead>
            <tbody>
              ${students.map(st => {
                let wsCells = '';
                const ws = st.worksheets || [];
                for (let i = 0; i < wsCount; i++) {
                  wsCells += `<td class="!text-center !p-0.5" style="font-size:0.75rem">${ws[i] !== '' && ws[i] !== undefined ? ws[i] : '-'}</td>`;
                }
                const gradeVal = st.grade !== '' && st.grade !== undefined ? st.grade : '-';
                const gradeStyle = gradeVal !== '-' ? gradeCellColor(gradeVal) : '';
                return `<tr>
                  <td class="!text-center !p-0.5" style="font-size:0.75rem">${st.no}</td>
                  <td class="!p-1" style="font-size:0.75rem">${escapeHtml(st.prefix)}${escapeHtml(st.firstName)} ${escapeHtml(st.lastName)}</td>
                  ${wsCells}
                  <td class="!text-center !p-0.5 !font-bold !bg-blue-50" style="font-size:0.75rem">${st.worksheetTotal || '-'}</td>
                  <td class="!text-center !p-0.5 !font-bold !bg-indigo-50" style="font-size:0.75rem">${st.midtermScore || '-'}</td>
                  <td class="!text-center !p-0.5 !bg-purple-50" style="font-size:0.75rem">${st.midtermExam || '-'}</td>
                  <td class="!text-center !p-0.5 !bg-pink-50" style="font-size:0.75rem">${st.finalExam || '-'}</td>
                  <td class="!text-center !p-0.5 !font-bold !bg-orange-50" style="font-size:0.75rem">${st.totalScore || '-'}</td>
                  <td class="!text-center !p-0.5 !font-bold" style="font-size:0.8rem;${gradeStyle}">${gradeVal}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function exportReportCSV() {
  if (!lastReportData || !lastReportData.students) return;
  const students = lastReportData.students;
  if (currentReportTab === 'attendance') {
    const filterText = lastReportData.term ? `ภาคเรียน_${lastReportData.term}` : (lastReportData.month ? `เดือน_${lastReportData.month}` : '');
    const filename = `รายงานเช็คชื่อ_${lastReportData.className}${filterText ? '_' + filterText : ''}`;
    const headers = ['ที่', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'มา', 'ขาด', 'ลา', 'สาย', 'รวม'];
    const data = students.map(st => [st.no, st.prefix, st.firstName, st.lastName, st.present, st.absent, st.leave, st.late, st.total]);
    exportToCSV(data, headers, filename);
  } else {
    const wsCount = lastReportData.worksheetCount || 0;
    const wsNames = lastReportData.worksheetNames || [];
    const wsHeaders = [];
    for (let i = 0; i < wsCount; i++) wsHeaders.push(wsNames[i] || `งาน ${i + 1}`);
    const headers = ['ที่', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', ...wsHeaders, 'รวมงาน', 'ระหว่างภาค', 'กลางภาค', 'ปลายภาค', 'รวม', 'เกรด'];
    const data = students.map(st => {
      const ws = st.worksheets || [];
      const wsData = [];
      for (let i = 0; i < wsCount; i++) wsData.push(ws[i] !== '' && ws[i] !== undefined ? ws[i] : '');
      return [st.no, st.prefix, st.firstName, st.lastName, ...wsData, st.worksheetTotal, st.midtermScore, st.midtermExam, st.finalExam, st.totalScore, st.grade];
    });
    exportToCSV(data, headers, `รายงานคะแนน_${lastReportData.className}`);
  }
}

function exportReportExcel() {
  if (!lastReportData || !lastReportData.students) return;
  const students = lastReportData.students;
  if (currentReportTab === 'attendance') {
    const filterText = lastReportData.term ? `ภาคเรียน_${lastReportData.term}` : (lastReportData.month ? `เดือน_${lastReportData.month}` : '');
    const filename = `รายงานเช็คชื่อ_${lastReportData.className}${filterText ? '_' + filterText : ''}`;
    const headers = ['ที่', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'มา', 'ขาด', 'ลา', 'สาย', 'รวม'];
    const data = students.map(st => [st.no, st.prefix, st.firstName, st.lastName, st.present, st.absent, st.leave, st.late, st.total]);
    exportToExcel(data, headers, filename);
  } else {
    const wsCount = lastReportData.worksheetCount || 0;
    const wsNames = lastReportData.worksheetNames || [];
    const wsHeaders = [];
    for (let i = 0; i < wsCount; i++) wsHeaders.push(wsNames[i] || `งาน ${i + 1}`);
    const headers = ['ที่', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', ...wsHeaders, 'รวมงาน', 'ระหว่างภาค', 'กลางภาค', 'ปลายภาค', 'รวม', 'เกรด'];
    const data = students.map(st => {
      const ws = st.worksheets || [];
      const wsData = [];
      for (let i = 0; i < wsCount; i++) wsData.push(ws[i] !== '' && ws[i] !== undefined ? ws[i] : '');
      return [st.no, st.prefix, st.firstName, st.lastName, ...wsData, st.worksheetTotal, st.midtermScore, st.midtermExam, st.finalExam, st.totalScore, st.grade];
    });
    exportToExcel(data, headers, `รายงานคะแนน_${lastReportData.className}`);
  }
}