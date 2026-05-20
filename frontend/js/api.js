/**
 * ============================================================
 * api.js — API Wrapper
 * ============================================================
 * Fetch wrapper for Google Apps Script Web App
 * Uses text/plain Content-Type to avoid CORS preflight
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbyVnAK_gq8jAHFAGc70K-Sih4WG0qx8XI8vXRQgppNHk0hv9TIt0nSl0JwYvAK6zzB8/exec';

async function callApi(action, data = {}) {
  showLoading();
  try {
    const token = localStorage.getItem('session_token') || '';
    const payload = { action, token, ...data };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const result = await response.json();
    
    if (result.code === 401) {
      localStorage.removeItem('session_token');
      localStorage.removeItem('teacher_data');
      showToast('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่', 'warning');
      setTimeout(() => showLoginPage(), 1000);
      return null;
    }

    if (!result.success) {
      showToast(result.message || 'เกิดข้อผิดพลาด', 'error');
    }
    
    return result;
  } catch (err) {
    console.error('API Error:', err);
    showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
    return null;
  } finally {
    hideLoading();
  }
}

async function callApiSilent(action, data = {}) {
  try {
    const token = localStorage.getItem('session_token') || '';
    const payload = { action, token, ...data };
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });
    if (!response.ok) return null;
    const result = await response.json();
    if (result.code === 401) {
      localStorage.removeItem('session_token');
      showLoginPage();
      return null;
    }
    return result;
  } catch (err) {
    return null;
  }
}