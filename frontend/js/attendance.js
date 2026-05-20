/**
 * ============================================================
 * attendance.js — เช็คชื่อคาบสอน
 * ============================================================
 */

let attendanceData = null;
let attendanceDirty = false;
let currentScheduleId = null;

async function renderAttendance(scheduleId) {
  const content = document.getElementById('pageContent');
  if (scheduleId) {
    currentScheduleId = scheduleId;
    await renderStudentAttendance(scheduleId);
    return;
  }

  content.innerHTML = `
    <div class="animate-fadeInUp space-y-6">
      <h1 class="text-xl font-bold text-gray-800">เช็คชื่อคาบสอน</h1>
      <p class="text-sm text-gray-400">${getThaiDay()} ${formatDateThai(getTodayStr())}</p>
      <div id="attendanceCards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <p class="text-gray-400 text-center py-8 col-span-full">กำลังโหลด...</p>
      </div>
    </div>
  `;

  // ใช้ cachedApiCall เพื่อแสดงข้อมูลจาก cache ทันทีและอัปเดตเบื้องหลัง
  await cachedApiCall('getAttendanceCards', { date: getTodayStr() }, (data, fromCache) => {
    if (currentPage !== 'attendance') return; // ⛔ ป้องกันเขียนทับหน้าอื่น
    const cards = data.cards || [];
    const container = document.getElementById('attendanceCards');
    if (!container) return;

    if (cards.length === 0) {
      container.innerHTML = `<div class="col-span-full text-center py-12">
        <p class="text-gray-400">วันนี้ไม่มีคาบสอน</p></div>`;
      return;
    }

    container.innerHTML = cards.map((c, i) => `
      <div class="card card-clickable p-5 ${c.isChecked ? 'border-green-200 bg-green-50' : ''} ${c.isCurrent ? 'border-primary-500 bg-primary-50' : ''} animate-fadeInUp"
           style="animation-delay:${i * 0.05}s"
           onclick="renderStudentAttendance('${c.scheduleId}')">
        <div class="flex items-center justify-between mb-3">
          <span class="badge ${c.isCurrent ? 'badge-blue' : 'badge-yellow'}">คาบ ${c.period}</span>
          ${c.isChecked ? '<span class="badge badge-green">✓ เช็คแล้ว</span>' : '<span class="badge badge-red">— ยังไม่เช็ค</span>'}
        </div>
        <h3 class="font-bold text-gray-800 text-lg">${escapeHtml(c.subjectName)}</h3>
        <p class="text-sm text-gray-500 mt-1">ชั้น ${escapeHtml(c.className)}</p>
        <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <span class="text-xs text-gray-400">⏰ ${c.startTime} - ${c.endTime}</span>
          ${c.isChecked
            ? `<div class="text-right"><span class="text-lg font-bold text-green-600">${c.presentCount}/${c.totalStudents}</span></div>`
            : `<span class="text-sm text-gray-400">${c.totalStudents} คน</span>`}
        </div>
      </div>
    `).join('');
  });
}

async function renderStudentAttendance(scheduleId) {
  currentScheduleId = scheduleId;
  attendanceDirty = false;
  const content = document.getElementById('pageContent');
  content.innerHTML = '<div class="text-center py-12 text-gray-400">กำลังโหลดรายชื่อนักเรียน...</div>';

  const result = await callApi('getStudentsForAttendance', { scheduleId, date: getTodayStr() });
  if (!result || !result.success) return;

  attendanceData = result.data;
  const schedule = attendanceData.schedule;
  const students = attendanceData.students;

  content.innerHTML = `
    <div class="animate-fadeInUp space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <button onclick="renderAttendance()" class="p-2 hover:bg-gray-100 rounded-xl transition-all">🔙 กลับ</button>
        <div class="flex-1">
          <h1 class="text-lg font-bold text-gray-800">เช็คชื่อ — ${escapeHtml(schedule.subjectName)}</h1>
          <p class="text-sm text-gray-400">ชั้น ${escapeHtml(schedule.className)} | คาบ ${schedule.period}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button onclick="setAllStatus('มา')" class="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-xl hover:bg-green-600">✓ มาทั้งหมด</button>
        <button onclick="setAllStatus('ขาด')" class="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600">✗ ขาดทั้งหมด</button>
        <button onclick="setAllStatus('ลา')" class="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600">⊘ ลาทั้งหมด</button>
        <button onclick="setAllStatus('สาย')" class="px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-600">◷ สายทั้งหมด</button>
      </div>
      <div class="table-container" style="max-height:60vh;overflow-y:auto">
        <table class="data-table" id="attendanceTable">
          <thead>
            <tr>
              <th class="w-12 !text-center">ที่</th>
              <th>ชื่อ-สกุล</th>
              <th class="!text-center w-12">มา</th>
              <th class="!text-center w-12">ขาด</th>
              <th class="!text-center w-12">ลา</th>
              <th class="!text-center w-12">สาย</th>
            </tr>
          </thead>
          <tbody id="attendanceTableBody">
            ${students.map(st => `
              <tr data-student-id="${st.studentId}" data-name="${st.firstName} ${st.lastName}">
                <td class="!text-center !font-bold">${st.no}</td>
                <td>${escapeHtml(st.prefix)}${escapeHtml(st.firstName)} ${escapeHtml(st.lastName)}</td>
                <td class="!text-center"><button class="att-btn att-present ${st.status === 'มา' ? 'active' : ''}" onclick="setStatus('${st.studentId}','มา',this)">✓</button></td>
                <td class="!text-center"><button class="att-btn att-absent ${st.status === 'ขาด' ? 'active' : ''}" onclick="setStatus('${st.studentId}','ขาด',this)">✗</button></td>
                <td class="!text-center"><button class="att-btn att-leave ${st.status === 'ลา' ? 'active' : ''}" onclick="setStatus('${st.studentId}','ลา',this)">⊘</button></td>
                <td class="!text-center"><button class="att-btn att-late ${st.status === 'สาย' ? 'active' : ''}" onclick="setStatus('${st.studentId}','สาย',this)">◷</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div class="flex gap-4 text-sm">
          <span class="text-green-600 font-medium" id="sumPresent">มา: 0</span>
          <span class="text-red-600 font-medium" id="sumAbsent">ขาด: 0</span>
          <span class="text-amber-600 font-medium" id="sumLeave">ลา: 0</span>
          <span class="text-indigo-600 font-medium" id="sumLate">สาย: 0</span>
        </div>
        <button onclick="saveCurrentAttendance()" class="px-8 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-xl hover:from-primary-600 hover:to-primary-700">
          💾 บันทึก
        </button>
      </div>
    </div>
  `;
  updateAttendanceSummary();
}

function setStatus(studentId, status, btn) {
  attendanceDirty = true;
  const row = btn.closest('tr');
  row.querySelectorAll('.att-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const st = attendanceData.students.find(s => String(s.studentId) === String(studentId));
  if (st) st.status = status;
  updateAttendanceSummary();
}

function setAllStatus(status) {
  attendanceDirty = true;
  const statusMap = { 'มา': 'att-present', 'ขาด': 'att-absent', 'ลา': 'att-leave', 'สาย': 'att-late' };
  const cls = statusMap[status];
  document.querySelectorAll('#attendanceTableBody tr').forEach(row => {
    row.querySelectorAll('.att-btn').forEach(b => b.classList.remove('active'));
    row.querySelector(`.${cls}`).classList.add('active');
  });
  attendanceData.students.forEach(st => { st.status = status; });
  updateAttendanceSummary();
}

function updateAttendanceSummary() {
  if (!attendanceData) return;
  const students = attendanceData.students;
  document.getElementById('sumPresent').textContent = `มา: ${students.filter(s => s.status === 'มา').length}`;
  document.getElementById('sumAbsent').textContent = `ขาด: ${students.filter(s => s.status === 'ขาด').length}`;
  document.getElementById('sumLeave').textContent = `ลา: ${students.filter(s => s.status === 'ลา').length}`;
  document.getElementById('sumLate').textContent = `สาย: ${students.filter(s => s.status === 'สาย').length}`;
}

async function saveCurrentAttendance() {
  if (!attendanceData) return;
  const records = attendanceData.students.filter(s => s.status).map(s => ({ studentId: s.studentId, status: s.status }));
  if (records.length === 0) {
    showToast('กรุณาเช็คชื่อนักเรียนก่อน', 'warning'); return;
  }
  const unchecked = attendanceData.students.filter(s => !s.status);
  if (unchecked.length > 0) {
    const ok = await showConfirm('มีนักเรียนที่ยังไม่ได้เช็ค', `ยังเหลืออีก ${unchecked.length} คน ต้องการบันทึกหรือไม่?`, 'บันทึก');
    if (!ok) return;
  }
  const result = await callApi('saveAttendance', { scheduleId: currentScheduleId, date: getTodayStr(), records });
  if (result && result.success) {
    attendanceDirty = false;
    clearApiCache('getDashboardData');
    clearApiCache('getAttendanceCards');
    localStorage.removeItem('dashboard_cache');
    showToast('บันทึกเช็คชื่อสำเร็จ ✓', 'success');
    setTimeout(() => renderAttendance(), 1000);
  }
}

function hasUnsavedAttendance() {
  return attendanceDirty;
}

function clearUnsavedAttendance() {
  attendanceDirty = false;
}