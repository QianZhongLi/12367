(() => {
  const state = {
    originalResult: null,
    currentResult: null,
    reviewDecisions: {},
    manualOverrides: {},
    lastRegion: 'macao',
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth() + 1,
    cumulativeStartDate: '',
    calendarMode: 'year',
    zoomLevels: { year: 1, scroll: 1, month: 1, full: 1 },
    hasScrolledAfterCalc: false
  };

  const $ = (id) => document.getElementById(id);

  function loadDeferredImages(container) {
    container.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
  }

  function toggleCollapse(id, iconEl) {
    const el = $(id);
    if (!el) return;
    el.classList.toggle('collapsed');
    if (!el.classList.contains('collapsed')) loadDeferredImages(el);
    if (iconEl) {
      iconEl.classList.toggle('rotated');
    }
    // 切换标题文字：点击展开 ↔ 点击折叠
    const parent = iconEl?.parentNode;
    if (parent) {
      for (const node of parent.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          if (node.textContent.includes('点击展开')) {
            node.textContent = node.textContent.replace('点击展开', '点击折叠');
          } else if (node.textContent.includes('点击折叠')) {
            node.textContent = node.textContent.replace('点击折叠', '点击展开');
          }
        }
      }
    }
  }
  window.toggleCollapse = toggleCollapse;

  function init() {
    document.querySelector('.pdf-guide-card .collapse-icon')?.classList.add('rotated');
    setupPdfJs();
    injectProgressStyle();
    bindEvents();
    state.lastRegion = getRegion();
    setStatus('准备就绪。请选择 PDF 或粘贴文本。', 0);

    // 根据访问协议显示离线/在线版文案
    const offlineOnlineText = $('offlineOnlineText');
    if (offlineOnlineText) {
      if (window.location.protocol === 'file:') {
        // 本地文件：提示当前是离线版，提供在线版链接
        offlineOnlineText.innerHTML = '<a href="https://12367.pages.dev/" target="_blank">当前是离线版，访问在线版 </a>';
        offlineOnlineText.className = 'link-active';
      } else {
        // 网页访问：提示当前是在线版，提供下载离线版链接
        offlineOnlineText.innerHTML = '<a href="javascript:void(0)" onclick="downloadOffline()">当前是在线版，下载离线版（电脑浏览器打开）</a>';
        offlineOnlineText.className = 'link-active';
      }
    }

    // 页面加载1秒后自动折叠 hero 与 PDF 指南
    setTimeout(() => {
      const heroContent = $('heroContent');
      if (heroContent) heroContent.classList.add('collapsed');
      // 旋转三角
      document.querySelectorAll('.hero .collapse-icon').forEach(icon => {
        icon.classList.add('rotated');
      });
    }, 1000);

    // PDF 导入框持续引导闪动（直到用户上传或粘贴）
    const fileBox = $('fileBox');
    if (fileBox) {
      fileBox.classList.add('flash-continuous');
    }
  }

  function setupPdfJs() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }

  function injectProgressStyle() {
    if (document.getElementById('progressStyle')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'progressStyle';
    style.textContent = `
      .progress-box {
        margin-top: 14px;
      }

      .progress-track {
        width: 100%;
        height: 10px;
        background: rgba(15, 23, 42, 0.08);
        border-radius: 999px;
        overflow: hidden;
      }

      .progress-fill {
        width: 0%;
        height: 100%;
        background: linear-gradient(90deg, #2057ce, #05a0ba);
        border-radius: 999px;
        transition: width 260ms ease;
      }

      .progress-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-top: 8px;
        font-size: 13px;
        color: #58667a;
      }

      .progress-percent {
        font-weight: 700;
        color: #2057ce;
        white-space: nowrap;
      }
    `;

    document.head.appendChild(style);
  }

  function updateCalendarZoom(level) {
    const wrap = $('calendarWrap');
    if (!wrap) return;
    const mode = state.calendarMode || 'year';

    // 年度视图放大超过150%自动切换月度整体视图
    if (mode === 'year' && level > 1.5) {
      const fullBtn = document.querySelector('.mode-btn[data-mode="full"]');
      if (fullBtn) {
        fullBtn.click();
        return;
      }
    }

    // 月度整体视图缩小到80%以下自动切换回年度视图
    if (mode === 'full' && level < 0.8) {
      const yearBtn = document.querySelector('.mode-btn[data-mode="year"]');
      if (yearBtn) {
        yearBtn.click();
        return;
      }
    }

    state.zoomLevels[mode] = level;
    wrap.style.zoom = level;
    wrap.style.transform = '';
    wrap.style.transformOrigin = '';
    wrap.classList.toggle('zoom-compact', level < 0.7);
    const display = $('calZoomLevelDisplay');
    if (display) display.textContent = Math.round(level * 100) + '%';
  }

  function bindEvents() {
    const pdfFileEl = $('pdfFile');
    if (pdfFileEl) pdfFileEl.addEventListener('change', (e) => {
      onFileChange(e);
      calculateFromPdf();
    });
    const recalcPdfBtn = $('recalcPdfBtn');
    if (recalcPdfBtn) {
      recalcPdfBtn.addEventListener('click', () => {
        calculateFromPdf();
      });
    }

    const demoBtn = $('demoBtn');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        const demoText = `序号   出境/入境   出入境日期   证件名称   证件号码   出入境口岸
   航班号 1   出境   2026-05-22   往来港澳通行证   *********   横琴口岸
 2   入境   2026-05-22   往来港澳通行证   *********   横琴口岸
 3   出境   2026-05-21   往来港澳通行证   *********   横琴口岸
 4   入境   2026-05-21   往来港澳通行证   *********   横琴口岸
 5   出境   2026-05-21   往来港澳通行证   *********   横琴口岸
 6   入境   2026-05-21   往来港澳通行证   *********   横琴口岸`;
        $('rawText').value = demoText;
        setTextStatus('已填入示例数据，正在计算...', false);
        calculateFromText();
      });
    }
    const copySummaryBtn = $('copySummaryBtn');
    if (copySummaryBtn) copySummaryBtn.addEventListener('click', copySummary);
    const exportSummaryBtnEl = $('exportSummaryBtn');
    if (exportSummaryBtnEl) exportSummaryBtnEl.addEventListener('click', exportSummaryCsv);

    // 三处“设为9月1日”按钮
    ['setSept1Btn-rules', 'setSept1Btn-start', 'setSept1Btn-cal'].forEach(id => {
      const btn = $(id);
      if (btn) {
        btn.addEventListener('click', () => {
          try {
            let earliestDate = '';
            const result = state.originalResult;
            if (result && result.allIntervals && result.allIntervals.length) {
              earliestDate = result.allIntervals.reduce((min, i) => i.exitDate < min ? i.exitDate : min, result.allIntervals[0].exitDate);
            } else if (result && result.dailyRows && result.dailyRows.length) {
              earliestDate = result.dailyRows[0].date;
            }
            if (earliestDate) {
              const year = earliestDate.slice(0, 4);
              state.cumulativeStartDate = `${year}-09-01`;
            } else {
              const year = new Date().getFullYear();
              state.cumulativeStartDate = `${year}-09-01`;
            }
            if ($('startDateInput')) $('startDateInput').value = state.cumulativeStartDate || '';
            if ($('calStartDate')) $('calStartDate').value = state.cumulativeStartDate || '';
            if ($('rulesStartDate')) $('rulesStartDate').value = state.cumulativeStartDate || '';
            recalcWithCurrentOptions();
          } catch (err) {
            alert('设为9月1日出错：' + err.message);
            console.error(err);
          }
        });
      }
    });

    // 三处"设为1月15日"按钮（春季班）
    ['setJan15Btn-rules', 'setJan15Btn-start', 'setJan15Btn-cal'].forEach(id => {
      const btn = $(id);
      if (btn) {
        btn.addEventListener('click', () => {
          try {
            let earliestDate = '';
            const result = state.originalResult;
            if (result && result.allIntervals && result.allIntervals.length) {
              earliestDate = result.allIntervals.reduce((min, i) => i.exitDate < min ? i.exitDate : min, result.allIntervals[0].exitDate);
            } else if (result && result.dailyRows && result.dailyRows.length) {
              earliestDate = result.dailyRows[0].date;
            }
            if (earliestDate) {
              const year = earliestDate.slice(0, 4);
              state.cumulativeStartDate = `${year}-01-15`;
            } else {
              const year = new Date().getFullYear();
              state.cumulativeStartDate = `${year}-01-15`;
            }
            if ($('startDateInput')) $('startDateInput').value = state.cumulativeStartDate || '';
            if ($('calStartDate')) $('calStartDate').value = state.cumulativeStartDate || '';
            if ($('rulesStartDate')) $('rulesStartDate').value = state.cumulativeStartDate || '';
            recalcWithCurrentOptions();
          } catch (err) {
            alert('设为1月15日出错：' + err.message);
            console.error(err);
          }
        });
      }
    });

    document.querySelectorAll('input[name="region"]').forEach(el => {
      el.addEventListener('change', handleRegionChange);
    });

    document.querySelectorAll('#deductWeekend, #deductGovHoliday, #deductCompensatory, #deductHalfDay, #deductSchoolBreak').forEach(el => {
      el.addEventListener('change', () => {
        if (state.originalResult) {
          recalcWithCurrentOptions();
        }
      });
    });

    // 文本框内容变化后自动计算（防抖）
    let textTimer = null;
    const rawTextEl = $('rawText');
    if (rawTextEl) rawTextEl.addEventListener('input', () => {
      if (textTimer) clearTimeout(textTimer);
      textTimer = setTimeout(() => {
        const text = rawTextEl.value || '';
        if (text.trim().length > 30) {
          calculateFromText();
        }
      }, 800);
    });

    // 日历导航
    const calPrevYearBtn = $('calPrevYear');
    if (calPrevYearBtn) calPrevYearBtn.addEventListener('click', () => changeCalendar(-1, 0));
    const calPrevMonthBtn = $('calPrevMonth');
    if (calPrevMonthBtn) calPrevMonthBtn.addEventListener('click', () => changeCalendar(0, -1));
    const calNextMonthBtn = $('calNextMonth');
    if (calNextMonthBtn) calNextMonthBtn.addEventListener('click', () => changeCalendar(0, 1));
    const calNextYearBtn = $('calNextYear');
    if (calNextYearBtn) calNextYearBtn.addEventListener('click', () => changeCalendar(1, 0));
    const calYearSelEl = $('calYearSelect');
    if (calYearSelEl) calYearSelEl.addEventListener('change', (e) => { state.calendarYear = +e.target.value; renderCalendar(state.currentResult); });
    const calMonthSelEl = $('calMonthSelect');
    if (calMonthSelEl) calMonthSelEl.addEventListener('change', (e) => { state.calendarMonth = +e.target.value; renderCalendar(state.currentResult); });
    const calStartDateEl = $('calStartDate');
    if (calStartDateEl) calStartDateEl.addEventListener('change', (e) => {
      state.cumulativeStartDate = e.target.value;
      if ($('startDateInput')) $('startDateInput').value = e.target.value;
      if (state.originalResult) {
        recalcWithCurrentOptions();
      }
    });

    const startDateInputEl = $('startDateInput');
    if (startDateInputEl) startDateInputEl.addEventListener('change', (e) => {
      state.cumulativeStartDate = e.target.value;
      if ($('calStartDate')) $('calStartDate').value = e.target.value;
      if ($('rulesStartDate')) $('rulesStartDate').value = e.target.value;
      if (state.originalResult) {
        recalcWithCurrentOptions();
      }
    });

    const rulesStartDateEl = $('rulesStartDate');
    if (rulesStartDateEl) rulesStartDateEl.addEventListener('change', (e) => {
      state.cumulativeStartDate = e.target.value;
      if ($('startDateInput')) $('startDateInput').value = e.target.value;
      if ($('calStartDate')) $('calStartDate').value = e.target.value;
      if (state.originalResult) {
        recalcWithCurrentOptions();
      }
    });

    // 日历模式切换
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        state.calendarMode = mode;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        const toolbar = $('monthToolbar');
        if (toolbar) toolbar.style.display = mode === 'month' ? 'flex' : 'none';
        if (state.originalResult) {
          renderCalendar(state.currentResult);
        }
        // 应用该模式保存的缩放级别
        updateCalendarZoom(state.zoomLevels[mode] || 1);
      });
    });

    // 拖拽导入视觉反馈
    const fileBox = $('fileBox');
    if (fileBox) {
      fileBox.addEventListener('dragenter', () => fileBox.classList.add('drag-over'));
      fileBox.addEventListener('dragleave', () => fileBox.classList.remove('drag-over'));
      fileBox.addEventListener('drop', () => fileBox.classList.remove('drag-over'));
    }

    // 日历缩放与导出
    const calZoomOut = $('calZoomOut');
    const calZoomReset = $('calZoomReset');
    const calZoomIn = $('calZoomIn');
    const calExportImg = $('calExportImg');
    if (calZoomOut) {
      calZoomOut.addEventListener('click', () => {
        const mode = state.calendarMode || 'year';
        const newLevel = Math.max(0.5, (state.zoomLevels[mode] || 1) - 0.15);
        updateCalendarZoom(newLevel);
      });
    }
    if (calZoomIn) {
      calZoomIn.addEventListener('click', () => {
        const mode = state.calendarMode || 'year';
        const newLevel = Math.min(2, (state.zoomLevels[mode] || 1) + 0.15);
        updateCalendarZoom(newLevel);
      });
    }
    if (calZoomReset) {
      calZoomReset.addEventListener('click', () => {
        updateCalendarZoom(1);
      });
    }
    if (calExportImg) {
      calExportImg.addEventListener('click', () => {
        const wrap = $('calendarWrap');
        if (!wrap) return;
        if (window.html2canvas) {
          window.html2canvas(wrap, { scale: 2, useCORS: true }).then(canvas => {
            const link = document.createElement('a');
            link.download = '万年历截图.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
          }).catch(err => {
            console.error(err);
            alert('截图导出失败：' + (err.message || err));
          });
        } else {
          alert('截图功能需要 html2canvas 库支持。请引入 html2canvas 后重试。');
        }
      });
    }
    const calExportTable = $('calExportTable');
    if (calExportTable) {
      calExportTable.addEventListener('click', exportCombinedCsv);
    }

    // 节假日明细按钮
    const addHolidayBtn = $('addHolidayBtn');
    const saveHolidaysBtn = $('saveHolidaysBtn');
    if (addHolidayBtn) {
      addHolidayBtn.addEventListener('click', () => {
        const date = prompt('请输入日期（YYYY-MM-DD）：');
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          alert('日期格式不正确');
          return;
        }
        const name = prompt('请输入节假日名称：') || '节假日';
        const region = getRegion();
        const holidays = window.EntryExitHolidays;
        const source = region === 'hongkong' ? holidays.HONGKONG_HOLIDAYS : holidays.MACAO_HOLIDAYS;
        source[date] = { name, type: 'gov', weight: 1 };
        renderHolidays();
        if (state.originalResult) recalcWithCurrentOptions();
      });
    }
    const addSchoolBreakBtn = $('addSchoolBreakBtn');
    if (addSchoolBreakBtn) {
      addSchoolBreakBtn.addEventListener('click', () => {
        const start = prompt('请输入开始日期（YYYY-MM-DD）：');
        if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
          alert('日期格式不正确');
          return;
        }
        const end = prompt('请输入结束日期（YYYY-MM-DD）：');
        if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
          alert('日期格式不正确');
          return;
        }
        const name = prompt('请输入假期名称（如：2024-2025 学年暑假）：') || '学校假期';
        const holidays = window.EntryExitHolidays;
        if (!holidays.MACAO_SCHOOL_BREAKS) holidays.MACAO_SCHOOL_BREAKS = [];
        holidays.MACAO_SCHOOL_BREAKS.push({ start, end, name });
        renderHolidays();
        if (state.originalResult) recalcWithCurrentOptions();
      });
    }

    if (saveHolidaysBtn) {
      saveHolidaysBtn.addEventListener('click', () => {
        const region = getRegion();
        const holidays = window.EntryExitHolidays;
        const source = region === 'hongkong' ? holidays.HONGKONG_HOLIDAYS : holidays.MACAO_HOLIDAYS;
        const data = JSON.stringify({ holidays: source, schoolBreaks: holidays.MACAO_SCHOOL_BREAKS }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${region}_holidays_backup.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert('已导出假期数据备份（含学校假期），请妥善保存。实际生效需要替换 holidays.js 文件内容。');
      });
    }
  }

  function handleRegionChange(e) {
    const newRegion = e.target.value;
    const oldRegion = state.lastRegion;

    if (newRegion === oldRegion) {
      return;
    }

    state.lastRegion = newRegion;

    if (!state.originalResult || !state.lastRecords) {
      setStatus(`已切换为${getRegionName(newRegion)}。`, 0);
      return;
    }

    // 地区切换后自动重算，不弹窗
    state.reviewDecisions = {};
    setTextStatus('地区已切换，正在重新计算...', false);
    recalcWithCurrentOptions();
  }

  function getRegionName(region) {
    if (region === 'hongkong') return '香港学生';
    if (region === 'other') return '其它留学生';
    return '澳门学生';
  }

  function setRegionChecked(region) {
    const input = document.querySelector(`input[name="region"][value="${region}"]`);
    if (input) {
      input.checked = true;
    }
  }

  function clearCalculationOnly() {
    state.originalResult = null;
    state.currentResult = null;
    state.reviewDecisions = {};

    $('resultCard').classList.add('hidden');
    $('reviewCard').classList.add('hidden');

    const tbody = $('summaryTable').querySelector('tbody');
    if (tbody) {
      tbody.innerHTML = '';
    }

    $('recordCount').textContent = '0';
    $('intervalCount').textContent = '0';
    $('reviewCount').textContent = '0';
    $('reviewSelectedCount').textContent = '0';
    $('reviewAddedDays').textContent = '0';
    $('reviewEffectMessage').textContent = '暂无复核影响';

    const reviewList = $('reviewList');
    if (reviewList) {
      reviewList.innerHTML = '';
    }
  }

  function onFileChange(e) {
    const file = e.target.files && e.target.files[0];
    const fileNameEl = $('fileName');
    const recalcBtn = $('recalcPdfBtn');
    if (file) {
      fileNameEl.childNodes[0].textContent = `已选择：${file.name} `;
      if (recalcBtn) recalcBtn.style.display = '';
    } else {
      fileNameEl.childNodes[0].textContent = '尚未选择文件 ';
      if (recalcBtn) recalcBtn.style.display = 'none';
    }
  }

  function handlePdfDrop(e) {
    e.preventDefault();
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length) {
      const file = files[0];
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setTextStatus('请拖放 PDF 文件。', true);
        return;
      }
      $('fileName').textContent = `已选择：${file.name}`;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      $('pdfFile').files = dataTransfer.files;
      calculateFromPdf();
    }
  }
  window.handlePdfDrop = handlePdfDrop;

  function getRegion() {
    const checked = document.querySelector('input[name="region"]:checked');
    return checked ? checked.value : 'macao';
  }

  function getRules() {
    return {
      deductWeekend: $('deductWeekend').checked,
      deductGovHoliday: $('deductGovHoliday').checked,
      deductCompensatory: $('deductCompensatory').checked,
      deductHalfDay: $('deductHalfDay').checked,
      deductSchoolBreak: $('deductSchoolBreak').checked
    };
  }

  function maskPrivacy(text) {
    // 身份证号（18位，末位可为X/x）
    text = text.replace(/\b\d{17}[\dXx]\b/g, (m) => '*'.repeat(m.length));
    // 出生日期字段（仅匹配"出生日期"后面的日期）
    text = text.replace(/(出生日期[\s:：]*)(\d{4}[\-/年]\d{2}[\-/月]\d{2}[日]?)/g, (m, p1, p2) => p1 + '*'.repeat(p2.length));
    // 姓名（匹配"姓名"后面的2-4个中文字符）
    text = text.replace(/(姓名[\s:：]*)([\u4e00-\u9fa5]{2,4})/g, '$1**');
    // CH 开头的通行证编号
    text = text.replace(/\bCH[A-Za-z0-9]{6,}\b/g, (m) => '*'.repeat(m.length));
    // 其他 8 位以上纯数字证件号码
    text = text.replace(/\b\d{9,}\b/g, (m) => '*'.repeat(m.length));
    // 出入境记录编号（"编号"后面的字母数字组合）
    text = text.replace(/(编号[\s:：]*)([A-Za-z0-9]{6,})/g, (m, p1, p2) => p1 + '*'.repeat(p2.length));
    return text;
  }

  async function calculateFromPdf() {
    const file = $('pdfFile').files && $('pdfFile').files[0];
    if (!file) return;

    // 停止引导闪动
    const fileBox = $('fileBox');
    if (fileBox) fileBox.classList.remove('flash-continuous');
    if (!window.pdfjsLib) {
      setTextStatus('PDF 解析库未加载成功。请检查网络。', true);
      return;
    }
    try {
      setTextStatus('正在读取 PDF...', false);
      let text = await extractTextFromPdf(file);
      // 隐私打码：身份证号、生日、姓名、CH 开头通行证编号
      text = maskPrivacy(text);
      // 在口岸、机场、码头等关键词后自动换行，便于阅读
      text = text.replace(/(口岸|机场|機場|码头|碼頭|港口|港站)(?![\n\r])/g, '$1\n');
      $('rawText').value = text;
      setTextStatus(`PDF 解析完成，文本长度 ${text.length}，已自动填入文本框。`, false);
      runCalculation(text);
    } catch (err) {
      console.error(err);
      setTextStatus(`PDF 解析失败：${err.message || err}`, true);
    }
  }

  async function extractTextFromPdf(file) {
    setStatus('正在载入 PDF。', 10);

    const arrayBuffer = await file.arrayBuffer();

    setStatus('正在初始化 PDF 解析器。', 14);

    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageTexts = [];

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const pageProgress = 16 + Math.round((pageNo / pdf.numPages) * 46);

      setStatus(`正在解析 PDF 第 ${pageNo} / ${pdf.numPages} 页。`, pageProgress);

      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str || '').filter(Boolean);

      pageTexts.push(strings.join(' '));
    }

    setStatus('PDF 页面文字提取完成。', 64);

    return pageTexts.join('\n');
  }

  function calculateFromText() {
    const text = $('rawText').value || '';
    if (!text.trim()) return;

    // 停止引导闪动
    const fileBox = $('fileBox');
    if (fileBox) fileBox.classList.remove('flash-continuous');

    setTextStatus('正在计算...', false);
    runCalculation(text);
  }

  function autoDetectRegion(records) {
    let macaoCount = 0;
    let hongkongCount = 0;
    for (const rec of records) {
      const r = rec.portInfo?.region;
      if (r === 'macao') macaoCount++;
      else if (r === 'hongkong') hongkongCount++;
    }
    if (macaoCount === 0 && hongkongCount === 0) return null;
    return macaoCount >= hongkongCount ? 'macao' : 'hongkong';
  }

  function runCalculation(text) {
    const region = getRegion();

    state.lastRegion = region;
    state.reviewDecisions = {};
    state.manualOverrides = {};
    state.autoDeductRemoved = false;
    state.shortDaysTipShown = false;

    // 新导入数据时恢复默认扣除设置（避免上次自动取消的扣除设置残留）
    if ($('deductWeekend')) $('deductWeekend').checked = true;
    if ($('deductGovHoliday')) $('deductGovHoliday').checked = true;
    if ($('deductCompensatory')) $('deductCompensatory').checked = true;
    if ($('deductHalfDay')) $('deductHalfDay').checked = false;
    if ($('deductSchoolBreak')) $('deductSchoolBreak').checked = true;

    const rules = getRules();

    setStatus('正在识别出入境记录。', 72);

    const records = window.EntryExitCalculator.parseMigrationRecords(text);

    if (!records.length) {
      setStatus('未识别到出入境记录。请确认文本中包含“序号 入境/出境 日期 证件名称 证件号码 口岸”等表格行。', 0);
      alert('未识别到出入境记录。');
      return;
    }

    setStatus(`已识别 ${records.length} 条记录。正在计算年度汇总。`, 82);

    state.lastRecords = records;

    // 自动识别地区：仅在首次导入数据时根据口岸分布判断，之后尊重用户手动选择
    let finalRegion = region;
    if (!state.lastRecords || state.lastRecords.length === 0) {
      const autoRegion = autoDetectRegion(records);
      if (autoRegion && autoRegion !== region) {
        setRegionChecked(autoRegion);
        state.lastRegion = autoRegion;
        finalRegion = autoRegion;
      }
    }

    const result = window.EntryExitCalculator.calculateResult(records, finalRegion, rules);

    setStatus('正在生成结果表和待复核口岸。', 92);

    state.originalResult = result;

    // 默认累计起始日期设为最早记录当年的9月1日，日历也默认跳到9月
    let earliestDate = '';
    if (result.allIntervals && result.allIntervals.length) {
      earliestDate = result.allIntervals.reduce((min, i) => i.exitDate < min ? i.exitDate : min, result.allIntervals[0].exitDate);
    } else if (result.dailyRows && result.dailyRows.length) {
      earliestDate = result.dailyRows[0].date;
    }
    if (earliestDate) {
      const year = earliestDate.slice(0, 4);
      let defaultStart = `${year}-09-01`;
      // 如果默认起始日期晚于最早记录，则使用最早记录日期（避免只导出近期记录时全部区间被过滤）
      if (defaultStart > earliestDate) {
        defaultStart = earliestDate;
      }
      state.cumulativeStartDate = defaultStart;
      state.calendarYear = +year;
      state.calendarMonth = 9;
    }

    // 同步三处开学日期输入框的值
    if ($('startDateInput')) $('startDateInput').value = state.cumulativeStartDate || '';
    if ($('calStartDate')) $('calStartDate').value = state.cumulativeStartDate || '';
    if ($('rulesStartDate')) $('rulesStartDate').value = state.cumulativeStartDate || '';

    state.currentResult = window.EntryExitCalculator.applyReviewDecisions(result, region, state.reviewDecisions, state.manualOverrides, state.cumulativeStartDate);

    // 检查有效天数是否过少，自动去除全部扣除限制后重新计算
    const totalValid = getTotalValidDays(state.currentResult);
    if (totalValid < 100 && !state.autoDeductRemoved) {
      state.autoDeductRemoved = true;
      // 取消所有扣除勾选
      if ($('deductWeekend')) $('deductWeekend').checked = false;
      if ($('deductGovHoliday')) $('deductGovHoliday').checked = false;
      if ($('deductCompensatory')) $('deductCompensatory').checked = false;
      if ($('deductHalfDay')) $('deductHalfDay').checked = false;
      if ($('deductSchoolBreak')) $('deductSchoolBreak').checked = false;
      // 重新计算
      recalcWithCurrentOptions();
      return;
    }

    renderAll();

    setTextStatus(`计算完成。识别记录数：${result.recordCount}，自动计入区间：${result.intervalCount}，待复核区间：${result.reviewCount}。`, false);

    scrollToResultOnMobile();
  }

  function recalcWithCurrentOptions() {
    if (!state.originalResult || !state.lastRecords) {
      return;
    }

    const region = getRegion();
    state.lastRegion = region;

    setTextStatus('正在根据当前规则重新计算...', false);

    const rules = getRules();
    state.originalResult = window.EntryExitCalculator.calculateResult(state.lastRecords, region, rules);
    state.currentResult = window.EntryExitCalculator.applyReviewDecisions(
      state.originalResult,
      region,
      state.reviewDecisions,
      state.manualOverrides,
      state.cumulativeStartDate
    );

    renderAll();

    setTextStatus('结果已根据当前规则刷新。', false);
  }

  function renderAll() {
    renderSummary(state.currentResult);
    renderReviewList(state.currentResult);
    renderTripTable(state.currentResult);
    renderCalendar(state.currentResult);
    renderHolidays();
    renderDeductList(state.currentResult);

    $('resultCard').classList.remove('hidden');
    $('regionCard').classList.remove('hidden');
    $('rulesCard').classList.remove('hidden');
    $('reviewCard').classList.toggle('hidden', !state.currentResult.reviewItems.length);
    $('tripTableCard').classList.toggle('hidden', !state.currentResult.allIntervals || !state.currentResult.allIntervals.length);
    $('calendarCard').classList.toggle('hidden', !state.currentResult.allIntervals || !state.currentResult.allIntervals.length);
    $('deductListCard').classList.remove('hidden');
    $('holidaysCard').classList.remove('hidden');

    // 显示结果弹窗
    showResultModal();
  }

  function renderSummary(result) {
    $('recordCount').textContent = result.recordCount || 0;
    $('intervalCount').textContent = result.intervalCount || 0;
    $('reviewCount').textContent = result.reviewCount || 0;
    $('reviewSelectedCount').textContent = result.reviewEffect ? result.reviewEffect.selectedCount : 0;
    $('reviewAddedDays').textContent = result.reviewEffect ? result.reviewEffect.addedNaturalDays : 0;
    $('reviewEffectMessage').textContent = result.reviewEffect ? result.reviewEffect.message : '暂无复核影响';

    const tbody = $('summaryTable').querySelector('tbody');
    tbody.innerHTML = '';

    let totalNatural = 0, totalWeekend = 0, totalGov = 0, totalComp = 0, totalSchool = 0, totalDeduct = 0, totalValid = 0;

    for (const row of result.summaryByYear || []) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(row.year)}</td>
        <td>${escapeHtml(row.naturalDays)}</td>
        <td>${escapeHtml(row.weekendDeductDays)}</td>
        <td>${escapeHtml(row.govHolidayDeductDays)}</td>
        <td>${escapeHtml(row.compensatoryDeductDays)}</td>
        <td>${escapeHtml(row.schoolBreakDeductDays)}</td>
        <td>${escapeHtml(row.totalDeductDays)}</td>
        <td><strong>${escapeHtml(row.validDays)}</strong></td>
      `;
      tbody.appendChild(tr);

      totalNatural += row.naturalDays || 0;
      totalWeekend += row.weekendDeductDays || 0;
      totalGov += row.govHolidayDeductDays || 0;
      totalComp += row.compensatoryDeductDays || 0;
      totalSchool += row.schoolBreakDeductDays || 0;
      totalDeduct += row.totalDeductDays || 0;
      totalValid += row.validDays || 0;
    }

    // 同步更新 02 区域的统计数字
    const textStats = document.querySelector('.text-stats');
    if (textStats) textStats.style.display = '';
    const reviewMsg = $('reviewEffectMessage');
    if (reviewMsg) reviewMsg.style.display = '';

    if (result.summaryByYear && result.summaryByYear.length > 0) {
      const totalTr = document.createElement('tr');
      totalTr.style.cssText = 'background:#d3dbdb;font-weight:900';
      totalTr.innerHTML = `
        <td>合计</td>
        <td>${escapeHtml(Math.round(totalNatural * 10) / 10)}</td>
        <td>${escapeHtml(Math.round(totalWeekend * 10) / 10)}</td>
        <td>${escapeHtml(Math.round(totalGov * 10) / 10)}</td>
        <td>${escapeHtml(Math.round(totalComp * 10) / 10)}</td>
        <td>${escapeHtml(Math.round(totalSchool * 10) / 10)}</td>
        <td>${escapeHtml(Math.round(totalDeduct * 10) / 10)}</td>
        <td style="background:#fee2e2;color:#991b1b"><strong>${escapeHtml(Math.round(totalValid * 10) / 10)}</strong></td>
      `;
      tbody.appendChild(totalTr);
    }
  }

  function renderReviewList(result) {
    const list = $('reviewList');
    list.innerHTML = '';

    const items = result.reviewItems || [];
    const region = getRegion();

    if (!items.length) {
      list.innerHTML = '<p class="hint">暂无待复核口岸。</p>';
      return;
    }

    for (const item of items) {
      const decision = state.reviewDecisions[item.id] || item.decision || region;
      const div = document.createElement('div');

      div.className = 'review-item';
      div.innerHTML = `
        <h4>记录 ${escapeHtml(item.recordNo)}</h4>
        <div class="review-meta">
          <div>日期：${escapeHtml(item.date)}</div>
          <div>口岸：${escapeHtml(item.portRaw)}</div>
          <div>说明：${escapeHtml(item.reason)}</div>
        </div>
        <div class="review-options">
          ${reviewOptionHtml(item.id, 'macao', '计入澳门', decision)}
          ${reviewOptionHtml(item.id, 'hongkong', '计入香港', decision)}
          ${reviewOptionHtml(item.id, 'exclude', '不计入（出国游玩等口岸记录）', decision)}
        </div>
      `;

      list.appendChild(div);
    }

    list.querySelectorAll('input[type="radio"]').forEach(input => {
      input.addEventListener('change', (e) => {
        state.reviewDecisions[e.target.dataset.id] = e.target.value;

        const region = getRegion();

        setTextStatus('正在应用待复核口岸选择...', false);

        state.currentResult = window.EntryExitCalculator.applyReviewDecisions(
          state.originalResult,
          region,
          state.reviewDecisions,
          state.manualOverrides,
          state.cumulativeStartDate
        );

        renderSummary(state.currentResult);

        setTextStatus('待复核口岸选择已应用。', false);
      });
    });
  }

  function batchReview(decision) {
    if (!state.currentResult || !state.currentResult.reviewItems) return;
    for (const item of state.currentResult.reviewItems) {
      state.reviewDecisions[item.id] = decision;
    }
    const region = getRegion();
    setTextStatus('正在批量应用待复核口岸选择...', false);
    state.currentResult = window.EntryExitCalculator.applyReviewDecisions(
      state.originalResult,
      region,
      state.reviewDecisions,
      state.manualOverrides,
      state.cumulativeStartDate
    );
    renderSummary(state.currentResult);
    renderReviewList(state.currentResult);
    setTextStatus('已批量应用待复核口岸选择。', false);
  }
  window.batchReview = batchReview;

  function reviewOptionHtml(id, value, label, current) {
    const checked = value === current ? 'checked' : '';
    return `<label><input type="radio" name="review_${escapeAttr(id)}" data-id="${escapeAttr(id)}" value="${value}" ${checked} /> ${label}</label>`;
  }

  function setTextStatus(text, isError) {
    const el = $('textStatus');
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? '#c12121' : '#16524f';
    const box = $('progressBox');
    if (box) box.style.display = 'none';
  }

  function copySummary() {
    if (!state.currentResult) {
      alert('请先完成一次计算。');
      return;
    }

    const text = buildReadableSummaryText(state.currentResult);

    copyTextToClipboard(text)
      .then(() => {
        alert('已复制年度汇总文本。');
      })
      .catch(() => {
        showManualCopyBox(text);
      });
  }

  function buildReadableSummaryText(result) {
    const regionName = getRegionName(result.selectedRegion || getRegion());
    const rows = Array.isArray(result.summaryByYear) ? result.summaryByYear : [];

    const lines = [];

    lines.push(`您好，以下为我的${regionName}出入境有效离境天数统计结果：`);
    lines.push('');

    rows.forEach(row => {
      lines.push(
        `${row.year}年：有效离境天数为 ${formatDayNumber(row.validDays)} 天` +
        `（自然离境天数为 ${formatDayNumber(row.naturalDays)} 天；` +
        `扣除周末 ${formatDayNumber(row.weekendDeductDays)} 天，` +
        `扣除公众假期 ${formatDayNumber(row.govHolidayDeductDays)} 天，` +
        `扣除补假 ${formatDayNumber(row.compensatoryDeductDays)} 天，` +
        `扣除学校假期 ${formatDayNumber(row.schoolBreakDeductDays)} 天，` +
        `合计扣除 ${formatDayNumber(row.totalDeductDays)} 天）。`
      );
      lines.push('');
    });

    lines.push(
      `本次共识别出入境记录 ${formatDayNumber(result.recordCount || 0)} 条，` +
      `自动计入完整离境区间 ${formatDayNumber(result.intervalCount || 0)} 个，` +
      `待复核区间 ${formatDayNumber(result.reviewCount || 0)} 个。`
    );

    lines.push('以上结果由出入境记录本地解析后生成，仅用于个人整理和核对，正式用途请结合学校或主管部门要求复核。');
    lines.push('本结果由「港澳出入境有效天数计算器」生成。作者：LeeV，钱中里。');

    return lines.join('\n');
  }

  function formatDayNumber(value) {
    const num = Number(value || 0);

    if (Number.isInteger(num)) {
      return String(num);
    }

    return String(Math.round(num * 10) / 10);
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (err) {
        // Electron file:// 或部分浏览器环境下可能拒绝 clipboard API，继续使用兜底方案。
      }
    }

    return new Promise((resolve, reject) => {
      const textarea = document.createElement('textarea');

      try {
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '0';
        textarea.style.top = '0';
        textarea.style.width = '1px';
        textarea.style.height = '1px';
        textarea.style.opacity = '0';
        textarea.style.zIndex = '-1';

        document.body.appendChild(textarea);
        textarea.focus({ preventScroll: true });
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);

        const ok = document.execCommand('copy');
        textarea.remove();

        if (ok) {
          resolve();
        } else {
          reject(new Error('复制失败'));
        }
      } catch (err) {
        textarea.remove();
        reject(err);
      }
    });
  }

  function showManualCopyBox(text) {
    const existing = $('manualCopyOverlay');

    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'manualCopyOverlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '99999';
    overlay.style.background = 'rgba(15, 23, 42, 0.45)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '18px';

    const box = document.createElement('div');
    box.style.width = 'min(760px, 100%)';
    box.style.maxHeight = '86vh';
    box.style.overflow = 'auto';
    box.style.background = '#ffffff';
    box.style.borderRadius = '22px';
    box.style.boxShadow = '0 24px 80px rgba(15, 23, 42, 0.25)';
    box.style.padding = '22px';

    const title = document.createElement('h3');
    title.textContent = '自动复制失败，请手动复制';
    title.style.margin = '0 0 10px';

    const hint = document.createElement('p');
    hint.textContent = '请点击下方文本框后按 Ctrl+C 复制，或点击“再次尝试复制”。';
    hint.style.margin = '0 0 12px';
    hint.style.color = '#58667a';
    hint.style.lineHeight = '1.7';

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.width = '100%';
    textarea.style.minHeight = '320px';
    textarea.style.border = '1px solid rgba(10, 186, 181, 0.35)';
    textarea.style.borderRadius = '14px';
    textarea.style.padding = '14px';
    textarea.style.fontSize = '14px';
    textarea.style.lineHeight = '1.7';
    textarea.style.resize = 'vertical';
    textarea.style.background = '#dadcdd';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.flexWrap = 'wrap';
    actions.style.gap = '10px';
    actions.style.justifyContent = 'flex-end';
    actions.style.marginTop = '14px';

    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.textContent = '再次尝试复制';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = '关闭';

    retryButton.addEventListener('click', () => {
      copyTextToClipboard(text)
        .then(() => {
          overlay.remove();
          alert('已复制年度汇总文本。');
        })
        .catch(() => {
          textarea.focus();
          textarea.select();
          textarea.setSelectionRange(0, textarea.value.length);
          alert('仍未能自动复制，请按 Ctrl+C 手动复制文本框内容。');
        });
    });

    closeButton.addEventListener('click', () => {
      overlay.remove();
    });

    actions.appendChild(retryButton);
    actions.appendChild(closeButton);

    box.appendChild(title);
    box.appendChild(hint);
    box.appendChild(textarea);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    setTimeout(() => {
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
    }, 50);
  }

  function exportSummaryCsv() {
    if (!state.currentResult) {
      alert('请先完成一次计算。');
      return;
    }

    const rows = [['年份', '自然离境天数', '周末扣除', '公众假期扣除', '补假扣除', '学校假期扣除', '合计扣除', '有效离境天数']]
      .concat((state.currentResult.summaryByYear || []).map(r => [
        r.year,
        r.naturalDays,
        r.weekendDeductDays,
        r.govHolidayDeductDays,
        r.compensatoryDeductDays,
        r.schoolBreakDeductDays,
        r.totalDeductDays,
        r.validDays
      ]));

    rows.push([]);
    rows.push(['说明', '本文件由港澳出入境有效天数计算器生成。作者：LeeV，钱中里。']);

    downloadCsv(rows, '年度汇总.csv');
  }

  function exportCombinedCsv() {
    if (!state.currentResult) {
      alert('请先完成一次计算。');
      return;
    }

    const rows = [];
    // 第一部分：计算结果汇总
    rows.push(['=== 计算结果汇总 ===']);
    rows.push(['年份', '自然离境天数', '周末扣除', '公众假期扣除', '补假扣除', '学校假期扣除', '合计扣除', '有效离境天数']);
    (state.currentResult.summaryByYear || []).forEach(r => {
      rows.push([r.year, r.naturalDays, r.weekendDeductDays, r.govHolidayDeductDays, r.compensatoryDeductDays, r.schoolBreakDeductDays, r.totalDeductDays, r.validDays]);
    });

    // 第二部分：每日明细
    rows.push([]);
    rows.push(['=== 每日明细 ===']);
    rows.push(['日期', '状态', '原因/备注', '累计天数']);
    let cumulativeCounter = 0;
    (state.currentResult.dailyRows || []).forEach(row => {
      let status, reason, cumDay = '';
      if (row.validDay > 0) {
        cumulativeCounter++;
        status = '计入';
        reason = '累计有效天数';
        cumDay = cumulativeCounter;
      } else {
        status = '扣除';
        const reasons = [];
        if (row.weekendDeduct) reasons.push('周末');
        if (row.govHolidayDeduct) reasons.push(row.holidayName || '公众假期');
        if (row.compensatoryDeduct) reasons.push('补假');
        if (row.halfDayDeduct) reasons.push('半日假');
        if (row.schoolBreakDeduct) reasons.push('寒暑假');
        reason = reasons.length ? reasons.join('、') : '扣除';
      }
      rows.push([row.date, status, reason, cumDay]);
    });

    rows.push([]);
    rows.push(['说明', '本文件由港澳出入境有效天数计算器生成。作者：LeeV，钱中里。']);

    downloadCsv(rows, '出入境计算结果.csv');
  }

  function exportDailyCsv() {
    if (!state.currentResult) {
      alert('请先完成一次计算。');
      return;
    }

    const rows = [['日期', '年份', '自然天', '周末扣除', '公众假期扣除', '补假扣除', '半日假扣除', '学校假期扣除', '合计扣除', '有效天数', '假期名称', '学校假期']]
      .concat((state.currentResult.dailyRows || []).map(r => [
        r.date,
        r.year,
        r.naturalDay,
        r.weekendDeduct,
        r.govHolidayDeduct,
        r.compensatoryDeduct,
        r.halfDayDeduct,
        r.schoolBreakDeduct,
        r.totalDeduct,
        r.validDay,
        r.holidayName || '',
        r.schoolEventName || ''
      ]));

    rows.push([]);
    rows.push(['说明', '本文件由港澳出入境有效天数计算器生成。作者：LeeV，钱中里。']);

    downloadCsv(rows, '每日明细.csv');
  }

  function downloadCsv(rows, filename) {
    const csv = '\ufeff' + rows.map(row => {
      return row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',');
    }).join('\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  function setStatus(message, percent) {
    setTextStatus(message, false);
    setProgress(percent, message);
  }

  function setProgress(percent, label) {
    const box = $('progressBox');
    const fill = $('progressFill');
    const percentText = $('progressPercent');
    const labelText = $('progressLabel');

    if (!box || !fill || !percentText || !labelText) {
      return;
    }

    box.style.display = 'block';
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    fill.style.width = `${safePercent}%`;
    percentText.textContent = `${safePercent}%`;
    labelText.textContent = label || '处理中';
  }


  function showResultModal() {
    const result = state.currentResult;
    if (!result) return;

    // 计算合计有效天数和合计扣除天数
    let totalValid = 0;
    let totalDeduct = 0;
    for (const row of result.summaryByYear || []) {
      totalValid += row.validDays || 0;
      totalDeduct += row.totalDeductDays || 0;
    }

    const region = result.selectedRegion || 'macao';
    const regionName = region === 'hongkong' ? '香港' : region === 'other' ? '其它地区' : '澳门';

    // 结果为 0 且当前是澳门，自动切换到香港并重新计算
    if (totalValid === 0 && region === 'macao') {
      const hkRadio = document.querySelector('input[name="region"][value="hongkong"]');
      if (hkRadio && !hkRadio.checked) {
        hkRadio.checked = true;
        recalcWithCurrentOptions();
        return;
      }
    }

    // 结果为 0 且当前是香港，自动切换到其它留学生并重新计算
    if (totalValid === 0 && region === 'hongkong') {
      const otherRadio = document.querySelector('input[name="region"][value="other"]');
      if (otherRadio && !otherRadio.checked) {
        otherRadio.checked = true;
        recalcWithCurrentOptions();
        return;
      }
    }

    const modalTitle = $('modalTitle');
    if (modalTitle) modalTitle.textContent = `${regionName}计算结果`;

    $('modalNumber').textContent = Math.round(totalValid * 10) / 10;

    if (totalValid < 10) {
      $('modalLabel').textContent = '合计有效离境天数';
      if (totalValid === 0) {
        $('modalDetail').textContent = '当前结果为 0，请检查是否已选择正确的使用地区（03 卡片），或确认数据是否完整。';
      } else {
        $('modalDetail').textContent = `当前结果较少（${Math.round(totalValid * 10) / 10} 天），建议确认已选择正确的使用地区（03 卡片）及开学日期。`;
      }
    } else {
      $('modalLabel').textContent = '合计有效离境天数';
      const deductText = totalDeduct > 0 ? `扣除周末、公众假期等共计 ${Math.round(totalDeduct * 10) / 10} 天` : '未扣除任何天数';
      $('modalDetail').textContent = deductText;
    }

    const modal = $('resultModal');
    if (modal) modal.classList.add('show');

    // 如果自动去除了扣除限制，延迟显示天数较少提示弹窗
    if (state.autoDeductRemoved && !state.shortDaysTipShown) {
      state.shortDaysTipShown = true;
      setTimeout(() => {
        const tipModal = $('shortDaysModal');
        if (tipModal) {
          loadDeferredImages(tipModal);
          tipModal.classList.add('show');
        }
      }, 600);
    }
  }

  function closeResultModal() {
    const modal = $('resultModal');
    if (modal) modal.classList.remove('show');

    if (state.hasScrolledAfterCalc) return;
    state.hasScrolledAfterCalc = true;

    // 滚动到结果卡片
    const resultCard = $('resultCard');
    if (resultCard) {
      resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 延迟3秒后滚动到日历中部
    setTimeout(() => {
      const calendarCard = $('calendarCard');
      if (calendarCard) {
        calendarCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 3000);
  }
  window.closeResultModal = closeResultModal;

  function closeShortDaysModal() {
    const modal = $('shortDaysModal');
    if (modal) modal.classList.remove('show');
  }
  window.closeShortDaysModal = closeShortDaysModal;

  function showFeedbackModal() {
    const modal = $('feedbackModal');
    if (!modal) return;
    const rawText = $('rawText')?.value || '';
    const preview = $('feedbackRawPreview');
    if (preview) preview.value = rawText;
    const hidden = $('feedbackRawText');
    if (hidden) hidden.value = rawText;
    const next = $('feedbackNext');
    if (next) next.value = window.location.href;
    modal.classList.add('show');
  }
  window.showFeedbackModal = showFeedbackModal;

  function closeFeedbackModal() {
    const modal = $('feedbackModal');
    if (modal) modal.classList.remove('show');
  }
  window.closeFeedbackModal = closeFeedbackModal;

  function onFeedbackSubmit() {
    const btn = document.querySelector('#feedbackModal button[type="submit"]');
    if (btn) {
      btn.textContent = '⏳ 正在发送...';
      btn.disabled = true;
    }
    return true;
  }
  window.onFeedbackSubmit = onFeedbackSubmit;

  function scrollToResultOnMobile() {
    if (window.innerWidth > 640) {
      return;
    }

    if (state.hasScrolledAfterCalc) return;

    const resultCard = $('resultCard');
    if (!resultCard) {
      return;
    }

    setTimeout(() => {
      if (state.hasScrolledAfterCalc) return;
      state.hasScrolledAfterCalc = true;
      resultCard.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 250);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#027;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#075;');
  }

  // =========================
  // 出境入境总表
  // =========================
  function renderTripTable(result) {
    const tbody = $('tripTable').querySelector('tbody');
    if (!tbody || !result || !result.allIntervals) {
      return;
    }
    tbody.innerHTML = '';

    const intervals = [...result.allIntervals].sort((a, b) => a.exitDate.localeCompare(b.exitDate));
    let seqNo = 0;

    for (const interval of intervals) {
      const exitRegion = interval.exitRecord.portInfo.region;
      const entryRegion = interval.entryRecord.portInfo.region;
      const hasReview = exitRegion === 'review' || entryRegion === 'review';
      const sameSelected = exitRegion === result.selectedRegion && entryRegion === result.selectedRegion;

      if (!sameSelected && !hasReview) continue;

      const isAutoIncluded = !interval.isAutoIgnored;
      const override = state.manualOverrides ? state.manualOverrides[interval.id] : undefined;
      const isIncluded = override !== undefined ? override : isAutoIncluded;
      const isOverridden = interval.isAutoIgnored && state.manualOverrides[interval.id];
      const isIgnored = !isIncluded;
      if (isIncluded) seqNo++;

      const tr = document.createElement('tr');
      if (isIgnored) tr.classList.add('ignored-row');
      const daysDisplay = isIgnored ? '-' : `第${seqNo}段`;
      const note = interval.autoIgnoreReason ? `<span class="ignore-reason">（${escapeHtml(interval.autoIgnoreReason)}）</span>` : '';
      tr.innerHTML = `
        <td><input type="checkbox" data-id="${escapeAttr(interval.id)}" ${isIncluded ? 'checked' : ''}></td>
        <td>${escapeHtml(interval.exitDate)}</td>
        <td>${escapeHtml(interval.exitRecord.portRaw)}</td>
        <td>${escapeHtml(interval.entryDate)}</td>
        <td>${escapeHtml(interval.entryRecord.portRaw)}</td>
        <td>${daysDisplay}${note}</td>
      `;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        state.manualOverrides[id] = e.target.checked;

        const region = getRegion();
        setStatus('正在应用区间选择...', 88);

        state.currentResult = window.EntryExitCalculator.applyReviewDecisions(
          state.originalResult,
          region,
          state.reviewDecisions,
          state.manualOverrides
        );

        renderSummary(state.currentResult);
        renderCalendar(state.currentResult);
        setStatus('区间选择已应用。', 100);
      });
    });
  }

  // =========================
  // 万年历
  // =========================
  function changeCalendar(yearDelta, monthDelta) {
    let y = state.calendarYear + yearDelta;
    let m = state.calendarMonth + monthDelta;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    state.calendarYear = y;
    state.calendarMonth = m;
    renderCalendar(state.currentResult);
  }

  function renderCalendar(result) {
    const wrap = $('calendarWrap');
    if (!wrap || !result || !result.allIntervals) {
      return;
    }

    // 初始化年月选择器（只做一次）
    const yearSel = $('calYearSelect');
    const monthSel = $('calMonthSelect');
    if (yearSel && yearSel.options.length === 0) {
      const minYear = Math.min(...result.allIntervals.map(i => +i.exitDate.slice(0, 4))) || 2020;
      const maxYear = Math.max(...result.allIntervals.map(i => +i.entryDate.slice(0, 4))) || 2030;
      for (let y = minYear; y <= maxYear; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y + '年';
        yearSel.appendChild(opt);
      }
    }
    if (monthSel && monthSel.options.length === 0) {
      for (let m = 1; m <= 12; m++) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m + '月';
        monthSel.appendChild(opt);
      }
    }
    if (yearSel) yearSel.value = state.calendarYear;
    if (monthSel) monthSel.value = state.calendarMonth;
    if ($('calStartDate')) {
      $('calStartDate').value = state.cumulativeStartDate || '';
    }
    if ($('startDateInput')) {
      $('startDateInput').value = state.cumulativeStartDate || '';
    }

    wrap.className = 'calendar-wrap calendar-container mode-' + (state.calendarMode || 'month');
    wrap.innerHTML = buildCalendar(state.calendarYear, state.calendarMonth, result);

    // 年份视图：统一月份框宽度
    if (state.calendarMode === 'year') {
      requestAnimationFrame(() => {
        const months = wrap.querySelectorAll('.year-view-month');
        let maxW = 0;
        months.forEach(m => { maxW = Math.max(maxW, m.offsetWidth); });
        if (maxW > 0) {
          months.forEach(m => { m.style.width = maxW + 'px'; });
        }

        // 统一所有月份表格中“周一到周日”7列的宽度
        const tables = wrap.querySelectorAll('.year-view-month table.calendar-table');
        const colMaxWidths = [0, 0, 0, 0, 0, 0, 0];
        tables.forEach(table => {
          const ths = table.querySelectorAll('thead th');
          ths.forEach((th, idx) => {
            if (idx < 7) {
              colMaxWidths[idx] = Math.max(colMaxWidths[idx], th.offsetWidth);
            }
          });
        });
        tables.forEach(table => {
          const ths = table.querySelectorAll('thead th');
          ths.forEach((th, idx) => {
            if (idx < 7 && colMaxWidths[idx] > 0) {
              th.style.width = colMaxWidths[idx] + 'px';
              th.style.minWidth = colMaxWidths[idx] + 'px';
            }
          });
          table.querySelectorAll('tbody tr').forEach(tr => {
            tr.querySelectorAll('td').forEach((td, idx) => {
              if (idx < 7 && colMaxWidths[idx] > 0) {
                td.style.width = colMaxWidths[idx] + 'px';
                td.style.minWidth = colMaxWidths[idx] + 'px';
              }
            });
          });
        });
      });
    }

    // 恢复当前模式的缩放级别
    updateCalendarZoom(state.zoomLevels[state.calendarMode || 'year'] || 1);

    // 绑定日历内勾选框
    wrap.querySelectorAll('.cal-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const intervalId = e.target.dataset.intervalId;
        if (!intervalId) return;
        state.manualOverrides[intervalId] = e.target.checked;

        const region = getRegion();
        setStatus('正在应用区间选择...', 88);

        state.currentResult = window.EntryExitCalculator.applyReviewDecisions(
          state.originalResult,
          region,
          state.reviewDecisions,
          state.manualOverrides
        );

        renderSummary(state.currentResult);
        renderTripTable(state.currentResult);
        renderCalendar(state.currentResult);
        setStatus('区间选择已应用。', 100);
      });
    });
  }

  function buildCalendarData(result) {
    const region = result.selectedRegion || 'macao';
    const dayEvents = new Map();

    for (const interval of result.allIntervals || []) {
      const exitRegion = interval.exitRecord.portInfo.region;
      const entryRegion = interval.entryRecord.portInfo.region;
      const hasReview = exitRegion === 'review' || entryRegion === 'review';
      const sameSelected = exitRegion === region && entryRegion === region;
      if (!sameSelected && !hasReview) continue;

      const isAutoIncluded = !interval.isAutoIgnored;
      const override = state.manualOverrides ? state.manualOverrides[interval.id] : undefined;
      let isIncluded = override !== undefined ? override : isAutoIncluded;

      // 复核区间：根据复核决策判断是否计入
      if (hasReview) {
        const reviewDecision = state.reviewDecisions ? state.reviewDecisions[interval.id] : undefined;
        const itemDecision = interval.decision;
        const effectiveDecision = reviewDecision !== undefined ? reviewDecision : itemDecision;
        isIncluded = effectiveDecision === region;
      }

      const dates = window.EntryExitCalculator.expandDateRange(interval.exitDate, interval.entryDate);
      for (let i = 0; i < dates.length; i++) {
        const d = dates[i];
        if (!dayEvents.has(d)) dayEvents.set(d, []);
        if (d === interval.exitDate) {
          dayEvents.get(d).push({ type: 'exit', portRaw: interval.exitRecord.portRaw, intervalId: interval.id, isIncluded });
        }
        if (d === interval.entryDate) {
          dayEvents.get(d).push({ type: 'entry', portRaw: interval.entryRecord.portRaw, intervalId: interval.id, isIncluded });
        }
        if (d !== interval.exitDate && d !== interval.entryDate && isIncluded) {
          dayEvents.get(d).push({ type: 'stay', portRaw: '', intervalId: interval.id, isIncluded });
        }
      }
    }

    const dayMeta = new Map();
    const startDate = state.cumulativeStartDate;
    if (startDate && result.dailyRows) {
      let counter = 0;
      const sortedRows = [...result.dailyRows].sort((a, b) => a.date.localeCompare(b.date));
      for (const row of sortedRows) {
        if (row.date < startDate) continue;
        if (row.validDay > 0) {
          counter++;
          dayMeta.set(row.date, { type: 'cumulative', text: `累计第${counter}天`, shortText: `${counter}` });
        } else {
          const reasons = [];
          if (row.weekendDeduct) reasons.push('周末');
          if (row.govHolidayDeduct) reasons.push(row.holidayName || '公众假期');
          if (row.compensatoryDeduct) reasons.push('补假');
          if (row.halfDayDeduct) reasons.push('半日假');
          if (row.schoolBreakDeduct) reasons.push('寒暑假');
          const fullText = reasons.length ? reasons.join('、') : '扣除';
          dayMeta.set(row.date, { type: 'deduct', text: fullText, shortText: reasons.length ? '扣' : '扣' });
        }
      }
    }

    const deductMap = new Map();
    if (result.dailyRows) {
      for (const row of result.dailyRows) {
        deductMap.set(row.date, row);
      }
    }

    return { dayEvents, dayMeta, deductMap, region };
  }

  function renderDayCell(dateStr, day, weekday, monthLabel, dayEvents, dayMeta, deductMap, region, compactMode = false) {
    const exitLabel = region === 'hongkong' ? '出去香港' : '出去澳门';
    const entryLabel = '进入内地';
    const events = dayEvents.get(dateStr) || [];
    const deduct = deductMap.get(dateStr);
    const isWeekend = weekday === 0 || weekday === 6;
    const meta = dayMeta.get(dateStr);

    let cellClass = 'cal-day';
    let badges = [];
    let tooltip = [];
    let isIncludedDay = false;
    let firstIntervalId = '';

    for (const ev of events) {
      if (!firstIntervalId) firstIntervalId = ev.intervalId;
      if (ev.type === 'exit') {
        cellClass += ' cal-exit';
        if (!compactMode) {
          const full = `${exitLabel}${ev.portRaw ? '·' + ev.portRaw : ''}`;
          badges.push(`<span class="cal-badge exit-badge"><span class="badge-full">${full}</span><span class="badge-short">出</span></span>`);
        }
        tooltip.push(`${exitLabel}${ev.portRaw ? ': ' + ev.portRaw : ''}`);
        isIncludedDay = isIncludedDay || ev.isIncluded;
      } else if (ev.type === 'entry') {
        cellClass += ' cal-entry';
        if (!compactMode) {
          const full = `${entryLabel}${ev.portRaw ? '·' + ev.portRaw : ''}`;
          badges.push(`<span class="cal-badge entry-badge"><span class="badge-full">${full}</span><span class="badge-short">入</span></span>`);
        }
        tooltip.push(`${entryLabel}${ev.portRaw ? ': ' + ev.portRaw : ''}`);
        isIncludedDay = isIncludedDay || ev.isIncluded;
      } else if (ev.type === 'stay') {
        cellClass += ' cal-stay';
        isIncludedDay = isIncludedDay || ev.isIncluded;
      }
    }

    if (meta) {
      // 紧凑模式下：只显示累计天数数字，不显示扣除原因
      if (compactMode) {
        if (meta.type === 'cumulative') {
          badges.push(`<span class="cal-badge cum-index"><span class="badge-short">${meta.shortText || meta.text}</span></span>`);
        }
        // deduct 原因在紧凑模式下不显示
      } else {
        const cls = meta.type === 'cumulative' ? 'cum-index' : 'cum-index deduct-reason';
        const short = meta.shortText || meta.text;
        badges.push(`<span class="cal-badge ${cls}"><span class="badge-full">${meta.text}</span><span class="badge-short">${short}</span></span>`);
      }
    }

    if (events.length && !isIncludedDay) {
      cellClass += ' cal-ignored';
      tooltip.push('被忽略');
    }

    if (deduct) {
      const d = [];
      if (deduct.weekendDeduct) d.push('周末');
      if (deduct.govHolidayDeduct) d.push(deduct.holidayName || '公众假期');
      if (deduct.compensatoryDeduct) d.push('补假');
      if (deduct.halfDayDeduct) d.push('半日假');
      if (deduct.schoolBreakDeduct) d.push('寒暑假');
      if (d.length) {
        cellClass += ' cal-deduct';
        tooltip.push('扣除: ' + d.join('、'));
      }
    }

    if (isWeekend && !events.length) {
      cellClass += ' cal-weekend';
    }

    const titleAttr = tooltip.length ? ` title="${escapeHtml(tooltip.join(' | '))}"` : '';
    const checkbox = (!compactMode && events.length && firstIntervalId)
      ? `<input type="checkbox" class="cal-cb" data-interval-id="${escapeAttr(firstIntervalId)}" ${isIncludedDay ? 'checked' : ''}>`
      : '';
    const numHtml = (day === 1 && monthLabel)
      ? `<div class="cal-num" style="position:relative"><span style="position:absolute;left:0;top:-18px;font-size:12px;color:var(--primary);font-weight:700;white-space:nowrap;background:rgba(255, 255, 255, .74);padding:2px 6px;border-radius:4px;border:1px solid rgba(8, 163, 159, .28)">${escapeHtml(monthLabel)}</span>${day}</div>`
      : `<div class="cal-num">${day}</div>`;
    return `<td class="${cellClass}"${titleAttr}>${numHtml}${checkbox}<div class="cal-badges">${badges.join('')}</div></td>`;
  }

  function renderMonthTable(year, month, dayEvents, dayMeta, deductMap, region, monthLabel = '', skipHeader = false, compactMode = false) {
    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    let html = '<table class="calendar-table">';
    if (!skipHeader) {
      html += '<thead><tr><th>日</th><th>一</th><th>二</th><th>三</th><th>四</th><th>五</th><th>六</th></tr></thead>';
    }
    html += '<tbody>';

    let day = 1;
    for (let week = 0; week < 6; week++) {
      html += '<tr>';
      for (let w = 0; w < 7; w++) {
        if ((week === 0 && w < startWeekday) || day > daysInMonth) {
          html += '<td class="cal-empty"></td>';
          continue;
        }
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        html += renderDayCell(dateStr, day, w, (day === 1 ? monthLabel : ''), dayEvents, dayMeta, deductMap, region, compactMode);
        day++;
      }
      html += '</tr>';
      if (day > daysInMonth) break;
    }

    html += '</tbody></table>';
    return html;
  }

  function renderContinuousTable(months, dayEvents, dayMeta, deductMap, region) {
    if (!months || !months.length) return '';
    const start = new Date(months[0].year, months[0].month - 1, 1);
    const end = new Date(months[months.length - 1].year, months[months.length - 1].month, 0);

    const dates = [];
    let cur = new Date(start);
    while (cur <= end) {
      const y = cur.getFullYear(), m = cur.getMonth() + 1, d = cur.getDate();
      dates.push({
        dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        monthLabel: d === 1 ? `${y}年${m}月` : ''
      });
      cur.setDate(cur.getDate() + 1);
    }

    const firstWeekday = start.getDay();
    let html = '<table class="calendar-table continuous-calendar"><thead><tr><th>日</th><th>一</th><th>二</th><th>三</th><th>四</th><th>五</th><th>六</th></tr></thead><tbody>';

    html += '<tr>';
    for (let w = 0; w < firstWeekday; w++) {
      html += '<td class="cal-empty"></td>';
    }

    for (let i = 0; i < dates.length; i++) {
      const di = dates[i];
      const currentWeekday = (firstWeekday + i) % 7;
      html += renderDayCell(di.dateStr, di.day, currentWeekday, di.monthLabel, dayEvents, dayMeta, deductMap, region, false);
      if (currentWeekday === 6 && i < dates.length - 1) {
        html += '</tr><tr>';
      }
    }

    const lastWeekday = (firstWeekday + dates.length - 1) % 7;
    for (let w = lastWeekday + 1; w < 7; w++) {
      html += '<td class="cal-empty"></td>';
    }

    html += '</tr></tbody></table>';
    return html;
  }

  function buildCalendar(year, month, result) {
    const { dayEvents, dayMeta, deductMap, region } = buildCalendarData(result);
    const mode = state.calendarMode || 'scroll';

    if (mode === 'month') {
      return renderMonthTable(year, month, dayEvents, dayMeta, deductMap, region);
    }

    if (mode === 'scroll') {
      const months = [];
      const startDate = state.cumulativeStartDate || `${year}-09-01`;
      let [sy, sm] = startDate.split('-').map(Number);
      const now = new Date();
      let ey = now.getFullYear(), em = now.getMonth() + 1;
      while (sy < ey || (sy === ey && sm <= em)) {
        months.push({ year: sy, month: sm });
        sm++;
        if (sm > 12) { sm = 1; sy++; }
      }
      return '<div class="calendar-scroll-view">' + renderContinuousTable(months, dayEvents, dayMeta, deductMap, region) + '</div>';
    }

    if (mode === 'year') {
      return renderYearView(dayEvents, dayMeta, deductMap, region);
    }

    if (mode === 'full') {
      const months = [];
      let earliest = '', latest = '';
      for (const interval of result.allIntervals || []) {
        if (!earliest || interval.exitDate < earliest) earliest = interval.exitDate;
        if (!latest || interval.entryDate > latest) latest = interval.entryDate;
      }
      if (earliest && latest) {
        let [sy, sm] = earliest.slice(0, 7).split('-').map(Number);
        let [ey, em] = latest.slice(0, 7).split('-').map(Number);
        while (sy < ey || (sy === ey && sm <= em)) {
          months.push({ year: sy, month: sm });
          sm++;
          if (sm > 12) { sm = 1; sy++; }
        }
      }
      return renderContinuousTable(months, dayEvents, dayMeta, deductMap, region);
    }

    return '';
  }

  function renderYearView(dayEvents, dayMeta, deductMap, region) {
    // 收集所有有数据的日期，确定最早和最晚的月份
    const allDates = new Set(dayEvents.keys());
    for (const d of dayMeta.keys()) allDates.add(d);
    for (const d of deductMap.keys()) allDates.add(d);

    let minYear = 9999, minMonth = 12;
    let maxYear = 0, maxMonth = 1;
    for (const d of allDates) {
      const y = +d.slice(0, 4);
      const m = +d.slice(5, 7);
      if (y < minYear || (y === minYear && m < minMonth)) { minYear = y; minMonth = m; }
      if (y > maxYear || (y === maxYear && m > maxMonth)) { maxYear = y; maxMonth = m; }
    }
    if (allDates.size === 0) return '';

    let html = '<div class="year-view-grid">';
    let y = minYear, m = minMonth;
    const startDate = state.cumulativeStartDate;
    while (y < maxYear || (y === maxYear && m <= maxMonth)) {
      let monthLabel = `${y}年${m}月`;
      if (startDate) {
        const monthKey = `${y}-${String(m).padStart(2, '0')}`;
        const startMonthKey = startDate.slice(0, 7);
        if (monthKey < startMonthKey) {
          monthLabel += '<span style="color:#c12121;margin-left:4px;font-size:11px;font-weight:400">（开学前扣除）</span>';
        }
      }
      html += `<div class="year-view-month"><div class="yvm-title">${monthLabel}</div>${renderMonthTable(y, m, dayEvents, dayMeta, deductMap, region, '', false, true)}</div>`;
      m++;
      if (m > 12) { m = 1; y++; }
    }
    html += '</div>';
    return html;
  }

  // =========================
  // 节假日明细
  // =========================
  function renderHolidays() {
    const tbody = $('holidaysTable')?.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const region = getRegion();
    const holidays = window.EntryExitHolidays;
    const source = region === 'hongkong' ? holidays.HONGKONG_HOLIDAYS : holidays.MACAO_HOLIDAYS;

    const entries = Object.entries(source || {}).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [date, info] of entries) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(date)}</td>
        <td><input type="text" value="${escapeAttr(info.name)}" data-date="${escapeAttr(date)}" data-field="name" style="width:100%;padding:4px 8px;border-radius:6px;border:1px solid rgba(8, 163, 159, .28)"></td>
        <td>
          <select data-date="${escapeAttr(date)}" data-field="type" style="padding:4px 8px;border-radius:6px;border:1px solid rgba(8, 163, 159, .28)">
            <option value="gov" ${info.type==='gov'?'selected':''}>公众假期</option>
            <option value="compensatory" ${info.type==='compensatory'?'selected':''}>补假</option>
            <option value="half" ${info.type==='half'?'selected':''}>半日假</option>
          </select>
        </td>
        <td><input type="number" step="0.5" value="${escapeAttr(info.weight)}" data-date="${escapeAttr(date)}" data-field="weight" style="width:60px;padding:4px 8px;border-radius:6px;border:1px solid rgba(8, 163, 159, .28)"></td>
        <td><button type="button" class="del-holiday-btn" data-date="${escapeAttr(date)}">删除</button></td>
      `;
      tbody.appendChild(tr);
    }

    // 删除按钮
    tbody.querySelectorAll('.del-holiday-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const date = e.target.dataset.date;
        const region = getRegion();
        const holidays = window.EntryExitHolidays;
        const source = region === 'hongkong' ? holidays.HONGKONG_HOLIDAYS : holidays.MACAO_HOLIDAYS;
        delete source[date];
        renderHolidays();
        if (state.originalResult) recalcWithCurrentOptions();
      });
    });

    // 输入框自动保存
    tbody.querySelectorAll('input[data-field], select[data-field]').forEach(el => {
      el.addEventListener('change', (e) => {
        const date = e.target.dataset.date;
        const field = e.target.dataset.field;
        const region = getRegion();
        const holidays = window.EntryExitHolidays;
        const source = region === 'hongkong' ? holidays.HONGKONG_HOLIDAYS : holidays.MACAO_HOLIDAYS;
        if (source[date]) {
          if (field === 'weight') {
            source[date][field] = parseFloat(e.target.value) || 1;
          } else {
            source[date][field] = e.target.value;
          }
        }
        if (state.originalResult) recalcWithCurrentOptions();
      });
    });

    // === 学校假期（寒暑假） ===
    const sbTbody = $('schoolBreaksTable')?.querySelector('tbody');
    const sbWrap = $('schoolBreaksTable')?.closest('.table-wrap');
    const sbTitle = sbWrap?.previousElementSibling;
    if (sbTbody) {
      sbTbody.innerHTML = '';
      if (region === 'hongkong') {
        if (sbWrap) sbWrap.style.display = 'none';
        if (sbTitle) sbTitle.style.display = 'none';
      } else {
        if (sbWrap) sbWrap.style.display = '';
        if (sbTitle) sbTitle.style.display = '';
        const breaks = holidays.MACAO_SCHOOL_BREAKS || [];
        breaks.sort((a, b) => a.start.localeCompare(b.start));
        for (let idx = 0; idx < breaks.length; idx++) {
          const item = breaks[idx];
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><input type="date" value="${escapeAttr(item.start)}" data-idx="${idx}" data-field="start" style="padding:4px 8px;border-radius:6px;border:1px solid rgba(8, 163, 159, .28)"></td>
            <td><input type="date" value="${escapeAttr(item.end)}" data-idx="${idx}" data-field="end" style="padding:4px 8px;border-radius:6px;border:1px solid rgba(8, 163, 159, .28)"></td>
            <td><input type="text" value="${escapeAttr(item.name)}" data-idx="${idx}" data-field="name" style="width:100%;padding:4px 8px;border-radius:6px;border:1px solid rgba(8, 163, 159, .28)"></td>
            <td><button type="button" class="del-school-break-btn" data-idx="${idx}">删除</button></td>
          `;
          sbTbody.appendChild(tr);
        }

        sbTbody.querySelectorAll('.del-school-break-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx, 10);
            const holidays = window.EntryExitHolidays;
            holidays.MACAO_SCHOOL_BREAKS.splice(idx, 1);
            renderHolidays();
            if (state.originalResult) recalcWithCurrentOptions();
          });
        });

        sbTbody.querySelectorAll('input[data-field]').forEach(el => {
          el.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx, 10);
            const field = e.target.dataset.field;
            const holidays = window.EntryExitHolidays;
            const item = holidays.MACAO_SCHOOL_BREAKS[idx];
            if (item) {
              item[field] = e.target.value;
            }
            if (state.originalResult) recalcWithCurrentOptions();
          });
        });
      }
    }
  }

  function getTotalValidDays(result) {
    let totalValid = 0;
    for (const row of result.summaryByYear || []) {
      totalValid += row.validDays || 0;
    }
    return totalValid;
  }

  function renderDeductList(result) {
    const tbody = $('deductListTable')?.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const rows = result.dailyRows || [];
    const deductRows = rows.filter(r => r.totalDeduct > 0);

    if (!deductRows.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted)">没有被扣除的日期</td></tr>';
    } else {
      for (const row of deductRows) {
        const reasons = [];
        if (row.weekendDeduct > 0) reasons.push('周末');
        if (row.govHolidayDeduct > 0) reasons.push(row.holidayName || '公众假期');
        if (row.compensatoryDeduct > 0) reasons.push(row.holidayName || '补假');
        if (row.halfDayDeduct > 0) reasons.push(row.holidayName || '半日假');
        if (row.schoolBreakDeduct > 0) reasons.push(row.schoolEventName || '学校假期');

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(row.date)}</td>
          <td>周${escapeHtml(weekdayNames[row.weekday] || '')}</td>
          <td>${escapeHtml(reasons.join('、'))}</td>
          <td>${escapeHtml(row.totalDeduct)}</td>
        `;
        tbody.appendChild(tr);
      }
    }

    // 计算完成后默认展开被扣除记录列表
    const wrap = $('deductListWrap');
    const icon = $('deductListCard')?.querySelector('.collapse-icon');
    if (wrap) {
      wrap.classList.remove('collapsed');
      if (icon) icon.classList.remove('rotated');
    }
    // 默认展开时同步标题文字为"点击折叠"
    const cardTitle = $('deductListCard')?.querySelector('.card-title');
    if (cardTitle) {
      for (const node of cardTitle.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('点击展开')) {
          node.textContent = node.textContent.replace('点击展开', '点击折叠');
        }
      }
      const h2 = cardTitle.querySelector('h2');
      if (h2) {
        for (const node of h2.childNodes) {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('点击展开')) {
            node.textContent = node.textContent.replace('点击展开', '点击折叠');
          }
        }
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// 全局：下载当前页面为离线版
function downloadOffline() {
  const a = document.createElement('a');
  a.href = window.location.protocol === 'file:' ? window.location.href : new URL('./offline.html', window.location.href).href;
  a.download = '逗留计算器浏览器打开.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 全局：复制邮箱到剪贴板
function copyEmail() {
  const email = '1836035711@qq.com';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(email).then(() => {
      alert('邮箱已复制：' + email);
    }).catch(() => {
      fallbackCopy(email);
    });
  } else {
    fallbackCopy(email);
  }
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    alert('邮箱已复制：' + text);
  } catch (err) {
    alert('复制失败，请手动复制：' + text);
  }
  document.body.removeChild(ta);
}
