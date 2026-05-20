/**
 * ============================================================
 * schedule.js — ตารางสอน Page
 * ============================================================
 */

// แคชรายชื่อห้องเรียนในตัวแปรโกลบอลเพื่อไม่ให้กดเปิด Modal แล้วหน่วง
let cachedClassrooms = null;

async function renderSchedule() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `
    <div class="animate-fadeInUp space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold text-gray-800">ตารางสอน</h1>
        <div class="flex items-center gap-3">
          <span class="badge badge-blue">${getThaiDay()}</span>
          <button onclick="openAddScheduleModal()" class="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-xl shadow-md transition-all active:scale-[0.98] text-sm flex items-center gap-1.5 no-print">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            เพิ่มคาบสอน
          </button>
        </div>
      </div>
      <div id="scheduleContent" class="card p-4 md:p-6">
        <div class="skeleton skeleton-text-lg" style="width:120px;margin-bottom:1rem"></div>
        <div class="skeleton" style="height:300px;border-radius:1rem"></div>
      </div>
    </div>
  `;

  // โหลดรายชื่อห้องเรียนเงียบๆ ไว้ล่วงหน้า (ใช้ cache)
  if (!cachedClassrooms) {
    const cached = getCachedApi('getAllClassrooms');
    if (cached) cachedClassrooms = cached;
    callApiSilent('getAllClassrooms').then(result => {
      if (result && result.success) {
        cachedClassrooms = result.data;
        setCachedApi('getAllClassrooms', {}, result.data);
      }
    });
  }

  // ใช้ cachedApiCall — แสดง cache ก่อน แล้วอัปเดตจาก API
  await cachedApiCall('getWeekSchedule', {}, (data, fromCache) => {
    if (currentPage !== 'schedule') return; // ⛔ ป้องกันเขียนทับ
    buildScheduleTable(data);
  });
}

/**
 * buildScheduleTable — สร้างตาราง HTML จากข้อมูล weekSchedule
 */
function buildScheduleTable(data) {
  const days = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];
  const periods = data.periods || [];

  let html = `<div class="table-container"><table class="data-table"><thead><tr>
    <th class="!text-center w-20">คาบ/วัน</th>`;
  days.forEach(day => {
    const isToday = day === data.today;
    html += `<th class="!text-center ${isToday ? '!bg-primary-500 !text-white' : ''}">${day}${isToday ? ' ★' : ''}</th>`;
  });
  html += `</tr></thead><tbody>`;

  periods.forEach(p => {
    html += `<tr><td class="!text-center !font-bold !text-xs">
      <div>คาบ ${p.period}</div>
      <div class="text-gray-400 text-[10px]">${p.start}-${p.end}</div>
      ${p.note ? `<div class="text-orange-400 text-[10px]">${p.note}</div>` : ''}
    </td>`;

    days.forEach(day => {
      const scheduleList = (data.week[day] || []).filter(s => s.period === p.period);
      if (scheduleList.length > 0) {
        const s = scheduleList[0];
        const isCurrent = s.isCurrent;
        html += `<td class="!p-1"><div class="schedule-cell ${isCurrent ? 'schedule-cell-current' : 'schedule-cell-filled'} relative group">
          <button onclick="confirmDeleteSchedule('${s.scheduleId}', '${escapeHtml(s.subjectName)}', '${escapeHtml(s.className)}')" class="absolute top-1 right-1 p-1 text-red-500 hover:text-red-700 bg-white/80 hover:bg-white rounded-lg shadow-sm opacity-0 group-hover:opacity-100 md:opacity-40 md:hover:opacity-100 transition-opacity duration-150 no-print" title="ลบคาบสอน">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
          <div class="font-bold text-xs pr-4">${escapeHtml(s.subjectName)}</div>
          <div class="text-[10px] mt-0.5 opacity-80">${escapeHtml(s.className)}</div>
        </div></td>`;
      } else {
        html += `<td class="!p-1">
          <div class="schedule-cell schedule-cell-empty group cursor-pointer transition-all flex items-center justify-center font-bold" onclick="openAddScheduleModal('${day}', '${p.period}')">
            <span class="group-hover:hidden">-</span>
            <span class="hidden group-hover:inline text-lg">+</span>
          </div>
        </td>`;
      }
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  const scheduleContent = document.getElementById('scheduleContent');
  if (scheduleContent) {
    scheduleContent.innerHTML = html;
  }
}

function openAddScheduleModal(dayOfWeek = 'จันทร์', period = '1') {
  const classrooms = cachedClassrooms || [];

  let modal = document.getElementById('addScheduleModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'addScheduleModal';
    modal.className = 'fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 transition-all duration-300 opacity-0 pointer-events-none';
    document.body.appendChild(modal);
  }

  // สร้าง Datalist สำหรับห้องเรียน
  let datalistHtml = '';
  classrooms.forEach(c => {
    datalistHtml += `<option value="${escapeHtml(c)}">`;
  });

  // สร้าง HTML เนื้อหาของ Modal
  modal.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform scale-95 transition-all duration-300" id="addScheduleModalCard">
      <!-- Modal Header -->
      <div class="px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white flex items-center justify-between">
        <h3 class="font-bold text-lg">เพิ่มคาบสอน</h3>
        <button onclick="closeAddScheduleModal()" class="text-white/80 hover:text-white transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">วันสอน</label>
          <select id="newDayOfWeek" class="custom-select w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary-500 outline-none transition-all text-sm">
            <option value="จันทร์">วันจันทร์</option>
            <option value="อังคาร">วันอังคาร</option>
            <option value="พุธ">วันพุธ</option>
            <option value="พฤหัสบดี">วันพฤหัสบดี</option>
            <option value="ศุกร์">วันศุกร์</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">คาบเรียน</label>
          <select id="newPeriod" class="custom-select w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary-500 outline-none transition-all text-sm">
            <option value="1">คาบ 1 (09:00 - 09:50)</option>
            <option value="2">คาบ 2 (09:50 - 10:40)</option>
            <option value="3">คาบ 3 (10:40 - 11:30)</option>
            <option value="4">คาบ 4 (11:30 - 12:30) - พักกลางวัน</option>
            <option value="5">คาบ 5 (12:30 - 13:20)</option>
            <option value="6">คาบ 6 (13:20 - 14:10)</option>
            <option value="7">คาบ 7 (14:10 - 15:00)</option>
            <option value="8">คาบ 8 (15:00 - 15:50)</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">ห้องเรียน</label>
          <input type="text" id="newClassName" list="modalClassrooms" placeholder="ระบุห้องเรียน เช่น ม.1/1" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary-500 outline-none transition-all text-sm">
          <datalist id="modalClassrooms">
            ${datalistHtml}
          </datalist>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">วิชา</label>
          <input type="text" id="newSubjectName" placeholder="ระบุวิชา เช่น คณิตศาสตร์" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary-500 outline-none transition-all text-sm">
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
        <button onclick="closeAddScheduleModal()" class="px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-100 font-medium text-sm transition-colors">
          ยกเลิก
        </button>
        <button onclick="submitAddSchedule()" class="px-5 py-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-xl shadow-md transition-all active:scale-[0.98] text-sm">
          บันทึก
        </button>
      </div>
    </div>
  `;

  // กำหนดวันและคาบตามที่คลิกมา
  document.getElementById('newDayOfWeek').value = dayOfWeek;
  document.getElementById('newPeriod').value = period;

  // แสดง Modal (Animation)
  modal.classList.remove('pointer-events-none', 'opacity-0');
  setTimeout(() => {
    document.getElementById('addScheduleModalCard').classList.remove('scale-95');
  }, 10);
}

function closeAddScheduleModal() {
  const modal = document.getElementById('addScheduleModal');
  if (!modal) return;
  const card = document.getElementById('addScheduleModalCard');
  if (card) card.classList.add('scale-95');
  modal.classList.add('opacity-0', 'pointer-events-none');
}

async function submitAddSchedule() {
  const className = document.getElementById('newClassName').value.trim();
  const subjectName = document.getElementById('newSubjectName').value.trim();
  const dayOfWeek = document.getElementById('newDayOfWeek').value;
  const period = document.getElementById('newPeriod').value;

  if (!className) {
    showToast('กรุณากรอกห้องเรียน', 'error');
    return;
  }
  if (!subjectName) {
    showToast('กรุณากรอกวิชา', 'error');
    return;
  }

  // เรียก API
  const result = await callApi('addSchedule', {
    className,
    subjectName,
    dayOfWeek,
    period
  });

  if (result && result.success) {
    closeAddScheduleModal();
    clearApiCache('getWeekSchedule');
    clearApiCache('getClassList');
    localStorage.removeItem('dashboard_cache');
    showToast('เพิ่มคาบสอนสำเร็จ ✓', 'success');
    renderSchedule(); // โหลดตารางใหม่
  }
}

async function confirmDeleteSchedule(scheduleId, subjectName, className) {
  const confirmResult = await Swal.fire({
    title: 'ยืนยันการลบคาบสอน?',
    text: `ต้องการลบวิชา ${subjectName} ห้อง ${className} ออกจากตารางเรียนใช่หรือไม่?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'ใช่, ลบเลย',
    cancelButtonText: 'ยกเลิก',
    customClass: {
      popup: '!rounded-3xl',
      confirmButton: '!rounded-xl px-5 py-2.5 text-sm font-semibold',
      cancelButton: '!rounded-xl px-5 py-2.5 text-sm font-semibold'
    }
  });

  if (confirmResult.isConfirmed) {
    const result = await callApi('deleteSchedule', { scheduleId });
    if (result && result.success) {
      clearApiCache('getWeekSchedule');
      localStorage.removeItem('dashboard_cache');
      showToast('ลบคาบสอนสำเร็จ ✓', 'success');
      renderSchedule();
    }
  }
}