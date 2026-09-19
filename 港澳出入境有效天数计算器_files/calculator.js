(function () {
  function normalizeRules(rules) {
    return {
      deductWeekend: rules.deductWeekend !== false,
      deductGovHoliday: rules.deductGovHoliday !== false,
      deductCompensatory: rules.deductCompensatory !== false,
      deductHalfDay: rules.deductHalfDay === true,
      deductSchoolBreak: rules.deductSchoolBreak === true
    };
  }

  function preprocessText(text) {
    return String(text || '')
      .replace(/\r/g, '\n')
      .replace(/港珠澳大桥口\s*\n\s*岸/g, '港珠澳大桥口岸')
      .replace(/港珠澳大桥口\s+岸/g, '港珠澳大桥口岸')
      .replace(/港珠澳大橋口\s*\n\s*岸/g, '港珠澳大橋口岸')
      .replace(/港珠澳大橋口\s+岸/g, '港珠澳大橋口岸');
  }

  function parseMigrationRecords(text) {
    const normalized = preprocessText(text)
      .replace(/往来港澳通行\s*证/g, '往来港澳通行证')
      .replace(/往來港澳通行\s*證/g, '往来港澳通行证')
      .replace(/护\s*照/g, '护照')
      .replace(/旅\s*行\s*证/g, '旅行证')
      .replace(/港澳居民来往内地通行\s*证/g, '港澳居民来往内地通行证')
      .replace(/台湾居民来往大陆通行\s*证/g, '台湾居民来往大陆通行证')
      .replace(/台灣居民來往大陸通行\s*證/g, '台湾居民来往大陆通行证')
      .replace(/第\s*\d+\s*页\s*\/\s*共\s*\d+\s*页/g, ' ')
      .replace(/第\s*\d+\s*頁\s*\/\s*共\s*\d+\s*頁/g, ' ')
      .replace(/国家移民管理局/g, ' ')
      .replace(/出入境记录查询结果（电子文件）/g, ' ')
      .replace(/序号\s*出境\/入境\s*出入境日期\s*证件名称\s*证件号码\s*出入境口岸\s*航班号/g, ' ')
      .replace(/序號\s*出境\/入境\s*出入境日期\s*證件名稱\s*證件號碼\s*出入境口岸\s*航班號/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const records = [];
    const seen = new Set();

    const rowPattern = /(\d{1,6})\s+(入境|出境)\s+(\d{4}-\d{2}-\d{2})\s+(往来港澳通行证|护照|旅行证|港澳居民来往内地通行证|台湾居民来往大陆通行证|其他证件)\s+([A-Z0-9*]{5,25})\s+([\s\S]*?)(?=\s+\d{1,6}\s+(?:入境|出境)\s+\d{4}-\d{2}-\d{2}\s+(?:往来港澳通行证|护照|旅行证|港澳居民来往内地通行证|台湾居民来往大陆通行证|其他证件)\s+[A-Z0-9*]{5,25}\s+|$)/g;

    let match;
    while ((match = rowPattern.exec(normalized)) !== null) {
      const recordNo = Number(match[1]);
      const direction = match[2];
      const date = match[3];
      const documentType = match[4];
      const rawTail = match[6];
      const key = `${recordNo}_${direction}_${date}`;

      if (!recordNo || seen.has(key)) continue;
      seen.add(key);

      const portAndFlight = splitPortAndFlight(cleanPortSegment(rawTail));
      if (!portAndFlight.portRaw) continue;

      records.push({
        recordNo,
        direction,
        date,
        documentType,
        documentNo: '',
        portRaw: portAndFlight.portRaw,
        flightNo: portAndFlight.flightNo,
        portInfo: window.EntryExitPorts.normalizePort(portAndFlight.portRaw)
      });
    }

    if (records.length === 0) {
      const rawLines = preprocessText(text).split('\n').map(line => line.trim()).filter(Boolean);
      const lines = [];

      for (const line of rawLines) {
        if ((line === '岸' || line === '口岸') && lines.length && /港珠澳大[桥橋]口$/.test(lines[lines.length - 1])) {
          lines[lines.length - 1] += '岸';
          continue;
        }
        lines.push(line);
      }

      const linePattern = /^(\d{1,6})\s+(入境|出境)\s+(\d{4}-\d{2}-\d{2})\s+(.+?)\s+([A-Z0-9]{5,25})\s+(.+)$/;

      for (const line of lines) {
        const m = line.match(linePattern);
        if (!m) continue;

        const recordNo = Number(m[1]);
        const direction = m[2];
        const date = m[3];
        const key = `${recordNo}_${direction}_${date}`;
        if (!recordNo || seen.has(key)) continue;
        seen.add(key);

        const portAndFlight = splitPortAndFlight(cleanPortSegment(m[6]));
        if (!portAndFlight.portRaw) continue;

        records.push({
          recordNo,
          direction,
          date,
          documentType: m[4],
          documentNo: '',
          portRaw: portAndFlight.portRaw,
          flightNo: portAndFlight.flightNo,
          portInfo: window.EntryExitPorts.normalizePort(portAndFlight.portRaw)
        });
      }
    }

    records.sort((a, b) => a.recordNo - b.recordNo);
    return records;
  }

  function cleanPortSegment(value) {
    let text = String(value || '')
      .replace(/第\s*\d+\s*页\s*\/\s*共\s*\d+\s*页/g, ' ')
      .replace(/第\s*\d+\s*頁\s*\/\s*共\s*\d+\s*頁/g, ' ')
      .replace(/<IMAGE[\s\S]*?>/g, ' ')
      .replace(/查询人姓名[\s\S]*?航班号/g, ' ')
      .replace(/查詢人姓名[\s\S]*?航班號/g, ' ')
      .replace(/编号[:：][\s\S]*?查询日期[:：]\s*\d{4}年\d{1,2}月\d{1,2}日/g, ' ')
      .replace(/編號[:：][\s\S]*?查詢日期[:：]\s*\d{4}年\d{1,2}月\d{1,2}日/g, ' ')
      .replace(/序号|序號|出境\/入境|出入境日期|证件名称|證件名稱|证件号码|證件號碼|出入境口岸|航班号|航班號/g, ' ')
      .replace(/\s+/g, '')
      .trim();

    const knownPorts = [
      '港珠澳大桥口岸', '港珠澳大橋口岸',
      '澳门国际机场', '澳门机场', '澳門國際機場', '澳門機場',
      '横琴口岸', '橫琴口岸', '拱北口岸', '青茂口岸',
      '湾仔港', '灣仔港', '湾仔口岸', '灣仔口岸',
      '外港客运码头', '外港碼頭', '外港码头',
      '氹仔客运码头', '氹仔碼頭', '氹仔码头',
      '内港客运码头', '內港客運碼頭', '内港码头',
      '罗湖口岸', '羅湖口岸', '福田口岸', '文锦渡口岸', '文錦渡口岸',
      '莲塘口岸', '蓮塘口岸', '皇岗口岸', '皇崗口岸',
      '深圳湾口岸', '深圳灣口岸', '沙头角口岸', '沙頭角口岸',
      '香港西九龙站口岸', '香港西九龍站口岸', '香港国际机场', '香港机场', '香港國際機場', '香港機場',
      '北京首都国际机场', '北京首都机场', '首都机场',
      '北京大兴国际机场', '北京大兴机场', '大兴机场',
      '上海浦东国际机场', '上海浦东机场', '浦东机场',
      '上海虹桥国际机场', '上海虹桥机场', '虹桥机场',
      '广州白云国际机场', '广州白云机场', '广州机场',
      '深圳宝安国际机场', '深圳宝安机场', '深圳机场',
      '成都天府国际机场', '成都天府机场', '天府机场',
      '重庆江北国际机场', '重庆江北机场', '重庆机场',
      '福州长乐国际机场', '福州长乐机场', '福州机场',
      '杭州萧山国际机场', '杭州萧山机场', '杭州机场',
      '南京禄口国际机场', '南京禄口机场', '南京机场',
      '厦门高崎国际机场', '厦门高崎机场', '厦门机场',
      '武汉天河国际机场', '武汉天河机场', '武汉机场',
      '无锡硕放机场', '苏南硕放机场', '无锡机场',
      '宁波栎社国际机场', '宁波栎社机场', '宁波机场',
      '青岛胶东国际机场', '青岛胶东机场', '青岛机场',
      '泉州晋江机场', '晋江机场',
      '南昌昌北机场', '南昌机场',
      '南宁吴圩机场', '南宁机场',
      '合肥新桥机场', '合肥机场',
      '海口美兰机场', '海口机场',
      '贵阳龙洞堡机场', '贵阳机场',
      '太原武宿机场', '太原机场',
      '温州龙湾机场', '温州机场',
      '常州奔牛机场', '常州机场',
      'PEK', 'PKX', 'PVG', 'SHA', 'CAN', 'SZX', 'TFU', 'CKG', 'FOC', 'HGH', 'NKG', 'XMN', 'WUH', 'WUX', 'NGB', 'TAO', 'JJN', 'KHN', 'NNG', 'HFE', 'HAK', 'KWE', 'TYN', 'WNZ', 'CZX', 'MFM', 'HKG'
    ];

    for (const port of knownPorts) {
      if (text.includes(port)) {
        return port;
      }
    }

    return text;
  }

  function splitPortAndFlight(value) {
    let text = String(value || '').trim().replace(/\s+/g, '');
    let portRaw = text;
    let flightNo = '';
    const flightMatch = text.match(/^(.+(?:口岸|机场|機場|港|码头|碼頭|Airport|MFM|HKG))([A-Z]{2}\d{3,5})$/i);

    if (flightMatch) {
      portRaw = flightMatch[1];
      flightNo = flightMatch[2];
    }

    return { portRaw, flightNo };
  }

  function calculateResult(records, selectedRegion, rawRules) {
    const rules = normalizeRules(rawRules || {});

    // 独立判断口岸分布，用于复核默认决策（不受 selectedRegion 影响）
    let macaoCount = 0, hongkongCount = 0;
    for (const rec of records) {
      const r = rec.portInfo?.region;
      if (r === 'macao') macaoCount++;
      else if (r === 'hongkong') hongkongCount++;
    }
    const reviewDefault = (macaoCount === 0 && hongkongCount === 0)
      ? selectedRegion
      : (macaoCount >= hongkongCount ? 'macao' : 'hongkong');

    const chronological = [...records].sort((a, b) => b.recordNo - a.recordNo);
    const intervals = [];
    const anomalies = [];
    let pendingExit = null;

    for (const rec of chronological) {
      if (rec.direction === '出境') {
        if (pendingExit) {
          anomalies.push({ type: '连续出境未见入境', recordNo: pendingExit.recordNo, date: pendingExit.date, portRaw: pendingExit.portRaw });
        }
        pendingExit = rec;
        continue;
      }

      if (rec.direction === '入境') {
        if (!pendingExit) {
          anomalies.push({ type: '缺少前序出境', recordNo: rec.recordNo, date: rec.date, portRaw: rec.portRaw });
          continue;
        }

        intervals.push({
          id: `interval_${pendingExit.recordNo}_${rec.recordNo}`,
          exitRecord: pendingExit,
          entryRecord: rec,
          exitDate: pendingExit.date,
          entryDate: rec.date
        });
        pendingExit = null;
      }
    }

    if (pendingExit) {
      anomalies.push({ type: '缺少后续入境', recordNo: pendingExit.recordNo, date: pendingExit.date, portRaw: pendingExit.portRaw });
    }

    // 计算每个区间的自然天数
    for (const interval of intervals) {
      const dates = expandDateRange(interval.exitDate, interval.entryDate);
      interval.naturalDays = dates.length;
      interval.isAutoIgnored = false;
      interval.autoIgnoreReason = '';
    }

    const includedIntervals = [];
    const reviewItems = [];

    for (const interval of intervals) {
      if (interval.isAutoIgnored) continue;

      const exitRegion = interval.exitRecord.portInfo.region;
      const entryRegion = interval.entryRecord.portInfo.region;
      const hasReview = exitRegion === 'review' || entryRegion === 'review';
      const sameSelected = exitRegion === selectedRegion && entryRegion === selectedRegion;

      if (selectedRegion === 'other') {
        // 其它留学生模式：不看口岸，只要出境就算（但未知口岸仍需复核）
        if (!hasReview) {
          includedIntervals.push(interval);
        } else {
          const reviewDates = expandDateRange(interval.exitDate, interval.entryDate);
          reviewItems.push({
            id: interval.id,
            recordNo: `${interval.exitRecord.recordNo}/${interval.entryRecord.recordNo}`,
            date: `${interval.exitDate} 至 ${interval.entryDate}`,
            direction: '出境至入境',
            portRaw: `${interval.exitRecord.portRaw} → ${interval.entryRecord.portRaw}`,
            reason: buildReviewReason(interval),
            decision: reviewDefault,
            exitDate: interval.exitDate,
            entryDate: interval.entryDate,
            dates: reviewDates,
            macaoDailyRows: reviewDates.map(date => buildDailyDeductRow(date, 'macao', rules)),
            hongkongDailyRows: reviewDates.map(date => buildDailyDeductRow(date, 'hongkong', rules))
          });
        }
        continue;
      }

      if (sameSelected) {
        includedIntervals.push(interval);
        continue;
      }

      if (hasReview) {
        const reviewDates = expandDateRange(interval.exitDate, interval.entryDate);
        reviewItems.push({
          id: interval.id,
          recordNo: `${interval.exitRecord.recordNo}/${interval.entryRecord.recordNo}`,
          date: `${interval.exitDate} 至 ${interval.entryDate}`,
          direction: '出境至入境',
          portRaw: `${interval.exitRecord.portRaw} → ${interval.entryRecord.portRaw}`,
          reason: buildReviewReason(interval),
          decision: reviewDefault,
          exitDate: interval.exitDate,
          entryDate: interval.entryDate,
          dates: reviewDates,
          macaoDailyRows: reviewDates.map(date => buildDailyDeductRow(date, 'macao', rules)),
          hongkongDailyRows: reviewDates.map(date => buildDailyDeductRow(date, 'hongkong', rules))
        });
      }
    }

    const dayMap = new Map();
    for (const interval of includedIntervals) {
      const dates = expandDateRange(interval.exitDate, interval.entryDate);
      for (const date of dates) {
        if (!dayMap.has(date)) {
          dayMap.set(date, { date, year: Number(date.slice(0, 4)) });
        }
      }
    }

    const dailyRows = [...dayMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(row => buildDailyDeductRow(row.date, selectedRegion, rules));

    return {
      calcVersion: 'web-local-v2-global-scan',
      recordCount: records.length,
      intervalCount: includedIntervals.length,
      reviewCount: reviewItems.length,
      ignoredCount: intervals.filter(i => i.isAutoIgnored).length,
      summaryByYear: buildSummaryByYear(dailyRows),
      reviewItems,
      anomalies,
      dailyRows,
      rules,
      selectedRegion,
      allIntervals: intervals
    };
  }

  function applyReviewDecisions(result, region, decisions, manualOverrides, startDate) {
    const dayMap = new Map();

    // 1. 从 allIntervals 重新构建基础日期（支持手动排除/计入，支持起始日期过滤）
    for (const interval of result.allIntervals || []) {
      const exitRegion = interval.exitRecord.portInfo.region;
      const entryRegion = interval.entryRecord.portInfo.region;
      const hasReview = exitRegion === 'review' || entryRegion === 'review';
      const sameSelected = exitRegion === region && entryRegion === region;

      if (region === 'other') {
        // 其它留学生模式：不看口岸，未知口岸除外
        if (hasReview) continue;
      } else {
        if (hasReview) continue;
        if (!sameSelected) continue;
      }

      const isAutoIncluded = !interval.isAutoIgnored;
      const override = manualOverrides ? manualOverrides[interval.id] : undefined;
      const isIncluded = override !== undefined ? override : isAutoIncluded;

      if (!isIncluded) continue;

      const dates = expandDateRange(interval.exitDate, interval.entryDate);
      for (const date of dates) {
        if (startDate && date < startDate) continue;
        if (!dayMap.has(date)) {
          dayMap.set(date, { date, year: Number(date.slice(0, 4)) });
        }
      }
    }

    // 2. 构建 dailyRows
    let rows = [...dayMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(row => buildDailyDeductRow(row.date, region, result.rules));

    // 3. 添加 review items（同样过滤 startDate 之前的日期）
    const reviewItems = Array.isArray(result.reviewItems) ? result.reviewItems : [];
    const addedDateSet = new Set();
    let selectedCount = 0;

    for (const item of reviewItems) {
      const decision = (decisions && decisions[item.id]) || item.decision || 'exclude';
      if (decision !== region) continue;
      selectedCount += 1;

      const addRows = region === 'macao' ? (item.macaoDailyRows || []) : (item.hongkongDailyRows || []);
      const filteredAddRows = addRows.filter(row => row && row.date && (!startDate || row.date >= startDate));
      for (const row of filteredAddRows) {
        if (!dayMap.has(row.date)) addedDateSet.add(row.date);
      }
      rows = rows.concat(filteredAddRows);
    }

    const dedupRows = deduplicateDailyRows(rows);

    // 重新统计 intervalCount（考虑起始日期过滤）
    let includedIntervalCount = 0;
    for (const interval of result.allIntervals || []) {
      const exitRegion = interval.exitRecord.portInfo.region;
      const entryRegion = interval.entryRecord.portInfo.region;
      const hasReview = exitRegion === 'review' || entryRegion === 'review';
      const sameSelected = exitRegion === region && entryRegion === region;

      if (region === 'other') {
        if (hasReview) continue;
      } else {
        if (hasReview || !sameSelected) continue;
      }

      const isAutoIncluded = !interval.isAutoIgnored;
      const override = manualOverrides ? manualOverrides[interval.id] : undefined;
      const isIncluded = override !== undefined ? override : isAutoIncluded;

      if (!isIncluded) continue;

      // 检查该区间是否有任何日期在 startDate 之后
      if (startDate) {
        const dates = expandDateRange(interval.exitDate, interval.entryDate);
        const hasValidDate = dates.some(d => d >= startDate);
        if (!hasValidDate) continue;
      }

      includedIntervalCount++;
    }

    return {
      ...result,
      selectedRegion: region,
      dailyRows: dedupRows,
      summaryByYear: buildSummaryByYear(dedupRows),
      intervalCount: includedIntervalCount,
      reviewEffect: {
        selectedCount,
        addedNaturalDays: addedDateSet.size,
        message: buildReviewEffectMessage(selectedCount, addedDateSet.size)
      }
    };
  }

  function buildReviewEffectMessage(selectedCount, addedNaturalDays) {
    if (selectedCount === 0) return '尚未有复核记录计入当前地区';
    if (addedNaturalDays === 0) return `已将 ${selectedCount} 条复核记录计入当前地区，但这些日期已被同日去重规则覆盖，所以年度汇总未新增天数。`;
    return `已将 ${selectedCount} 条复核记录计入当前地区，新增 ${addedNaturalDays} 个自然离境日。`;
  }

  function deduplicateDailyRows(rows) {
    const map = new Map();

    for (const row of rows) {
      if (!row || !row.date) continue;
      const normalizedRow = {
        ...row,
        year: Number(row.year || String(row.date).slice(0, 4)),
        naturalDay: row.naturalDay || 1,
        weekendDeduct: row.weekendDeduct || 0,
        govHolidayDeduct: row.govHolidayDeduct || 0,
        compensatoryDeduct: row.compensatoryDeduct || 0,
        halfDayDeduct: row.halfDayDeduct || 0,
        schoolBreakDeduct: row.schoolBreakDeduct || 0,
        totalDeduct: row.totalDeduct || 0,
        validDay: row.validDay ?? 1
      };

      if (!map.has(normalizedRow.date)) {
        map.set(normalizedRow.date, normalizedRow);
        continue;
      }

      const oldRow = map.get(normalizedRow.date);
      const weekendDeduct = Math.max(oldRow.weekendDeduct || 0, normalizedRow.weekendDeduct || 0);
      const govHolidayDeduct = Math.max(oldRow.govHolidayDeduct || 0, normalizedRow.govHolidayDeduct || 0);
      const compensatoryDeduct = Math.max(oldRow.compensatoryDeduct || 0, normalizedRow.compensatoryDeduct || 0);
      const halfDayDeduct = Math.max(oldRow.halfDayDeduct || 0, normalizedRow.halfDayDeduct || 0);
      const schoolBreakDeduct = Math.max(oldRow.schoolBreakDeduct || 0, normalizedRow.schoolBreakDeduct || 0);
      const totalDeduct = Math.max(weekendDeduct, govHolidayDeduct, compensatoryDeduct, halfDayDeduct, schoolBreakDeduct);

      map.set(normalizedRow.date, {
        ...oldRow,
        weekendDeduct,
        govHolidayDeduct,
        compensatoryDeduct,
        halfDayDeduct,
        schoolBreakDeduct,
        totalDeduct,
        validDay: 1 - totalDeduct
      });
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  function buildReviewReason(interval) {
    const reasons = [];
    if (interval.exitRecord.portInfo.needReview) reasons.push(`出境口岸 ${interval.exitRecord.portRaw} 需要复核`);
    if (interval.entryRecord.portInfo.needReview) reasons.push(`入境口岸 ${interval.entryRecord.portRaw} 需要复核`);
    return reasons.length ? reasons.join('；') : '该区间无法自动判断属于澳门或香港';
  }

  function expandDateRange(startDate, endDate) {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.getTime() > end.getTime()) return [];

    const out = [];
    const cur = new Date(start.getTime());
    while (cur.getTime() <= end.getTime()) {
      out.push(formatDate(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return out;
  }

  function parseDate(dateStr) {
    const [y, m, d] = String(dateStr).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function formatDate(dateObj) {
    const y = dateObj.getUTCFullYear();
    const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getWeekday(dateStr) {
    return parseDate(dateStr).getUTCDay();
  }

  function getHoliday(region, date) {
    const holidays = window.EntryExitHolidays;
    if (region === 'macao') return holidays.MACAO_HOLIDAYS[date] || null;
    if (region === 'hongkong') return holidays.HONGKONG_HOLIDAYS[date] || null;
    return null;
  }

  function getSchoolBreak(region, date) {
    if (region !== 'macao') return null;
    for (const item of window.EntryExitHolidays.MACAO_SCHOOL_BREAKS) {
      if (date >= item.start && date <= item.end) return item;
    }
    return null;
  }

  function buildDailyDeductRow(date, region, rules) {
    const weekday = getWeekday(date);
    const isWeekend = weekday === 0 || weekday === 6;
    const holiday = getHoliday(region, date);
    const schoolBreak = getSchoolBreak(region, date);

    const weekendDeduct = rules.deductWeekend && isWeekend ? 1 : 0;
    const govHolidayDeduct = rules.deductGovHoliday && holiday && holiday.type === 'gov' ? holiday.weight : 0;
    const compensatoryDeduct = rules.deductCompensatory && holiday && holiday.type === 'compensatory' ? holiday.weight : 0;
    const halfDayDeduct = rules.deductHalfDay && holiday && holiday.type === 'half' ? holiday.weight : 0;
    const schoolBreakDeduct = rules.deductSchoolBreak && schoolBreak ? 1 : 0;
    const totalDeduct = Math.max(weekendDeduct, govHolidayDeduct, compensatoryDeduct, halfDayDeduct, schoolBreakDeduct);

    return {
      date,
      year: Number(date.slice(0, 4)),
      weekday,
      isWeekend,
      holidayName: holiday ? holiday.name : '',
      schoolEventName: schoolBreak ? schoolBreak.name : '',
      naturalDay: 1,
      weekendDeduct,
      govHolidayDeduct,
      compensatoryDeduct,
      halfDayDeduct,
      schoolBreakDeduct,
      totalDeduct,
      validDay: 1 - totalDeduct
    };
  }

  function buildSummaryByYear(dailyRows) {
    const map = new Map();
    for (const row of dailyRows) {
      if (!row || !row.date) continue;
      const year = Number(row.year || String(row.date).slice(0, 4));
      if (!map.has(year)) {
        map.set(year, { year, naturalDays: 0, weekendDeductDays: 0, govHolidayDeductDays: 0, compensatoryDeductDays: 0, schoolBreakDeductDays: 0, totalDeductDays: 0, validDays: 0 });
      }
      const item = map.get(year);
      item.naturalDays += row.naturalDay || 1;
      item.weekendDeductDays += row.weekendDeduct || 0;
      item.govHolidayDeductDays += row.govHolidayDeduct || 0;
      item.compensatoryDeductDays += row.compensatoryDeduct || 0;
      item.schoolBreakDeductDays += row.schoolBreakDeduct || 0;
      item.totalDeductDays += row.totalDeduct || 0;
      item.validDays += row.validDay ?? 1;
    }

    return Array.from(map.values()).sort((a, b) => a.year - b.year).map(item => ({
      year: item.year,
      naturalDays: roundNumber(item.naturalDays),
      weekendDeductDays: roundNumber(item.weekendDeductDays),
      govHolidayDeductDays: roundNumber(item.govHolidayDeductDays),
      compensatoryDeductDays: roundNumber(item.compensatoryDeductDays),
      schoolBreakDeductDays: roundNumber(item.schoolBreakDeductDays),
      totalDeductDays: roundNumber(item.totalDeductDays),
      validDays: roundNumber(item.validDays)
    }));
  }

  function buildSummaryByAcademicYear(dailyRows, startMonth = 9, endMonth = 6) {
    if (![startMonth, endMonth].every(month => Number.isInteger(month) && month >= 1 && month <= 12)) {
      throw new RangeError('学年月份必须在 1 至 12 月之间');
    }
    const groups = new Map();
    const crossesYear = endMonth < startMonth;
    for (const row of dailyRows) {
      const year = Number(row.date.slice(0, 4));
      const month = Number(row.date.slice(5, 7));
      const included = crossesYear ? month >= startMonth || month <= endMonth : month >= startMonth && month <= endMonth;
      if (!included) continue;
      const startYear = crossesYear && month <= endMonth ? year - 1 : year;
      if (!groups.has(startYear)) groups.set(startYear, []);
      groups.get(startYear).push({ ...row, year: startYear });
    }
    return [...groups.keys()].sort((a, b) => a - b).map(startYear => {
      const summary = buildSummaryByYear(groups.get(startYear))[0];
      const endYear = startYear + (crossesYear ? 1 : 0);
      return { ...summary, year: `${startYear}年${startMonth}月—${endYear}年${endMonth}月` };
    });
  }

  function roundNumber(num) {
    return Math.round((Number(num) || 0) * 10) / 10;
  }

  window.EntryExitCalculator = {
    parseMigrationRecords,
    calculateResult,
    applyReviewDecisions,
    buildSummaryByYear,
    buildSummaryByAcademicYear,
    deduplicateDailyRows,
    buildDailyDeductRow,
    expandDateRange,
    normalizeRules
  };
})();
