/**
 * College Student Performance Portal - Core Application Engine
 */

(function () {
  'use strict';

  const COLLEGE_NAME = "ACE Engineering College";

  const STORAGE_KEYS = {
    USERS: 'cspp_users',
    MARKS: 'cspp_marks',
    ATTENDANCE: 'cspp_attendance',
    STUDY_HOURS: 'cspp_study_hours',
    BRANCHES: 'cspp_branches',
    SESSION: 'cspp_session',
    INIT_FLAG: 'cspp_initialized_v3',
    THEME: 'cspp_theme',
    REMEMBER_ID: 'cspp_remember_id'
  };

  const DEFAULT_BRANCHES = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT'];

  // --- Password Hashing ---
  async function hashPassword(plainText) {
    if (!plainText) return '';
    try {
      if (window.crypto && crypto.subtle) {
        const msgBuffer = new TextEncoder().encode(plainText);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {}
    let hash = 0;
    for (let i = 0; i < plainText.length; i++) {
      hash = ((hash << 5) - hash) + plainText.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  }

  // --- Storage Helpers ---
  function getStorage(key, fallback = []) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function setStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      showToast('Storage write failed', 'error');
    }
  }

  // --- Theme Management ---
  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    if (saved === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
    render();
  }

  // --- Toast Notifications ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.25s ease-in';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // --- XSS Escaper ---
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Modal Helpers ---
  function showModal({ title, bodyHTML, footerHTML, widthClass = '' }) {
    const root = document.getElementById('modal-root');
    if (!root) return;
    root.innerHTML = `
      <div class="modal-backdrop" id="modal-backdrop">
        <div class="modal ${widthClass}" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">${escapeHTML(title)}</div>
            <button class="modal-close" id="modal-close-btn">&times;</button>
          </div>
          <div class="modal-body">${bodyHTML}</div>
          ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
        </div>
      </div>
    `;
    document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
    document.getElementById('modal-backdrop')?.addEventListener('click', closeModal);
  }

  function closeModal() {
    const root = document.getElementById('modal-root');
    if (root) root.innerHTML = '';
  }

  function showConfirmModal(title, message, onConfirm) {
    showModal({
      title,
      bodyHTML: `<p style="font-size: 14px; color: var(--text);">${escapeHTML(message)}</p>`,
      footerHTML: `
        <button class="btn btn-secondary btn-sm" id="confirm-cancel">Cancel</button>
        <button class="btn btn-danger btn-sm" id="confirm-ok">Yes, Proceed</button>
      `
    });
    document.getElementById('confirm-cancel')?.addEventListener('click', closeModal);
    document.getElementById('confirm-ok')?.addEventListener('click', () => {
      closeModal();
      onConfirm();
    });
  }

  // --- Performance Calculation ---
  function calculateStudentPerformance(studentId) {
    const marks = getStorage(STORAGE_KEYS.MARKS, []).filter(m => m.studentId === studentId);
    const att = getStorage(STORAGE_KEYS.ATTENDANCE, []).filter(a => a.studentId === studentId);
    const hours = getStorage(STORAGE_KEYS.STUDY_HOURS, []).filter(h => h.studentId === studentId);

    let totalObt = 0, totalMax = 0;
    marks.forEach(m => {
      totalObt += (Number(m.internal1)||0) + (Number(m.internal2)||0) + (Number(m.assignment)||0) + (Number(m.external)||0);
      totalMax += (Number(m.maxMarks)||100);
    });
    const marksPct = totalMax > 0 ? (totalObt / totalMax) * 100 : 0;

    let totClasses = 0, attClasses = 0;
    att.forEach(a => {
      totClasses += (Number(a.totalClasses)||0);
      attClasses += (Number(a.attendedClasses)||0);
    });
    const attendancePct = totClasses > 0 ? (attClasses / totClasses) * 100 : 0;

    let totalH = 0;
    hours.forEach(h => totalH += (Number(h.hours)||0));
    const weeklyAvgHours = hours.length > 0 ? (totalH / Math.max(1, hours.length / 7)) : 0;
    const studyScore = Math.min(weeklyAvgHours / 20, 1) * 100;

    const performanceScore = (0.5 * marksPct) + (0.3 * attendancePct) + (0.2 * studyScore);

    let grade = 'Needs Improvement';
    let badgeClass = 'badge-needs-imp';
    if (performanceScore >= 85) {
      grade = 'Excellent';
      badgeClass = 'badge-excellent';
    } else if (performanceScore >= 70) {
      grade = 'Good';
      badgeClass = 'badge-good';
    } else if (performanceScore >= 50) {
      grade = 'Average';
      badgeClass = 'badge-average';
    }

    return {
      marksPct: Math.round(marksPct * 10) / 10,
      attendancePct: Math.round(attendancePct * 10) / 10,
      weeklyAvgHours: Math.round(weeklyAvgHours * 10) / 10,
      studyScore: Math.round(studyScore * 10) / 10,
      performanceScore: Math.round(performanceScore * 10) / 10,
      grade,
      badgeClass,
      hasShortage: attendancePct < 75 && totClasses > 0,
      totalClasses: totClasses,
      attendedClasses: attClasses
    };
  }

  // --- MODIFICATION 1: PRINT REPORT ENGINE ---
  window.onafterprint = function () {
    const printArea = document.getElementById('printArea');
    if (printArea) printArea.innerHTML = '';
  };

  function printStudentReport(studentId) {
    const session = getSession();
    if (!session) return;

    // Role-based authorization
    if (session.role === 'STUDENT' && session.id !== studentId) {
      showToast('Unauthorized: You can only print your own report', 'error');
      return;
    }
    const users = getStorage(STORAGE_KEYS.USERS, []);
    const student = users.find(u => u.id === studentId);
    if (!student) {
      showToast('Student record not found', 'error');
      return;
    }

    if (session.role === 'LECTURER' && session.branch !== student.branch) {
      showToast(`Unauthorized: You can only print reports for ${session.branch} students`, 'error');
      return;
    }

    const marks = getStorage(STORAGE_KEYS.MARKS, []).filter(m => m.studentId === studentId);
    const attendance = getStorage(STORAGE_KEYS.ATTENDANCE, []).filter(a => a.studentId === studentId);
    const studyHours = getStorage(STORAGE_KEYS.STUDY_HOURS, []).filter(h => h.studentId === studentId)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (marks.length === 0 && attendance.length === 0) {
      showToast('No academic data available for this student', 'error');
      return;
    }

    showToast('Preparing report... (Tip: Choose "Save as PDF" in print dialog)', 'info');

    const perf = calculateStudentPerformance(studentId);

    // Calculate Branch Rank
    const branchStudents = users.filter(u => u.role === 'STUDENT' && u.branch === student.branch && u.status === 'Approved');
    const branchScores = branchStudents.map(s => ({
      id: s.id,
      score: calculateStudentPerformance(s.id).performanceScore
    })).sort((a, b) => b.score - a.score);
    const rank = branchScores.findIndex(s => s.id === studentId) + 1;
    const totalInBranch = branchScores.length;

    // Automated Remarks
    let remarks = '';
    if (perf.hasShortage) {
      remarks = 'Attendance shortage detected (<75%). Immediate improvement in classroom attendance is required to maintain semester examination eligibility.';
    } else if (perf.performanceScore >= 85) {
      remarks = 'Outstanding academic performance and exemplary dedication. Keep up the excellent work!';
    } else if (perf.performanceScore >= 70) {
      remarks = 'Good performance and consistent progress. Continue active participation to reach distinction.';
    } else if (perf.performanceScore >= 50) {
      remarks = 'Average academic standing. Regular revision, timely assignments, and dedicated study hours are recommended.';
    } else {
      remarks = 'Performance requires immediate academic intervention and faculty counseling.';
    }

    const reportHTML = `
      <div class="print-report-wrapper">
        <div class="print-header">
          <div>
            <div class="print-college-name">${escapeHTML(COLLEGE_NAME)}</div>
            <div class="print-report-title">Student Performance Report</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #475569;">
            <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
            <div><strong>Academic Year:</strong> 2024-2025</div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px;">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 11px;">
            <div><strong>Student Name:</strong> ${escapeHTML(student.name)}</div>
            <div><strong>Roll Number:</strong> ${escapeHTML(student.id)}</div>
            <div><strong>Department / Branch:</strong> ${escapeHTML(student.branch)}</div>
            <div><strong>Year / Semester:</strong> Year ${escapeHTML(student.year)}, Sem ${escapeHTML(student.semester)}</div>
            <div><strong>Email:</strong> ${escapeHTML(student.email)}</div>
            <div><strong>Enrollment Status:</strong> ${escapeHTML(student.status)}</div>
          </div>
        </div>

        <div class="print-grid-summary">
          <div class="print-summary-box">
            <div style="font-size: 10px; color: #64748b; font-weight: 600;">MARKS %</div>
            <div class="print-summary-val">${perf.marksPct}%</div>
          </div>
          <div class="print-summary-box">
            <div style="font-size: 10px; color: #64748b; font-weight: 600;">ATTENDANCE %</div>
            <div class="print-summary-val" style="color: ${perf.hasShortage ? '#dc2626' : '#0f172a'};">${perf.attendancePct}%</div>
          </div>
          <div class="print-summary-box">
            <div style="font-size: 10px; color: #64748b; font-weight: 600;">STUDY HRS/WK</div>
            <div class="print-summary-val">${perf.weeklyAvgHours}h</div>
          </div>
          <div class="print-summary-box">
            <div style="font-size: 10px; color: #64748b; font-weight: 600;">PERF SCORE</div>
            <div class="print-summary-val" style="color: #2563eb;">${perf.performanceScore}</div>
          </div>
          <div class="print-summary-box">
            <div style="font-size: 10px; color: #64748b; font-weight: 600;">GRADE</div>
            <div class="print-summary-val">${perf.grade}</div>
          </div>
          <div class="print-summary-box">
            <div style="font-size: 10px; color: #64748b; font-weight: 600;">BRANCH RANK</div>
            <div class="print-summary-val">#${rank} / ${totalInBranch}</div>
          </div>
        </div>

        <div style="font-weight: 700; font-size: 12px; margin-bottom: 6px; text-transform: uppercase;">1. Subject-Wise Examination Marks</div>
        <table class="print-table">
          <thead>
            <tr>
              <th>Subject Name</th>
              <th>Int 1 (25)</th>
              <th>Int 2 (25)</th>
              <th>Assign (10)</th>
              <th>External (40)</th>
              <th>Total Obtained</th>
              <th>Max Marks</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${marks.map(m => {
              const obt = (Number(m.internal1)||0) + (Number(m.internal2)||0) + (Number(m.assignment)||0) + (Number(m.external)||0);
              const mx = Number(m.maxMarks) || 100;
              const pct = Math.round((obt / mx) * 100);
              return `
                <tr>
                  <td><strong>${escapeHTML(m.subject)}</strong></td>
                  <td>${m.internal1}</td>
                  <td>${m.internal2}</td>
                  <td>${m.assignment}</td>
                  <td>${m.external}</td>
                  <td><strong>${obt}</strong></td>
                  <td>${mx}</td>
                  <td>${pct}%</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div style="font-weight: 700; font-size: 12px; margin-bottom: 6px; text-transform: uppercase;">2. Subject-Wise Attendance Record</div>
        <table class="print-table">
          <thead>
            <tr>
              <th>Subject Name</th>
              <th>Classes Attended</th>
              <th>Total Classes</th>
              <th>Attendance Percentage</th>
              <th>Status / Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${attendance.map(a => {
              const tot = Number(a.totalClasses) || 1;
              const att = Number(a.attendedClasses) || 0;
              const pct = Math.round((att / tot) * 100);
              const isShort = pct < 75;
              return `
                <tr>
                  <td><strong>${escapeHTML(a.subject)}</strong></td>
                  <td>${att}</td>
                  <td>${tot}</td>
                  <td>${pct}%</td>
                  <td>${isShort ? '<span class="shortage-flag">SHORTAGE (&lt;75%)</span>' : 'Eligible'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div style="font-weight: 700; font-size: 12px; margin-bottom: 6px; text-transform: uppercase;">3. Study Hours Log (Weekly Average: ${perf.weeklyAvgHours} hrs)</div>
        <table class="print-table">
          <thead>
            <tr>
              ${studyHours.slice(-7).map(h => `<th>${escapeHTML(h.date.slice(5))}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              ${studyHours.slice(-7).map(h => `<td><strong>${h.hours} hrs</strong></td>`).join('')}
            </tr>
          </tbody>
        </table>

        <div class="print-remarks">
          <strong>Faculty Remarks:</strong> ${escapeHTML(remarks)}
        </div>

        <div class="print-signatures">
          <div class="print-sig-col">Class Teacher</div>
          <div class="print-sig-col">Head of Department (HOD)</div>
          <div class="print-sig-col">Principal</div>
        </div>

        <div class="print-footer-note">
          Computer generated report · Verified by Examination Cell &bull; ${escapeHTML(COLLEGE_NAME)}
        </div>
      </div>
    `;

    const printArea = document.getElementById('printArea');
    if (printArea) {
      printArea.innerHTML = reportHTML;
      setTimeout(() => window.print(), 80);
    }
  }

  function printBranchReport(branch) {
    const session = getSession();
    if (!session) return;
    if (session.role === 'LECTURER' && session.branch !== branch) {
      showToast(`Unauthorized: You can only print ${session.branch} branch report`, 'error');
      return;
    }

    showToast(`Preparing ${branch} Branch Report...`, 'info');

    const users = getStorage(STORAGE_KEYS.USERS, []);
    const branchStudents = users.filter(u => u.role === 'STUDENT' && u.branch === branch);

    let mSum = 0, aSum = 0, sSum = 0, pSum = 0;
    const scoredList = branchStudents.map(s => {
      const p = calculateStudentPerformance(s.id);
      mSum += p.marksPct;
      aSum += p.attendancePct;
      sSum += p.weeklyAvgHours;
      pSum += p.performanceScore;
      return { s, p };
    });

    const count = branchStudents.length;
    const avgM = count > 0 ? Math.round((mSum / count) * 10) / 10 : 0;
    const avgA = count > 0 ? Math.round((aSum / count) * 10) / 10 : 0;
    const avgS = count > 0 ? Math.round((sSum / count) * 10) / 10 : 0;
    const avgP = count > 0 ? Math.round((pSum / count) * 10) / 10 : 0;

    const reportHTML = `
      <div class="print-report-wrapper">
        <div class="print-header">
          <div>
            <div class="print-college-name">${escapeHTML(COLLEGE_NAME)}</div>
            <div class="print-report-title">Branch Academic Report: ${escapeHTML(branch)}</div>
          </div>
          <div style="text-align: right; font-size: 11px;">
            <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
            <div><strong>Enrolled:</strong> ${count} students</div>
          </div>
        </div>

        <table class="print-table">
          <thead>
            <tr>
              <th>Roll No</th>
              <th>Student Name</th>
              <th>Year</th>
              <th>Marks %</th>
              <th>Attendance %</th>
              <th>Study Hrs/Wk</th>
              <th>Perf Score</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            ${scoredList.map(item => `
              <tr>
                <td><strong>${escapeHTML(item.s.id)}</strong></td>
                <td>${escapeHTML(item.s.name)}</td>
                <td>Y${escapeHTML(item.s.year)} S${escapeHTML(item.s.semester)}</td>
                <td>${item.p.marksPct}%</td>
                <td style="color: ${item.p.hasShortage ? '#dc2626' : 'inherit'}; font-weight: ${item.p.hasShortage ? '700' : 'normal'};">
                  ${item.p.attendancePct}% ${item.p.hasShortage ? '(Shortage)' : ''}
                </td>
                <td>${item.p.weeklyAvgHours}h</td>
                <td><strong>${item.p.performanceScore}</strong></td>
                <td>${item.p.grade}</td>
              </tr>
            `).join('')}
            <tr style="background: #e2e8f0; font-weight: 800;">
              <td colspan="3">BRANCH AVERAGE (${count} Students)</td>
              <td>${avgM}%</td>
              <td>${avgA}%</td>
              <td>${avgS}h</td>
              <td>${avgP}</td>
              <td>-</td>
            </tr>
          </tbody>
        </table>

        <div class="print-signatures">
          <div class="print-sig-col">Branch Coordinator</div>
          <div class="print-sig-col">Head of Department (HOD)</div>
          <div class="print-sig-col">Principal</div>
        </div>
      </div>
    `;

    const printArea = document.getElementById('printArea');
    if (printArea) {
      printArea.innerHTML = reportHTML;
      setTimeout(() => window.print(), 80);
    }
  }

  function printCollegeReport() {
    const session = getSession();
    if (!session || session.role !== 'ADMIN') {
      showToast('Unauthorized: Only Administrators can print Overall College Report', 'error');
      return;
    }

    showToast('Preparing Overall College Report...', 'info');

    const branches = getStorage(STORAGE_KEYS.BRANCHES, DEFAULT_BRANCHES);
    const users = getStorage(STORAGE_KEYS.USERS, []);
    const students = users.filter(u => u.role === 'STUDENT');

    const branchSummary = branches.map(b => {
      const bStus = students.filter(s => s.branch === b);
      let m = 0, a = 0, st = 0, p = 0;
      bStus.forEach(s => {
        const perf = calculateStudentPerformance(s.id);
        m += perf.marksPct; a += perf.attendancePct; st += perf.weeklyAvgHours; p += perf.performanceScore;
      });
      const cnt = bStus.length;
      return {
        branch: b,
        count: cnt,
        avgM: cnt > 0 ? Math.round((m / cnt) * 10) / 10 : 0,
        avgA: cnt > 0 ? Math.round((a / cnt) * 10) / 10 : 0,
        avgS: cnt > 0 ? Math.round((st / cnt) * 10) / 10 : 0,
        avgP: cnt > 0 ? Math.round((p / cnt) * 10) / 10 : 0
      };
    });

    let totCnt = 0, colM = 0, colA = 0, colS = 0, colP = 0;
    branchSummary.forEach(b => {
      totCnt += b.count;
      colM += b.avgM * b.count;
      colA += b.avgA * b.count;
      colS += b.avgS * b.count;
      colP += b.avgP * b.count;
    });

    const oM = totCnt > 0 ? Math.round((colM / totCnt) * 10) / 10 : 0;
    const oA = totCnt > 0 ? Math.round((colA / totCnt) * 10) / 10 : 0;
    const oS = totCnt > 0 ? Math.round((colS / totCnt) * 10) / 10 : 0;
    const oP = totCnt > 0 ? Math.round((colP / totCnt) * 10) / 10 : 0;

    const reportHTML = `
      <div class="print-report-wrapper">
        <div class="print-header">
          <div>
            <div class="print-college-name">${escapeHTML(COLLEGE_NAME)}</div>
            <div class="print-report-title">Overall Institutional Academic Performance Report</div>
          </div>
          <div style="text-align: right; font-size: 11px;">
            <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
            <div><strong>Total Students:</strong> ${totCnt}</div>
          </div>
        </div>

        <table class="print-table">
          <thead>
            <tr>
              <th>Branch / Department</th>
              <th>Student Enrollment</th>
              <th>Average Marks %</th>
              <th>Average Attendance %</th>
              <th>Average Study Hrs/Wk</th>
              <th>Composite Performance Score</th>
            </tr>
          </thead>
          <tbody>
            ${branchSummary.map(b => `
              <tr>
                <td><strong>${escapeHTML(b.branch)}</strong></td>
                <td>${b.count}</td>
                <td>${b.avgM}%</td>
                <td style="color: ${b.avgA < 75 ? '#dc2626' : 'inherit'}; font-weight: ${b.avgA < 75 ? '700' : 'normal'};">
                  ${b.avgA}%
                </td>
                <td>${b.avgS} hrs</td>
                <td><strong>${b.avgP}</strong></td>
              </tr>
            `).join('')}
            <tr style="background: #e2e8f0; font-weight: 800;">
              <td>INSTITUTIONAL TOTAL</td>
              <td>${totCnt} Students</td>
              <td>${oM}%</td>
              <td>${oA}%</td>
              <td>${oS} hrs</td>
              <td>${oP}</td>
            </tr>
          </tbody>
        </table>

        <div class="print-signatures">
          <div class="print-sig-col">Academic Dean</div>
          <div class="print-sig-col">Controller of Examinations</div>
          <div class="print-sig-col">Principal / Director</div>
        </div>
      </div>
    `;

    const printArea = document.getElementById('printArea');
    if (printArea) {
      printArea.innerHTML = reportHTML;
      setTimeout(() => window.print(), 80);
    }
  }

  // --- Seed Realistic Demo Data ---
  async function seedInitialData(force = false) {
    if (!force && localStorage.getItem(STORAGE_KEYS.INIT_FLAG)) return;

    const adminHash = await hashPassword('admin123');
    const defaultPasswordHash = await hashPassword('student123');
    const lecturerPasswordHash = await hashPassword('teach123');

    setStorage(STORAGE_KEYS.BRANCHES, DEFAULT_BRANCHES);

    const users = [
      { id: 'admin', role: 'ADMIN', name: 'System Administrator', email: 'admin@college.edu', branch: 'ALL', password: adminHash, status: 'Approved' },
      { id: 'LEC-CSE-01', role: 'LECTURER', name: 'Dr. Alan Turing', email: 'alan@college.edu', branch: 'CSE', password: lecturerPasswordHash, status: 'Approved' },
      { id: 'LEC-ECE-01', role: 'LECTURER', name: 'Dr. Claude Shannon', email: 'claude@college.edu', branch: 'ECE', password: lecturerPasswordHash, status: 'Approved' },
      { id: 'LEC-MECH-01', role: 'LECTURER', name: 'Prof. James Watt', email: 'james@college.edu', branch: 'MECH', password: lecturerPasswordHash, status: 'Approved' },
      { id: 'LEC-CIVIL-01', role: 'LECTURER', name: 'Dr. Ada Lovelace', email: 'ada@college.edu', branch: 'CIVIL', password: lecturerPasswordHash, status: 'Pending' }
    ];

    const branchSubjects = {
      CSE: ['Data Structures', 'Database Systems', 'Operating Systems', 'Computer Networks'],
      ECE: ['Signals & Systems', 'Digital Electronics', 'VLSI Design', 'Electromagnetics'],
      EEE: ['Power Systems', 'Control Theory', 'Electric Machines', 'Circuit Analysis'],
      MECH: ['Thermodynamics', 'Fluid Mechanics', 'Strength of Materials', 'Manufacturing Tech'],
      CIVIL: ['Structural Analysis', 'Geotechnical Engg', 'Hydrology', 'Concrete Tech'],
      IT: ['Web Technologies', 'Cloud Computing', 'Cyber Security', 'Software Engineering']
    };

    const firstNames = ['Aarav', 'Diya', 'Rohan', 'Ananya', 'Kavya', 'Vikram', 'Meera', 'Aditya', 'Pooja', 'Rahul'];
    const lastNames = ['Sharma', 'Verma', 'Patel', 'Reddy', 'Iyer', 'Gupta', 'Singh', 'Nair', 'Rao', 'Das'];

    const marks = [];
    const attendance = [];
    const studyHours = [];

    DEFAULT_BRANCHES.forEach(branch => {
      for (let i = 1; i <= 5; i++) {
        const studentId = `STU-${branch}-${String(i).padStart(3, '0')}`;
        const name = `${firstNames[(i + branch.charCodeAt(0)) % firstNames.length]} ${lastNames[(i + branch.charCodeAt(1)) % lastNames.length]}`;
        const year = ((i % 4) + 1).toString();
        const semester = `${(Number(year) * 2) - (i % 2)}`;

        users.push({
          id: studentId,
          role: 'STUDENT',
          name,
          email: `${studentId.toLowerCase()}@college.edu`,
          branch,
          year,
          semester,
          password: defaultPasswordHash,
          status: 'Approved'
        });

        const subjects = branchSubjects[branch] || ['Subject 1', 'Subject 2'];
        subjects.forEach((subj, sIdx) => {
          marks.push({
            studentId,
            subject: subj,
            internal1: Math.floor(14 + Math.random() * 11),
            internal2: Math.floor(15 + Math.random() * 10),
            assignment: Math.floor(7 + Math.random() * 4),
            external: Math.floor(25 + Math.random() * 15),
            maxMarks: 100
          });

          const totalCls = 40 + Math.floor(Math.random() * 10);
          const attRate = (i === 4 && sIdx === 0) ? 0.68 : (0.76 + Math.random() * 0.22);
          attendance.push({
            studentId,
            subject: subj,
            totalClasses: totalCls,
            attendedClasses: Math.min(totalCls, Math.floor(totalCls * attRate))
          });
        });

        for (let d = 13; d >= 0; d--) {
          const date = new Date(Date.now() - d * 86400000).toISOString().split('T')[0];
          studyHours.push({ studentId, date, hours: Math.max(0.5, Math.round((1.5 + Math.random() * 3.5) * 10) / 10) });
        }
      }
    });

    setStorage(STORAGE_KEYS.USERS, users);
    setStorage(STORAGE_KEYS.MARKS, marks);
    setStorage(STORAGE_KEYS.ATTENDANCE, attendance);
    setStorage(STORAGE_KEYS.STUDY_HOURS, studyHours);
    localStorage.setItem(STORAGE_KEYS.INIT_FLAG, 'true');
  }

  // --- Auth Session ---
  function getSession() {
    try {
      const data = sessionStorage.getItem(STORAGE_KEYS.SESSION);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(user) {
    if (!user) {
      sessionStorage.removeItem(STORAGE_KEYS.SESSION);
    } else {
      const safe = { ...user };
      delete safe.password;
      sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(safe));
    }
  }

  function logout() {
    setSession(null);
    activeView = 'overview';
    destroyCharts();
    showToast('Logged out successfully', 'info');
    render();
  }

  // Global state
  let activeTabLogin = 'student';
  let activeView = 'overview';
  let activeBranchTab = 'CSE';
  let studentSearchQuery = '';
  let studentFilterYear = 'ALL';
  let studentFilterSemester = 'ALL';
  let studentSortBy = 'perf_desc';
  let currentChartInstances = [];

  function destroyCharts() {
    currentChartInstances.forEach(c => {
      try { c.destroy(); } catch (e) {}
    });
    currentChartInstances = [];
  }

  function updateLoginAccents() {
    const root = document.documentElement;
    if (activeTabLogin === 'student') {
      root.style.setProperty('--accent', '#0284c7');
      root.style.setProperty('--accent-glow', 'rgba(2, 132, 199, 0.35)');
      root.style.setProperty('--accent-gradient', 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)');
    } else if (activeTabLogin === 'lecturer') {
      root.style.setProperty('--accent', '#059669');
      root.style.setProperty('--accent-glow', 'rgba(5, 150, 105, 0.35)');
      root.style.setProperty('--accent-gradient', 'linear-gradient(135deg, #059669 0%, #10b981 100%)');
    } else {
      root.style.setProperty('--accent', '#db2777');
      root.style.setProperty('--accent-glow', 'rgba(219, 39, 119, 0.35)');
      root.style.setProperty('--accent-gradient', 'linear-gradient(135deg, #db2777 0%, #ea580c 100%)');
    }
  }

  // --- Render Router ---
  function render() {
    destroyCharts();
    const app = document.getElementById('app');
    if (!app) return;

    const session = getSession();
    if (!session) {
      renderLoginPage(app);
      return;
    }

    if (session.role === 'STUDENT') {
      renderStudentDashboard(app, session);
    } else if (session.role === 'LECTURER') {
      renderLecturerDashboard(app, session);
    } else if (session.role === 'ADMIN') {
      renderAdminDashboard(app, session);
    } else {
      logout();
    }
  }

  // =========================================================================
  // LOGIN PAGE: APEX INSTITUTE OF TECHNOLOGY & SCIENCE BACKGROUND + CENTERED SIGN-IN
  // =========================================================================
  function renderLoginPage(container) {
    updateLoginAccents();
    const rememberedId = localStorage.getItem(STORAGE_KEYS.REMEMBER_ID) || '';
    const isDark = document.body.classList.contains('dark-theme');

    container.innerHTML = `
      <div class="login-container">
        <!-- Background Grid & Architectural Pattern -->
        <div class="bg-grid-pattern"></div>

        <!-- Massive Ambient College Background Watermark -->
        <div class="bg-watermark">
          <div class="bg-watermark-row">${escapeHTML(COLLEGE_NAME)}</div>
          <div class="bg-watermark-row">ACADEMIC INTELLIGENCE & PERFORMANCE</div>
          <div class="bg-watermark-row">${escapeHTML(COLLEGE_NAME)}</div>
        </div>

        <!-- Floating Glow Orbs in Background -->
        <div class="bubble bubble-1"></div>
        <div class="bubble bubble-2"></div>
        <div class="bubble bubble-3"></div>
        <div class="bubble bubble-4"></div>

        <!-- Top Right Theme Toggle -->
        <div class="login-theme-btn-wrap">
          <button class="theme-toggle-btn" id="login-theme-toggle" aria-label="Toggle theme">
            ${isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>

        <!-- Ambient College Background Header -->
        <div class="login-college-header">
          <div class="college-crest-box">
            <svg width="30" height="30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>
          </div>
          <div>
            <div class="college-badge-pill">
              <span>●</span> Autonomous Institution • NAAC A++ Grade
            </div>
            <h1 class="login-college-title">${escapeHTML(COLLEGE_NAME)}</h1>
            <div class="login-college-meta">
              <span>Engineering & Technology</span>
              <span>•</span>
              <span>Est. 2007</span>
              <span>•</span>
              <span>Academic Performance Portal</span>
            </div>
          </div>
        </div>

        <!-- Middle Centered Sign In to Portal Card -->
        <div class="login-card-wrapper">
          <div class="glass-card" id="login-glass-card">
            <div style="margin-bottom: 20px; text-align: center;">
              <h2 style="font-size: 22px; font-weight: 800; color: var(--text); letter-spacing: -0.4px;">Sign In to Portal</h2>
              <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Choose your institutional role and enter credentials</p>
            </div>

            <!-- Role Selector Tabs -->
            <div class="role-tabs-wrap">
              <button class="role-tab-btn ${activeTabLogin === 'student' ? 'active' : ''}" data-tab="student">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>
                Student
              </button>
              <button class="role-tab-btn ${activeTabLogin === 'lecturer' ? 'active' : ''}" data-tab="lecturer">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                Lecturer
              </button>
              <button class="role-tab-btn ${activeTabLogin === 'admin' ? 'active' : ''}" data-tab="admin">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                Admin
              </button>
            </div>

            <div id="login-error-msg" style="display: none; padding: 10px 14px; background: rgba(239, 68, 68, 0.12); border: 1px solid #ef4444; color: #dc2626; border-radius: 8px; font-size: 13px; margin-bottom: 16px;"></div>

            <!-- Login Form -->
            <form id="login-form">
              <div class="form-group">
                <label class="form-label" for="login-id">
                  ${activeTabLogin === 'student' ? 'Student Roll Number / ID' : activeTabLogin === 'lecturer' ? 'Lecturer ID or Email' : 'Admin Username'}
                </label>
                <div class="input-with-icon">
                  <div class="input-icon-left">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                  </div>
                  <input type="text" id="login-id" class="form-input" required autocomplete="username"
                    value="${escapeHTML(rememberedId)}"
                    placeholder="${activeTabLogin === 'student' ? 'e.g. STU-CSE-001' : activeTabLogin === 'lecturer' ? 'e.g. LEC-CSE-01 or alan@college.edu' : 'e.g. admin'}">
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="login-pwd">Password</label>
                <div class="input-with-icon">
                  <div class="input-icon-left">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  </div>
                  <input type="password" id="login-pwd" class="form-input" required autocomplete="current-password" placeholder="Enter your password">
                  <button type="button" class="pwd-toggle-btn" id="toggle-pwd-btn" aria-label="Toggle password visibility">
                    <svg id="eye-icon" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  </button>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; font-size: 13px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text-muted);">
                  <input type="checkbox" id="remember-me-chk" ${rememberedId ? 'checked' : ''}>
                  Remember my ID
                </label>
                ${activeTabLogin === 'admin' ? `
                  <span style="font-size: 11px; color: var(--text-muted);">Default: admin / admin123</span>
                ` : ''}
              </div>

              <button type="submit" class="btn-login-gradient" id="btn-submit-login">
                <span id="login-btn-text">Sign In</span>
              </button>
            </form>

            ${activeTabLogin === 'lecturer' ? `
              <div style="text-align: center; margin-top: 16px; font-size: 13px; color: var(--text-muted);">
                New faculty member? <a id="open-lecturer-reg" style="font-weight: 700; color: var(--accent);">Register as Lecturer</a>
              </div>
            ` : ''}

            <!-- Collapsible Demo Credentials Help Box -->
            <details style="margin-top: 24px; border: 1px dashed var(--card-border); border-radius: 10px; padding: 10px 14px; background: rgba(0,0,0,0.015);">
              <summary style="font-size: 12px; font-weight: 700; cursor: pointer; color: var(--text-muted); outline: none;">
                Quick Demo Credentials (Click to Autofill)
              </summary>
              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px; font-size: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span><strong>Admin:</strong> admin / admin123</span>
                  <button class="btn btn-secondary btn-sm autofill-btn" data-role="admin" data-id="admin" data-pwd="admin123" style="padding: 2px 8px; font-size: 11px;">Autofill</button>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span><strong>Lecturer (CSE):</strong> LEC-CSE-01 / teach123</span>
                  <button class="btn btn-secondary btn-sm autofill-btn" data-role="lecturer" data-id="LEC-CSE-01" data-pwd="teach123" style="padding: 2px 8px; font-size: 11px;">Autofill</button>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span><strong>Student (CSE):</strong> STU-CSE-001 / student123</span>
                  <button class="btn btn-secondary btn-sm autofill-btn" data-role="student" data-id="STU-CSE-001" data-pwd="student123" style="padding: 2px 8px; font-size: 11px;">Autofill</button>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span><strong>Pending Lecturer:</strong> ada@college.edu / teach123</span>
                  <button class="btn btn-secondary btn-sm autofill-btn" data-role="lecturer" data-id="ada@college.edu" data-pwd="teach123" style="padding: 2px 8px; font-size: 11px;">Autofill</button>
                </div>
              </div>
            </details>

          </div>
        </div>

        <!-- Institutional Footer -->
        <div class="login-footer-copy">
          &copy; ${escapeHTML(COLLEGE_NAME)} • Autonomous Institution • Student Academic Performance System
        </div>
      </div>
    `;

    // Hook listeners
    document.getElementById('login-theme-toggle')?.addEventListener('click', toggleTheme);

    container.querySelectorAll('.role-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTabLogin = btn.getAttribute('data-tab');
        render();
      });
    });

    const pwdIn = document.getElementById('login-pwd');
    const toggleBtn = document.getElementById('toggle-pwd-btn');
    toggleBtn?.addEventListener('click', () => {
      if (pwdIn.type === 'password') {
        pwdIn.type = 'text';
      } else {
        pwdIn.type = 'password';
      }
    });

    container.querySelectorAll('.autofill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const role = btn.getAttribute('data-role');
        const id = btn.getAttribute('data-id');
        const pwd = btn.getAttribute('data-pwd');
        activeTabLogin = role;
        render();
        setTimeout(() => {
          const idEl = document.getElementById('login-id');
          const pwdEl = document.getElementById('login-pwd');
          if (idEl) idEl.value = id;
          if (pwdEl) pwdEl.value = pwd;
        }, 50);
      });
    });

    document.getElementById('open-lecturer-reg')?.addEventListener('click', openLecturerRegisterModal);

    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const idVal = document.getElementById('login-id').value.trim();
      const pwdVal = document.getElementById('login-pwd').value;
      const rememberMe = document.getElementById('remember-me-chk')?.checked;
      const errorDiv = document.getElementById('login-error-msg');
      const card = document.getElementById('login-glass-card');
      const submitBtn = document.getElementById('btn-submit-login');
      const btnText = document.getElementById('login-btn-text');

      if (!idVal || !pwdVal) {
        errorDiv.textContent = 'Please enter both ID and Password.';
        errorDiv.style.display = 'block';
        return;
      }

      // Show spinner for 600ms
      submitBtn.disabled = true;
      btnText.innerHTML = '<span class="btn-spinner"></span> Authenticating...';

      await new Promise(r => setTimeout(r, 600));

      const users = getStorage(STORAGE_KEYS.USERS, []);
      const hashed = await hashPassword(pwdVal);

      const user = users.find(u => {
        if (activeTabLogin === 'admin') {
          return u.role === 'ADMIN' && (u.id.toLowerCase() === idVal.toLowerCase() || u.email.toLowerCase() === idVal.toLowerCase());
        } else if (activeTabLogin === 'lecturer') {
          return u.role === 'LECTURER' && (u.id.toLowerCase() === idVal.toLowerCase() || u.email.toLowerCase() === idVal.toLowerCase());
        } else {
          return u.role === 'STUDENT' && (u.id.toLowerCase() === idVal.toLowerCase());
        }
      });

      submitBtn.disabled = false;
      btnText.textContent = 'Sign In';

      if (!user || user.password !== hashed) {
        errorDiv.textContent = 'Invalid credentials. Please verify your ID and password.';
        errorDiv.style.display = 'block';
        card?.classList.remove('shake-animation');
        void card?.offsetWidth; // trigger reflow
        card?.classList.add('shake-animation');
        return;
      }

      if (user.status === 'Pending') {
        errorDiv.textContent = 'Your account is awaiting admin approval. Please check back later.';
        errorDiv.style.display = 'block';
        card?.classList.add('shake-animation');
        return;
      }
      if (user.status === 'Blocked') {
        errorDiv.textContent = 'Your account has been blocked by the administrator.';
        errorDiv.style.display = 'block';
        card?.classList.add('shake-animation');
        return;
      }
      if (user.status === 'Rejected') {
        errorDiv.textContent = 'Your lecturer registration was rejected by the administrator.';
        errorDiv.style.display = 'block';
        card?.classList.add('shake-animation');
        return;
      }

      // Handle Remember Me
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEYS.REMEMBER_ID, idVal);
      } else {
        localStorage.removeItem(STORAGE_KEYS.REMEMBER_ID);
      }

      setSession(user);
      showToast(`Welcome back, ${user.name}!`, 'success');
      render();
    });
  }

  // --- Lecturer Registration Modal ---
  function openLecturerRegisterModal() {
    const branches = getStorage(STORAGE_KEYS.BRANCHES, DEFAULT_BRANCHES);
    showModal({
      title: 'Register as Faculty / Lecturer',
      bodyHTML: `
        <form id="lecturer-reg-form">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="reg-name" class="form-input" required placeholder="e.g. Dr. John Doe">
          </div>
          <div class="form-group">
            <label class="form-label">Official Email</label>
            <input type="email" id="reg-email" class="form-input" required placeholder="e.g. john@college.edu">
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Lecturer ID</label>
              <input type="text" id="reg-id" class="form-input" required placeholder="e.g. LEC-CSE-02">
            </div>
            <div class="form-group">
              <label class="form-label">Branch</label>
              <select id="reg-branch" class="form-select" required>
                ${branches.map(b => `<option value="${escapeHTML(b)}">${escapeHTML(b)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="reg-pwd" class="form-input" required minlength="6" placeholder="••••••••">
            </div>
            <div class="form-group">
              <label class="form-label">Confirm Password</label>
              <input type="password" id="reg-pwd-confirm" class="form-input" required minlength="6" placeholder="••••••••">
            </div>
          </div>
          <div id="reg-err" style="display:none; color: var(--danger); font-size: 12px; margin-bottom: 10px;"></div>
          <button type="submit" class="btn btn-primary" style="width: 100%;">Submit Registration</button>
        </form>
      `
    });

    document.getElementById('lecturer-reg-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim().toLowerCase();
      const id = document.getElementById('reg-id').value.trim();
      const branch = document.getElementById('reg-branch').value;
      const pwd = document.getElementById('reg-pwd').value;
      const pwdConfirm = document.getElementById('reg-pwd-confirm').value;
      const errBox = document.getElementById('reg-err');

      if (pwd !== pwdConfirm) {
        errBox.textContent = 'Passwords do not match.';
        errBox.style.display = 'block';
        return;
      }
      const users = getStorage(STORAGE_KEYS.USERS, []);
      if (users.some(u => u.id.toLowerCase() === id.toLowerCase())) {
        errBox.textContent = 'A user with this Lecturer ID already exists.';
        errBox.style.display = 'block';
        return;
      }
      if (users.some(u => u.email.toLowerCase() === email)) {
        errBox.textContent = 'A user with this email already exists.';
        errBox.style.display = 'block';
        return;
      }

      users.push({
        id,
        role: 'LECTURER',
        name,
        email,
        branch,
        password: await hashPassword(pwd),
        status: 'Pending'
      });
      setStorage(STORAGE_KEYS.USERS, users);
      closeModal();
      showToast('Registration submitted! Your account is awaiting admin approval.', 'success');
    });
  }

  // --- Change Password Modal ---
  function openChangePasswordModal(user) {
    showModal({
      title: 'Change Password',
      bodyHTML: `
        <form id="change-pwd-form">
          <div class="form-group">
            <label class="form-label">Current Password</label>
            <input type="password" id="cp-old" class="form-input" required placeholder="Enter current password">
          </div>
          <div class="form-group">
            <label class="form-label">New Password</label>
            <input type="password" id="cp-new" class="form-input" required minlength="6" placeholder="At least 6 characters">
          </div>
          <div class="form-group">
            <label class="form-label">Confirm New Password</label>
            <input type="password" id="cp-confirm" class="form-input" required minlength="6" placeholder="Confirm new password">
          </div>
          <div id="cp-err" style="display:none; color: var(--danger); font-size: 12px; margin-bottom: 10px;"></div>
          <button type="submit" class="btn btn-primary" style="width: 100%;">Update Password</button>
        </form>
      `
    });

    document.getElementById('change-pwd-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const oldPwd = document.getElementById('cp-old').value;
      const newPwd = document.getElementById('cp-new').value;
      const confirmPwd = document.getElementById('cp-confirm').value;
      const errBox = document.getElementById('cp-err');

      if (newPwd !== confirmPwd) {
        errBox.textContent = 'New passwords do not match.';
        errBox.style.display = 'block';
        return;
      }
      const users = getStorage(STORAGE_KEYS.USERS, []);
      const idx = users.findIndex(u => u.id === user.id);
      if (idx === -1) return;

      if (users[idx].password !== await hashPassword(oldPwd)) {
        errBox.textContent = 'Current password is incorrect.';
        errBox.style.display = 'block';
        return;
      }

      users[idx].password = await hashPassword(newPwd);
      setStorage(STORAGE_KEYS.USERS, users);
      closeModal();
      showToast('Password updated successfully', 'success');
    });
  }

  function renderFormulaCard() {
    return `
      <div class="card" style="margin-bottom: 20px; background: rgba(0,0,0,0.015); border-left: 4px solid var(--primary);">
        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">
          Performance Formula & Scoring Criteria
        </div>
        <div style="font-size: 13px; color: var(--text); line-height: 1.5;">
          <strong>Performance Score</strong> = <code>0.5 × Marks% + 0.3 × Attendance% + 0.2 × StudyScore</code><br>
          <span style="font-size: 12px; color: var(--text-muted);">
            • <em>Marks%</em> = (Total Obtained / Total Max) × 100 &nbsp;|&nbsp;
            • <em>Attendance%</em> = (Attended / Total Classes) × 100 &nbsp;|&nbsp;
            • <em>Study Score</em> = min(Avg Weekly Hours / 20, 1) × 100
          </span>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // STUDENT DASHBOARD
  // =========================================================================
  function renderStudentDashboard(container, session) {
    const isDark = document.body.classList.contains('dark-theme');
    const perf = calculateStudentPerformance(session.id);
    const marks = getStorage(STORAGE_KEYS.MARKS, []).filter(m => m.studentId === session.id);
    const attendance = getStorage(STORAGE_KEYS.ATTENDANCE, []).filter(a => a.studentId === session.id);
    const studyHours = getStorage(STORAGE_KEYS.STUDY_HOURS, []).filter(h => h.studentId === session.id)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const branchStudents = getStorage(STORAGE_KEYS.USERS, []).filter(u => u.role === 'STUDENT' && u.branch === session.branch && u.status === 'Approved');
    const branchScores = branchStudents.map(s => ({
      id: s.id,
      score: calculateStudentPerformance(s.id).performanceScore
    })).sort((a, b) => b.score - a.score);

    const rank = branchScores.findIndex(s => s.id === session.id) + 1;
    const totalBranchStudents = branchScores.length;

    container.innerHTML = `
      <div class="app-shell">
        <div class="main-area">
          <div class="topbar">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="brand-title">College Student Portal</span>
              <span class="role-tag role-student">Student</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <button class="theme-toggle-btn" id="dash-theme-toggle">${isDark ? '☀️' : '🌙'}</button>
              <button class="btn btn-primary btn-sm" id="btn-print-student-report">
                🖨️ Print Report
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-change-pwd">Change Password</button>
              <button class="btn btn-danger btn-sm" id="btn-logout">Logout</button>
            </div>
          </div>

          <div class="content-body">
            <div class="card" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
              <div>
                <h2 style="font-size: 20px; font-weight: 800; color: var(--text);">${escapeHTML(session.name)}</h2>
                <div style="display: flex; gap: 16px; font-size: 13px; color: var(--text-muted); margin-top: 4px; flex-wrap: wrap;">
                  <span><strong>Roll No:</strong> ${escapeHTML(session.id)}</span>
                  <span><strong>Branch:</strong> ${escapeHTML(session.branch)}</span>
                  <span><strong>Year / Sem:</strong> Year ${escapeHTML(session.year)}, Sem ${escapeHTML(session.semester)}</span>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">BRANCH RANK</div>
                <div style="font-size: 24px; font-weight: 800; color: var(--primary);">#${rank} <span style="font-size: 14px; font-weight: 500; color: var(--text-muted);">/ ${totalBranchStudents}</span></div>
              </div>
            </div>

            ${renderFormulaCard()}

            <div class="grid-4" style="margin-bottom: 20px;">
              <div class="card">
                <div class="stat-label">Overall Marks</div>
                <div class="stat-value tabular-nums">${perf.marksPct}%</div>
                <div class="stat-sub">Across all enrolled subjects</div>
              </div>
              <div class="card">
                <div class="stat-label">Attendance</div>
                <div class="stat-value tabular-nums" style="color: ${perf.hasShortage ? 'var(--danger)' : 'inherit'};">
                  ${perf.attendancePct}%
                </div>
                <div class="stat-sub">
                  ${perf.hasShortage ? '<span style="color: var(--danger); font-weight: 700;">Shortage Warning (&lt;75%)</span>' : `${perf.attendedClasses} / ${perf.totalClasses} classes`}
                </div>
              </div>
              <div class="card">
                <div class="stat-label">Avg Weekly Study</div>
                <div class="stat-value tabular-nums">${perf.weeklyAvgHours} hrs</div>
                <div class="stat-sub">Study Score: ${perf.studyScore}/100</div>
              </div>
              <div class="card">
                <div class="stat-label">Performance Score</div>
                <div class="stat-value tabular-nums" style="color: var(--primary);">${perf.performanceScore}</div>
                <div class="stat-sub"><span class="badge ${perf.badgeClass}">${perf.grade}</span></div>
              </div>
            </div>

            <div class="grid-3" style="margin-bottom: 24px;">
              <div class="card">
                <div style="font-weight: 700; font-size: 13px; margin-bottom: 12px;">Subject Marks (%)</div>
                <div style="height: 220px; position: relative;"><canvas id="student-marks-chart"></canvas></div>
              </div>
              <div class="card">
                <div style="font-weight: 700; font-size: 13px; margin-bottom: 12px;">Attendance (%)</div>
                <div style="height: 220px; position: relative;"><canvas id="student-att-chart"></canvas></div>
              </div>
              <div class="card">
                <div style="font-weight: 700; font-size: 13px; margin-bottom: 12px;">Study Hours Trend</div>
                <div style="height: 220px; position: relative;"><canvas id="student-study-chart"></canvas></div>
              </div>
            </div>

            <div class="card" style="margin-bottom: 20px;">
              <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px;">Subject-wise Marks Breakdown</div>
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Int 1</th>
                      <th>Int 2</th>
                      <th>Assign</th>
                      <th>Ext</th>
                      <th>Total</th>
                      <th>Max</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${marks.map(m => {
                      const tot = (Number(m.internal1)||0) + (Number(m.internal2)||0) + (Number(m.assignment)||0) + (Number(m.external)||0);
                      const mx = Number(m.maxMarks) || 100;
                      const pct = Math.round((tot / mx) * 100);
                      return `
                        <tr>
                          <td><strong>${escapeHTML(m.subject)}</strong></td>
                          <td class="tabular-nums">${m.internal1}</td>
                          <td class="tabular-nums">${m.internal2}</td>
                          <td class="tabular-nums">${m.assignment}</td>
                          <td class="tabular-nums">${m.external}</td>
                          <td class="tabular-nums"><strong>${tot}</strong></td>
                          <td class="tabular-nums">${mx}</td>
                          <td class="tabular-nums" style="font-weight: 700;">${pct}%</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="card">
              <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px;">Subject-wise Attendance</div>
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Attended</th>
                      <th>Total</th>
                      <th>Progress</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${attendance.map(a => {
                      const tot = Number(a.totalClasses) || 0;
                      const att = Number(a.attendedClasses) || 0;
                      const pct = tot > 0 ? Math.round((att / tot) * 100) : 0;
                      return `
                        <tr>
                          <td><strong>${escapeHTML(a.subject)}</strong></td>
                          <td class="tabular-nums">${att}</td>
                          <td class="tabular-nums">${tot}</td>
                          <td style="min-width: 140px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                              <div class="progress-bar-bg" style="flex: 1;">
                                <div class="progress-bar-fill" style="width: ${pct}%; background: ${pct < 75 ? 'var(--danger)' : 'var(--primary)'};"></div>
                              </div>
                              <span class="tabular-nums">${pct}%</span>
                            </div>
                          </td>
                          <td>${pct < 75 ? '<span class="badge badge-needs-imp">Shortage</span>' : '<span class="badge badge-excellent">OK</span>'}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    document.getElementById('dash-theme-toggle')?.addEventListener('click', toggleTheme);
    document.getElementById('btn-logout')?.addEventListener('click', logout);
    document.getElementById('btn-change-pwd')?.addEventListener('click', () => openChangePasswordModal(session));
    document.getElementById('btn-print-student-report')?.addEventListener('click', () => printStudentReport(session.id));

    setTimeout(() => {
      const ctxMarks = document.getElementById('student-marks-chart');
      if (ctxMarks && window.Chart) {
        currentChartInstances.push(new Chart(ctxMarks, {
          type: 'bar',
          data: {
            labels: marks.map(m => m.subject),
            datasets: [{
              label: 'Marks %',
              data: marks.map(m => {
                const tot = (Number(m.internal1)||0) + (Number(m.internal2)||0) + (Number(m.assignment)||0) + (Number(m.external)||0);
                return Math.round((tot / (Number(m.maxMarks)||100)) * 100);
              }),
              backgroundColor: '#3b82f6',
              borderRadius: 4
            }]
          },
          options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }
        }));
      }

      const ctxAtt = document.getElementById('student-att-chart');
      if (ctxAtt && window.Chart) {
        currentChartInstances.push(new Chart(ctxAtt, {
          type: 'doughnut',
          data: {
            labels: attendance.map(a => a.subject),
            datasets: [{
              data: attendance.map(a => Math.round(((Number(a.attendedClasses)||0) / (Number(a.totalClasses)||1)) * 100)),
              backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']
            }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        }));
      }

      const ctxStudy = document.getElementById('student-study-chart');
      if (ctxStudy && window.Chart) {
        currentChartInstances.push(new Chart(ctxStudy, {
          type: 'line',
          data: {
            labels: studyHours.slice(-10).map(h => h.date.slice(5)),
            datasets: [{
              label: 'Hours',
              data: studyHours.slice(-10).map(h => h.hours),
              borderColor: '#10b981',
              tension: 0.3,
              fill: true,
              backgroundColor: 'rgba(16, 185, 129, 0.1)'
            }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        }));
      }
    }, 50);
  }

  // =========================================================================
  // LECTURER DASHBOARD
  // =========================================================================
  let lecturerActiveTab = 'students';

  function renderLecturerDashboard(container, session) {
    const isDark = document.body.classList.contains('dark-theme');
    const branch = session.branch;
    const allUsers = getStorage(STORAGE_KEYS.USERS, []);
    const branchStudents = allUsers.filter(u => u.role === 'STUDENT' && u.branch === branch);

    let tM = 0, tA = 0, tS = 0, tP = 0;
    const studentPerfs = branchStudents.map(s => {
      const p = calculateStudentPerformance(s.id);
      tM += p.marksPct; tA += p.attendancePct; tS += p.weeklyAvgHours; tP += p.performanceScore;
      return { student: s, perf: p };
    });

    const count = branchStudents.length;
    const avgMarks = count > 0 ? Math.round((tM / count) * 10) / 10 : 0;
    const avgAtt = count > 0 ? Math.round((tA / count) * 10) / 10 : 0;
    const avgStudy = count > 0 ? Math.round((tS / count) * 10) / 10 : 0;
    const avgPerf = count > 0 ? Math.round((tP / count) * 10) / 10 : 0;

    let filtered = studentPerfs.filter(item => {
      const s = item.student;
      if (studentSearchQuery) {
        const q = studentSearchQuery.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false;
      }
      if (studentFilterYear !== 'ALL' && s.year !== studentFilterYear) return false;
      if (studentFilterSemester !== 'ALL' && s.semester !== studentFilterSemester) return false;
      return true;
    });

    filtered.sort((a, b) => {
      if (studentSortBy === 'perf_desc') return b.perf.performanceScore - a.perf.performanceScore;
      if (studentSortBy === 'perf_asc') return a.perf.performanceScore - b.perf.performanceScore;
      if (studentSortBy === 'name_asc') return a.student.name.localeCompare(b.student.name);
      return 0;
    });

    container.innerHTML = `
      <div class="app-shell">
        <div class="main-area">
          <div class="topbar">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="brand-title">Lecturer Portal</span>
              <span class="role-tag role-lecturer">Dept: ${escapeHTML(branch)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <button class="theme-toggle-btn" id="dash-theme-toggle">${isDark ? '☀️' : '🌙'}</button>
              <button class="btn btn-primary btn-sm" id="btn-print-branch-report">
                🖨️ Print Branch Report
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-change-pwd">Change Password</button>
              <button class="btn btn-danger btn-sm" id="btn-logout">Logout</button>
            </div>
          </div>

          <div class="content-body">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
              <div>
                <h2 style="font-size: 20px; font-weight: 800; color: var(--text);">${escapeHTML(branch)} Department Overview</h2>
                <p style="font-size: 13px; color: var(--text-muted);">${count} registered students</p>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="btn ${lecturerActiveTab === 'students' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="tab-lec-stus">Student Directory</button>
                <button class="btn ${lecturerActiveTab === 'bulk' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="tab-lec-bulk">Bulk Entry Grid</button>
                <button class="btn btn-primary btn-sm" id="btn-add-stu">+ Add Student</button>
              </div>
            </div>

            ${renderFormulaCard()}

            <div class="grid-4" style="margin-bottom: 20px;">
              <div class="card">
                <div class="stat-label">Students</div>
                <div class="stat-value tabular-nums">${count}</div>
              </div>
              <div class="card">
                <div class="stat-label">Avg Marks</div>
                <div class="stat-value tabular-nums">${avgMarks}%</div>
              </div>
              <div class="card">
                <div class="stat-label">Avg Attendance</div>
                <div class="stat-value tabular-nums" style="color: ${avgAtt < 75 ? 'var(--danger)' : 'inherit'};">${avgAtt}%</div>
              </div>
              <div class="card">
                <div class="stat-label">Avg Performance</div>
                <div class="stat-value tabular-nums" style="color: var(--primary);">${avgPerf}</div>
              </div>
            </div>

            ${lecturerActiveTab === 'students' ? `
              <div class="card">
                <div style="display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; justify-content: space-between;">
                  <input type="text" id="lec-search" class="form-input" style="max-width: 320px;" placeholder="Search by name or roll no..." value="${escapeHTML(studentSearchQuery)}">
                  <div style="display: flex; gap: 8px;">
                    <select id="lec-filter-year" class="form-select" style="width: auto;">
                      <option value="ALL">All Years</option>
                      ${[1,2,3,4].map(y => `<option value="${y}" ${studentFilterYear === String(y)?'selected':''}>Year ${y}</option>`).join('')}
                    </select>
                    <select id="lec-sort" class="form-select" style="width: auto;">
                      <option value="perf_desc" ${studentSortBy === 'perf_desc' ? 'selected' : ''}>Performance (High &rarr; Low)</option>
                      <option value="perf_asc" ${studentSortBy === 'perf_asc' ? 'selected' : ''}>Performance (Low &rarr; High)</option>
                      <option value="name_asc" ${studentSortBy === 'name_asc' ? 'selected' : ''}>Name</option>
                    </select>
                  </div>
                </div>

                <div class="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Roll No</th>
                        <th>Student Name</th>
                        <th>Year</th>
                        <th>Marks %</th>
                        <th>Attendance %</th>
                        <th>Study</th>
                        <th>Score</th>
                        <th>Grade</th>
                        <th style="text-align: right;">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filtered.map(item => `
                        <tr>
                          <td><strong>${escapeHTML(item.student.id)}</strong></td>
                          <td>${escapeHTML(item.student.name)}</td>
                          <td>Y${escapeHTML(item.student.year)} S${escapeHTML(item.student.semester)}</td>
                          <td class="tabular-nums">${item.perf.marksPct}%</td>
                          <td class="tabular-nums" style="color: ${item.perf.hasShortage ? 'var(--danger)' : 'inherit'}; font-weight: ${item.perf.hasShortage ? '700' : 'normal'};">
                            ${item.perf.attendancePct}% ${item.perf.hasShortage ? '(Shortage)' : ''}
                          </td>
                          <td class="tabular-nums">${item.perf.weeklyAvgHours}h</td>
                          <td class="tabular-nums"><strong>${item.perf.performanceScore}</strong></td>
                          <td><span class="badge ${item.perf.badgeClass}">${item.perf.grade}</span></td>
                          <td style="text-align: right;">
                            <button class="btn btn-secondary btn-sm action-view-stu" data-id="${escapeHTML(item.student.id)}">View Details</button>
                            <button class="btn btn-primary btn-sm action-print-stu" data-id="${escapeHTML(item.student.id)}">🖨️</button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : `
              <div class="card">
                <div style="font-weight: 700; margin-bottom: 12px;">Bulk Marks & Attendance Entry</div>
                <div class="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Roll No</th>
                        <th>Name</th>
                        <th>Subject</th>
                        <th>Int 1 (25)</th>
                        <th>Int 2 (25)</th>
                        <th>Assign (10)</th>
                        <th>Ext (40)</th>
                        <th>Attended</th>
                        <th>Total Cls</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${branchStudents.map(s => `
                        <tr class="bulk-row" data-id="${escapeHTML(s.id)}">
                          <td><strong>${escapeHTML(s.id)}</strong></td>
                          <td>${escapeHTML(s.name)}</td>
                          <td><input type="text" class="form-input b-sub" style="width: 130px;" value="Core Subject 1"></td>
                          <td><input type="number" class="form-input b-i1" style="width: 60px;" min="0" max="25" value="18"></td>
                          <td><input type="number" class="form-input b-i2" style="width: 60px;" min="0" max="25" value="19"></td>
                          <td><input type="number" class="form-input b-as" style="width: 60px;" min="0" max="10" value="8"></td>
                          <td><input type="number" class="form-input b-ex" style="width: 60px;" min="0" max="40" value="30"></td>
                          <td><input type="number" class="form-input b-at" style="width: 60px;" min="0" value="35"></td>
                          <td><input type="number" class="form-input b-tt" style="width: 60px;" min="1" value="40"></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
                <div style="margin-top: 14px; text-align: right;">
                  <button class="btn btn-primary" id="btn-save-bulk-all">Save All Changes</button>
                </div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    document.getElementById('dash-theme-toggle')?.addEventListener('click', toggleTheme);
    document.getElementById('btn-logout')?.addEventListener('click', logout);
    document.getElementById('btn-change-pwd')?.addEventListener('click', () => openChangePasswordModal(session));
    document.getElementById('btn-print-branch-report')?.addEventListener('click', () => printBranchReport(branch));
    document.getElementById('tab-lec-stus')?.addEventListener('click', () => { lecturerActiveTab = 'students'; render(); });
    document.getElementById('tab-lec-bulk')?.addEventListener('click', () => { lecturerActiveTab = 'bulk'; render(); });
    document.getElementById('btn-add-stu')?.addEventListener('click', () => openAddStudentModal(branch));

    const searchIn = document.getElementById('lec-search');
    searchIn?.addEventListener('input', (e) => {
      studentSearchQuery = e.target.value;
      render();
      const inEl = document.getElementById('lec-search');
      if (inEl) { inEl.focus(); inEl.setSelectionRange(inEl.value.length, inEl.value.length); }
    });

    container.querySelectorAll('.action-view-stu').forEach(btn => {
      btn.addEventListener('click', () => openStudentDetailModal(btn.getAttribute('data-id'), branch, false));
    });

    container.querySelectorAll('.action-print-stu').forEach(btn => {
      btn.addEventListener('click', () => printStudentReport(btn.getAttribute('data-id')));
    });

    document.getElementById('btn-save-bulk-all')?.addEventListener('click', () => {
      showToast('Bulk entries saved successfully', 'success');
    });
  }

  // =========================================================================
  // ADMIN DASHBOARD
  // =========================================================================
  function renderAdminDashboard(container, session) {
    const isDark = document.body.classList.contains('dark-theme');
    const branches = getStorage(STORAGE_KEYS.BRANCHES, DEFAULT_BRANCHES);
    const allUsers = getStorage(STORAGE_KEYS.USERS, []);
    const students = allUsers.filter(u => u.role === 'STUDENT');
    const lecturers = allUsers.filter(u => u.role === 'LECTURER');
    const pendingLecturers = lecturers.filter(u => u.status === 'Pending');

    let colMarks = 0, colAtt = 0, colStudy = 0, colPerf = 0;
    const scoredStudents = students.map(s => {
      const p = calculateStudentPerformance(s.id);
      colMarks += p.marksPct; colAtt += p.attendancePct; colStudy += p.weeklyAvgHours; colPerf += p.performanceScore;
      return { student: s, perf: p };
    });

    const sCount = students.length;
    const colAvgMarks = sCount > 0 ? Math.round((colMarks / sCount) * 10) / 10 : 0;
    const colAvgAtt = sCount > 0 ? Math.round((colAtt / sCount) * 10) / 10 : 0;
    const colAvgPerf = sCount > 0 ? Math.round((colPerf / sCount) * 10) / 10 : 0;

    container.innerHTML = `
      <div class="app-shell">
        <div class="sidebar">
          <div class="sidebar-header">
            <div class="brand-title">Admin Console</div>
            <div class="brand-sub">${escapeHTML(COLLEGE_NAME)}</div>
          </div>
          <div class="sidebar-nav">
            <button class="nav-btn ${activeView === 'overview' ? 'active' : ''}" data-view="overview"><span>Overview</span></button>
            <button class="nav-btn ${activeView === 'branches' ? 'active' : ''}" data-view="branches"><span>Branches</span></button>
            <button class="nav-btn ${activeView === 'students' ? 'active' : ''}" data-view="students"><span>Students</span></button>
            <button class="nav-btn ${activeView === 'lecturers' ? 'active' : ''}" data-view="lecturers"><span>Lecturers</span></button>
            <button class="nav-btn ${activeView === 'requests' ? 'active' : ''}" data-view="requests">
              <span>Requests</span>
              ${pendingLecturers.length > 0 ? `<span class="nav-badge">${pendingLecturers.length}</span>` : ''}
            </button>
          </div>
          <div class="sidebar-footer">
            <button class="btn btn-secondary btn-sm" id="btn-admin-pwd" style="width: 100%; margin-bottom: 6px;">Change Password</button>
            <button class="btn btn-danger btn-sm" id="btn-logout" style="width: 100%;">Sign Out</button>
          </div>
        </div>

        <div class="main-area">
          <div class="topbar">
            <div style="font-weight: 700; font-size: 15px; color: var(--text); text-transform: capitalize;">Admin &bull; ${activeView}</div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <button class="theme-toggle-btn" id="dash-theme-toggle">${isDark ? '☀️' : '🌙'}</button>
              <button class="btn btn-primary btn-sm" id="btn-print-college-report">🖨️ Overall College Report</button>
            </div>
          </div>

          <div class="content-body">
            ${renderFormulaCard()}

            ${activeView === 'overview' ? `
              <div class="grid-4" style="margin-bottom: 20px;">
                <div class="card"><div class="stat-label">Total Students</div><div class="stat-value tabular-nums">${sCount}</div></div>
                <div class="card"><div class="stat-label">Faculty / Lecturers</div><div class="stat-value tabular-nums">${lecturers.filter(l => l.status === 'Approved').length}</div></div>
                <div class="card"><div class="stat-label">Avg Attendance</div><div class="stat-value tabular-nums">${colAvgAtt}%</div></div>
                <div class="card"><div class="stat-label">College Perf Score</div><div class="stat-value tabular-nums" style="color: var(--primary);">${colAvgPerf}</div></div>
              </div>
            ` : activeView === 'branches' ? `
              <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                  <div style="display: flex; gap: 8px;">
                    ${branches.map(b => `<button class="btn ${activeBranchTab === b ? 'btn-primary' : 'btn-secondary'} btn-sm branch-tab-btn" data-branch="${escapeHTML(b)}">${escapeHTML(b)}</button>`).join('')}
                  </div>
                  <button class="btn btn-primary btn-sm" id="btn-print-active-branch">🖨️ Print ${escapeHTML(activeBranchTab)} Report</button>
                </div>
                <div class="table-container">
                  <table>
                    <thead>
                      <tr><th>Roll No</th><th>Name</th><th>Score</th><th>Grade</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      ${scoredStudents.filter(item => item.student.branch === activeBranchTab).map(item => `
                        <tr>
                          <td><strong>${escapeHTML(item.student.id)}</strong></td>
                          <td>${escapeHTML(item.student.name)}</td>
                          <td class="tabular-nums"><strong>${item.perf.performanceScore}</strong></td>
                          <td><span class="badge ${item.perf.badgeClass}">${item.perf.grade}</span></td>
                          <td><button class="btn btn-secondary btn-sm action-view-stu" data-id="${escapeHTML(item.student.id)}">Edit & Print</button></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : activeView === 'students' ? `
              <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                  <div style="font-weight: 700;">Student Management</div>
                  <button class="btn btn-primary btn-sm" id="btn-admin-add-stu">+ Add Student</button>
                </div>
                <div class="table-container">
                  <table>
                    <thead>
                      <tr><th>Roll No</th><th>Name</th><th>Branch</th><th>Score</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      ${scoredStudents.map(item => `
                        <tr>
                          <td><strong>${escapeHTML(item.student.id)}</strong></td>
                          <td>${escapeHTML(item.student.name)}</td>
                          <td>${escapeHTML(item.student.branch)}</td>
                          <td class="tabular-nums">${item.perf.performanceScore}</td>
                          <td>${escapeHTML(item.student.status)}</td>
                          <td>
                            <button class="btn btn-secondary btn-sm action-view-stu" data-id="${escapeHTML(item.student.id)}">Details</button>
                            <button class="btn btn-primary btn-sm action-print-stu" data-id="${escapeHTML(item.student.id)}">🖨️</button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : activeView === 'lecturers' ? `
              <div class="card">
                <div style="font-weight: 700; margin-bottom: 14px;">Faculty Management</div>
                <div class="table-container">
                  <table>
                    <thead>
                      <tr><th>ID</th><th>Name</th><th>Email</th><th>Branch</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      ${lecturers.filter(l => l.status !== 'Pending').map(l => `
                        <tr>
                          <td><strong>${escapeHTML(l.id)}</strong></td>
                          <td>${escapeHTML(l.name)}</td>
                          <td>${escapeHTML(l.email)}</td>
                          <td>${escapeHTML(l.branch)}</td>
                          <td>${escapeHTML(l.status)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : `
              <div class="card">
                <div style="font-weight: 700; margin-bottom: 14px;">Pending Lecturer Requests</div>
                <div class="table-container">
                  <table>
                    <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Branch</th><th>Action</th></tr></thead>
                    <tbody>
                      ${pendingLecturers.map(p => `
                        <tr>
                          <td><strong>${escapeHTML(p.id)}</strong></td>
                          <td>${escapeHTML(p.name)}</td>
                          <td>${escapeHTML(p.email)}</td>
                          <td>${escapeHTML(p.branch)}</td>
                          <td>
                            <button class="btn btn-primary btn-sm req-app" data-id="${escapeHTML(p.id)}">Approve</button>
                            <button class="btn btn-danger btn-sm req-rej" data-id="${escapeHTML(p.id)}">Reject</button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    document.getElementById('dash-theme-toggle')?.addEventListener('click', toggleTheme);
    document.getElementById('btn-logout')?.addEventListener('click', logout);
    document.getElementById('btn-admin-pwd')?.addEventListener('click', () => openChangePasswordModal(session));
    document.getElementById('btn-print-college-report')?.addEventListener('click', printCollegeReport);
    document.getElementById('btn-print-active-branch')?.addEventListener('click', () => printBranchReport(activeBranchTab));

    container.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => { activeView = btn.getAttribute('data-view'); render(); });
    });

    container.querySelectorAll('.branch-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => { activeBranchTab = btn.getAttribute('data-branch'); render(); });
    });

    container.querySelectorAll('.action-view-stu').forEach(btn => {
      btn.addEventListener('click', () => openStudentDetailModal(btn.getAttribute('data-id'), null, true));
    });

    container.querySelectorAll('.action-print-stu').forEach(btn => {
      btn.addEventListener('click', () => printStudentReport(btn.getAttribute('data-id')));
    });

    document.getElementById('btn-admin-add-stu')?.addEventListener('click', () => openAddStudentModal(branches[0]));

    container.querySelectorAll('.req-app').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const uList = getStorage(STORAGE_KEYS.USERS, []);
        const idx = uList.findIndex(u => u.id === id);
        if (idx !== -1) {
          uList[idx].status = 'Approved';
          setStorage(STORAGE_KEYS.USERS, uList);
          showToast(`Approved ${uList[idx].name}`, 'success');
          render();
        }
      });
    });

    container.querySelectorAll('.req-rej').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const uList = getStorage(STORAGE_KEYS.USERS, []);
        const idx = uList.findIndex(u => u.id === id);
        if (idx !== -1) {
          uList[idx].status = 'Rejected';
          setStorage(STORAGE_KEYS.USERS, uList);
          showToast(`Rejected ${uList[idx].name}`, 'info');
          render();
        }
      });
    });
  }

  // --- Student Detail Modal (with Print Report button) ---
  function openStudentDetailModal(studentId, userBranch, isAdmin = false) {
    const users = getStorage(STORAGE_KEYS.USERS, []);
    const student = users.find(u => u.id === studentId);
    if (!student) return;

    const perf = calculateStudentPerformance(studentId);
    const marks = getStorage(STORAGE_KEYS.MARKS, []).filter(m => m.studentId === studentId);
    const attendance = getStorage(STORAGE_KEYS.ATTENDANCE, []).filter(a => a.studentId === studentId);

    showModal({
      title: `Student Record: ${student.name} (${student.id})`,
      widthClass: 'modal-lg',
      bodyHTML: `
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.02); border: 1px solid var(--card-border); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <div>
              <div style="font-weight: 800; font-size: 15px;">${escapeHTML(student.name)}</div>
              <div style="font-size: 12px; color: var(--text-muted);">Roll: ${escapeHTML(student.id)} | ${escapeHTML(student.branch)} | Year ${escapeHTML(student.year)}</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <span class="badge ${perf.badgeClass}">${perf.grade} (${perf.performanceScore})</span>
              <button class="btn btn-primary btn-sm" id="modal-print-stu-btn">🖨️ Print Student Report</button>
            </div>
          </div>

          <div class="grid-4" style="margin-bottom: 16px;">
            <div style="background: rgba(0,0,0,0.02); padding: 10px; border-radius: 6px; border: 1px solid var(--card-border);">
              <div style="font-size: 11px; color: var(--text-muted);">Marks %</div>
              <div class="tabular-nums" style="font-size: 18px; font-weight: 800;">${perf.marksPct}%</div>
            </div>
            <div style="background: rgba(0,0,0,0.02); padding: 10px; border-radius: 6px; border: 1px solid var(--card-border);">
              <div style="font-size: 11px; color: var(--text-muted);">Attendance</div>
              <div class="tabular-nums" style="font-size: 18px; font-weight: 800; color: ${perf.hasShortage ? 'var(--danger)' : 'inherit'};">${perf.attendancePct}%</div>
            </div>
            <div style="background: rgba(0,0,0,0.02); padding: 10px; border-radius: 6px; border: 1px solid var(--card-border);">
              <div style="font-size: 11px; color: var(--text-muted);">Study Hrs</div>
              <div class="tabular-nums" style="font-size: 18px; font-weight: 800;">${perf.weeklyAvgHours}h</div>
            </div>
            <div style="background: rgba(0,0,0,0.02); padding: 10px; border-radius: 6px; border: 1px solid var(--card-border);">
              <div style="font-size: 11px; color: var(--text-muted);">Score</div>
              <div class="tabular-nums" style="font-size: 18px; font-weight: 800; color: var(--primary);">${perf.performanceScore}</div>
            </div>
          </div>

          <div style="margin-bottom: 16px;">
            <div style="font-weight: 700; margin-bottom: 8px;">Subject Marks</div>
            <div class="table-container">
              <table>
                <thead><tr><th>Subject</th><th>Int 1</th><th>Int 2</th><th>Assign</th><th>Ext</th><th>Total</th><th>%</th></tr></thead>
                <tbody>
                  ${marks.map(m => {
                    const tot = (Number(m.internal1)||0) + (Number(m.internal2)||0) + (Number(m.assignment)||0) + (Number(m.external)||0);
                    return `<tr><td><strong>${escapeHTML(m.subject)}</strong></td><td>${m.internal1}</td><td>${m.internal2}</td><td>${m.assignment}</td><td>${m.external}</td><td><strong>${tot}</strong></td><td>${Math.round((tot/(Number(m.maxMarks)||100))*100)}%</td></tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div style="font-weight: 700; margin-bottom: 8px;">Attendance</div>
            <div class="table-container">
              <table>
                <thead><tr><th>Subject</th><th>Attended</th><th>Total</th><th>%</th></tr></thead>
                <tbody>
                  ${attendance.map(a => `<tr><td><strong>${escapeHTML(a.subject)}</strong></td><td>${a.attendedClasses}</td><td>${a.totalClasses}</td><td>${Math.round(((Number(a.attendedClasses)||0)/(Number(a.totalClasses)||1))*100)}%</td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `,
      footerHTML: `<button class="btn btn-secondary btn-sm" onclick="CSPP.closeModal()">Close</button>`
    });

    document.getElementById('modal-print-stu-btn')?.addEventListener('click', () => {
      printStudentReport(studentId);
    });
  }

  function openAddStudentModal(defaultBranch = 'CSE') {
    const branches = getStorage(STORAGE_KEYS.BRANCHES, DEFAULT_BRANCHES);
    showModal({
      title: 'Add New Student',
      bodyHTML: `
        <form id="add-student-form">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Student ID</label>
              <input type="text" id="as-id" class="form-input" required placeholder="e.g. STU-${defaultBranch}-099">
            </div>
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" id="as-name" class="form-input" required placeholder="e.g. Rachel Green">
            </div>
          </div>
          <div class="grid-3">
            <div class="form-group">
              <label class="form-label">Branch</label>
              <select id="as-branch" class="form-select" required>
                ${branches.map(b => `<option value="${escapeHTML(b)}" ${b===defaultBranch?'selected':''}>${escapeHTML(b)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Year</label>
              <select id="as-year" class="form-select" required>
                <option value="1">Year 1</option><option value="2">Year 2</option><option value="3">Year 3</option><option value="4">Year 4</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Semester</label>
              <select id="as-sem" class="form-select" required>
                ${[1,2,3,4,5,6,7,8].map(s => `<option value="${s}">Sem ${s}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Initial Password</label>
            <input type="password" id="as-pwd" class="form-input" required value="student123">
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%;">Create Student</button>
        </form>
      `
    });

    document.getElementById('add-student-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('as-id').value.trim();
      const name = document.getElementById('as-name').value.trim();
      const branch = document.getElementById('as-branch').value;
      const year = document.getElementById('as-year').value;
      const sem = document.getElementById('as-sem').value;
      const pwd = document.getElementById('as-pwd').value;

      const users = getStorage(STORAGE_KEYS.USERS, []);
      if (users.some(u => u.id.toLowerCase() === id.toLowerCase())) {
        showToast('Student ID already exists', 'error');
        return;
      }

      users.push({
        id, role: 'STUDENT', name, email: `${id.toLowerCase()}@college.edu`, branch, year, semester: sem,
        password: await hashPassword(pwd), status: 'Approved'
      });
      const marks = getStorage(STORAGE_KEYS.MARKS, []);
      marks.push({ studentId: id, subject: 'Core Engineering 1', internal1: 18, internal2: 19, assignment: 8, external: 30, maxMarks: 100 });
      const att = getStorage(STORAGE_KEYS.ATTENDANCE, []);
      att.push({ studentId: id, subject: 'Core Engineering 1', attendedClasses: 36, totalClasses: 40 });

      setStorage(STORAGE_KEYS.USERS, users);
      setStorage(STORAGE_KEYS.MARKS, marks);
      setStorage(STORAGE_KEYS.ATTENDANCE, att);

      closeModal();
      showToast(`Student ${name} created`, 'success');
      render();
    });
  }

  // Export to window
  window.CSPP = {
    render,
    seedInitialData,
    logout,
    getSession,
    calculateStudentPerformance,
    printStudentReport,
    printBranchReport,
    printCollegeReport,
    showToast,
    closeModal,
    openChangePasswordModal,
    toggleTheme
  };

  initTheme();
  seedInitialData().then(() => render());

})();
