let students = [];
let subjects = {};

function maskDigits(str) {
    if (!window.DEMO_MODE) return str;
    return String(str).replace(/\d/g, '*');
}

function maskLogLine(line) {
    if (!window.DEMO_MODE) return line;
    // Mask 8-digit roll numbers
    line = line.replace(/\b\d{8}\b/g, '********');
    // Mask 7-digit + 1-letter admit card IDs (e.g. 1294823C)
    line = line.replace(/\b\d{7}[A-Za-z]\b/g, '********');
    // Mask 2-letter + 6-digit admit card IDs (e.g. AX251267)
    line = line.replace(/\b[A-Za-z]{2}\d{6}\b/g, '********');
    return line;
}

function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '—';
    return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

function formatPercent(num, useInlineMin = false) {
    if (num === null || num === undefined || isNaN(num)) return '—';
    if (useInlineMin && num < 1 && num > 0) return '<1%';
    return num.toFixed(1) + '%';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function formatLogLine(msg, statusType = 'info') {
    const timeStr = new Date().toTimeString().split(' ')[0]; // "HH:MM:SS"
    return `<div class="log-row log-row--${statusType}">[${timeStr}] ${escapeHtml(msg)}</div>`;
}

const CONN_LABELS = { idle: 'Idle', fetching: 'Fetching...', done: 'Done', halted: 'Halted' };
function setConnectionStatus(status) {
    const badge = document.getElementById('topbarConnectionBadge');
    const text = document.getElementById('topbarConnectionText');
    if (!badge || !text) return;
    badge.className = 'status-badge ' + status;
    text.textContent = CONN_LABELS[status] || status;
}

// ===== VIEW SWITCHING =====
function switchView(viewId, btn) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    if (btn) btn.classList.add('active');

    clearSearch();

    const searchInput = document.getElementById('searchInput');
    const searchWrapper = document.getElementById('searchWrapper');
    const schoolSelector = document.getElementById('globalSchoolSelector');
    const purgeBtn = document.getElementById('topbarPurgeBtn');

    if (viewId === 'scraper') {
        if (searchWrapper) searchWrapper.classList.add('hidden');
        if (schoolSelector) schoolSelector.classList.add('hidden');
        if (purgeBtn) purgeBtn.classList.add('hidden');
    } else {
        if (searchWrapper) searchWrapper.classList.remove('hidden');
        if (purgeBtn) purgeBtn.classList.remove('hidden');
        if (schoolSelector) {
            if (schoolSelector.options.length > 0) {
                schoolSelector.classList.remove('hidden');
            } else {
                schoolSelector.classList.add('hidden');
            }
        }
    }

    if (viewId === 'analytics') {
        if (searchInput) {
            searchInput.disabled = true;
            searchInput.placeholder = 'Search disabled in Analytics';
        }
        renderAnalytics();
    } else {
        if (searchInput) {
            searchInput.disabled = false;
            searchInput.placeholder = 'Search by name, roll, admit card...';
        }
    }
}

// ===== SEARCH =====
function handleSearch() {
    const raw = document.getElementById('searchInput').value.trim();
    const query = raw.toUpperCase();
    const dropdown = document.getElementById('searchDropdown');
    const clearBtn = document.getElementById('clearBtn');

    clearBtn.style.display = raw.length > 0 ? 'block' : 'none';

    if (query.length < 2) {
        dropdown.classList.remove('open');
        return;
    }

    const results = students.filter(s =>
        (s.name && s.name.toUpperCase().includes(query)) ||
        String(s.roll).includes(query) ||
        (s.admid && s.admid.toUpperCase().includes(query)) ||
        (s.mother && s.mother !== 'N/A' && s.mother.toUpperCase().includes(query)) ||
        (s.father && s.father !== 'N/A' && s.father.toUpperCase().includes(query))
    ).slice(0, 8);

    if (results.length === 0) {
        dropdown.innerHTML = '<div class="search-empty"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>No students found</div>';
    } else {
        dropdown.innerHTML = results.map(s => {
            const styles = getComputedStyle(document.documentElement);
            const avatarColors = [
                `rgb(${styles.getPropertyValue('--avatar-1-rgb').trim()})`,
                `rgb(${styles.getPropertyValue('--avatar-2-rgb').trim()})`,
                `rgb(${styles.getPropertyValue('--avatar-3-rgb').trim()})`,
                `rgb(${styles.getPropertyValue('--avatar-4-rgb').trim()})`,
                `rgb(${styles.getPropertyValue('--avatar-5-rgb').trim()})`
            ];
            const bgColor = avatarColors[s.roll % avatarColors.length];
            const initials = s.name ? s.name.split(' ').map(w => w[0]).join('').slice(0,2) : '??';
            const statusLower = s.result.toLowerCase();
            const displayStatus = s.result === 'PASS' ? 'Pass' : s.result === 'COMP' ? 'Compartment' : 'Fail';
            const titleName = toTitleCase(s.name);
            const displayPerc = s.percentage ? formatPercent(s.percentage, true) : 'N/A';
            return `
                <div class="search-item" onclick="openStudentDetail(${s.roll})">
                    <div class="avatar" style="background:${bgColor}">${initials}</div>
                    <div class="info">
                        <div class="name">${titleName}</div>
                        <div class="meta">${maskDigits(s.roll)} · ${displayPerc}</div>
                    </div>
                    <div class="badge ${statusLower}">${displayStatus}</div>
                </div>
            `;
        }).join('');
    }

    dropdown.classList.add('open');
}

function clearSearch() {
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) clearBtn.style.display = 'none';
    const drop = document.getElementById('searchDropdown');
    if (drop) drop.classList.remove('open');
}

// ===== STUDENT DETAIL =====
let currentDetailRoll = null;
function openStudentDetail(roll) {
    const student = students.find(s => s.roll === roll || String(s.roll) === String(roll));
    if (!student) return;
    
    currentDetailRoll = roll;

    clearSearch();

    document.getElementById('detailName').textContent = toTitleCase(student.name || 'Unknown');
    document.getElementById('detailRoll').textContent = maskDigits(student.roll);
    document.getElementById('detailAdmid').textContent = maskDigits(student.admid || 'N/A');
    document.getElementById('detailFather').textContent = toTitleCase(student.father || 'N/A');
    document.getElementById('detailMother').textContent = toTitleCase(student.mother || 'N/A');

    const statusEl = document.getElementById('detailStatus');
    const displayStatus = student.result === 'PASS' ? 'Pass' : student.result === 'COMP' ? 'Compartment' : 'Fail';
    statusEl.textContent = displayStatus;
    statusEl.className = 'detail-status ' + student.result.toLowerCase();

    const tbody = document.getElementById('detailMarks');
    const marksData = [];
    for (const [code, marks] of Object.entries(student.marks)) {
        if (['500', '502', '503'].includes(code)) continue;
        marksData.push({
            code: code,
            name: toTitleCase(subjects[code] || 'Unknown'),
            theory: marks.t,
            practical: marks.p,
            total: marks.t + marks.p
        });
    }

    const sortedIndices = marksData
        .map((d, i) => ({ index: i, total: d.total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
        .map(item => item.index);

    const marksHtml = marksData.map((d, i) => {
        const isBestOf5 = sortedIndices.includes(i);
        const rowClass = isBestOf5 ? 'best-of-5-row' : '';
        const totalStyle = d.total < 33 ? 'color: var(--fail); font-weight: 700;' : 'font-weight: 700;';
        
        return `<tr class="${rowClass}">
            <td>${d.code}</td>
            <td>${d.name}</td>
            <td class="numeric-col">${d.theory}</td>
            <td class="numeric-col">${d.practical}</td>
            <td class="numeric-col" style="${totalStyle}">${d.total}</td>
        </tr>`;
    });
    tbody.innerHTML = marksHtml.join('');

    // Percentage + Best of 5 Average
    document.getElementById('detailPerc').textContent = formatPercent(student.percentage || 0);
    const totalBest5 = sortedIndices.reduce((sum, idx) => sum + marksData[idx].total, 0);
    const best5Avg = sortedIndices.length > 0 ? totalBest5 / sortedIndices.length : 0;
    document.getElementById('detailBest5').textContent = formatPercent(best5Avg);

    document.getElementById('studentDetailOverlay').classList.add('open');
}

function closeDetail() {
    document.getElementById('studentDetailOverlay').classList.remove('open');
}

// ===== INIT DASHBOARD =====
function initDashboard() {
    if (!students || students.length === 0) {
        document.getElementById('kpiTotal').textContent = '0';
        document.getElementById('kpiAvg').textContent = '—';
        document.getElementById('kpiPass').textContent = '—';
        document.getElementById('kpiTop').textContent = '—';
        document.getElementById('rankingBody').innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <i class="fa-regular fa-folder-open empty-state-icon" aria-hidden="true"></i>
                        <div class="empty-state-title">No student records found</div>
                        <div class="empty-state-hint">Complete a fetch results dispatch first to index student records.</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    const sortEl = document.getElementById('sortRecordsSelect');
    const sortMode = sortEl ? sortEl.value : 'marks_desc';
    
    if (sortMode === 'marks_desc') {
        students.sort((a, b) => b.percentage - a.percentage);
    } else if (sortMode === 'marks_asc') {
        students.sort((a, b) => a.percentage - b.percentage);
    } else if (sortMode === 'roll_asc') {
        students.sort((a, b) => a.roll - b.roll);
    } else if (sortMode === 'roll_desc') {
        students.sort((a, b) => b.roll - a.roll);
    }

    const totalEl = document.getElementById('kpiTotal');
    const avgEl = document.getElementById('kpiAvg');
    const passEl = document.getElementById('kpiPass');
    const topEl = document.getElementById('kpiTop');

    totalEl.textContent = students.length;
    totalEl.classList.remove('green-tint', 'gold-tint');

    let totalPerc = 0, passCount = 0;
    students.forEach(s => { totalPerc += s.percentage; if (s.result === 'PASS') passCount++; });

    const avgVal = totalPerc / students.length;
    avgEl.textContent = formatPercent(avgVal);
    avgEl.classList.remove('green-tint', 'gold-tint');
    if (avgVal >= 90) {
        avgEl.classList.add('green-tint');
    } else if (avgVal >= 75) {
        avgEl.classList.add('gold-tint');
    }

    const passVal = (passCount / students.length) * 100;
    passEl.textContent = formatPercent(passVal);
    passEl.classList.remove('green-tint', 'gold-tint');
    if (passVal >= 90) {
        passEl.classList.add('green-tint');
    }

    let maxPerc = 0;
    for (const s of students) {
        if (s.percentage > maxPerc) maxPerc = s.percentage;
    }
    topEl.textContent = formatPercent(maxPerc);
    topEl.classList.remove('green-tint', 'gold-tint');
    if (maxPerc >= 95) {
        topEl.classList.add('green-tint');
    }

    const rankBody = document.getElementById('rankingBody');
    const rankRows = students.map((s, idx) => {
        const statusLower = s.result.toLowerCase();
        const pillClass = statusLower === 'pass' ? 'status-pill--pass' : statusLower === 'comp' ? 'status-pill--warn' : 'status-pill--fail';
        const displayStatus = s.result === 'PASS' ? 'Pass' : s.result === 'COMP' ? 'Compartment' : 'Fail';
        const titleName = toTitleCase(s.name || 'Unknown');
        return `<tr>
            <td style="font-weight:700;color:var(--text-muted);">${String(idx + 1).padStart(2, '0')}</td>
            <td class="roll-number">${maskDigits(s.roll)}</td>
            <td class="clickable-name" onclick="openStudentDetail(${s.roll})">${titleName}</td>
            <td class="numeric-col">${formatPercent(s.percentage)}</td>
            <td><span class="status-pill ${pillClass}">${displayStatus}</span></td>
        </tr>`;
    });
    rankBody.innerHTML = rankRows.join('');
}

// ===== ANALYTICS =====
let currentAnalyticsFilter = 'all';

function setAnalyticsFilter(filter, btn) {
    currentAnalyticsFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderAnalytics();
}

function getStream(s) {
    const codes = Object.keys(s.marks);
    if (codes.includes('042') || codes.includes('043')) return 'science';
    if (codes.includes('055') || codes.includes('054')) return 'commerce';
    return 'arts';
}

function getSubjectCategory(subjectName) {
    const name = subjectName.trim().toUpperCase();
    const sciences = [
        'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'MATHEMATICS', 'APPLIED MATHEMATICS',
        'COMPUTER SCIENCE', 'INFORMATICS PRACTICE', 'INFORMATICS PRACTICES',
        'INFORMATION TECHNOLOGY', 'ARTIFICIAL INTELLIGENCE'
    ];
    const commerce = [
        'ACCOUNTANCY', 'BUSINESS STUDIES', 'ECONOMICS', 'ENTREPRENEURSHIP',
        'LEGAL STUDIES', 'BANKING'
    ];
    const humanities = [
        'HISTORY', 'POLITICAL SCIENCE', 'GEOGRAPHY', 'PSYCHOLOGY', 'SOCIOLOGY'
    ];
    const languages = [
        'ENGLISH CORE', 'HINDI CORE', 'PUNJABI'
    ];
    const artsVocational = [
        'PAINTING', 'HINDUSTANI MUSIC VOCAL', 'ODISSI-DANCE', 'BEAUTY & WELLNESS',
        'PHYSICAL EDUCATION', 'HEALTH & PHYSICAL EDUCATION', 'HOME SCIENCE',
        'YOGA', 'GENERAL STUDIES', 'WORK EXPERIENCE'
    ];
    if (sciences.some(s => name.includes(s))) return 'SCIENCES';
    if (commerce.some(s => name.includes(s))) return 'COMMERCE';
    if (humanities.some(s => name.includes(s))) return 'HUMANITIES';
    if (languages.some(s => name.includes(s))) return 'LANGUAGES';
    if (artsVocational.some(s => name.includes(s))) return 'ARTS & VOCATIONAL';
    return 'ARTS & VOCATIONAL';
}

function renderAnalytics() {
    const emptyStateEl = document.getElementById('analyticsEmptyState');
    const chartsContentEl = document.getElementById('analyticsChartsContent');
    
    if (!students || students.length === 0) {
        if (emptyStateEl) emptyStateEl.classList.remove('hidden');
        if (chartsContentEl) chartsContentEl.classList.add('hidden');
        return;
    } else {
        if (emptyStateEl) emptyStateEl.classList.add('hidden');
        if (chartsContentEl) chartsContentEl.classList.remove('hidden');
    }

    if (typeof Plotly === 'undefined') return;

    let filteredStudents = students;
    if (currentAnalyticsFilter !== 'all') {
        filteredStudents = students.filter(s => getStream(s) === currentAnalyticsFilter);
    }

    const styles = getComputedStyle(document.documentElement);
    const getRGBStr = (varName) => `rgb(${styles.getPropertyValue(varName).trim()})`;
    const getRGBAStr = (varName, alpha) => `rgba(${styles.getPropertyValue(varName).trim()}, ${alpha})`;

    const colors = {
        gold: getRGBStr('--gold-rgb'),
        pass: getRGBStr('--pass-rgb'),
        fail: getRGBStr('--fail-rgb'),
        textMain: getRGBStr('--text-main-rgb'),
        textMuted: getRGBStr('--text-muted-rgb'),
        border: getRGBAStr('--border-rgb', 0.08),
        bgPanel2: getRGBStr('--bg-panel-2-rgb'),
        gridLines: getRGBAStr('--border-rgb', 0.12)
    };

    const chartFont = { color: colors.textMuted, family: 'Inter, sans-serif', size: 10 };
    const hoverStyle = {
        bgcolor: colors.bgPanel2,
        bordercolor: colors.border,
        font: { family: 'Inter, sans-serif', color: colors.textMain, size: 11 }
    };

    const chartLayout = {
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: chartFont,
        margin: { t: 20, b: 30, l: 35, r: 10 },
        hoverlabel: hoverStyle,
        showlegend: false
    };

    const gridConfig = {
        gridcolor: colors.gridLines,
        zerolinecolor: colors.gridLines,
        tickfont: { size: 9, family: 'Inter, sans-serif', color: colors.textMuted },
        titlefont: { size: 10, color: colors.textMuted, family: 'Inter, sans-serif' }
    };
    
    // 1. Pass/Fail Distribution Donut
    const resultCounts = { 'PASS': 0, 'COMP': 0, 'FAIL': 0 };
    filteredStudents.forEach(s => { if(resultCounts[s.result] !== undefined) resultCounts[s.result]++; });

    const passCount = filteredStudents.filter(s => s.result === 'PASS').length;
    const passRateVal = filteredStudents.length > 0 ? (passCount / filteredStudents.length) * 100 : 0;
    const passRateText = formatPercent(passRateVal, false);

    Plotly.react('chart-pass-fail', [{
        values: [resultCounts.PASS, resultCounts.COMP, resultCounts.FAIL],
        labels: ['Pass', 'Compartment', 'Fail'],
        type: 'pie',
        marker: { colors: [colors.pass, colors.gold, colors.fail] },
        hole: 0.6,
        textinfo: 'percent',
        hoverinfo: 'label+value',
        textposition: 'outside'
    }], {
        ...chartLayout,
        margin: { t: 15, b: 15, l: 15, r: 15 },
        annotations: [
            {
                font: {
                    family: 'JetBrains Mono, monospace',
                    size: 16,
                    color: colors.textMain,
                    weight: 'bold'
                },
                showarrow: false,
                text: passRateText,
                x: 0.5,
                y: 0.55
            },
            {
                font: {
                    family: 'Inter, sans-serif',
                    size: 8,
                    color: colors.textMuted
                },
                showarrow: false,
                text: 'PASS RATE',
                x: 0.5,
                y: 0.40
            }
        ]
    }, { displayModeBar: false, responsive: true });

    // Pie click -> modal
    const pfChart = document.getElementById('chart-pass-fail');
    if (pfChart.removeAllListeners) pfChart.removeAllListeners('plotly_click');
    pfChart.on('plotly_click', function(data) {
        const label = data.points[0].label;
        const statusMap = { 'Pass': 'PASS', 'Compartment': 'COMP', 'Fail': 'FAIL' };
        const specificStudents = filteredStudents.filter(s => s.result === statusMap[label]).sort((a, b) => b.percentage - a.percentage);

        document.getElementById('modalTitle').innerHTML = `${label} students (${specificStudents.length})`;
        const tbody = document.getElementById('modalBody');
        tbody.innerHTML = specificStudents.map(s => {
            const statusLower = s.result.toLowerCase();
            const pillClass = statusLower === 'pass' ? 'status-pill--pass' : statusLower === 'comp' ? 'status-pill--warn' : 'status-pill--fail';
            const displayStatus = s.result === 'PASS' ? 'Pass' : s.result === 'COMP' ? 'Compartment' : 'Fail';
            return `<tr>
                <td class="roll-number">${maskDigits(s.roll)}</td>
                <td class="clickable-name" onclick="document.getElementById('studentModal').classList.remove('open');openStudentDetail(${s.roll})">${toTitleCase(s.name)}</td>
                <td class="numeric-col">${formatPercent(s.percentage)}</td>
                <td><span class="status-pill ${pillClass}">${displayStatus}</span></td>
            </tr>`;
        }).join('');
        document.getElementById('studentModal').classList.add('open');
    });

    // 2. Score Distribution Histogram
    const scores = filteredStudents.map(s => s.percentage);
    Plotly.react('chart-score-dist', [{
        x: scores, type: 'histogram',
        marker: { color: getRGBAStr('--gold-rgb', 0.25), line: { color: colors.gold, width: 1 } },
        xbins: { start: 0, end: 100, size: 5 }
    }], {
        ...chartLayout,
        xaxis: { ...gridConfig, title: 'Score (%)' },
        yaxis: { ...gridConfig, title: 'Students count' }
    }, { displayModeBar: false, responsive: true });

    // 3. Subject Averages Horizontal Bar
    const subData = {};
    filteredStudents.forEach(s => {
        for (const [code, marks] of Object.entries(s.marks)) {
            if (['500', '502', '503'].includes(code)) continue;
            if (!subData[code]) subData[code] = { total: 0, count: 0 };
            subData[code].total += (marks.t + marks.p);
            subData[code].count++;
        }
    });
    const subLabels = [], subAvgs = [];
    for (const code in subData) { 
        subLabels.push(toTitleCase(subjects[code] || code)); 
        subAvgs.push(subData[code].total / subData[code].count); 
    }

    const sortedAvgData = subLabels.map((l, i) => ({ label: l, avg: subAvgs[i] }))
        .sort((a, b) => a.avg - b.avg);

    Plotly.react('chart-subject-avg', [{
        x: sortedAvgData.map(d => d.avg),
        y: sortedAvgData.map(d => d.label),
        type: 'bar',
        orientation: 'h',
        marker: { color: getRGBAStr('--gold-rgb', 0.35), line: { color: colors.gold, width: 1 } }
    }], {
        ...chartLayout,
        margin: { t: 10, b: 30, l: 140, r: 10 },
        xaxis: { ...gridConfig, title: 'Average score (%)' },
        yaxis: { ...gridConfig, tickfont: { size: 11, family: 'Inter, sans-serif', color: colors.textMuted } }
    }, { displayModeBar: false, responsive: true });

    // 4. Performance Categories Stacked Bar
    const catCounts = { 'Excellent (>=90%)': 0, 'Good (75-89%)': 0, 'Average (50-74%)': 0, 'Needs Attention (<50%)': 0 };
    filteredStudents.forEach(s => { if(s.category && catCounts[s.category] !== undefined) catCounts[s.category]++; });
    
    const totalStudentsCount = filteredStudents.length || 1;
    const categoryTraces = Object.entries(catCounts).map(([catName, count]) => {
        const percentage = (count / totalStudentsCount) * 100;
        let colorVal = colors.textMuted;
        if (catName.startsWith('Excellent')) colorVal = colors.pass;
        else if (catName.startsWith('Good')) colorVal = colors.gold;
        else if (catName.startsWith('Average')) colorVal = getRGBAStr('--text-muted-rgb', 0.4);
        else if (catName.startsWith('Needs')) colorVal = colors.fail;

        return {
            x: [percentage],
            y: ['Tiers'],
            name: catName,
            type: 'bar',
            orientation: 'h',
            text: percentage > 5 ? formatPercent(percentage) : '',
            textposition: 'inside',
            insidetextanchor: 'middle',
            marker: {
                color: colorVal,
                line: { color: colors.border, width: 1 }
            }
        };
    });

    Plotly.react('chart-category-donut', categoryTraces, {
        ...chartLayout,
        barmode: 'stack',
        xaxis: { showgrid: false, showticklabels: false, range: [0, 100], zeroline: false },
        yaxis: { showgrid: false, showticklabels: false, zeroline: false },
        showlegend: true,
        legend: {
            orientation: 'h',
            y: -0.25,
            x: 0.5,
            xanchor: 'center',
            font: { size: 9, color: colors.textMuted }
        },
        margin: { t: 10, b: 40, l: 10, r: 10 }
    }, { displayModeBar: false, responsive: true });

    // 5. Marks Spread Box Plot
    const streamScores = { science: [], commerce: [], arts: [] };
    filteredStudents.forEach(s => {
        streamScores[getStream(s)].push(s.percentage);
    });

    const boxTraces = [
        {
            y: streamScores.science,
            type: 'box',
            name: 'Science',
            boxpoints: 'outliers',
            marker: { color: colors.gold }
        },
        {
            y: streamScores.commerce,
            type: 'box',
            name: 'Commerce',
            boxpoints: 'outliers',
            marker: { color: colors.pass }
        },
        {
            y: streamScores.arts,
            type: 'box',
            name: 'Humanities',
            boxpoints: 'outliers',
            marker: { color: colors.fail }
        }
    ];

    Plotly.react('chart-theory-practical', boxTraces, {
        ...chartLayout,
        xaxis: { ...gridConfig, title: '' },
        yaxis: { ...gridConfig, title: 'Score (%)', range: [0, 105] },
        margin: { t: 20, b: 30, l: 45, r: 10 }
    }, { displayModeBar: false, responsive: true });

    // 6. Subject Failure Rates Bar
    const failData = {};
    filteredStudents.forEach(s => {
        for (const [code, marks] of Object.entries(s.marks)) {
            if (['500', '502', '503'].includes(code)) continue;
            if (!failData[code]) failData[code] = { total: 0, fails: 0 };
            failData[code].total++;
            // NOTE: Duplicated in core_analyzer.py process_student_data(). Keep in sync.
            let p_m = 20;
            if (['029', '048', '042', '043', '044', '065', '083'].includes(code)) p_m = 30;
            else if (['049', '034'].includes(code)) p_m = 70;
            else if (['811', '802'].includes(code)) p_m = 40;
            let t_m = 100 - p_m;
            let pt = 26; if(t_m==70) pt=23; else if(t_m==30) pt=10; else if(t_m==60) pt=20; else if(t_m==100) pt=33;
            let pp = 7; if(p_m==30) pp=10; else if(p_m==70) pp=23; else if(p_m==40) pp=13; else if(p_m==0) pp=0;
            if ((marks.t + marks.p) < 33 || (t_m > 0 && marks.t < pt) || (p_m > 0 && marks.p < pp)) {
                failData[code].fails++;
            }
        }
    });
    const failLabels = [], failRates = [];
    for (const code in failData) {
        if (failData[code].total > 0) {
            failLabels.push(toTitleCase(subjects[code] || code));
            failRates.push((failData[code].fails / failData[code].total) * 100);
        }
    }

    const sortedFailData = failLabels.map((l, i) => ({ label: l, rate: failRates[i] }))
        .sort((a, b) => a.rate - b.rate);

    Plotly.react('chart-subject-fail', [{
        x: sortedFailData.map(d => d.rate),
        y: sortedFailData.map(d => d.label),
        type: 'bar',
        orientation: 'h',
        marker: { color: getRGBAStr('--fail-rgb', 0.45), line: { color: colors.fail, width: 1 } }
    }], {
        ...chartLayout,
        margin: { t: 8, b: 40, l: 140, r: 16 },
        xaxis: { ...gridConfig, title: 'Failure rate (%)' },
        yaxis: { ...gridConfig, tickfont: { size: 11, family: 'Inter, sans-serif', color: colors.textMuted } }
    }, { displayModeBar: false, responsive: true });

    // Stream Toppers
    const streams = { science: [], commerce: [], arts: [] };
    students.forEach(s => { streams[getStream(s)].push(s); });
    
    ['science', 'commerce', 'arts'].forEach(stream => {
        streams[stream].sort((a, b) => b.percentage - a.percentage);
        const tbody = document.getElementById(`${stream}Toppers`);
        if (tbody) {
            tbody.innerHTML = streams[stream].slice(0, 5).map((s, idx) => {
                const badgeClass = idx === 0 ? 'rank-first' : 'rank-other';
                const rankBadge = `<span class="rank-badge ${badgeClass}">#${idx + 1}</span>`;
                return `<tr>
                    <td>${rankBadge}</td>
                    <td class="clickable-name" onclick="openStudentDetail(${s.roll})">${toTitleCase(s.name)}</td>
                    <td class="numeric-col">${formatPercent(s.percentage)}</td>
                </tr>`;
            }).join('');
        }
    });

    const mvps = {};
    filteredStudents.forEach(s => {
        for (const [code, marks] of Object.entries(s.marks)) {
            if (['500', '502', '503'].includes(code)) continue;
            const tot = marks.t + marks.p;
            if (!mvps[code] || tot > mvps[code].score) mvps[code] = { name: s.name, roll: s.roll, score: tot };
        }
    });
    const mvpGrid = document.getElementById('mvpGrid');
    if (mvpGrid) {
        const categories = {
            'SCIENCES': [],
            'COMMERCE': [],
            'HUMANITIES': [],
            'LANGUAGES': [],
            'ARTS & VOCATIONAL': []
        };
        
        Object.keys(mvps).forEach(code => {
            const subName = toTitleCase(subjects[code] || code);
            const cat = getSubjectCategory(subName);
            if (categories[cat]) {
                categories[cat].push({ code, subName, ...mvps[code] });
            }
        });
        
        let html = '';
        Object.entries(categories).forEach(([catName, items]) => {
            if (items.length === 0) return;
            
            html += `
            <div class="toppers-category-section">
                <div class="toppers-category-header">
                    <span class="toppers-category-title">${catName}</span>
                    <hr class="toppers-category-divider">
                </div>
                <div class="toppers-cards-grid">
                    ${items.map(item => {
                        const isPerfect = item.score === 100;
                        const perfectTag = isPerfect ? '<span class="perfect-tag">PERFECT</span>' : '';
                        const cardClass = isPerfect ? 'mvp-card perfect-score-card' : 'mvp-card';
                        return `
                        <div class="${cardClass}" onclick="openStudentDetail(${item.roll})">
                            <div class="mvp-card-top">
                                <span class="sub-name">${item.subName}</span>
                                ${perfectTag}
                              </div>
                              <span class="stu-name">${toTitleCase(item.name)}</span>
                              <span class="stu-score">${item.score}<span class="score-muted">/100</span></span>
                          </div>`;
                      }).join('')}
                  </div>
              </div>`;
        });
        mvpGrid.innerHTML = html;
    }
}


// ===== SCRAPER & API INTEGRATION =====
let currentSchoolNo = "";
let dashboardFetchId = 0;

function scheduleDashboardRender() {
    const run = () => {
        initDashboard();
        if (document.getElementById('view-analytics').classList.contains('active')) {
            renderAnalytics();
        }
    };
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 500 });
    } else {
        setTimeout(run, 0);
    }
}

async function loadSchools() {
    try {
        const res = await fetch('/api/list_schools');
        const data = await res.json();
        const selector = document.getElementById('globalSchoolSelector');
        const isScraperActive = document.getElementById('view-scraper').classList.contains('active');
        if (data.schools && data.schools.length > 0) {
            selector.innerHTML = '';
            data.schools.forEach(school => {
                const opt = document.createElement('option');
                opt.value = school;
                opt.textContent = "School " + maskDigits(school);
                selector.appendChild(opt);
            });
            if (!currentSchoolNo || !data.schools.includes(currentSchoolNo)) {
                currentSchoolNo = data.schools[0];
            }
            selector.value = currentSchoolNo;
            
            if (!isScraperActive) {
                selector.classList.remove('hidden');
            } else {
                selector.classList.add('hidden');
            }
        } else {
            selector.classList.add('hidden');
            currentSchoolNo = "";
        }
    } catch(e) {
        console.error("Error loading schools", e);
    }
}

function handleSchoolChange() {
    currentSchoolNo = document.getElementById('globalSchoolSelector').value;
    loadDashboardData();
}

async function loadDashboardData() {
    if (!currentSchoolNo) return;
    const fetchId = ++dashboardFetchId;
    try {
        const res = await fetch('/api/dashboard_data?school_no=' + encodeURIComponent(currentSchoolNo));
        if (fetchId !== dashboardFetchId) return;
        const data = await res.json();
        if (fetchId !== dashboardFetchId) return;
        if (data.error) {
            students = [];
            subjects = {};
            document.getElementById('kpiTotal').textContent = '0';
            document.getElementById('kpiAvg').textContent = '—';
            document.getElementById('kpiPass').textContent = '—';
            document.getElementById('kpiTop').textContent = '—';
            document.getElementById('rankingBody').innerHTML =
                `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">${data.error}</td></tr>`;
            return;
        }
        if (data.students && data.students.length > 0) {
            students = data.students;
            subjects = data.subjects || {};
            scheduleDashboardRender();
        } else {
            students = [];
            subjects = {};
            scheduleDashboardRender();
        }
    } catch (err) {
        if (fetchId !== dashboardFetchId) return;
        console.error("Error loading dashboard data:", err);
    }
}

// ===== FETCH SPEED SETTER =====
function setFetchSpeed(speed) {
    const btnCareful = document.getElementById('speed-careful');
    const btnBalanced = document.getElementById('speed-balanced');
    const btnFast = document.getElementById('speed-fast');
    const hiddenWorkers = document.getElementById('parallelWorkers');
    const helpText = document.getElementById('speedHelpText');
    
    if (!hiddenWorkers || !helpText) return;
    
    // Remove active class from all
    [btnCareful, btnBalanced, btnFast].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });
    
    if (speed === 'careful') {
        if (btnCareful) btnCareful.classList.add('active');
        hiddenWorkers.value = 4;
        helpText.textContent = "Careful speed (4 parallel workers) for safe retrieval.";
    } else if (speed === 'fast') {
        if (btnFast) btnFast.classList.add('active');
        hiddenWorkers.value = 16;
        helpText.textContent = "Fastest speed (16 parallel workers) for rapid retrieval.";
    } else {
        // Default: balanced
        if (btnBalanced) btnBalanced.classList.add('active');
        hiddenWorkers.value = 8;
        helpText.textContent = "Balanced speed (8 parallel workers) for optimal data retrieval.";
    }
}

// ===== ROLL RANGE VALIDATOR / CALC =====
function updateRollCount() {
    const startEl = document.getElementById('rollStart');
    const endEl = document.getElementById('rollEnd');
    const msgEl = document.getElementById('rollCountMsg');
    if (!startEl || !endEl || !msgEl) return;
    
    const startVal = startEl.value.trim();
    const endVal = endEl.value.trim();
    
    if (startVal === "" || endVal === "") {
        msgEl.classList.add('hidden');
        return;
    }
    
    const start = parseInt(startVal);
    const end = parseInt(endVal);
    
    if (isNaN(start) || isNaN(end)) {
        msgEl.classList.add('hidden');
        return;
    }
    
    if (end < start) {
        msgEl.classList.remove('hidden');
        msgEl.style.color = 'var(--fail)';
        msgEl.textContent = "Ending roll number must be greater than starting roll number.";
        return;
    }
    
    const count = end - start + 1;
    msgEl.classList.remove('hidden');
    msgEl.style.color = 'var(--text-muted)';
    msgEl.textContent = `${count} students in range.`;
}

function setWorkerStatus(id, ledClass, text) {
    const led = document.getElementById('worker-led-' + id);
    const txt = document.getElementById('worker-status-text-' + id);
    if (led) {
        led.className = 'worker-led ' + ledClass;
        if (ledClass === 'working') led.classList.add('led-working');
        else if (ledClass === 'hit') led.classList.add('led-hit');
    }
    if (txt) {
        txt.textContent = text;
    }
}

function openWorkerLog(id) {
    currentWorkerLogId = id;
    document.getElementById('workerLogTitle').textContent = 'worker-' + id;
    const body = document.getElementById('workerLogBody');
    if (body && workerLogs[id]) {
        body.innerHTML = workerLogs[id].join('');
    }
    document.getElementById('workerLogOverlay').classList.add('open');
}

function closeWorkerLog() {
    currentWorkerLogId = null;
    document.getElementById('workerLogOverlay').classList.remove('open');
}

// ===== LOG POLLING =====
function appendLog(el, msg, type) {
    el.innerHTML += "\n" + formatLogLine(msg, type);
    scrollActivityLogToBottom();
}
function scrollActivityLogToBottom() {
    const container = document.getElementById('terminalsContainer');
    if (container) container.scrollTop = container.scrollHeight;
}

let pollInterval = null;
let logIndex = 0;

function startPolling() {
    logIndex = 0;
    if (pollInterval) clearTimeout(pollInterval);
    function doPoll() {
        pollLogs().then((continuePolling) => { 
            if (continuePolling) {
                pollInterval = setTimeout(doPoll, 150); 
            }
        });
    }
    doPoll();
}

function stopPolling() {
    if (pollInterval) {
        clearTimeout(pollInterval);
        pollInterval = null;
    }
}

let netAttempts = 0;
let isPolling = false;
let currentWorkerCount = 0;
let workerLogs = {};
let currentWorkerLogId = null;
let workerBodyInited = {};

async function pollLogs() {
    if (isPolling) return;
    isPolling = true;
    try {
        const res = await fetch('/api/poll_logs?since=' + logIndex);
        const data = await res.json();
        const mainTerm = document.getElementById('term-main');

        if (data.lines && data.lines.length > 0) {
            for (let line of data.lines) {
                line = maskLogLine(line);
                function finishScrape(initial, status, captureSchool, final) {
                    if (mainTerm) {
                        for (const [msg, type] of initial) appendLog(mainTerm, msg, type);
                    }
                    setConnectionStatus(status);
                    resetScrapeButton();
                    if (captureSchool) {
                        const v = document.getElementById('schoolNo').value.trim();
                        if (v) currentSchoolNo = v;
                    }
                    (captureSchool ? loadSchools().then(() => loadDashboardData()) : loadDashboardData()).then(() => {
                        if (mainTerm) appendLog(mainTerm, final, "success");
                    });
                    for (let i = 1; i <= currentWorkerCount; i++) setWorkerStatus(i, 'idle', 'idle');
                    logIndex = data.total;
                    return false;
                }
                if (line === '__FINISHED__') return finishScrape([["Scrape completed.", "success"], ["Updating database...", "warning"]], 'done', true, "Database updated. Switch tabs to view records.");
                if (line === 'STOPPED') return finishScrape([["Scrape stopped. Saving partial results...", "error"]], 'halted', true, "Database updated with partial results.");
                if (line.includes("[!] Scraping stopped by user.")) return finishScrape([["Scrape stopped. Saving partial results...", "error"]], 'halted', false, "Database updated.");
                
                if (line.startsWith("[SYS_ROLL]")) {
                    netAttempts = 0;
                    const parts = line.replace("[SYS_ROLL] ", "").split("|");
                    const header = document.getElementById("statusHeader");
                    if (header) {
                        header.classList.remove('hidden');
                        document.getElementById("currentRollText").innerText = parts[0];
                        document.getElementById("remainingRollsText").innerText = parts[1];
                        document.getElementById("totalAttemptsText").innerText = netAttempts;
                    }
                    // Reset and update worker card consoles for the new roll
                    for (let i = 1; i <= currentWorkerCount; i++) {
                        const wBody = document.getElementById('worker-body-' + i);
                        if (wBody) {
                            wBody.innerHTML = `<div class="line-in text-muted">GET roll=${escapeHtml(parts[0])}</div><div class="line-in text-muted">solving cf-turnstile...</div>`;
                        }
                        workerLogs[i] = [`<div class="line-in text-muted">GET roll=${escapeHtml(parts[0])}</div>`, `<div class="line-in text-muted">solving cf-turnstile...</div>`];
                        workerBodyInited[i] = true;
                        setWorkerStatus(i, 'working', 'working');
                    }
                } else {
                    if (line.includes("Trying:")) {
                        netAttempts++;
                        document.getElementById("totalAttemptsText").innerText = netAttempts;
                    }
                    const wMatch = line.match(/\[W(\d+)\]/i);
                    if (wMatch) {
                        const workerId = wMatch[1];
                        const wBody = document.getElementById('worker-body-' + workerId);
                        if (wBody) {
                            if (!workerBodyInited[workerId]) {
                                wBody.innerHTML = "";
                                workerBodyInited[workerId] = true;
                            }
                            const cleanLine = escapeHtml(line.replace(/\[W\d+\]/gi, '').trim());
                            wBody.innerHTML += `<div class="line-in">${cleanLine}</div>`;
                            if (!workerLogs[workerId]) workerLogs[workerId] = [];
                            workerLogs[workerId].push(`<div class="line-in">${cleanLine}</div>`);
                            if (Number(currentWorkerLogId) === Number(workerId)) {
                                const popBody = document.getElementById('workerLogBody');
                                if (popBody) popBody.innerHTML += `<div class="line-in">${cleanLine}</div>`;
                            }
                            
                            // Update worker state LED
                            if (line.includes("Trying:")) {
                                setWorkerStatus(workerId, 'working', 'working');
                            } else if (line.includes("CRACKED:") || line.includes("✓")) {
                                setWorkerStatus(workerId, 'hit', 'record');
                            } else if (line.includes("no record") || line.includes("skipping") || line.includes("Failed") || line.includes("404")) {
                                setWorkerStatus(workerId, 'miss', 'no record');
                            } else if (line.includes("Rate-limited") || line.includes("pausing")) {
                                setWorkerStatus(workerId, 'working', 'throttled');
                            }
                        }
                    } else {
                        if (mainTerm) {
                            let cleanLine = line.trim();
                            let statusType = 'info';
                            if (cleanLine.startsWith('[+]')) {
                                cleanLine = cleanLine.replace('[+]', '').trim();
                                statusType = 'success';
                            } else if (cleanLine.startsWith('[!]')) {
                                cleanLine = cleanLine.replace('[!]', '').trim();
                                statusType = 'warning';
                            } else if (cleanLine.startsWith('[X]')) {
                                cleanLine = cleanLine.replace('[X]', '').trim();
                                statusType = 'error';
                            } else if (cleanLine.includes('CRACKED:')) {
                                statusType = 'warning';
                            } else if (cleanLine.includes('Extracted:')) {
                                statusType = 'success';
                            } else if (cleanLine.includes('Processing Roll:')) {
                                statusType = 'info';
                            } else if (cleanLine.includes('Trying:') || cleanLine.includes('Attempted') || cleanLine.includes('Missing prefix')) {
                                statusType = 'muted';
                            }
                            appendLog(mainTerm, cleanLine, statusType);
                        }
                    }
                }
            }
        }
        logIndex = data.total;
        return true;

    } catch (e) {
        console.error("Poll error:", e);
        return true;
    } finally {
        isPolling = false;
    }
}

async function checkScraperStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.scraping) {
            const term = document.getElementById('term-main');
            if (term) term.innerHTML = formatLogLine("Reconnected to running scraper...", "warning");
            setConnectionStatus('fetching');
            document.getElementById('startBtn').disabled = true;
            document.getElementById('startBtn').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching...';
            
            const stopBtn = document.getElementById('stopBtn');
            if (stopBtn) {
                stopBtn.classList.remove('hidden');
                stopBtn.disabled = false;
            }
            
            startPolling();
        } else {
            setConnectionStatus('idle');
        }
    } catch (e) {
        console.error("Error checking scraper status", e);
    }
}

function startScrape() {
    const schoolNo = document.getElementById('schoolNo').value;
    const centreMid = document.getElementById('centreMid').value;
    const rollStart = document.getElementById('rollStart').value;
    const rollEnd = document.getElementById('rollEnd').value;
    const stateFilter = document.getElementById('stateFilter').value;
    const workers = document.getElementById('parallelWorkers') ? document.getElementById('parallelWorkers').value : 4;
    
    if (!schoolNo || !centreMid || !rollStart || !rollEnd) {
        alert("Please fill all configuration fields.");
        return;
    }
    
    const workersCount = parseInt(workers);
    currentWorkerCount = workersCount;
    
    netAttempts = 0;
    workerBodyInited = {};
    workerLogs = {};
    currentWorkerLogId = null;
    const floorPanel = document.getElementById('workerFloorPanel');
    const grid = document.getElementById('workerFloorGrid');
    if (floorPanel) floorPanel.classList.remove('hidden');
    if (grid) {
        grid.innerHTML = '';
        for (let i = 1; i <= workersCount; i++) {
            const card = document.createElement('div');
            card.className = 'worker-card slide-up';
            card.id = `worker-card-${i}`;
            card.setAttribute('onclick', 'openWorkerLog(' + i + ')');
            card.innerHTML = `
                <div class="worker-card-header">
                    <span>worker-${i}</span>
                    <span class="align-center-flex">
                        <span class="worker-led idle" id="worker-led-${i}"></span>
                        <span id="worker-status-text-${i}" style="text-transform:uppercase; color:var(--text-muted); font-size: 10px; margin-left: 6px;">idle</span>
                    </span>
                </div>
                <div class="worker-card-body" id="worker-body-${i}">
                    <div class="line-in text-muted">booting headless session...</div>
                </div>
            `;
            grid.appendChild(card);
        }
    }

    const mainTerm = document.getElementById('term-main');
    if (mainTerm) mainTerm.innerHTML = formatLogLine("Connecting to scraper...", "warning");
    setConnectionStatus('fetching');

    document.getElementById('statusHeader').classList.add('hidden');
    document.getElementById('startBtn').disabled = true;
    document.getElementById('startBtn').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching...';
    
    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) {
        stopBtn.classList.remove('hidden');
        stopBtn.disabled = false;
    }

    fetch('/api/start_scrape', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            school_no: schoolNo,
            centre_mid: centreMid,
            roll_start: rollStart,
            roll_end: rollEnd,
            state: stateFilter,
            workers: parseInt(workers)
        })
    }).then(res => res.json()).then(data => {
        if (data.status === "error") {
            if (mainTerm) mainTerm.innerHTML += "\n" + formatLogLine(`Error: ${data.message}`, "error");
            setConnectionStatus('halted');
            resetScrapeButton();
            return;
        }
        
        startPolling();
    }).catch(err => {
        console.error(err);
        if (mainTerm) mainTerm.innerHTML += "\n" + formatLogLine(`Error starting scraper: ${err.message}`, "error");
        setConnectionStatus('halted');
        resetScrapeButton();
    });
}

function resetScrapeButton() {
    const btn = document.getElementById('startBtn');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Fetch results';
    }
    
    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) {
        stopBtn.classList.add('hidden');
        stopBtn.disabled = true;
        stopBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop';
    }
}

async function stopScrape() {
    try {
        const res = await fetch('/api/stop_scrape', { method: 'POST' });
        const data = await res.json();
        const stopBtn = document.getElementById('stopBtn');
        if (stopBtn) {
            stopBtn.disabled = true;
            stopBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Stopping...';
        }
    } catch(e) {
        console.error("Error stopping scrape", e);
    }
}

async function clearDatabase() {
    if (!confirm("Are you sure you want to clear the entire database? This action cannot be undone.")) return;
    try {
        if (!currentSchoolNo) return;
        const res = await fetch('/api/delete_database?school_no=' + currentSchoolNo, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'success') {
            alert("Database cleared.");
            loadSchools().then(() => {
                return loadDashboardData();
            });
        } else {
            alert("Failed to clear database: " + data.message);
        }
    } catch(e) {
        console.error("Error clearing DB", e);
    }
}

function exportExcel() {
    if (students.length === 0) {
        alert("No data available to export!");
        return;
    }
    window.open('/api/export_excel?school_no=' + currentSchoolNo, '_blank');
}

async function deleteCurrentStudent() {
    if (!currentDetailRoll) return;
    if (!confirm("Delete this student record?")) return;
    try {
        const res = await fetch('/api/delete_record/' + currentDetailRoll + '?school_no=' + currentSchoolNo, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'success') {
            closeDetail();
            loadDashboardData();
        } else {
            alert("Failed to delete: " + data.message);
        }
    } catch(e) {
        console.error("Error deleting student", e);
    }
}

// ===== TYPEWRITER EFFECT =====
function runTypewriter() {
    const el = document.getElementById('typewriter-headline');
    if (!el) return;

    const text = "Fetch school results";
    let index = 0;

    function tick() {
        el.innerHTML = `<span>${text.slice(0, index)}</span><span class="caret"></span>`;
        index++;
        if (index <= text.length) {
            setTimeout(tick, 80);
        } else {
            el.innerHTML = `<span>${text}</span>`;
        }
    }
    tick();
}

// ===== INIT =====
let appInitialized = false;
window.addEventListener('DOMContentLoaded', async () => {
    if (appInitialized) return;
    appInitialized = true;

    if (window.DEMO_MODE) {
        document.body.classList.add('demo-mode-active');
        ['schoolNo', 'centreMid', 'rollStart', 'rollEnd'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.setAttribute('data-sensitive', 'true');
        });
    }

    const activeBtn = document.querySelector('.nav-item.active');
    if (activeBtn) {
        switchView('scraper', activeBtn);
    }

    setFetchSpeed('balanced');
    
    const startEl = document.getElementById('rollStart');
    const endEl = document.getElementById('rollEnd');
    if (startEl) startEl.addEventListener('input', updateRollCount);
    if (endEl) endEl.addEventListener('input', updateRollCount);

    runTypewriter();
    await loadSchools();
    if (currentSchoolNo) {
        await loadDashboardData();
    }
    checkScraperStatus();

    document.addEventListener('click', function(e) {
        const wrapper = document.getElementById('searchWrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            const drop = document.getElementById('searchDropdown');
            if (drop) drop.classList.remove('open');
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeDetail();
            const modal = document.getElementById('studentModal');
            if (modal) modal.classList.remove('open');
            const drop = document.getElementById('searchDropdown');
            if (drop) drop.classList.remove('open');
        }
    });
});
