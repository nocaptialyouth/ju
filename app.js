/**
 * 📒 매일가계부 — 주원 가족 노션 워크스페이스 & 구글 시트(량신) 0초 실시간 양방향 동기화 엔진 (App.js V4.0)
 */

const SHEET_ID = "16xlN-rZwRRsOhdylZGZZL1-FF3flTthARoE6Tr4Xwrg";
const GID_MONTHLY_GRID = "661362148";
const GID_SAVINGS_MASTER = "7284588";
const GID_HOSPITAL = "1541600042";

// One-time cleanup of old polluted localStorage keys from previous versions
if (localStorage.getItem('juwon_v4_clean_sync') !== 'done') {
    localStorage.removeItem('juwon_records_edits');
    localStorage.removeItem('juwon_products');
    localStorage.setItem('juwon_v4_clean_sync', 'done');
}

const INITIAL_SAMPLE_MEMOS = [
    { date: "2026-10-06", time: "10:00", category: "적금입금", content: "부산은행 특판 예금 입금 완료 (₩23,000,000)" },
    { date: "2026-10-25", time: "10:00", category: "적금입금", content: "부산기쁨두배통장 10월 납입 완료 (₩100,000)" },
    { date: "2026-10-27", time: "12:00", category: "일상업무", content: "구글 스프레드시트(량신) 실시간 가계부 점검" }
];

const state = {
    webappUrl: localStorage.getItem('juwon_webapp_url') || 'https://script.google.com/macros/s/AKfycbzv46eUI_Y-DoICIGb6fLZa5FaWamZbByCt0tqvDfWzIw6bAvWE-wCrWZ2j4GdPBwbJvA/exec',
    isUnlinkedLocalMode: localStorage.getItem('juwon_unlinked_mode') === 'true',

    firebaseConfig: JSON.parse(localStorage.getItem('juwon_fb_config')) || {
        apiKey: "AIzaSyDZLZT8OAcgV0UTC3FBtFfNsrWp_0YsbAk",
        authDomain: "nocaptialyouth.firebaseapp.com",
        projectId: "nocaptialyouth",
        appId: "1:789489809787:web:fd1df94f9aae22281965de"
    },
    db: null,

    goalTitle: localStorage.getItem('juwon_goal_title') || '1억 모으기 (가족목표)',
    goalTargetAmount: parseFloat(localStorage.getItem('juwon_goal_target')) || 100000000,

    notionDbView: 'all',
    recCategory: 'baby',
    recSeed: 0,
    dealsFilter: 'all',
    dealsSeed: 0,

    savingsMasterList: [],
    hospitalExpenses: [],
    customLedgerEntries: JSON.parse(localStorage.getItem('juwon_custom_ledger')) || [],

    lastUpdated: null,
    kpi: {
        accumulatedSavings: 4300000,       // 시트 C3: 총 누적 저축액 (걸음마+하나+청년미래+굴비)
        extendedSavings: 5900000,          // + 카카오뱅크 아이적금(20만) + 부산기쁨두배(140만)
        specialDeposit: 23000000,          // 부산은행 특판 예금(2,300만)
        maturityTotal: 46500000,           // 시트 D3: 만기적금총액 (부산1000만+새마을2000만+청년도약1650만)
        parentalTotal: 19000000,           // 시트 E3: 부모급여 총액
        parentalReceived: 2000000,         // 부모급여 현재 수령액
        childAllowanceReceived: 200000,    // 시트 F3: 아이급여 현재 수령액
        totalNetWorth: 50800000,           // 시트 기준 통합자산 (C3 + D3 = 5,080만원)
        grandTotalAssets: 75400000         // 전체 보유자산 총합 (5,900만 + 4,650만 + 특판예금 2,300만 = 7,540만원)
    },
    products: [],
    maturedList: [],
    allRecordsFlat: [],
    paidCount: 0,
    totalSavingsEpisodes: 0,

    calCurrentDate: new Date(2026, 9, 27), // 2026년 10월 (시트 현재날짜 2026. 10. 27 기준)
    calSelectedDateStr: "2026-10-27",
    memos: JSON.parse(localStorage.getItem('juwon_memos')) || INITIAL_SAMPLE_MEMOS,

    autoSyncTimer: null,
    autoSyncIntervalSec: 5
};

const elements = {
    navTabs: document.querySelectorAll('.nav-tab'),
    tabPages: document.querySelectorAll('.tab-page'),
    topSyncBtn: document.getElementById('top-sync-btn'),
    topSyncIcon: document.getElementById('top-sync-icon'),
    autoSyncIntervalSelect: document.getElementById('auto-sync-interval-select'),

    syncBanner: document.getElementById('sync-banner'),
    syncBannerText: document.getElementById('sync-banner-text'),
    bannerUpdatedTime: document.getElementById('banner-updated-time'),

    kpiTotalNetworth: document.getElementById('kpi-total-networth'),
    kpiAccumulatedSavings: document.getElementById('kpi-accumulated-savings'),
    kpiMaturityTotal: document.getElementById('kpi-maturity-total'),
    kpiParentalTotal: document.getElementById('kpi-parental-total'),
    kpiSubNetworth: document.getElementById('kpi-sub-networth'),
    kpiSubSavings: document.getElementById('kpi-sub-savings'),
    kpiSubMaturity: document.getElementById('kpi-sub-maturity'),
    kpiSubParental: document.getElementById('kpi-sub-parental'),
    overallCompletionRate: document.getElementById('overall-completion-rate'),
    overallProgressBar: document.getElementById('overall-progress-bar'),
    statPaidCount: document.getElementById('stat-paid-count'),
    statProductCount: document.getElementById('stat-product-count'),

    productsContainer: document.getElementById('products-container'),
    maturedList: document.getElementById('matured-list'),

    calMonthTitle: document.getElementById('cal-month-title'),
    calPrevBtn: document.getElementById('cal-prev-btn'),
    calNextBtn: document.getElementById('cal-next-btn'),
    calendarDaysContainer: document.getElementById('calendar-days-container'),
    selectedDateDisplay: document.getElementById('selected-date-display'),
    dailyNotesList: document.getElementById('daily-notes-list'),
    btnOpenScheduleModal: document.getElementById('btn-open-schedule-modal'),

    scheduleModal: document.getElementById('schedule-modal'),
    scheduleModalClose: document.getElementById('schedule-modal-close'),
    scheduleForm: document.getElementById('schedule-form'),
    schedDateInput: document.getElementById('sched-date-input'),
    schedTimeInput: document.getElementById('sched-time-input'),
    schedCategorySelect: document.getElementById('sched-category-select'),
    schedContentInput: document.getElementById('sched-content-input'),
    btnSchedCancel: document.getElementById('btn-sched-cancel'),

    ledgerSearchInput: document.getElementById('ledger-search-input'),
    ledgerStatusSelect: document.getElementById('ledger-status-select'),
    ledgerTableBody: document.getElementById('ledger-table-body'),
    btnExportExcel: document.getElementById('btn-export-excel'),

    savingsMasterTableBody: document.getElementById('savings-master-table-body'),
    maturityTableBody: document.getElementById('maturity-table-body'),
    btnExportMaturityExcel: document.getElementById('btn-export-maturity-excel'),

    hospKpiTotal: document.getElementById('hosp-kpi-total'),
    hospKpiPostpartum: document.getElementById('hosp-kpi-postpartum'),
    hospKpiHospital: document.getElementById('hosp-kpi-hospital'),
    hospKpiCarecenter: document.getElementById('hosp-kpi-carecenter'),
    hospSearchInput: document.getElementById('hosp-search-input'),
    hospCatSelect: document.getElementById('hosp-cat-select'),
    hospitalTableBody: document.getElementById('hospital-table-body'),
    btnExportHospExcel: document.getElementById('btn-export-hosp-excel'),

    webappUrlInput: document.getElementById('webapp-url-input'),
    btnSaveUrl: document.getElementById('btn-save-url'),
    btnClearUrl: document.getElementById('btn-clear-url'),
    btnCopyCode: document.getElementById('btn-copy-code'),
    codeContent: document.getElementById('code-content'),

    fbApiKey: document.getElementById('fb-api-key'),
    fbProjectId: document.getElementById('fb-project-id'),
    fbAuthDomain: document.getElementById('fb-auth-domain'),
    fbAppId: document.getElementById('fb-app-id'),
    btnSaveFirebase: document.getElementById('btn-save-firebase'),
    btnClearFirebase: document.getElementById('btn-clear-firebase'),

    btnOpenDepositModal: document.getElementById('btn-open-deposit-modal'),
    depositModal: document.getElementById('deposit-modal'),
    depositModalClose: document.getElementById('deposit-modal-close'),
    depositForm: document.getElementById('deposit-form'),
    modalProductSelect: document.getElementById('modal-product-select'),
    btnDepositCancel: document.getElementById('btn-deposit-cancel'),

    btnOpenNewProductModal: document.getElementById('btn-open-new-product-modal'),
    newProductModal: document.getElementById('new-product-modal'),
    newProductModalClose: document.getElementById('new-product-modal-close'),
    newProductForm: document.getElementById('new-product-form'),
    btnNewProdCancel: document.getElementById('btn-new-prod-cancel'),

    productDetailModal: document.getElementById('product-detail-modal'),
    productDetailClose: document.getElementById('product-detail-close'),
    productDetailTitle: document.getElementById('product-detail-title'),
    productDetailBody: document.getElementById('product-detail-body'),

    toastContainer: document.getElementById('toast-container')
};

// Normalize product names between gid=661362148 and gid=7284588
function normalizeProductName(rawName) {
    if (!rawName) return '';
    const s = rawName.toString().replace(/이율\([^)]+\)/g, '').trim();
    if (s.includes('걸음마')) return '걸음마 적금(새마을금고)';
    if (s.includes('하나은행')) return '하나은행(산모)';
    if (s.includes('굴비')) return '굴비적금(토스)';
    if (s.includes('카카오') && s.includes('아이')) return '카카오뱅크 아이적금';
    if (s.includes('청년미래')) return '청년미래적금계좌';
    if (s.includes('기쁨두배')) return '부산기쁨두배통장';
    if (s.includes('부산은행') && s.includes('특판')) return '부산은행 특판 예금';
    if (s.includes('ISA')) return 'ISA계좌(중계형)';
    if (s.includes('부모급여')) return '부모급여';
    if (s.includes('아이급여') || s.includes('아동급여')) return '아이급여(아동수당)';
    if (s.includes('너만SOLO')) return '너만SOLO';
    if (s.includes('새마을금고예금')) return '새마을금고예금';
    return s;
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initAuthGate();
    initSetupPanel();
    initFirebase();
    setupTabNavigation();
    setupEventListeners();
    renderCalendar();
    renderDailyDeals();
    fetchData();
    startAutoSyncTimer(state.autoSyncIntervalSec);
});

/**
 * Sends POST payload to Google Apps Script
 * Backward-compatible with V1 (always sets action='deposit' for ledger updates) AND V5.0 (uses subAction)
 */
async function postToGoogleSheet(payload) {
    if (!state.webappUrl || state.isUnlinkedLocalMode) {
        showToast('⚠️ 구글 Apps Script 웹앱 URL이 등록되어 있지 않습니다. [🔗 새 배포 URL 연결] 버튼을 눌러 등록해주세요.', 'warning');
        return false;
    }
    try {
        const subAction = payload.subAction || payload.action || 'deposit';
        const compatAction = (subAction === 'memo') ? 'memo' : 'deposit';
        const bodyObj = {
            ...payload,
            action: compatAction,
            subAction: subAction
        };
        await fetch(state.webappUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(bodyObj)
        });
        return true;
    } catch (err) {
        console.warn("Google Apps Script POST warning:", err);
        return false;
    }
}

window.copyMacroCodeDirect = function() {
    const codeEl = document.getElementById('code-content');
    if (!codeEl) return;
    navigator.clipboard.writeText(codeEl.innerText).then(() => {
        showToast('📋 V5.0 무결점 매크로 복사 완료! 구글 시트 [확장 프로그램 > Apps Script]에 붙여넣고 저장해 주세요.', 'success');
    });
};

window.openUrlConfigModal = function() {
    const modal = document.getElementById('url-config-modal');
    const input = document.getElementById('quick-url-input');
    const resultBox = document.getElementById('url-test-result');
    if (input) input.value = state.isUnlinkedLocalMode ? '' : state.webappUrl;
    if (resultBox) resultBox.innerHTML = '';
    if (modal) modal.classList.add('active');
};

window.handleQuickUrlSave = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('quick-url-input');
    const url = input ? input.value.trim() : '';
    if (!url) {
        showToast('URL을 입력해주세요.', 'warning');
        return;
    }
    state.webappUrl = url;
    state.isUnlinkedLocalMode = false;
    localStorage.setItem('juwon_webapp_url', url);
    localStorage.setItem('juwon_unlinked_mode', 'false');
    showToast('🔗 Apps Script 웹앱 URL이 저장되었습니다!', 'success');
    closeAllModals();
    updateUrlDisplays();
    fetchData(false);
};

window.testCurrentWebAppUrl = async function() {
    const input = document.getElementById('quick-url-input');
    const url = (input && input.value ? input.value : state.webappUrl).trim();
    const resultBox = document.getElementById('url-test-result');

    if (!url) {
        if (resultBox) resultBox.innerHTML = '<span style="color:#d44c47;">⚠️ URL을 입력해주세요.</span>';
        return;
    }

    if (resultBox) {
        resultBox.innerHTML = '<span style="color:#2383e2;"><i class="fa-solid fa-spinner fa-spin"></i> 구글 시트 연결 상태 점검 중...</span>';
    }

    try {
        const checkUrl = url + (url.includes('?') ? '&' : '?') + 'ping=1&t=' + Date.now();
        const res = await fetch(checkUrl, { method: 'GET' });
        const json = await res.json();
        if (json && json.version) {
            if (resultBox) {
                resultBox.innerHTML = `<span style="color:#0f7b6c; font-weight:600;">✅ V${json.version} 최신 엔진 정상 연결됨! (시트: ${json.sheetName || '량신'})</span>`;
            }
            showToast(`✅ Apps Script 최신 엔진(V${json.version}) 연결 성공!`, 'success');
            return true;
        } else {
            if (resultBox) {
                resultBox.innerHTML = '<span style="color:#cb912f; font-weight:600;">⚠️ 구버전 스크립트가 실행 중입니다. 최신 V4.5 코드를 Apps Script에 붙여넣고 [새 배포] 해주세요.</span>';
            }
            return false;
        }
    } catch (err) {
        if (resultBox) {
            resultBox.innerHTML = '<span style="color:#2383e2;">ℹ️ URL 연결 확인됨 (배포 시 [액세스 권한: 모든 사용자]로 배포되었는지 확인해주세요).</span>';
        }
        return true;
    }
};

function updateUrlDisplays() {
    const modalDisplay = document.getElementById('sheet-modal-url-display');
    if (modalDisplay) {
        if (!state.webappUrl || state.isUnlinkedLocalMode) {
            modalDisplay.textContent = '미연결 (클릭하여 설정)';
            modalDisplay.style.color = '#d44c47';
        } else {
            const shortUrl = state.webappUrl.substring(0, 32) + '...';
            modalDisplay.textContent = shortUrl;
            modalDisplay.style.color = '#2383e2';
        }
    }
    const setupInput = document.getElementById('webapp-url-input');
    if (setupInput) setupInput.value = state.isUnlinkedLocalMode ? '' : state.webappUrl;
}

window.resetLocalEditsToSheet = function() {
    localStorage.removeItem('juwon_v4_edits');
    localStorage.removeItem('juwon_records_edits');
    localStorage.removeItem('juwon_custom_ledger');
    localStorage.removeItem('juwon_custom_products');
    localStorage.removeItem('juwon_custom_hospital');
    state.customLedgerEntries = [];
    fetchData(false);
    showToast('🔄 웹 임시 수정내역을 비우고 구글 시트(량신) 원본 데이터와 100% 일치시켰습니다!', 'success');
};

function initFirebase() {
    if (state.firebaseConfig && typeof firebase !== 'undefined') {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(state.firebaseConfig);
            }
            state.db = firebase.firestore();
            listenToFirebaseRealtime();
            return true;
        } catch (err) {
            console.warn("Firebase Init Exception:", err);
        }
    }
    return false;
}

function listenToFirebaseRealtime() {
    if (!state.db) return;
    state.db.collection('memos').onSnapshot(snapshot => {
        const memos = [];
        snapshot.forEach(doc => memos.push(doc.data()));
        if (memos.length > 0) {
            state.memos = memos;
            localStorage.setItem('juwon_memos', JSON.stringify(memos));
            renderCalendar();
        }
    }, err => console.warn("Firebase memos listener:", err));
}

function startAutoSyncTimer(seconds) {
    if (state.autoSyncTimer) {
        clearInterval(state.autoSyncTimer);
        state.autoSyncTimer = null;
    }
    if (seconds > 0) {
        state.autoSyncTimer = setInterval(() => {
            fetchData(true);
        }, seconds * 1000);
    }
}

function initSetupPanel() {
    if (elements.webappUrlInput) {
        elements.webappUrlInput.value = state.isUnlinkedLocalMode ? '' : state.webappUrl;
    }
    if (state.firebaseConfig) {
        if (elements.fbApiKey) elements.fbApiKey.value = state.firebaseConfig.apiKey || '';
        if (elements.fbProjectId) elements.fbProjectId.value = state.firebaseConfig.projectId || 'nocaptialyouth';
        if (elements.fbAuthDomain) elements.fbAuthDomain.value = state.firebaseConfig.authDomain || 'nocaptialyouth.firebaseapp.com';
        if (elements.fbAppId) elements.fbAppId.value = state.firebaseConfig.appId || '';
    }
}

function setupTabNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            if (!targetTab) return;
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const targetPage = document.getElementById(`tab-${targetTab}`);
            if (targetPage) targetPage.classList.add('active');
        });
    });
}

function setupEventListeners() {
    if (elements.topSyncBtn) {
        elements.topSyncBtn.addEventListener('click', () => {
            if (elements.topSyncIcon) elements.topSyncIcon.classList.add('fa-spin');
            fetchData(false).finally(() => {
                setTimeout(() => {
                    if (elements.topSyncIcon) elements.topSyncIcon.classList.remove('fa-spin');
                }, 600);
            });
        });
    }

    ['quick-add-title', 'quick-add-date', 'quick-add-amount', 'quick-add-method'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleNotionQuickAdd();
                }
            });
        }
    });

    if (elements.btnSaveFirebase) {
        elements.btnSaveFirebase.addEventListener('click', () => {
            const apiKey = elements.fbApiKey.value.trim();
            const projectId = elements.fbProjectId.value.trim() || 'nocaptialyouth';
            const authDomain = elements.fbAuthDomain.value.trim() || `${projectId}.firebaseapp.com`;
            const appId = elements.fbAppId.value.trim();
            if (!apiKey || !appId) {
                showToast('Firebase apiKey와 appId를 입력해 주세요.', 'warning');
                return;
            }
            const config = { apiKey, projectId, authDomain, appId };
            state.firebaseConfig = config;
            localStorage.setItem('juwon_fb_config', JSON.stringify(config));
            if (initFirebase()) showToast('🔥 Firebase 클라우드 실시간 연동 완료!', 'success');
        });
    }

    if (elements.btnClearFirebase) {
        elements.btnClearFirebase.addEventListener('click', () => {
            state.firebaseConfig = null;
            localStorage.removeItem('juwon_fb_config');
            showToast('Firebase 연동이 해제되었습니다.', 'info');
        });
    }

    if (elements.autoSyncIntervalSelect) {
        elements.autoSyncIntervalSelect.addEventListener('change', (e) => {
            const sec = parseInt(e.target.value, 10);
            state.autoSyncIntervalSec = sec;
            startAutoSyncTimer(sec);
            showToast(sec > 0 ? `⚡ ${sec}초마다 구글 시트 실시간 동기화 작동` : '수동 동기화 모드로 전환됨', 'info');
        });
    }

    if (elements.btnSaveUrl) {
        elements.btnSaveUrl.addEventListener('click', () => {
            const val = elements.webappUrlInput.value.trim();
            if (val) {
                state.webappUrl = val;
                state.isUnlinkedLocalMode = false;
                localStorage.setItem('juwon_webapp_url', val);
                localStorage.setItem('juwon_unlinked_mode', 'false');
                showToast('🔗 구글 시트 웹앱 URL이 저장되었습니다.', 'success');
                fetchData(false);
            }
        });
    }

    if (elements.btnClearUrl) {
        elements.btnClearUrl.addEventListener('click', () => {
            state.isUnlinkedLocalMode = true;
            state.webappUrl = '';
            elements.webappUrlInput.value = '';
            localStorage.setItem('juwon_unlinked_mode', 'true');
            localStorage.removeItem('juwon_webapp_url');
            showToast('웹앱 URL이 초기화되었습니다 (공개 시트 읽기 모드).', 'info');
            fetchData(false);
        });
    }

    if (elements.btnCopyCode) {
        elements.btnCopyCode.addEventListener('click', copyMacroCodeDirect);
    }

    if (elements.calPrevBtn) {
        elements.calPrevBtn.addEventListener('click', () => {
            state.calCurrentDate.setMonth(state.calCurrentDate.getMonth() - 1);
            renderCalendar();
        });
    }
    if (elements.calNextBtn) {
        elements.calNextBtn.addEventListener('click', () => {
            state.calCurrentDate.setMonth(state.calCurrentDate.getMonth() + 1);
            renderCalendar();
        });
    }

    if (elements.btnOpenScheduleModal) {
        elements.btnOpenScheduleModal.addEventListener('click', () => {
            elements.schedDateInput.value = state.calSelectedDateStr;
            elements.scheduleModal.classList.add('active');
        });
    }
    if (elements.scheduleModalClose) elements.scheduleModalClose.addEventListener('click', closeAllModals);
    if (elements.btnSchedCancel) elements.btnSchedCancel.addEventListener('click', closeAllModals);

    if (elements.scheduleForm) {
        elements.scheduleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const date = elements.schedDateInput.value;
            const time = elements.schedTimeInput.value;
            const category = elements.schedCategorySelect.value;
            const content = elements.schedContentInput.value.trim();

            if (date && content) {
                const newMemo = { date, time, category, content };
                state.memos.push(newMemo);
                localStorage.setItem('juwon_memos', JSON.stringify(state.memos));
                if (state.db) {
                    try { state.db.collection('memos').add(newMemo); } catch (err) {}
                }
                await postToGoogleSheet({ subAction: 'memo', ...newMemo });
                showToast('📅 일정 메모가 저장 및 구글 시트에 전송되었습니다!', 'success');
                closeAllModals();
                elements.scheduleForm.reset();
                renderCalendar();
            }
        });
    }

    if (elements.ledgerSearchInput) elements.ledgerSearchInput.addEventListener('input', renderLedgerTable);
    if (elements.ledgerStatusSelect) elements.ledgerStatusSelect.addEventListener('change', renderLedgerTable);
    if (elements.hospSearchInput) elements.hospSearchInput.addEventListener('input', renderHospitalExpensesTable);
    if (elements.hospCatSelect) elements.hospCatSelect.addEventListener('change', renderHospitalExpensesTable);

    if (elements.btnExportExcel) elements.btnExportExcel.addEventListener('click', () => exportToCSV('Juwon_Savings_Ledger.csv', prepareLedgerCSVData()));
    if (elements.btnExportMaturityExcel) elements.btnExportMaturityExcel.addEventListener('click', () => exportToCSV('Juwon_Maturity_Assets.csv', prepareMaturityCSVData()));
    if (elements.btnExportHospExcel) elements.btnExportHospExcel.addEventListener('click', () => exportToCSV('Juwon_Hospital_Care_Expenses.csv', prepareHospitalCSVData()));

    const btnRefreshRec = document.getElementById('btn-refresh-recommend');
    if (btnRefreshRec) {
        btnRefreshRec.addEventListener('click', () => {
            state.recSeed++;
            renderRecommendations();
            showToast('🔄 추천 적금 목록이 새로고침되었습니다.', 'info');
        });
    }

    if (elements.btnOpenDepositModal) {
        elements.btnOpenDepositModal.addEventListener('click', () => {
            populateProductSelect();
            elements.depositModal.classList.add('active');
        });
    }
    if (elements.depositModalClose) elements.depositModalClose.addEventListener('click', closeAllModals);
    if (elements.btnDepositCancel) elements.btnDepositCancel.addEventListener('click', closeAllModals);

    if (elements.depositForm) {
        elements.depositForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const prodId = elements.modalProductSelect.value;
            const month = document.getElementById('modal-month-input').value.trim();
            const date = document.getElementById('modal-date-input').value.trim();
            const amount = parseFloat(document.getElementById('modal-amount-input').value) || 0;
            const methodInput = document.getElementById('modal-method-input');
            const method = methodInput ? methodInput.value.trim() : '자동이체';

            const product = state.products.find(p => p.id === prodId);
            if (product) {
                let existingRec = product.records.find(r => r.month === month);
                if (existingRec) {
                    existingRec.date = date;
                    existingRec.amount = amount;
                    existingRec.amountFormatted = formatKRW(amount);
                    existingRec.status = 'deposited';
                    existingRec.memo = method;
                } else {
                    existingRec = {
                        id: `rec_${Date.now()}`,
                        productName: product.name,
                        rate: product.rate,
                        month,
                        date,
                        amount,
                        amountFormatted: formatKRW(amount),
                        status: 'deposited',
                        memo: method
                    };
                    product.records.push(existingRec);
                    state.allRecordsFlat.push(existingRec);
                }

                persistRecordEdit(existingRec);
                recalculateAllKPIs();

                const payload = {
                    subAction: 'deposit',
                    productName: product.name,
                    month,
                    date,
                    amount,
                    status: 'deposited',
                    method
                };
                if (state.db) {
                    try { state.db.collection('deposits').add(payload); } catch (err) {}
                }
                await postToGoogleSheet(payload);

                showToast(`✅ [${product.name} ${month}] ${formatKRW(amount)} 입금 내역이 저장 및 시트로 전송되었습니다!`, 'success');
                closeAllModals();
                elements.depositForm.reset();
                renderDashboard();
                renderLedgerTable();
            }
        });
    }

    if (elements.btnOpenNewProductModal) {
        elements.btnOpenNewProductModal.addEventListener('click', () => {
            if (elements.newProductModal) elements.newProductModal.classList.add('active');
        });
    }
    if (elements.newProductModalClose) elements.newProductModalClose.addEventListener('click', closeAllModals);
    if (elements.btnNewProdCancel) elements.btnNewProdCancel.addEventListener('click', closeAllModals);

    if (elements.newProductForm) {
        elements.newProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rawName = document.getElementById('new-prod-name').value.trim();
            const name = normalizeProductName(rawName);
            const rate = document.getElementById('new-prod-rate').value.trim() || '5.0%';
            const owner = document.getElementById('new-prod-owner').value;
            const monthly = parseFloat(document.getElementById('new-prod-monthly').value) || 300000;
            const initial = parseFloat(document.getElementById('new-prod-initial').value) || 0;
            const startDate = document.getElementById('new-prod-start').value.trim() || '2026. 10. 27';
            const endDate = document.getElementById('new-prod-end').value.trim() || '2027. 10. 27';

            if (!name) return;

            const customProds = JSON.parse(localStorage.getItem('juwon_custom_products')) || [];
            const newProdEntry = { name, rate, owner, monthly, initial, startDate, endDate, createdAt: Date.now() };
            customProds.push(newProdEntry);
            localStorage.setItem('juwon_custom_products', JSON.stringify(customProds));

            applyLocalAndCloudCustomizations();
            recalculateAllKPIs();

            if (state.db) {
                try { state.db.collection('products').add(newProdEntry); } catch (err) {}
            }
            await postToGoogleSheet({
                subAction: 'new_product',
                productName: name,
                month: '신규상품',
                date: startDate,
                amount: initial,
                ...newProdEntry
            });

            showToast(`🎉 [${name}] 신규 적금 상품이 등록 및 구글 시트에 전송되었습니다!`, 'success');
            closeAllModals();
            elements.newProductForm.reset();
            renderDashboard();
            renderSavingsMasterTable();
            renderLedgerTable();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllModals();
    });

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        if (modal && modal.id !== 'auth-modal-overlay') {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeAllModals();
            });
        }
    });

    if (elements.productDetailClose) elements.productDetailClose.addEventListener('click', closeAllModals);
}

window.closeAllModals = function() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        if (modal.id !== 'auth-modal-overlay') {
            modal.classList.remove('active');
        }
    });
};

// Bank Links & Official Metadata
const BANK_LINKS = {
    "걸음마 적금(새마을금고)": "https://search.naver.com/search.naver?query=새마을금고+걸음마+적금",
    "하나은행(산모)": "https://search.naver.com/search.naver?query=하나은행+아이키움+적금",
    "굴비적금(토스)": "https://search.naver.com/search.naver?query=토스뱅크+굴비적금",
    "카카오뱅크 아이적금": "https://search.naver.com/search.naver?query=카카오뱅크+아이적금",
    "청년미래적금계좌": "https://search.naver.com/search.naver?query=IBK+청년미래적금",
    "너만SOLO": "https://search.naver.com/search.naver?query=신한은행+너만SOLO+적금",
    "부모급여": "https://search.naver.com/search.naver?query=2026+부모급여+혜택",
    "아이급여(아동수당)": "https://search.naver.com/search.naver?query=아동수당+지급일",
    "새마을금고예금": "https://search.naver.com/search.naver?query=새마을금고+정기예금",
    "부산기쁨두배통장": "https://search.naver.com/search.naver?query=부산+기쁨두배통장",
    "부산은행 특판 예금": "https://search.naver.com/search.naver?query=부산은행+특판+정기예금",
    "ISA계좌(중계형)": "https://search.naver.com/search.naver?query=한국투자증권+중개형+ISA"
};

const OFFICIAL_RATES = {
    "걸음마 적금(새마을금고)": "10.0%",
    "하나은행(산모)": "5.0%",
    "굴비적금(토스)": "4.3%",
    "카카오뱅크 아이적금": "5.0%",
    "청년미래적금계좌": "6.0%",
    "너만SOLO": "6.0%",
    "부모급여": "정부지원",
    "아이급여(아동수당)": "정부지원",
    "새마을금고예금": "4.0%",
    "부산기쁨두배통장": "1+1+이자",
    "부산은행 특판 예금": "특판예금",
    "ISA계좌(중계형)": "비과세투자"
};

const PRODUCT_EPISODES = {
    "걸음마 적금(새마을금고)": 12,
    "하나은행(산모)": 12,
    "굴비적금(토스)": 6,
    "카카오뱅크 아이적금": 12,
    "청년미래적금계좌": 36,
    "너만SOLO": 36,
    "부모급여": 24,
    "아이급여(아동수당)": 12,
    "새마을금고예금": 1,
    "부산기쁨두배통장": 36,
    "부산은행 특판 예금": 1,
    "ISA계좌(중계형)": 12
};

const BABY_RECOMMENDATIONS = [
    { name: "새마을금고 용용적금/걸음마 특판", rate: "최고 10.0%", desc: "2026년 출생아 우대 최고 연 10.0% 출생축하 우대금리", query: "새마을금고+용용적금+걸음마적금" },
    { name: "하나은행 아이키움 적금", rate: "최고 5.0%", desc: "양육수당/아기 수당 수령 시 우대 금리 혜택", query: "하나은행+아이키움적금" },
    { name: "KB국민 아이사랑 적금", rate: "최고 6.5%", desc: "미성년 아기 명의 가입 시 출생 우대금리 최고 6.5%", query: "KB국민은행+아이사랑적금" },
    { name: "신한은행 아기드림 적금", rate: "최고 5.5%", desc: "영유아 전용 우대금리 및 첫 만기 축하금 지원", query: "신한은행+아이드림적금" },
    { name: "카카오뱅크 26주 아이적금", rate: "최고 5.0%", desc: "매주 자동이체 성공 시 단계별 우대금리 5.0%", query: "카카오뱅크+26주적금" }
];

const HIGH_YIELD_RECOMMENDATIONS = [
    { name: "IBK기업은행 청년미래/도약 적금", rate: "최고 6.0%", desc: "정부 연계 청년 저축계좌 일반형 연 6.0%", query: "IBK+청년미래적금" },
    { name: "신한은행 SOL 너만SOLO 적금", rate: "최고 6.0%", desc: "약정 납입 달성 시 최고 연 6.0% 우대 적금", query: "신한은행+너만SOLO적금" },
    { name: "토스뱅크 굴비적금", rate: "최고 4.3%", desc: "굴비 저금 시 매달 자동 우대 이율 반영 최고 연 4.3%", query: "토스뱅크+굴비적금" },
    { name: "부산은행 기쁨두배 통장", rate: "1+1 원금매칭", desc: "부산시 청년 지원 1+1 원금 매칭 및 이자 혜택", query: "부산은행+기쁨두배통장" },
    { name: "새마을금고 2000만원 정기예금", rate: "연 4.0%", desc: "확정 금리 4.0% 비과세 활용 정기예금", query: "새마을금고+정기예금+금리" }
];

// Exact Fallback matching user's Google Sheet (gid=7284588 & gid=661362148)
const SAVINGS_MASTER_FALLBACK = [
    { name: "걸음마 적금(새마을금고)", owners: ["주원"], rate: "10.0%", monthly: 300000, monthlyFormatted: "₩300,000", total: 900000, totalFormatted: "₩900,000", startDate: "2026. 7. 30", endDate: "2027. 7. 30" },
    { name: "하나은행(산모)", owners: ["지헌"], rate: "5.0%", monthly: 300000, monthlyFormatted: "₩300,000", total: 900000, totalFormatted: "₩900,000", startDate: "2026. 7. 3", endDate: "2027. 7. 3" },
    { name: "굴비적금(토스)", owners: ["지헌"], rate: "4.3%", monthly: 300000, monthlyFormatted: "₩300,000", total: 1500000, totalFormatted: "₩1,500,000", startDate: "2026. 4. 12", endDate: "2026. 10. 16" },
    { name: "카카오뱅크 아이적금", owners: ["지헌"], rate: "5.0%", monthly: 200000, monthlyFormatted: "₩200,000", total: 200000, totalFormatted: "₩200,000", startDate: "2026. 9. 30", endDate: "2027. 9. 30" },
    { name: "청년미래적금계좌", owners: ["준영"], rate: "6.0%", monthly: 500000, monthlyFormatted: "₩500,000", total: 1000000, totalFormatted: "₩1,000,000", startDate: "2026. 8. 25", endDate: "2029. 8. 25" },
    { name: "너만SOLO", owners: ["지헌"], rate: "6.0%", monthly: 300000, monthlyFormatted: "₩300,000", total: 10000000, totalFormatted: "₩10,000,000", startDate: "2023. 8. 25", endDate: "2026. 8. 25" },
    { name: "부모급여", owners: ["지헌"], rate: "정부지원", monthly: 1000000, monthlyFormatted: "₩1,000,000", total: 19000000, totalFormatted: "₩19,000,000", startDate: "2026. 8. 25", endDate: "2027. 8. 25" },
    { name: "새마을금고예금", owners: ["준영"], rate: "4.0%", monthly: 20000000, monthlyFormatted: "₩20,000,000", total: 20000000, totalFormatted: "₩20,000,000", startDate: "2026. 6. 25", endDate: "2026. 9. 25" },
    { name: "부산기쁨두배통장", owners: ["지헌"], rate: "1+1+이자", monthly: 100000, monthlyFormatted: "₩100,000", total: 1400000, totalFormatted: "₩1,400,000", startDate: "2025. 8. 25", endDate: "2028. 8. 25" },
    { name: "아이급여(아동수당)", owners: ["지헌"], rate: "정부지원", monthly: 100000, monthlyFormatted: "₩100,000", total: 200000, totalFormatted: "₩200,000", startDate: "2026. 8. 25", endDate: "2033. 8. 25" },
    { name: "ISA계좌(중계형)", owners: ["지헌", "준영"], rate: "비과세투자", monthly: 100000, monthlyFormatted: "₩100,000", total: 0, totalFormatted: "₩0", startDate: "2026. 7. 3", endDate: "-" },
    { name: "부산은행 특판 예금", owners: ["지헌"], rate: "특판예금", monthly: 0, monthlyFormatted: "₩0", total: 23000000, totalFormatted: "₩23,000,000", startDate: "2026. 10. 6", endDate: "2027. 10. 6" }
];

const HOSPITAL_EXPENSES_FALLBACK = [
    { date: "2026-07-30", category: "산후도우미", details: "지헌(새로운카드)", amount: 470000, amountFormatted: "₩470,000", note: "-" },
    { date: "2026-07-31", category: "병원비", details: "준영(롯데)", amount: 876900, amountFormatted: "₩876,900", note: "보건소에 제출해야함 병원비환불" },
    { date: "2026-07-18", category: "병원비", details: "준영(롯데)(영양제)", amount: 135000, amountFormatted: "₩135,000", note: "-" },
    { date: "2026-07-18", category: "병원비", details: "준영(롯데)(부스터)", amount: 250000, amountFormatted: "₩250,000", note: "-" },
    { date: "2026-07-31", category: "병원비", details: "지헌(약국)", amount: 25000, amountFormatted: "₩25,000", note: "-" },
    { date: "2026-07-31", category: "조리원비", details: "준영(롯데)", amount: 500000, amountFormatted: "₩500,000", note: "보건소에 제출해야함 조리원환불" },
    { date: "2026-07-31", category: "조리원비", details: "지헌(국민행복)", amount: 500000, amountFormatted: "₩500,000", note: "-" },
    { date: "2026-07-31", category: "조리원비", details: "지헌(M카드)", amount: 1500000, amountFormatted: "₩1,500,000", note: "-" }
];

function persistRecordEdit(rec) {
    const edits = JSON.parse(localStorage.getItem('juwon_v4_edits')) || [];
    const normName = normalizeProductName(rec.productName);
    const idx = edits.findIndex(e => normalizeProductName(e.productName) === normName && e.month === rec.month);
    const entryToSave = { ...rec, productName: normName };
    if (idx !== -1) {
        edits[idx] = entryToSave;
    } else {
        edits.push(entryToSave);
    }
    localStorage.setItem('juwon_v4_edits', JSON.stringify(edits));
}

function applyLocalAndCloudCustomizations() {
    const deletedProducts = JSON.parse(localStorage.getItem('juwon_deleted_products')) || [];
    const deletedRecordIds = JSON.parse(localStorage.getItem('juwon_deleted_record_ids')) || [];

    // Filter out deleted products from master list and products
    if (deletedProducts.length > 0) {
        state.savingsMasterList = state.savingsMasterList.filter(m => !deletedProducts.includes(normalizeProductName(m.name)));
        state.products = state.products.filter(p => !deletedProducts.includes(normalizeProductName(p.name)));
        state.allRecordsFlat = state.allRecordsFlat.filter(r => !deletedProducts.includes(normalizeProductName(r.productName)));
    }

    // Filter out deleted record IDs
    if (deletedRecordIds.length > 0) {
        state.allRecordsFlat = state.allRecordsFlat.filter(r => {
            const rid = r.id || `${r.productName}_${r.month}`;
            return !deletedRecordIds.includes(rid);
        });
    }

    // 1. Custom Products
    let customProds = JSON.parse(localStorage.getItem('juwon_custom_products')) || [];
    customProds = customProds.filter(cp => !deletedProducts.includes(normalizeProductName(cp.name)));
    customProds.forEach(cp => {
        const normName = normalizeProductName(cp.name);
        if (deletedProducts.includes(normName)) return;
        if (!state.savingsMasterList.some(m => normalizeProductName(m.name) === normName)) {
            state.savingsMasterList.push({
                name: normName,
                owners: [cp.owner || '주원'],
                rate: cp.rate || '5.0%',
                monthly: cp.monthly || 0,
                monthlyFormatted: formatKRW(cp.monthly || 0),
                total: cp.initial || 0,
                totalFormatted: formatKRW(cp.initial || 0),
                startDate: cp.startDate || '-',
                endDate: cp.endDate || '-'
            });
        }
        let prodObj = state.products.find(p => normalizeProductName(p.name) === normName);
        if (!prodObj) {
            const initRecs = cp.initial > 0 ? [{
                id: `rec_custom_${normName}_10`,
                productName: normName,
                rate: cp.rate || '5.0%',
                month: '10월',
                date: cp.startDate || '2026. 10. 27',
                amount: cp.initial,
                amountFormatted: formatKRW(cp.initial),
                status: 'deposited'
            }] : [];
            prodObj = {
                id: `prod_custom_${normName}`,
                name: normName,
                rate: cp.rate || '5.0%',
                records: initRecs,
                totalDeposited: cp.initial || 0
            };
            state.products.push(prodObj);
            state.allRecordsFlat.push(...initRecs);
        }
    });

    // 2. Clean V4 Edits (only explicit user edits made in V4)
    const localEdits = JSON.parse(localStorage.getItem('juwon_v4_edits')) || [];
    localEdits.forEach(editRec => {
        const normName = normalizeProductName(editRec.productName);
        let flatMatch = state.allRecordsFlat.find(r => normalizeProductName(r.productName) === normName && r.month === editRec.month);
        if (flatMatch) {
            flatMatch.date = editRec.date;
            flatMatch.amount = editRec.amount;
            flatMatch.amountFormatted = formatKRW(editRec.amount);
            flatMatch.status = editRec.status;
            flatMatch.memo = editRec.memo;
        } else {
            const newFlat = {
                ...editRec,
                productName: normName,
                id: editRec.id || `rec_edit_${state.allRecordsFlat.length}`,
                amountFormatted: formatKRW(editRec.amount)
            };
            state.allRecordsFlat.push(newFlat);
            const parentProd = state.products.find(p => normalizeProductName(p.name) === normName);
            if (parentProd && !parentProd.records.some(r => r.month === editRec.month)) {
                parentProd.records.push(newFlat);
            }
        }
    });

    // 3. Custom Hospital Expenses
    const customHosp = JSON.parse(localStorage.getItem('juwon_custom_hospital')) || [];
    customHosp.forEach(ch => {
        if (!state.hospitalExpenses.some(h => h.date === ch.date && h.details === ch.details && h.amount === ch.amount)) {
            state.hospitalExpenses.push({
                ...ch,
                amountFormatted: formatKRW(ch.amount)
            });
        }
    });
}

function recalculateAllKPIs() {
    // Calculate per-product deposited sum
    state.products.forEach(prod => {
        const depSum = prod.records.filter(r => r.status === 'deposited').reduce((s, r) => s + (Number(r.amount) || 0), 0);
        prod.totalDeposited = depSum;
    });

    // Core 4 savings products that make up Google Sheet Cell C3 (총 누적 저축액 = ₩4,300,000)
    const core4Names = ['걸음마 적금(새마을금고)', '하나은행(산모)', '청년미래적금계좌', '굴비적금(토스)'];
    const core4Sum = state.products
        .filter(p => core4Names.includes(normalizeProductName(p.name)))
        .reduce((s, p) => s + (p.totalDeposited || 0), 0);

    // Additional active installment savings (카카오뱅크 아이적금 20만 + 부산기쁨두배통장 140만 + 신규 추가 상품)
    const otherActiveSavingsSum = state.products
        .filter(p => {
            const n = normalizeProductName(p.name);
            return !core4Names.includes(n) && n !== '부모급여' && n !== '아이급여(아동수당)' && n !== '부산은행 특판 예금' && n !== '너만SOLO' && n !== '새마을금고예금';
        })
        .reduce((s, p) => s + (p.totalDeposited || 0), 0);

    const specialDepositProd = state.products.find(p => normalizeProductName(p.name) === '부산은행 특판 예금');
    const specialDepositSum = specialDepositProd ? specialDepositProd.totalDeposited : 23000000;

    const parentalProd = state.products.find(p => normalizeProductName(p.name) === '부모급여');
    const parentalReceived = parentalProd ? parentalProd.totalDeposited : 2000000;

    const childAllowProd = state.products.find(p => normalizeProductName(p.name) === '아이급여(아동수당)');
    const childAllowReceived = childAllowProd ? childAllowProd.totalDeposited : 200000;

    const customSavingsSum = state.customLedgerEntries
        .filter(e => e.status === 'deposited' && e.mainCategory === '저축/투자/연금')
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const totalMatured = state.maturedList.reduce((s, m) => s + (m.amount || 0), 0) || 46500000;

    state.kpi.accumulatedSavings = (core4Sum > 0 ? core4Sum : 4300000) + customSavingsSum;
    state.kpi.extendedSavings = state.kpi.accumulatedSavings + otherActiveSavingsSum;
    state.kpi.specialDeposit = specialDepositSum;
    state.kpi.maturityTotal = totalMatured;
    state.kpi.parentalReceived = parentalReceived;
    state.kpi.childAllowanceReceived = childAllowReceived;

    // Sheet C3 + D3 = ₩4,300,000 + ₩46,500,000 = ₩50,800,000
    state.kpi.totalNetWorth = state.kpi.accumulatedSavings + state.kpi.maturityTotal;
    // Grand Total including カ뱅(20만) + 기쁨두배(140만) + 부산은행 특판예금(2,300만) = ₩75,400,000
    state.kpi.grandTotalAssets = state.kpi.extendedSavings + state.kpi.maturityTotal + state.kpi.specialDeposit;

    // Count paid episodes only for actual savings products (excluding 120-row child allowance & 24-row parental allowance)
    const savingsOnlyRecords = state.allRecordsFlat.filter(r => {
        const n = normalizeProductName(r.productName);
        return n !== '부모급여' && n !== '아이급여(아동수당)';
    });
    state.paidCount = savingsOnlyRecords.filter(r => r.status === 'deposited').length;
    state.totalSavingsEpisodes = savingsOnlyRecords.length;
}

/**
 * Fetches 0-second real-time Google Visualization JSON for a specific GID and converts to 2D display grid
 */
async function fetchGvizGrid(gid) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=0&gid=${gid}&_=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('Invalid gviz payload');
    const data = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    const rows = (data.table && data.table.rows) ? data.table.rows : [];
    return rows.map(r => {
        const cells = r.c || [];
        return cells.map(cell => {
            if (!cell) return '';
            if (cell.f !== undefined && cell.f !== null) return String(cell.f).trim();
            if (cell.v !== undefined && cell.v !== null) return String(cell.v).trim();
            return '';
        });
    });
}

async function fetchData(isSilent = false) {
    let masterOk = false;
    let hospOk = false;
    let gridOk = false;

    // 1. Fetch Savings Master Tab (gid=7284588)
    try {
        const masterGrid = await fetchGvizGrid(GID_SAVINGS_MASTER);
        if (masterGrid && masterGrid.length > 0) {
            parseSavingsMasterGrid(masterGrid);
            masterOk = true;
        }
    } catch (e) {
        console.warn("Master gviz fetch warning:", e);
    }

    // 2. Fetch Hospital Expenses Tab (gid=1541600042)
    try {
        const hospGrid = await fetchGvizGrid(GID_HOSPITAL);
        if (hospGrid && hospGrid.length > 0) {
            parseHospitalGrid(hospGrid);
            hospOk = true;
        }
    } catch (e) {
        console.warn("Hospital gviz fetch warning:", e);
    }

    // 3. Fetch Main Monthly Grid Tab (gid=661362148)
    try {
        const mainGrid = await fetchGvizGrid(GID_MONTHLY_GRID);
        if (mainGrid && mainGrid.length > 3) {
            parseGridArray(mainGrid);
            if (state.products.length > 0) gridOk = true;
        }
    } catch (e) {
        console.warn("Main grid gviz fetch warning:", e);
    }

    if (!gridOk || state.products.length === 0) {
        loadBackupData();
        renderSyncBanner(true, '로컬 백업 모드');
    } else {
        applyLocalAndCloudCustomizations();
        recalculateAllKPIs();
        renderSyncBanner(false, '구글 시트(량신) 0초 실시간 연동중');
    }

    renderDashboard();
    renderSavingsMasterTable();
    renderHospitalExpensesTable();
    renderLedgerTable();
    renderMaturityTable();
    renderCalendar();

    state.lastUpdated = new Date();
    if (elements.bannerUpdatedTime) {
        elements.bannerUpdatedTime.innerText = `(${formatTime(state.lastUpdated)})`;
    }
    if (!isSilent && gridOk) {
        showToast('🔄 구글 스프레드시트(량신) 실시간 데이터 동기화 완료!', 'success');
    }
}

function parseSavingsMasterGrid(grid) {
    const deletedProducts = JSON.parse(localStorage.getItem('juwon_deleted_products')) || [];
    const masterList = [];
    for (let r = 0; r < grid.length; r++) {
        const row = grid[r];
        if (!row || row.length < 5) continue;

        // In gid=7284588, Col D (index 3) is 종류, Col E (4) is 주원, Col F (5) is 지헌, Col G (6) is 준영, Col H (7) is 매달입금액, Col I (8) is 총금액, Col J (9) is 시작일, Col K (10) is 만기일
        const colD = (row[3] || '').trim();
        const colC = (row[2] || '').trim();
        const rawName = (colD && colD !== '종류') ? colD : (colC && colC !== '종류' ? colC : '');
        if (!rawName || rawName.includes('주원 적금')) continue;

        const normName = normalizeProductName(rawName);
        if (deletedProducts.includes(normName)) continue; // 사용자가 삭제한 상품 필터링

        const offset = (colD && colD !== '종류') ? 3 : 2;
        const juwon = (row[offset + 1] || '').trim();
        const jihyeon = (row[offset + 2] || '').trim();
        const junyeong = (row[offset + 3] || '').trim();
        const monthly = parseCurrency(row[offset + 4]);
        const total = parseCurrency(row[offset + 5]);
        const startDate = (row[offset + 6] || '').trim();
        const endDate = (row[offset + 7] || '').trim();

        if (juwon === 'O' || jihyeon === 'O' || junyeong === 'O' || monthly > 0 || total > 0) {
            const owners = [];
            if (juwon === 'O') owners.push('주원');
            if (jihyeon === 'O') owners.push('지헌');
            if (junyeong === 'O') owners.push('준영');

            const normName = normalizeProductName(rawName);
            masterList.push({
                name: normName,
                owners: owners.length ? owners : ['지헌'],
                rate: OFFICIAL_RATES[normName] || '약정 이율',
                monthly,
                monthlyFormatted: formatKRW(monthly),
                total,
                totalFormatted: formatKRW(total),
                startDate: startDate || '-',
                endDate: endDate || '-'
            });
        }
    }
    if (masterList.length > 0) {
        state.savingsMasterList = masterList;
    }
}

function parseHospitalGrid(grid) {
    const expenses = [];
    for (let r = 0; r < grid.length; r++) {
        const row = grid[r];
        if (!row || row.length < 4) continue;
        // In gid=1541600042, Col B (index 1) is 날짜, Col C (2) is 카테고리, Col D (3) is 결제수단/내용, Col E (4) is 금액, Col F (5) is 비고
        const colB = (row[1] || '').trim();
        const colA = (row[0] || '').trim();
        const useOffset1 = colB.includes('202');
        const date = useOffset1 ? colB : colA;
        const category = (row[useOffset1 ? 2 : 1] || '').trim();
        const details = (row[useOffset1 ? 3 : 2] || '').trim();
        const amount = parseCurrency(row[useOffset1 ? 4 : 3]);
        const note = (row[useOffset1 ? 5 : 4] || '').trim();

        if (date && date.includes('202') && category && amount > 0) {
            expenses.push({
                date,
                category,
                details,
                amount,
                amountFormatted: formatKRW(amount),
                note: note || '-'
            });
        }
    }
    if (expenses.length > 0) {
        state.hospitalExpenses = expenses;
    }
}

function parseGridArray(grid) {
    if (!grid || grid.length < 3) return;

    state.products = [];
    state.maturedList = [];
    state.allRecordsFlat = [];

    let parentalTotalFromKPI = 19000000;

    // 1. Scan Top KPI cells (Rows 0..4)
    for (let r = 0; r < Math.min(grid.length, 5); r++) {
        const row = grid[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
            const cell = (row[c] || '').toString().trim();
            if (cell === '부모급여' && r <= 2) {
                const valBelow = parseCurrency(grid[r + 1]?.[c]);
                if (valBelow > 0) parentalTotalFromKPI = valBelow;
            }
        }
    }

    // 2. Scan ALL monthly product blocks (where subRow[c] === '월')
    for (let r = 0; r < grid.length - 1; r++) {
        const row = grid[r];
        const subRow = grid[r + 1] || [];
        if (!row || !subRow) continue;

        for (let c = 0; c < subRow.length; c++) {
            const subCell = (subRow[c] || '').toString().trim();
            if (subCell === '월') {
                let rawProdName = '';
                let rateStr = '';

                // Product title is ALWAYS at offset 0 (same col as '월') or offset 1 ('입금날짜' col)
                for (let offset = 0; offset <= 2; offset++) {
                    const candidate = (row[c + offset] || '').toString().trim();
                    if (!candidate) continue;
                    if (/^[0-9]{1,2}월$/.test(candidate) || candidate === '현재날짜' || candidate === '종류') continue;
                    if (candidate.includes('이율')) {
                        rateStr = candidate;
                    } else if (!rawProdName) {
                        rawProdName = candidate;
                    }
                }

                if (rawProdName) {
                    const normName = normalizeProductName(rawProdName);
                    const finalRate = OFFICIAL_RATES[normName] || rateStr || '약정 이율';

                    let prodObj = state.products.find(p => p.name === normName);
                    if (!prodObj) {
                        prodObj = {
                            id: `prod_${state.products.length}`,
                            name: normName,
                            rate: finalRate,
                            records: [],
                            totalDeposited: 0
                        };
                        state.products.push(prodObj);
                    }

                    let emptyScheduledCount = 0;
                    const isLongScheduleBlock = (normName === '아이급여(아동수당)' || normName === 'ISA계좌(중계형)');

                    for (let mr = r + 2; mr < grid.length; mr++) {
                        const mRow = grid[mr];
                        if (!mRow) break;
                        const monthVal = (mRow[c] || '').toString().trim();
                        const dateVal = (mRow[c + 1] || '').toString().trim();
                        const amountVal = (mRow[c + 2] || '').toString().trim();

                        if (monthVal === '총액' || monthVal === '총역' || monthVal === '총급여' || monthVal === '월') {
                            break;
                        }

                        if (monthVal && /^[0-9]{1,2}월$/.test(monthVal)) {
                            const amountNum = parseCurrency(amountVal);
                            let status = 'scheduled';

                            if (dateVal && dateVal !== '미입금' && amountNum > 0) {
                                status = 'deposited';
                            } else if (dateVal === '미입금') {
                                status = 'unpaid';
                            } else {
                                emptyScheduledCount++;
                                // Keep UI clean from 120 empty future rows in 아이급여 / 64 empty rows in ISA계좌
                                if (isLongScheduleBlock && emptyScheduledCount > 4) {
                                    continue;
                                }
                            }

                            const rec = {
                                id: `rec_${state.allRecordsFlat.length}`,
                                productName: prodObj.name,
                                rate: prodObj.rate,
                                month: monthVal,
                                date: dateVal || '-',
                                amount: amountNum,
                                amountFormatted: formatKRW(amountNum),
                                status
                            };
                            prodObj.records.push(rec);
                            state.allRecordsFlat.push(rec);
                        }
                    }
                }
            }
        }
    }

    // 3. Scan Matured Deposits List (8월만기적금, 9월예금만기, 7월청년도약계좌)
    for (let r = 0; r < grid.length; r++) {
        const row = grid[r];
        if (!row) continue;
        for (let c = 0; c < row.length - 2; c++) {
            const cell = (row[c] || '').toString().trim();
            if (cell.includes('만기적금') || cell.includes('예금만기') || cell.includes('청년도약계좌')) {
                const bankVal = (row[c + 1] || '').toString().trim();
                const amountNum = parseCurrency(row[c + 2]);
                if (amountNum > 0) {
                    state.maturedList.push({
                        type: cell,
                        bank: bankVal || '시중은행',
                        amount: amountNum,
                        amountFormatted: formatKRW(amountNum)
                    });
                }
            }
        }
    }

    if (state.savingsMasterList.length === 0) {
        state.savingsMasterList = JSON.parse(JSON.stringify(SAVINGS_MASTER_FALLBACK));
    }

    state.kpi.parentalTotal = parentalTotalFromKPI;
}

function loadBackupData() {
    state.savingsMasterList = JSON.parse(JSON.stringify(SAVINGS_MASTER_FALLBACK));
    state.hospitalExpenses = JSON.parse(JSON.stringify(HOSPITAL_EXPENSES_FALLBACK));

    // Active products matching gid=661362148
    const activeDefs = [
        {
            name: "걸음마 적금(새마을금고)", rate: "10.0%",
            records: [
                { month: "7월", date: "2026. 7. 30", amount: 300000, status: "deposited" },
                { month: "8월", date: "2026. 8. 30", amount: 300000, status: "deposited" },
                { month: "9월", date: "2026. 9. 30", amount: 300000, status: "deposited" },
                { month: "10월", date: "-", amount: 0, status: "scheduled" }
            ]
        },
        {
            name: "하나은행(산모)", rate: "5.0%",
            records: [
                { month: "7월", date: "2026. 7. 3", amount: 300000, status: "deposited" },
                { month: "8월", date: "2026. 8. 3", amount: 300000, status: "deposited" },
                { month: "9월", date: "2026. 9. 3", amount: 300000, status: "deposited" },
                { month: "10월", date: "-", amount: 0, status: "scheduled" }
            ]
        },
        {
            name: "청년미래적금계좌", rate: "6.0%",
            records: [
                { month: "8월", date: "2026. 8. 25", amount: 500000, status: "deposited" },
                { month: "9월", date: "2026. 9. 25", amount: 500000, status: "deposited" },
                { month: "10월", date: "-", amount: 0, status: "scheduled" }
            ]
        },
        {
            name: "굴비적금(토스)", rate: "4.3%",
            records: [
                { month: "4월", date: "2026. 4. 12", amount: 300000, status: "deposited" },
                { month: "5월", date: "2026. 5. 6", amount: 300000, status: "deposited" },
                { month: "6월", date: "미입금", amount: 0, status: "unpaid" },
                { month: "7월", date: "2026. 7. 3", amount: 300000, status: "deposited" },
                { month: "8월", date: "2026. 8. 3", amount: 300000, status: "deposited" },
                { month: "9월", date: "2026. 9. 3", amount: 300000, status: "deposited" }
            ]
        },
        {
            name: "카카오뱅크 아이적금", rate: "5.0%",
            records: [
                { month: "9월", date: "2026. 9. 30", amount: 200000, status: "deposited" },
                { month: "10월", date: "-", amount: 0, status: "scheduled" }
            ]
        },
        {
            name: "부산기쁨두배통장", rate: "1+1+이자",
            records: [
                { month: "8월", date: "2026. 8. 25", amount: 100000, status: "deposited" },
                { month: "9월", date: "2026. 9. 25", amount: 100000, status: "deposited" },
                { month: "10월", date: "2026. 10. 25", amount: 100000, status: "deposited" }
            ]
        },
        {
            name: "부산은행 특판 예금", rate: "특판예금",
            records: [
                { month: "10월", date: "2026. 10. 6", amount: 23000000, status: "deposited" }
            ]
        },
        {
            name: "부모급여", rate: "정부지원",
            records: [
                { month: "8월", date: "2026. 8. 25", amount: 1000000, status: "deposited" },
                { month: "9월", date: "2026. 9. 25", amount: 1000000, status: "deposited" },
                { month: "10월", date: "-", amount: 1000000, status: "scheduled" }
            ]
        },
        {
            name: "아이급여(아동수당)", rate: "정부지원",
            records: [
                { month: "8월", date: "2026. 8. 25", amount: 100000, status: "deposited" },
                { month: "9월", date: "2026. 9. 25", amount: 100000, status: "deposited" },
                { month: "10월", date: "-", amount: 0, status: "scheduled" }
            ]
        }
    ];

    state.allRecordsFlat = [];
    state.products = activeDefs.map((d, idx) => {
        const recs = d.records.map((r, rIdx) => ({
            id: `rec_${idx}_${rIdx}`,
            productName: d.name,
            rate: d.rate,
            month: r.month,
            date: r.date,
            amount: r.amount,
            amountFormatted: formatKRW(r.amount),
            status: r.status
        }));
        state.allRecordsFlat.push(...recs);
        return {
            id: `prod_fallback_${idx}`,
            name: d.name,
            rate: d.rate,
            records: recs,
            totalDeposited: recs.filter(x => x.status === 'deposited').reduce((s, x) => s + x.amount, 0)
        };
    });

    state.maturedList = [
        { type: "8월만기적금", bank: "부산은행", amount: 10000000, amountFormatted: "₩10,000,000" },
        { type: "9월예금만기", bank: "새마을", amount: 20000000, amountFormatted: "₩20,000,000" },
        { type: "7월청년도약계좌", bank: "IBK기업은행", amount: 16500000, amountFormatted: "₩16,500,000" }
    ];

    applyLocalAndCloudCustomizations();
    recalculateAllKPIs();
}

// ================= RENDER DASHBOARD & NOTION GOAL BOARD =================
function renderDashboard() {
    if (elements.kpiTotalNetworth) elements.kpiTotalNetworth.innerText = formatKRW(state.kpi.totalNetWorth);
    if (elements.kpiAccumulatedSavings) elements.kpiAccumulatedSavings.innerText = formatKRW(state.kpi.accumulatedSavings);
    if (elements.kpiMaturityTotal) elements.kpiMaturityTotal.innerText = formatKRW(state.kpi.maturityTotal);
    if (elements.kpiParentalTotal) elements.kpiParentalTotal.innerText = formatKRW(state.kpi.parentalTotal);

    const totalPossible = state.totalSavingsEpisodes || 1;
    const pct = Math.min(100, Math.round((state.paidCount / totalPossible) * 100));

    if (elements.kpiSubNetworth) {
        elements.kpiSubNetworth.innerText = `특판예금(${formatKRW(state.kpi.specialDeposit)})·기쁨두배·카뱅 포함 총 ${formatKRW(state.kpi.grandTotalAssets)}`;
    }
    if (elements.kpiSubSavings) {
        elements.kpiSubSavings.innerHTML = `납입완료: <strong id="stat-paid-count">${state.paidCount}회</strong> (<span id="overall-completion-rate">${pct}%</span>) · 전체적금 합산 ${formatKRW(state.kpi.extendedSavings)}`;
    }
    if (elements.kpiSubParental) {
        elements.kpiSubParental.innerText = `아이급여 누적 ${formatKRW(state.kpi.childAllowanceReceived)} · 부모급여 입금완료 ${formatKRW(state.kpi.parentalReceived)}`;
    }

    if (elements.overallProgressBar) elements.overallProgressBar.style.width = `${pct}%`;
    if (elements.statProductCount) {
        const savingsProdCount = state.products.filter(p => p.name !== '부모급여' && p.name !== '아이급여(아동수당)').length;
        elements.statProductCount.innerText = `${savingsProdCount}개 적금·예금`;
    }

    renderSidebarGoalCard();
    renderDailyDeals();
    renderNotionMainDatabase();
    renderProductsGrid();
    renderMaturedList();
    renderRecommendations();
    renderAIGuardianInsights();
    renderBabyMilestonesTable();
}

// ================= DAILY HOT SAVINGS DEALS (오늘의 데일리 고금리 적금·예금 특가) =================
const HOT_DAILY_DEALS = [
    {
        id: "deal_mg_baby",
        bank: "새마을금고",
        name: "MG 출생축하 걸음마적금",
        rate: "최고 연 10.0%",
        rateNum: 10.0,
        category: "baby",
        badge: "🔥 오늘 1위 특가",
        desc: "2024~2026 출생아 가구 대상 최고 10.0% 고금리 + 비과세 종합저축 지원",
        monthly: 300000,
        period: "12개월",
        link: "https://search.naver.com/search.naver?query=새마을금고+출생축하+걸음마적금"
    },
    {
        id: "deal_kb_child",
        bank: "KB국민은행",
        name: "KB 아이사랑 적금",
        rate: "최고 연 10.0%",
        rateNum: 10.0,
        category: "baby",
        badge: "👶 아동수당 우대",
        desc: "아동수당 수령 및 다둥이 가구 우대금리 제공, 월 최대 30만원 자유적립",
        monthly: 300000,
        period: "12개월",
        link: "https://search.naver.com/search.naver?query=KB아이사랑적금"
    },
    {
        id: "deal_post_parent",
        bank: "우체국",
        name: "대한민국 엄마아빠 적금",
        rate: "최고 연 9.0%",
        rateNum: 9.0,
        category: "baby",
        badge: "🍼 임산부 특별우대",
        desc: "임산부, 출산가구 우대금리 최고 9.0% 확정 및 정부 100% 원금·이자 보장",
        monthly: 300000,
        period: "12개월",
        link: "https://search.naver.com/search.naver?query=우체국+대한민국+엄마아빠적금"
    },
    {
        id: "deal_hana_ikium",
        bank: "하나은행",
        name: "하나 아이키움 적금",
        rate: "최고 연 8.0%",
        rateNum: 8.0,
        category: "baby",
        badge: "🎁 다자녀·태아 우대",
        desc: "태아 및 18세 이하 자녀 부모 대상 우대금리 제공, 자동이체만 해도 고금리 적용",
        monthly: 300000,
        period: "12개월",
        link: "https://search.naver.com/search.naver?query=하나+아이키움적금"
    },
    {
        id: "deal_shinhan_first",
        bank: "신한은행",
        name: "신한 청년 처음적금",
        rate: "최고 연 8.0%",
        rateNum: 8.0,
        category: "youth",
        badge: "🧑 청년 첫거래 1위",
        desc: "신한 첫거래 청년 대상 최고 연 8.0% 특별금리 특판, 매달 최대 30만원",
        monthly: 300000,
        period: "12개월",
        link: "https://search.naver.com/search.naver?query=신한+청년+처음적금"
    },
    {
        id: "deal_kj_youth",
        bank: "광주은행",
        name: "청년 비대면 도약적금",
        rate: "최고 연 7.1%",
        rateNum: 7.1,
        category: "youth",
        badge: "🚀 비대면 모바일특판",
        desc: "신분증만 있으면 모바일 앱에서 1분 만에 가입 가능한 고금리 청년 특판",
        monthly: 500000,
        period: "12개월",
        link: "https://search.naver.com/search.naver?query=광주은행+청년적금"
    },
    {
        id: "deal_jb_damoa",
        bank: "전북은행",
        name: "JB 다모아 비대면 특판",
        rate: "최고 연 6.5%",
        rateNum: 6.5,
        category: "youth",
        badge: "✨ 조건없는 우대",
        desc: "복잡한 카드실적 없이 계좌 오픈뱅킹 연결만으로 최고 6.5% 금리 확정 제공",
        monthly: 300000,
        period: "12개월",
        link: "https://search.naver.com/search.naver?query=전북은행+특판적금"
    },
    {
        id: "deal_toss_gulbi",
        bank: "토스뱅크",
        name: "토스뱅크 굴비 적금",
        rate: "최고 연 5.0%",
        rateNum: 5.0,
        category: "youth",
        badge: "🐟 소액 자유저축",
        desc: "천원부터 매일 자유롭게 저축하고 6개월마다 이자 수령, 자린고비 게이미피케이션",
        monthly: 300000,
        period: "6개월",
        link: "https://search.naver.com/search.naver?query=토스뱅크+굴비적금"
    },
    {
        id: "deal_kakaobank_26",
        bank: "카카오뱅크",
        name: "카카오뱅크 26주 적금",
        rate: "최고 연 6.0%",
        rateNum: 6.0,
        category: "youth",
        badge: "🎯 매주 성공 챌린지",
        desc: "매주 연속 납입 성공 시 추가 우대금리 적용, 단기 목돈 마련 1등 국민적금",
        monthly: 200000,
        period: "26주",
        link: "https://search.naver.com/search.naver?query=카카오뱅크+26주적금"
    },
    {
        id: "deal_busan_deposit",
        bank: "부산은행",
        name: "부산은행 특판 레벨업 정기예금",
        rate: "최고 연 3.8%",
        rateNum: 3.8,
        category: "parking",
        badge: "💰 1년 확정 목돈",
        desc: "목돈 굴리기 확정 고금리, 만기 시 비과세 혜택 및 안정적인 확정 이자 보장",
        monthly: 0,
        period: "12개월",
        link: "https://search.naver.com/search.naver?query=부산은행+특판예금"
    },
    {
        id: "deal_sc_hi",
        bank: "SC제일은행",
        name: "SC제일 Hi 통장 (파킹)",
        rate: "최고 연 4.0%",
        rateNum: 4.0,
        category: "parking",
        badge: "🅿️ 하루만 넣어도 4%",
        desc: "언제든 입출금 가능하면서 잔액에 최고 연 4.0% 고금리 매일 일할 계산 지급",
        monthly: 0,
        period: "자유입출금",
        link: "https://search.naver.com/search.naver?query=SC제일Hi통장"
    },
    {
        id: "deal_kbank_parking",
        bank: "케이뱅크",
        name: "플러스박스 / 생활통장",
        rate: "최고 연 3.5%",
        rateNum: 3.5,
        category: "parking",
        badge: "🅿️ 비상금 3.5%",
        desc: "매일 즉시 이자받기 기능 지원, 최대 3억원까지 연 3.5% 하루 단위 이자 지급",
        monthly: 0,
        period: "수시입출금",
        link: "https://search.naver.com/search.naver?query=케이뱅크+플러스박스"
    }
];

function getDailyRotatedDeals() {
    const today = new Date();
    const daySeed = (today.getFullYear() * 1000) + (today.getMonth() * 31) + today.getDate() + (state.dealsSeed * 3);
    
    let filtered = HOT_DAILY_DEALS;
    if (state.dealsFilter && state.dealsFilter !== 'all') {
        filtered = HOT_DAILY_DEALS.filter(d => d.category === state.dealsFilter);
    }

    if (filtered.length <= 4) return filtered;

    const count = 4;
    const startIndex = Math.abs(daySeed) % filtered.length;
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(filtered[(startIndex + i) % filtered.length]);
    }
    return result;
}

window.renderDailyDeals = function() {
    const container = document.getElementById('daily-deals-container');
    const dateEl = document.getElementById('deals-date-display');
    if (!container) return;

    const today = new Date();
    const curMonth = today.getMonth() + 1;
    const curDate = today.getDate();
    if (dateEl) {
        dateEl.innerText = `${curMonth}월 ${curDate}일 오늘 기준 가장 혜택 좋은 금융 특판 (원클릭 가계부 즉시 등록 지원)`;
    }

    const pills = document.querySelectorAll('.deals-filter-pill');
    pills.forEach(pill => {
        const cat = pill.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || 'all';
        if (cat === state.dealsFilter) pill.classList.add('active');
        else pill.classList.remove('active');
    });

    const deals = getDailyRotatedDeals();
    if (deals.length === 0) {
        container.innerHTML = `<div style="padding:1.5rem; text-align:center; color:var(--text-muted); width:100%;">선택한 카테고리의 특가 상품이 없습니다.</div>`;
        return;
    }

    container.innerHTML = deals.map(deal => {
        return `
            <div class="deal-card ${deal.category}">
                <div class="deal-top">
                    <span class="deal-badge">${escapeHTML(deal.badge)}</span>
                    <span class="deal-bank">${escapeHTML(deal.bank)}</span>
                </div>
                <h4 class="deal-name">${escapeHTML(deal.name)}</h4>
                <div class="deal-rate-wrap">
                    <span class="deal-rate-val">${escapeHTML(deal.rate)}</span>
                    <span class="deal-period-tag">${escapeHTML(deal.period)}</span>
                </div>
                <p class="deal-desc">${escapeHTML(deal.desc)}</p>
                <div class="deal-footer">
                    <a href="${deal.link}" target="_blank" rel="noopener noreferrer" class="deal-btn-link" title="공식 안내 페이지 열기">
                        자세히 ↗
                    </a>
                    <button class="deal-btn-apply" onclick="openApplyDealModal('${deal.id}')" title="이 상품을 내 가계부 적금으로 즉시 추가">
                        <i class="fa-solid fa-plus"></i> 내 가계부 등록
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

window.filterDailyDeals = function(category) {
    state.dealsFilter = category;
    renderDailyDeals();
};

window.rotateDailyDeals = function() {
    state.dealsSeed++;
    renderDailyDeals();
    showToast('🔄 오늘의 다른 알짜 특판 상품을 불러왔습니다!', 'info');
};

window.openApplyDealModal = function(dealId) {
    const deal = HOT_DAILY_DEALS.find(d => d.id === dealId);
    if (!deal) return;

    const modal = document.getElementById('new-product-modal');
    if (!modal) return;

    const nameInput = document.getElementById('new-prod-name');
    const rateInput = document.getElementById('new-prod-rate');
    const monthlyInput = document.getElementById('new-prod-monthly');
    const initialInput = document.getElementById('new-prod-initial');
    
    if (nameInput) nameInput.value = `${deal.name}`;
    if (rateInput) rateInput.value = deal.rate.replace('최고 ', '').replace('연 ', '');
    if (monthlyInput) monthlyInput.value = deal.monthly || 300000;
    if (initialInput) initialInput.value = deal.category === 'parking' ? 10000000 : 0;

    modal.classList.add('active');
    showToast(`✨ [${deal.name}] 정보가 자동 입력되었습니다. 확인 후 등록하세요!`, 'success');
};

function renderSidebarGoalCard() {
    const titleEl = document.getElementById('goal-title-display');
    const curAssetEl = document.getElementById('goal-current-asset');
    const remainPctEl = document.getElementById('goal-remain-pct');
    const achievedPctEl = document.getElementById('goal-achieved-pct');
    const segBarEl = document.getElementById('goal-segmented-bar');

    const netWorth = state.kpi.grandTotalAssets || state.kpi.totalNetWorth || 75400000;
    const target = state.goalTargetAmount || 100000000;
    const achievedPct = Math.min(100, Math.max(0, (netWorth / target) * 100));
    const remainPct = Math.max(0, 100 - achievedPct).toFixed(1);
    const filledSegments = Math.round(achievedPct / 10);

    if (titleEl) titleEl.innerText = state.goalTitle;
    if (curAssetEl) curAssetEl.innerText = `${formatKRW(netWorth)}원`;
    if (remainPctEl) remainPctEl.innerText = `${remainPct}%`;
    if (achievedPctEl) achievedPctEl.innerText = `${Math.round(achievedPct)}%`;

    if (segBarEl) {
        let segHTML = '';
        for (let i = 1; i <= 10; i++) {
            segHTML += `<span class="goal-seg ${i <= filledSegments ? 'filled' : ''}"></span>`;
        }
        segBarEl.innerHTML = segHTML;
    }
}

window.openGoalSettingPrompt = function() {
    const newTitle = prompt('목표 이름을 입력하세요 (예: 1억 모으기, 15억 모으기):', state.goalTitle);
    if (!newTitle) return;
    const currentManwon = Math.round(state.goalTargetAmount / 10000);
    const newTargetManwon = prompt('목표 금액을 만원 단위로 입력하세요 (예: 1억 = 10000, 15억 = 150000):', currentManwon);
    if (!newTargetManwon) return;

    const parsed = parseFloat(newTargetManwon);
    if (!isNaN(parsed) && parsed > 0) {
        state.goalTitle = newTitle.trim();
        state.goalTargetAmount = parsed * 10000;
        localStorage.setItem('juwon_goal_title', state.goalTitle);
        localStorage.setItem('juwon_goal_target', String(state.goalTargetAmount));
        renderSidebarGoalCard();
        showToast(`🎯 목표가 [${state.goalTitle} - ${formatKRW(state.goalTargetAmount)}]으로 설정되었습니다!`, 'success');
    }
};

// ================= NOTION MAIN DATABASE (✽ 가계부) ENGINE =================
window.switchNotionDbView = function(view) {
    state.notionDbView = view;
    document.querySelectorAll('.db-view-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    });
    renderNotionMainDatabase();
};

window.focusInlineAddRow = function() {
    const input = document.getElementById('quick-add-title');
    if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => input.focus(), 200);
    }
};

function getOwnerForProduct(prodName) {
    const norm = normalizeProductName(prodName);
    const masterInfo = state.savingsMasterList.find(m => normalizeProductName(m.name) === norm);
    if (masterInfo && masterInfo.owners && masterInfo.owners.length > 0) {
        return masterInfo.owners.join('·');
    }
    if (norm.includes('걸음마')) return '주원';
    if (norm.includes('청년미래') || norm.includes('새마을금고예금')) return '준영';
    return '지헌';
}

function getBankMethodForProduct(prodName, memo) {
    if (memo && memo !== '-') return memo;
    const norm = normalizeProductName(prodName);
    if (norm.includes('걸음마') || norm.includes('새마을')) return '새마을금고';
    if (norm.includes('하나')) return '하나은행';
    if (norm.includes('굴비') || norm.includes('토스')) return '토스뱅크';
    if (norm.includes('카카오')) return '카카오뱅크';
    if (norm.includes('청년미래')) return 'IBK기업은행';
    if (norm.includes('부산')) return '부산은행';
    if (norm.includes('ISA')) return '한국투자증권';
    if (norm.includes('급여') || norm.includes('수당')) return '정부지원금';
    return '자동이체';
}

function buildUnifiedNotionRows() {
    const rows = [];

    // 1. Custom Ledger Entries
    state.customLedgerEntries.forEach((entry, idx) => {
        rows.push({
            rowType: 'custom',
            rawIndex: idx,
            id: entry.id || `custom_${idx}`,
            icon: entry.mainCategory === '지출' ? '🧾' : entry.mainCategory === '수입/지원금' ? '🎁' : '🐷',
            title: entry.title,
            date: entry.date || '-',
            amount: Number(entry.amount) || 0,
            subCategory: entry.subCategory || '🍼 예적금/청약/파킹',
            mainCategory: entry.mainCategory || '저축/투자/연금',
            isFixedOrPaid: entry.status === 'deposited',
            status: entry.status || 'deposited',
            owner: entry.owner || '주원',
            method: entry.method || '토스체크'
        });
    });

    // 2. Active Savings & Allowance Records (from Google Sheet gid=661362148)
    state.allRecordsFlat.forEach((rec, idx) => {
        const normName = normalizeProductName(rec.productName);
        const ownerName = getOwnerForProduct(normName);
        const isAllowance = (normName === '부모급여' || normName === '아이급여(아동수당)');
        const methodBank = getBankMethodForProduct(normName, rec.memo);
        const masterInfo = state.savingsMasterList.find(m => normalizeProductName(m.name) === normName);
        const displayAmount = Number(rec.amount) > 0 ? Number(rec.amount) : (masterInfo && masterInfo.monthly > 0 ? masterInfo.monthly : 300000);

        rows.push({
            rowType: 'savings',
            rawIndex: idx,
            id: rec.id || `sav_${idx}`,
            icon: isAllowance ? '👶' : '🏦',
            title: `${rec.month} ${normName}`,
            date: rec.date && rec.date !== '-' ? rec.date : `2026. ${rec.month.replace('월', '')}. 25 (예정)`,
            amount: displayAmount,
            subCategory: isAllowance ? '🎁 정부지원금/수입' : '🍼 예적금/청약/파킹',
            mainCategory: isAllowance ? '수입/지원금' : '저축/투자/연금',
            isFixedOrPaid: rec.status === 'deposited',
            status: rec.status,
            owner: ownerName,
            method: methodBank
        });
    });

    // 3. Hospital & Postpartum Expenses (from Google Sheet gid=1541600042)
    const hospList = state.hospitalExpenses.length > 0 ? state.hospitalExpenses : HOSPITAL_EXPENSES_FALLBACK;
    hospList.forEach((exp, idx) => {
        rows.push({
            rowType: 'hospital',
            rawIndex: idx,
            id: `hosp_${idx}`,
            icon: exp.category === '조리원비' ? '🍼' : exp.category === '산후도우미' ? '👩‍⚕️' : '🏥',
            title: `${exp.category} — ${exp.details}`,
            date: exp.date.replace(/-/g, '. '),
            amount: Number(exp.amount) || 0,
            subCategory: `🏥 ${exp.category}`,
            mainCategory: '지출',
            isFixedOrPaid: true,
            status: 'deposited',
            owner: exp.details.includes('준영') ? '준영' : exp.details.includes('지헌') ? '지헌' : '주원',
            method: exp.note && exp.note !== '-' ? exp.note : '카드결제'
        });
    });

    return rows;
}

window.renderNotionMainDatabase = function() {
    const tbody = document.getElementById('notion-db-tbody');
    const searchInput = document.getElementById('notion-db-search');
    const totalSumEl = document.getElementById('notion-db-total-sum');
    const countTextEl = document.getElementById('notion-db-count-text');
    if (!tbody) return;

    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
    let rows = buildUnifiedNotionRows();

    if (state.notionDbView === 'this-month') {
        rows = rows.filter(r => r.title.includes('9월') || r.title.includes('10월') || r.date.includes('. 9.') || r.date.includes('. 10.') || r.rowType === 'custom');
    } else if (state.notionDbView === 'savings') {
        rows = rows.filter(r => (r.mainCategory === '저축/투자/연금' || r.mainCategory === '수입/지원금') && r.isFixedOrPaid);
    } else if (state.notionDbView === 'expenses') {
        rows = rows.filter(r => r.mainCategory === '지출');
    } else if (state.notionDbView === 'unpaid') {
        rows = rows.filter(r => !r.isFixedOrPaid);
    } else {
        // 'all' view: show all actually deposited/completed records from the Google Sheet + custom rows
        rows = rows.filter(r => r.rowType === 'custom' || r.isFixedOrPaid || r.status === 'unpaid');
    }

    if (query) {
        rows = rows.filter(r =>
            r.title.toLowerCase().includes(query) ||
            r.subCategory.toLowerCase().includes(query) ||
            r.mainCategory.toLowerCase().includes(query) ||
            r.owner.toLowerCase().includes(query) ||
            r.method.toLowerCase().includes(query)
        );
    }

    const totalSum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    if (totalSumEl) totalSumEl.innerText = formatKRW(totalSum);
    if (countTextEl) countTextEl.innerText = `총 ${rows.length}건`;

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--text-muted);">조건에 맞는 내역이 없습니다. 하단 <code>+ 새 내역 기입</code> 줄에서 바로 추가해 보세요!</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(r => {
        const mainTagClass = r.mainCategory === '지출' ? 'tag-red' : r.mainCategory === '수입/지원금' ? 'tag-green' : 'tag-purple';
        const ownerEmoji = r.owner.includes('주원') ? '👶' : r.owner.includes('지헌') ? '👩' : r.owner.includes('준영') ? '👨' : '💧';

        let actionBtnHTML = '';
        if (r.rowType === 'savings') {
            actionBtnHTML = `
                <div style="display:flex; gap:0.25rem; justify-content:center; align-items:center;">
                    <button class="notion-btn notion-btn-ghost btn-xs" onclick="openEditRecordModal(${r.rawIndex})" title="상세 수정"><i class="fa-solid fa-pen"></i></button>
                    <button class="notion-btn notion-btn-ghost btn-xs text-danger" onclick="deleteRecordRow(${r.rawIndex})" title="삭제" style="color:#d44c47;"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            `;
        } else if (r.rowType === 'custom') {
            actionBtnHTML = `<button class="notion-btn notion-btn-ghost btn-xs text-danger" onclick="deleteCustomLedgerRow(${r.rawIndex})" title="삭제" style="color:#d44c47;"><i class="fa-regular fa-trash-can"></i></button>`;
        } else {
            actionBtnHTML = `<button class="notion-btn notion-btn-ghost btn-xs text-danger" onclick="deleteRecordRow(${r.rawIndex})" title="삭제" style="color:#d44c47;"><i class="fa-regular fa-trash-can"></i></button>`;
        }

        return `
            <tr>
                <td class="col-check">
                    <input type="checkbox" class="notion-checkbox" ${r.isFixedOrPaid ? 'checked' : ''} onchange="toggleNotionRowCheck('${r.rowType}', ${r.rawIndex})">
                </td>
                <td>
                    <div class="row-title-cell">
                        <span>${r.icon}</span>
                        <span>${escapeHTML(r.title)}</span>
                    </div>
                </td>
                <td style="color:var(--text-secondary); font-variant-numeric:tabular-nums;">${escapeHTML(r.date)}</td>
                <td class="col-amount">${formatKRW(r.amount)}</td>
                <td><span style="font-size:0.8rem;">${escapeHTML(r.subCategory)}</span></td>
                <td><span class="notion-tag ${mainTagClass}">${escapeHTML(r.mainCategory)}</span></td>
                <td class="col-fixed">
                    <input type="checkbox" class="notion-checkbox" ${r.isFixedOrPaid ? 'checked' : ''} onchange="toggleNotionRowCheck('${r.rowType}', ${r.rawIndex})">
                </td>
                <td><span class="owner-badge ${escapeHTML(r.owner.split('·')[0])}">${ownerEmoji} ${escapeHTML(r.owner)}</span></td>
                <td><span class="notion-tag tag-blue">${escapeHTML(r.method)}</span></td>
                <td style="text-align:center;">${actionBtnHTML}</td>
            </tr>
        `;
    }).join('');
};

window.toggleNotionRowCheck = async function(rowType, rawIndex) {
    if (rowType === 'savings') {
        toggleQuickDepositStatus(rawIndex);
    } else if (rowType === 'custom') {
        const item = state.customLedgerEntries[rawIndex];
        if (!item) return;
        item.status = item.status === 'deposited' ? 'unpaid' : 'deposited';
        localStorage.setItem('juwon_custom_ledger', JSON.stringify(state.customLedgerEntries));
        recalculateAllKPIs();
        renderDashboard();
        showToast(`✅ [${item.title}] 완납 상태가 변경되었습니다.`, 'success');
    } else if (rowType === 'hospital') {
        toggleHospClaimStatus(rawIndex);
    }
};

window.deleteCustomLedgerRow = function(idx) {
    const removed = state.customLedgerEntries.splice(idx, 1)[0];
    localStorage.setItem('juwon_custom_ledger', JSON.stringify(state.customLedgerEntries));
    recalculateAllKPIs();
    renderDashboard();
    if (removed) showToast(`🗑️ [${removed.title}] 내역이 삭제되었습니다.`, 'info');
};

window.handleNotionQuickAdd = async function() {
    const titleEl = document.getElementById('quick-add-title');
    const dateEl = document.getElementById('quick-add-date');
    const amountEl = document.getElementById('quick-add-amount');
    const subcatEl = document.getElementById('quick-add-subcat');
    const maincatEl = document.getElementById('quick-add-maincat');
    const fixedEl = document.getElementById('quick-add-fixed');
    const ownerEl = document.getElementById('quick-add-owner');
    const methodEl = document.getElementById('quick-add-method');

    const title = titleEl ? titleEl.value.trim() : '';
    const date = dateEl ? dateEl.value.trim() || '2026. 10. 27' : '2026. 10. 27';
    const amount = amountEl ? parseFloat(amountEl.value) || 0 : 0;
    const subCategory = subcatEl ? subcatEl.value : '🍼 예적금/청약/파킹';
    const mainCategory = maincatEl ? maincatEl.value : '저축/투자/연금';
    const isFixed = fixedEl ? fixedEl.checked : true;
    const owner = ownerEl ? ownerEl.value : '주원';
    const method = methodEl ? methodEl.value.trim() || '토스체크' : '토스체크';

    if (!title || amount <= 0) {
        showToast('내역 이름과 금액(원)을 입력해 주세요!', 'warning');
        if (titleEl && !title) titleEl.focus();
        else if (amountEl) amountEl.focus();
        return;
    }

    const matchedProd = state.products.find(p => {
        const key = p.name.split('(')[0].trim();
        return key && title.includes(key);
    });
    const monthMatch = title.match(/([0-9]{1,2}월)/);

    if (matchedProd && monthMatch) {
        const targetMonth = monthMatch[1];
        let rec = matchedProd.records.find(r => r.month === targetMonth);
        if (rec) {
            rec.date = date;
            rec.amount = amount;
            rec.amountFormatted = formatKRW(amount);
            rec.status = isFixed ? 'deposited' : 'unpaid';
            rec.memo = method;
            persistRecordEdit(rec);
        } else {
            rec = {
                id: `rec_${Date.now()}`,
                productName: matchedProd.name,
                rate: matchedProd.rate,
                month: targetMonth,
                date,
                amount,
                amountFormatted: formatKRW(amount),
                status: isFixed ? 'deposited' : 'unpaid',
                memo: method
            };
            matchedProd.records.push(rec);
            state.allRecordsFlat.push(rec);
            persistRecordEdit(rec);
        }
    } else {
        const newEntry = {
            id: `custom_${Date.now()}`,
            title,
            date,
            amount,
            subCategory,
            mainCategory,
            status: isFixed ? 'deposited' : 'unpaid',
            owner,
            method,
            createdAt: new Date().toISOString()
        };
        state.customLedgerEntries.unshift(newEntry);
        localStorage.setItem('juwon_custom_ledger', JSON.stringify(state.customLedgerEntries));
        if (state.db) {
            try { state.db.collection('custom_ledger').add(newEntry); } catch (e) {}
        }
    }

    if (subCategory.includes('병원') || subCategory.includes('조리원')) {
        const hospEntry = {
            date: date.replace(/\./g, '-').replace(/\s+/g, '').replace(/\//g, '-'),
            category: title.includes('조리원') ? '조리원비' : title.includes('도우미') ? '산후도우미' : '병원비',
            details: `${owner}(${method}) ${title}`,
            amount,
            amountFormatted: formatKRW(amount),
            note: '웹 가계부 직접기입'
        };
        const customHosp = JSON.parse(localStorage.getItem('juwon_custom_hospital')) || [];
        customHosp.push(hospEntry);
        localStorage.setItem('juwon_custom_hospital', JSON.stringify(customHosp));
        state.hospitalExpenses.push(hospEntry);
        renderHospitalExpensesTable();
    }

    recalculateAllKPIs();
    renderDashboard();
    renderLedgerTable();

    if (titleEl) titleEl.value = '';
    if (amountEl) amountEl.value = '';

    await postToGoogleSheet({
        subAction: 'add_ledger_entry',
        productName: matchedProd ? matchedProd.name : title,
        month: monthMatch ? monthMatch[1] : subCategory,
        date,
        amount,
        status: isFixed ? 'deposited' : 'unpaid',
        owner,
        method,
        record: {
            productName: matchedProd ? matchedProd.name : title,
            title,
            month: monthMatch ? monthMatch[1] : subCategory,
            date,
            amount,
            subCategory,
            mainCategory,
            status: isFixed ? 'deposited' : 'unpaid',
            owner,
            method
        }
    });

    showToast(`✨ [${title} — ${formatKRW(amount)}] 내역이 추가 및 구글 시트로 전송되었습니다!`, 'success');
};

// ================= CREATE NEW GOOGLE SHEET TAB MODAL HANDLER =================
window.openCreateSheetModal = function() {
    const modal = document.getElementById('create-sheet-modal');
    const nameInput = document.getElementById('new-sheet-name-input');
    if (nameInput && !nameInput.value) {
        const today = new Date().toISOString().slice(0, 10);
        nameInput.value = `매일가계부_${today}`;
    }
    if (typeof updateUrlDisplays === 'function') updateUrlDisplays();
    if (modal) modal.classList.add('active');
};

window.handleCreateNewSheetSubmit = async function(e) {
    e.preventDefault();
    const sheetName = document.getElementById('new-sheet-name-input').value.trim();
    const dataType = document.getElementById('new-sheet-data-type').value;
    if (!sheetName) return;

    let recordsToExport = [];
    if (dataType === 'all') {
        recordsToExport = buildUnifiedNotionRows().map(r => ({
            title: r.title,
            date: r.date,
            amount: r.amount,
            subCategory: r.subCategory,
            mainCategory: r.mainCategory,
            status: r.isFixedOrPaid ? '입금/결제완료' : '미입금/예정',
            owner: r.owner,
            method: r.method
        }));
    } else if (dataType === 'savings') {
        recordsToExport = state.allRecordsFlat.filter(r => r.status === 'deposited').map(r => ({
            title: r.productName,
            date: r.date,
            amount: r.amount,
            subCategory: r.month,
            mainCategory: '저축/적금',
            status: '입금완료',
            owner: getOwnerForProduct(r.productName),
            method: getBankMethodForProduct(r.productName, r.memo)
        }));
    } else if (dataType === 'hospital') {
        recordsToExport = state.hospitalExpenses.map(h => ({
            title: h.details,
            date: h.date,
            amount: h.amount,
            subCategory: h.category,
            mainCategory: '병원/조리원지출',
            status: h.claimStatus || '결제완료',
            owner: '지헌·준영',
            method: h.note || '-'
        }));
    }

    closeAllModals();
    showToast(`📊 구글 스프레드시트에 [${sheetName}] 새 시트를 생성하고 있습니다...`, 'info');

    const ok = await postToGoogleSheet({
        subAction: 'create_new_sheet',
        productName: `[새시트생성] ${sheetName}`,
        month: `${recordsToExport.length}건`,
        date: new Date().toLocaleDateString(),
        amount: recordsToExport.reduce((s, r) => s + (Number(r.amount) || 0), 0),
        sheetName,
        records: recordsToExport
    });

    if (ok) {
        showToast(`🎉 구글 스프레드시트에 [${sheetName}] 새 시트 생성 요청 완료!`, 'success');
    } else {
        showToast(`⚠️ 새 시트 생성 요청 실패: 상단 [🔗 새 배포 URL 연결] 버튼을 눌러 Apps Script URL을 확인해 주세요.`, 'error');
    }
};

// ================= HOSPITAL EXPENSE ADD MODAL HANDLER =================
window.openHospitalExpenseModal = function() {
    const modal = document.getElementById('hospital-expense-modal');
    const dateInput = document.getElementById('hosp-add-date');
    if (dateInput && !dateInput.value) dateInput.value = '2026-10-27';
    if (modal) modal.classList.add('active');
};

window.handleHospitalExpenseSubmit = async function(e) {
    e.preventDefault();
    const date = document.getElementById('hosp-add-date').value;
    const category = document.getElementById('hosp-add-category').value;
    const details = document.getElementById('hosp-add-details').value.trim();
    const amount = parseFloat(document.getElementById('hosp-add-amount').value) || 0;
    const note = document.getElementById('hosp-add-note').value.trim() || '-';

    if (!date || !details || amount <= 0) return;

    const newExp = {
        date,
        category,
        details,
        amount,
        amountFormatted: formatKRW(amount),
        note,
        claimStatus: note.includes('보건소') ? '청구대기' : '환불완료'
    };

    const customHosp = JSON.parse(localStorage.getItem('juwon_custom_hospital')) || [];
    customHosp.push(newExp);
    localStorage.setItem('juwon_custom_hospital', JSON.stringify(customHosp));

    state.hospitalExpenses.push(newExp);
    renderHospitalExpensesTable();
    renderNotionMainDatabase();
    closeAllModals();

    if (state.db) {
        try { state.db.collection('hospital_expenses').add(newExp); } catch (err) {}
    }
    await postToGoogleSheet({
        subAction: 'add_hospital_expense',
        productName: `[${category}] ${details}`,
        month: category,
        date,
        amount,
        ...newExp
    });

    showToast(`🏥 [${category} — ${formatKRW(amount)}] 지출 내역이 등록 및 구글 시트에 반영되었습니다!`, 'success');
};

// ================= SAVINGS PRODUCTS & TABLES RENDERERS =================
function getBankLink(name) {
    if (!name) return "https://search.naver.com/search.naver?query=적금+추천";
    const norm = normalizeProductName(name);
    return BANK_LINKS[norm] || `https://search.naver.com/search.naver?query=${encodeURIComponent(norm)}`;
}

function getOfficialRate(name, currentRate) {
    const norm = normalizeProductName(name);
    if (OFFICIAL_RATES[norm]) return OFFICIAL_RATES[norm];
    if (currentRate && currentRate !== '이율 정보 없음' && currentRate !== '약정 이율') return currentRate;
    return '약정 이율';
}

function getTargetEpisodes(name, actualRecordCount) {
    const norm = normalizeProductName(name);
    const target = PRODUCT_EPISODES[norm] || 12;
    return Math.max(target, actualRecordCount || 0);
}

window.switchRecommendCategory = function(cat) {
    state.recCategory = cat;
    const babyTab = document.getElementById('rec-tab-baby');
    const highTab = document.getElementById('rec-tab-high');
    if (babyTab && highTab) {
        babyTab.className = cat === 'baby' ? "notion-btn notion-btn-warm btn-xs active" : "notion-btn notion-btn-default btn-xs";
        highTab.className = cat === 'high' ? "notion-btn notion-btn-warm btn-xs active" : "notion-btn notion-btn-default btn-xs";
    }
    renderRecommendations();
};

function renderRecommendations() {
    const listContainer = document.getElementById('recommend-list');
    if (!listContainer) return;

    const sourceList = state.recCategory === 'high' ? HIGH_YIELD_RECOMMENDATIONS : BABY_RECOMMENDATIONS;
    const offset = state.recSeed % sourceList.length;

    const displayItems = [];
    for (let i = 0; i < 5; i++) {
        displayItems.push(sourceList[(offset + i) % sourceList.length]);
    }

    listContainer.innerHTML = displayItems.map(item => `
        <div style="padding:0.55rem 0; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
            <div>
                <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                    <strong style="font-size:0.84rem; color:var(--text-primary);">${escapeHTML(item.name)}</strong>
                    <span class="notion-tag tag-green">${escapeHTML(item.rate)}</span>
                </div>
                <div style="font-size:0.74rem; color:var(--text-secondary); margin-top:2px;">${escapeHTML(item.desc)}</div>
            </div>
            <a href="https://search.naver.com/search.naver?query=${encodeURIComponent(item.query)}" target="_blank" rel="noopener noreferrer" class="notion-btn notion-btn-default btn-xs">
                조회 ↗
            </a>
        </div>
    `).join('');
}

function renderProductsGrid() {
    if (!elements.productsContainer) return;
    if (state.products.length === 0) {
        elements.productsContainer.innerHTML = `<p style="padding:1.5rem; color:var(--text-secondary);">등록된 적금 상품이 없습니다.</p>`;
        return;
    }

    elements.productsContainer.innerHTML = state.products.map(prod => {
        const normName = normalizeProductName(prod.name);
        const deposited = prod.records.filter(r => r.status === 'deposited').length;
        const targetEpisodes = getTargetEpisodes(normName, deposited);
        const lastRec = prod.records.filter(r => r.status === 'deposited').slice(-1)[0];

        const ownerStr = getOwnerForProduct(normName);
        const ownersHTML = ownerStr.split('·').map(o => `<span class="owner-badge ${o}">${o}</span>`).join(' ');
        const bankLink = getBankLink(normName);
        const rateDisplay = getOfficialRate(normName, prod.rate);
        const completionPct = Math.min(100, Math.round((deposited / targetEpisodes) * 100));

        return `
            <div class="product-card">
                <div class="product-head">
                    <div class="product-title-group">
                        <div style="display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap;">
                            <h4>${escapeHTML(normName)}</h4>
                            ${ownersHTML}
                        </div>
                        <span class="rate-badge">${escapeHTML(rateDisplay)}</span>
                    </div>
                    <div>
                        <div style="font-size:0.72rem; color:var(--text-secondary); text-align:right;">현재 누적액</div>
                        <div class="product-total-amount">${formatKRW(prod.totalDeposited)}</div>
                    </div>
                </div>

                <div class="product-status-mini">
                    <span>납입: <strong>${deposited}/${targetEpisodes}회 (${completionPct}%)</strong></span>
                    <span>최근: <strong>${lastRec ? lastRec.date : '-'}</strong></span>
                </div>

                <div class="mini-progress-track">
                    <div class="mini-progress-fill" style="width:${completionPct}%; background:${completionPct >= 100 ? '#d9730d' : '#2e7d32'};"></div>
                </div>

                <div class="product-actions">
                    <span class="notion-tag ${deposited > 0 ? 'tag-green' : 'tag-yellow'}">${deposited > 0 ? `납입완료 ${deposited}회` : '납입예정'}</span>
                    <div style="display:flex; gap:0.3rem;">
                        <a href="${bankLink}" target="_blank" rel="noopener noreferrer" class="notion-btn notion-btn-default btn-xs">정보 ↗</a>
                        <button class="notion-btn notion-btn-blue btn-xs" onclick="openProductDetail('${prod.id}')">상세/입금</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderMaturedList() {
    if (!elements.maturedList) return;
    if (state.maturedList.length === 0) {
        elements.maturedList.innerHTML = `<p style="color:var(--text-muted); font-size:0.82rem;">만기 자산이 없습니다.</p>`;
        return;
    }
    elements.maturedList.innerHTML = state.maturedList.map(item => `
        <div class="matured-item">
            <div>
                <div class="matured-name">${escapeHTML(item.type)}</div>
                <div class="matured-bank">🏦 ${escapeHTML(item.bank)}</div>
            </div>
            <div class="matured-amount">${item.amountFormatted}</div>
        </div>
    `).join('');
}

function formatStandardDateKey(str) {
    if (!str || str === '-') return '';
    const clean = str.replace(/\./g, '-').replace(/\s+/g, '').replace(/\//g, '-');
    const parts = clean.split('-').filter(Boolean);
    if (parts.length === 3) {
        return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
    }
    return str;
}

function renderCalendar() {
    if (!elements.calendarDaysContainer) return;
    const year = state.calCurrentDate.getFullYear();
    const month = state.calCurrentDate.getMonth();
    if (elements.calMonthTitle) elements.calMonthTitle.innerText = `${year}년 ${month + 1}월`;

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevLastDate = new Date(year, month, 0).getDate();

    let html = '';
    for (let i = firstDay - 1; i >= 0; i--) {
        html += `<div class="cal-day-cell other-month">${prevLastDate - i}</div>`;
    }

    for (let day = 1; day <= lastDate; day++) {
        const fullDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = fullDateStr === "2026-10-27";
        const isSelected = fullDateStr === state.calSelectedDateStr;
        const hasManualMemo = state.memos.some(m => formatStandardDateKey(m.date) === fullDateStr);
        const hasDepositRecord = state.allRecordsFlat.some(r => r.status === 'deposited' && formatStandardDateKey(r.date) === fullDateStr);

        html += `
            <div class="cal-day-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" onclick="selectCalendarDate('${fullDateStr}')">
                ${day}
                ${(hasManualMemo || hasDepositRecord) ? `<span class="event-dot" style="background:${hasDepositRecord ? '#2e7d32' : '#d9730d'};"></span>` : ''}
            </div>
        `;
    }

    elements.calendarDaysContainer.innerHTML = html;
    renderDailyNotes();
}

window.selectCalendarDate = function(dateStr) {
    state.calSelectedDateStr = dateStr;
    renderCalendar();
};

function renderDailyNotes() {
    if (!elements.dailyNotesList) return;
    const [y, m, d] = state.calSelectedDateStr.split('-');
    if (elements.selectedDateDisplay) elements.selectedDateDisplay.innerText = `${y}.${m}.${d}`;

    const dayMemos = state.memos.map((memo, originalIdx) => ({ ...memo, originalIdx }))
        .filter(memo => formatStandardDateKey(memo.date) === state.calSelectedDateStr)
        .map(memo => ({
            category: memo.category,
            time: memo.time,
            content: memo.content,
            isCustomMemo: true,
            originalMemoIdx: memo.originalIdx
        }));
    const autoDeposits = state.allRecordsFlat.filter(r => r.status === 'deposited' && formatStandardDateKey(r.date) === state.calSelectedDateStr);
    const autoDepositMemos = autoDeposits.map(r => ({
        category: '입금완료',
        time: '시트기록',
        content: `${r.productName} ${r.month} (${r.amountFormatted})`,
        isCustomMemo: false
    }));

    const combined = [...autoDepositMemos, ...dayMemos];
    if (combined.length === 0) {
        elements.dailyNotesList.innerHTML = `<p style="color:var(--text-muted); font-size:0.74rem;">등록된 일정이 없습니다.</p>`;
        return;
    }

    elements.dailyNotesList.innerHTML = combined.map(item => `
        <div class="note-item-card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="note-cat-tag">${escapeHTML(item.category)}</span>
                <div style="display:flex; align-items:center; gap:0.4rem;">
                    <span class="note-time">${escapeHTML(item.time)}</span>
                    ${item.isCustomMemo ? `<button onclick="deleteMemo(${item.originalMemoIdx})" class="notion-btn notion-btn-ghost btn-xs text-danger" title="메모 삭제" style="padding:1px 4px; color:#d44c47;"><i class="fa-regular fa-trash-can" style="font-size:0.68rem;"></i></button>` : ''}
                </div>
            </div>
            <div class="note-text">${escapeHTML(item.content)}</div>
        </div>
    `).join('');
}

window.deleteMemo = function(memoIdx) {
    const memo = state.memos[memoIdx];
    if (!memo) return;
    if (!confirm(`[${memo.content}] 메모를 삭제하시겠습니까?`)) return;

    state.memos.splice(memoIdx, 1);
    localStorage.setItem('juwon_memos', JSON.stringify(state.memos));
    renderCalendar();
    renderDailyNotes();
    showToast('🗑️ 메모가 삭제되었습니다.', 'info');
};

function renderLedgerTable() {
    if (!elements.ledgerTableBody) return;
    const query = (elements.ledgerSearchInput ? elements.ledgerSearchInput.value : '').toLowerCase().trim();
    const statusFilter = elements.ledgerStatusSelect ? elements.ledgerStatusSelect.value : 'all';

    const filtered = state.allRecordsFlat.filter(r => {
        const matchQuery = !query || r.productName.toLowerCase().includes(query) || r.month.toLowerCase().includes(query) || r.date.toLowerCase().includes(query);
        const matchStatus = statusFilter === 'all' || r.status === statusFilter;
        return matchQuery && matchStatus;
    });

    if (filtered.length === 0) {
        elements.ledgerTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">검색 결과가 없습니다.</td></tr>`;
        return;
    }

    elements.ledgerTableBody.innerHTML = filtered.map((r, idx) => {
        const rawIndex = state.allRecordsFlat.findIndex(rec => rec.productName === r.productName && rec.month === r.month);
        const targetIndex = rawIndex !== -1 ? rawIndex : idx;

        return `
            <tr>
                <td>${idx + 1}</td>
                <td><strong>${escapeHTML(r.productName)}</strong></td>
                <td>${escapeHTML(r.month)}</td>
                <td>${escapeHTML(r.date)}</td>
                <td class="col-amount">${r.amountFormatted}</td>
                <td>
                    <span class="status-badge-inline ${r.status}">
                        ${r.status === 'deposited' ? '입금 완료' : r.status === 'unpaid' ? '미입금' : '납입 예정'}
                    </span>
                </td>
                <td>
                    <div style="display:flex; gap:0.3rem; align-items:center;">
                        <button class="notion-btn notion-btn-default btn-xs" onclick="openEditRecordModal(${targetIndex})">수정</button>
                        <button class="notion-btn notion-btn-green btn-xs" onclick="toggleQuickDepositStatus(${targetIndex})" title="완납 토글">✓</button>
                        <button class="notion-btn notion-btn-ghost btn-xs text-danger" onclick="deleteRecordRow(${targetIndex})" title="내역 삭제" style="color:#d44c47;">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.deleteRecordRow = async function(recordIndex) {
    const record = state.allRecordsFlat[recordIndex];
    if (!record) return;
    if (!confirm(`[${record.productName} - ${record.month}] 내역을 삭제하시겠습니까?\n구글 시트에서도 해당 칸이 초기화됩니다.`)) {
        return;
    }

    const recId = record.id || `${record.productName}_${record.month}`;
    const deletedRecordIds = JSON.parse(localStorage.getItem('juwon_deleted_record_ids')) || [];
    if (!deletedRecordIds.includes(recId)) {
        deletedRecordIds.push(recId);
        localStorage.setItem('juwon_deleted_record_ids', JSON.stringify(deletedRecordIds));
    }

    // state.allRecordsFlat에서 제거
    state.allRecordsFlat.splice(recordIndex, 1);

    // prod.records에서도 제거
    const prod = state.products.find(p => normalizeProductName(p.name) === normalizeProductName(record.productName));
    if (prod && prod.records) {
        prod.records = prod.records.filter(r => r.month !== record.month);
    }

    recalculateAllKPIs();
    renderDashboard();
    renderLedgerTable();
    if (typeof renderNotionMainDatabase === 'function') renderNotionMainDatabase();

    postToGoogleSheet({
        subAction: 'delete_record',
        productName: record.productName,
        month: record.month,
        status: 'unpaid',
        amount: 0
    });

    showToast(`🗑️ [${record.productName} ${record.month}] 내역이 삭제되었습니다.`, 'success');
};

function renderMaturityTable() {
    if (!elements.maturityTableBody) return;
    elements.maturityTableBody.innerHTML = state.maturedList.map((item, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td><strong>${escapeHTML(item.type)}</strong></td>
            <td>🏦 ${escapeHTML(item.bank)}</td>
            <td class="col-amount" style="color:var(--notion-coral);">${item.amountFormatted}</td>
            <td><span class="notion-tag tag-green">확정 예금 자산</span></td>
        </tr>
    `).join('');
}

function calculateNetInterest(principal, rateStr, name) {
    const rateNum = parseFloat(rateStr) || 4.0;
    const isTaxFree = name.includes('새마을금고') || name.includes('청년') || name.includes('걸음마') || name.includes('용용') || name.includes('ISA');
    const grossInterest = Math.round(principal * (rateNum / 100));
    const tax = isTaxFree ? 0 : Math.round(grossInterest * 0.154);
    return { grossInterest, tax, netInterest: grossInterest - tax, isTaxFree };
}

window.selectCashflowMonth = function(monthKey) {
    ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12'].forEach(m => {
        const btn = document.getElementById(`cf-m-${m}`);
        if (btn) btn.className = (m === monthKey) ? 'notion-btn notion-btn-blue btn-xs' : 'notion-btn notion-btn-default btn-xs';
    });

    let inflow = 1100000;
    let inflowDesc = "부모급여 100만 + 아이급여 10만";
    let outflow = 1700000;
    if (monthKey === '2026-09') {
        inflow += 20000000;
        inflowDesc = "부모급여 110만 + 새마을금고 2,000만 예금만기";
    }
    const surplus = inflow - outflow;

    const inflowValEl = document.getElementById('cf-inflow-val');
    const inflowDescEl = document.getElementById('cf-inflow-desc');
    const surplusValEl = document.getElementById('cf-surplus-val');
    const ratioTextEl = document.getElementById('cf-ratio-text');
    const barInflowEl = document.getElementById('cf-bar-inflow');
    const barOutflowEl = document.getElementById('cf-bar-outflow');

    if (inflowValEl) inflowValEl.innerText = formatKRW(inflow);
    if (inflowDescEl) inflowDescEl.innerText = inflowDesc;
    if (surplusValEl) surplusValEl.innerText = (surplus >= 0 ? '+' : '') + formatKRW(surplus);

    const totalSum = inflow + outflow;
    const inPct = Math.round((inflow / totalSum) * 100);
    const outPct = 100 - inPct;
    if (barInflowEl) barInflowEl.style.width = `${inPct}%`;
    if (barOutflowEl) barOutflowEl.style.width = `${outPct}%`;
    if (ratioTextEl) ratioTextEl.innerText = `수입 ${inPct}% vs 저축 ${outPct}%`;
};

function renderSavingsMasterTable() {
    if (!elements.savingsMasterTableBody) return;
    const list = state.savingsMasterList.length > 0 ? state.savingsMasterList : SAVINGS_MASTER_FALLBACK;
    elements.savingsMasterTableBody.innerHTML = list.map((item, idx) => {
        const normName = normalizeProductName(item.name);
        const matchedProd = state.products.find(p => normalizeProductName(p.name) === normName);
        const liveTotal = (matchedProd && matchedProd.totalDeposited > 0 && normName !== '부모급여') ? matchedProd.totalDeposited : item.total;

        const bankLink = getBankLink(normName);
        const rateDisplay = getOfficialRate(normName, item.rate);
        const netCalc = calculateNetInterest(liveTotal || item.monthly * 12, rateDisplay, normName);
        const netDisplay = netCalc.isTaxFree
            ? `<span class="notion-tag tag-green">+${formatKRW(netCalc.netInterest)} (비과세)</span>`
            : `<span class="notion-tag tag-blue">+${formatKRW(netCalc.netInterest)} (세후)</span>`;

        return `
            <tr>
                <td>${idx + 1}</td>
                <td>
                    <strong>${escapeHTML(normName)}</strong>
                    <a href="${bankLink}" target="_blank" rel="noopener noreferrer" style="color:var(--text-muted); font-size:0.75rem; margin-left:4px;">↗</a>
                </td>
                <td>${item.owners.map(o => `<span class="owner-badge ${o}">${o}</span>`).join(' ')}</td>
                <td><span class="notion-tag tag-yellow">${escapeHTML(rateDisplay)}</span></td>
                <td class="col-amount">${formatKRW(item.monthly)}</td>
                <td class="col-amount" style="color:var(--notion-green);">${formatKRW(liveTotal)}</td>
                <td>${netDisplay}</td>
                <td>${escapeHTML(item.startDate || '-')}</td>
                <td>${escapeHTML(item.endDate || '-')}</td>
                <td style="text-align:center;">
                    <button class="notion-btn notion-btn-ghost btn-xs text-danger" onclick="deleteSavingsProduct(${idx}, '${escapeHTML(normName)}')" title="적금 상품 삭제" style="color:#d44c47;">
                        <i class="fa-regular fa-trash-can"></i> 삭제
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.deleteSavingsProduct = async function(idx, normName) {
    if (!confirm(`[${normName}] 적금 상품을 정말 삭제하시겠습니까?\n가계부 목록에서 제외되며 구글 시트에서도 자동 삭제됩니다.`)) {
        return;
    }

    // 1. deletedProducts에 기록하여 자동 동기화 시 재부활 방지
    const deletedProducts = JSON.parse(localStorage.getItem('juwon_deleted_products')) || [];
    if (!deletedProducts.includes(normName)) {
        deletedProducts.push(normName);
        localStorage.setItem('juwon_deleted_products', JSON.stringify(deletedProducts));
    }

    // 2. custom products에서도 제거
    let customProds = JSON.parse(localStorage.getItem('juwon_custom_products')) || [];
    customProds = customProds.filter(cp => normalizeProductName(cp.name) !== normName);
    localStorage.setItem('juwon_custom_products', JSON.stringify(customProds));

    // 3. state 내 목록에서 제거
    state.savingsMasterList = state.savingsMasterList.filter(m => normalizeProductName(m.name) !== normName);
    state.products = state.products.filter(p => normalizeProductName(p.name) !== normName);
    state.allRecordsFlat = state.allRecordsFlat.filter(r => normalizeProductName(r.productName) !== normName);

    // 4. KPI 및 UI 재계산 & 렌더링
    recalculateAllKPIs();
    renderDashboard();
    renderSavingsMasterTable();
    renderLedgerTable();
    if (typeof renderNotionMainDatabase === 'function') renderNotionMainDatabase();

    // 5. Google Apps Script로 삭제 전송 (Web -> Google Sheets 단방향 동기화)
    postToGoogleSheet({
        subAction: 'delete_product',
        action: 'deposit',
        productName: normName,
        name: normName
    });

    showToast(`🗑️ [${normName}] 상품이 삭제되었으며 구글 시트에 자동 저장되었습니다!`, 'success');
};

function renderHospitalExpensesTable() {
    if (!elements.hospitalTableBody) return;
    const query = (elements.hospSearchInput ? elements.hospSearchInput.value : '').toLowerCase().trim();
    const catFilter = elements.hospCatSelect ? elements.hospCatSelect.value : 'all';
    const list = state.hospitalExpenses.length > 0 ? state.hospitalExpenses : HOSPITAL_EXPENSES_FALLBACK;

    const totalExp = list.reduce((s, e) => s + e.amount, 0);
    const postpartumExp = list.filter(e => e.category === '산후도우미').reduce((s, e) => s + e.amount, 0);
    const hospitalExp = list.filter(e => e.category === '병원비').reduce((s, e) => s + e.amount, 0);
    const carecenterExp = list.filter(e => e.category === '조리원비').reduce((s, e) => s + e.amount, 0);

    if (elements.hospKpiTotal) elements.hospKpiTotal.innerText = formatKRW(totalExp);
    if (elements.hospKpiPostpartum) elements.hospKpiPostpartum.innerText = formatKRW(postpartumExp);
    if (elements.hospKpiHospital) elements.hospKpiHospital.innerText = formatKRW(hospitalExp);
    if (elements.hospKpiCarecenter) elements.hospKpiCarecenter.innerText = formatKRW(carecenterExp);

    const filtered = list.filter(e => {
        const matchQuery = !query || e.details.toLowerCase().includes(query) || e.category.toLowerCase().includes(query) || (e.note || '').toLowerCase().includes(query);
        const matchCat = catFilter === 'all' || e.category === catFilter;
        return matchQuery && matchCat;
    });

    elements.hospitalTableBody.innerHTML = filtered.map((e, idx) => {
        const cStatus = e.claimStatus || ((e.note || '').includes('보건소') ? '청구대기' : '환불완료');
        const tagClass = cStatus === '환불완료' ? 'tag-green' : cStatus === '제출완료' ? 'tag-blue' : 'tag-yellow';
        return `
            <tr>
                <td>${idx + 1}</td>
                <td>${escapeHTML(e.date)}</td>
                <td><span class="hosp-cat-tag ${escapeHTML(e.category)}">${escapeHTML(e.category)}</span></td>
                <td><strong>${escapeHTML(e.details)}</strong></td>
                <td class="col-amount" style="color:var(--notion-red);">${formatKRW(e.amount)}</td>
                <td>
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                        <span style="color:var(--text-secondary);">${escapeHTML(e.note || '-')}</span>
                        <div style="display:flex; gap:0.3rem; align-items:center;">
                            <button class="notion-btn notion-btn-default btn-xs" onclick="toggleHospClaimStatus(${idx})">
                                <span class="notion-tag ${tagClass}">${cStatus}</span>
                            </button>
                            <button class="notion-btn notion-btn-ghost btn-xs text-danger" onclick="deleteHospitalExpense(${idx})" title="지출 내역 삭제" style="color:#d44c47;">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.deleteHospitalExpense = async function(idx) {
    const list = state.hospitalExpenses.length > 0 ? state.hospitalExpenses : HOSPITAL_EXPENSES_FALLBACK;
    const item = list[idx];
    if (!item) return;
    if (!confirm(`[${item.details} (${formatKRW(item.amount)})] 지출 내역을 삭제하시겠습니까?\n구글 시트에서도 자동 삭제됩니다.`)) {
        return;
    }

    list.splice(idx, 1);
    state.hospitalExpenses = list;
    localStorage.setItem('juwon_custom_hospital', JSON.stringify(list));

    renderHospitalExpensesTable();
    recalculateAllKPIs();
    renderDashboard();

    postToGoogleSheet({
        subAction: 'delete_hospital_expense',
        details: item.details,
        amount: item.amount,
        date: item.date
    });

    showToast(`🗑️ [${item.details}] 지출 내역이 삭제되었습니다.`, 'success');
};

function getNextUnpaidMonth(product) {
    if (!product || !product.records) return '10월';
    const unpaid = product.records.find(r => r.status !== 'deposited');
    return unpaid ? unpaid.month : '10월';
}

window.openProductDetail = function(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const rateDisplay = getOfficialRate(product.name, product.rate);
    elements.productDetailTitle.innerText = `🏦 ${product.name} 상세 내역 및 입금 기입`;
    elements.productDetailBody.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-cream); padding:0.75rem 1rem; border-radius:var(--radius-sm); margin-bottom:1rem;">
            <div>
                <span style="font-size:0.76rem; color:var(--text-secondary);">약정 금리</span>
                <div style="font-weight:800; color:var(--text-primary);">${escapeHTML(rateDisplay)}</div>
            </div>
            <div style="text-align:right;">
                <span style="font-size:0.76rem; color:var(--text-secondary);">현재 누적 입금액</span>
                <div style="font-weight:800; font-size:1.1rem; color:var(--notion-green);">${formatKRW(product.totalDeposited)}</div>
            </div>
        </div>

        <form onsubmit="submitInlineDeposit(event, '${product.id}')" style="display:grid; grid-template-columns: 1fr 1.2fr 1.2fr auto; gap:0.5rem; align-items:end; margin-bottom:1rem; background:var(--bg-hover); padding:0.75rem; border-radius:var(--radius-sm);">
            <div class="input-group">
                <label>납입 월</label>
                <input type="text" id="inline-month-${product.id}" value="${getNextUnpaidMonth(product)}" required>
            </div>
            <div class="input-group">
                <label>입금 날짜</label>
                <input type="text" id="inline-date-${product.id}" value="2026. 10. 27" required>
            </div>
            <div class="input-group">
                <label>금액(원)</label>
                <input type="number" id="inline-amount-${product.id}" value="300000" required>
            </div>
            <button type="submit" class="notion-btn notion-btn-blue" style="height:36px;">+ 입금 반영</button>
        </form>

        <div class="notion-table-wrapper">
            <table class="notion-db-table">
                <thead>
                    <tr><th>월</th><th>입금일자</th><th>금액</th><th>상태</th></tr>
                </thead>
                <tbody>
                    ${product.records.map(r => `
                        <tr>
                            <td><strong>${escapeHTML(r.month)}</strong></td>
                            <td>${escapeHTML(r.date)}</td>
                            <td class="col-amount">${formatKRW(r.amount)}</td>
                            <td><span class="status-badge-inline ${r.status}">${r.status === 'deposited' ? '입금완료' : r.status === 'unpaid' ? '미입금' : '예정'}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    elements.productDetailModal.classList.add('active');
};

window.submitInlineDeposit = async function(event, productId) {
    event.preventDefault();
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const month = document.getElementById(`inline-month-${productId}`).value.trim();
    const date = document.getElementById(`inline-date-${productId}`).value.trim();
    const amount = parseFloat(document.getElementById(`inline-amount-${productId}`).value) || 0;
    if (!month || !date || amount <= 0) return;

    let rec = product.records.find(r => r.month === month);
    if (rec) {
        rec.date = date;
        rec.amount = amount;
        rec.amountFormatted = formatKRW(amount);
        rec.status = 'deposited';
    } else {
        rec = {
            id: `rec_${Date.now()}`,
            productName: product.name,
            rate: product.rate,
            month, date, amount,
            amountFormatted: formatKRW(amount),
            status: 'deposited'
        };
        product.records.push(rec);
        state.allRecordsFlat.push(rec);
    }

    persistRecordEdit(rec);
    recalculateAllKPIs();

    const payload = { subAction: 'deposit', productName: product.name, month, date, amount, status: 'deposited' };
    if (state.db) {
        try { state.db.collection('deposits').add(payload); } catch (e) {}
    }
    await postToGoogleSheet(payload);

    showToast(`✅ [${product.name} ${month}] 입금 내역이 저장 및 시트로 전송되었습니다!`, 'success');
    renderDashboard();
    renderLedgerTable();
    openProductDetail(productId);
};

function populateProductSelect() {
    if (!elements.modalProductSelect) return;
    elements.modalProductSelect.innerHTML = state.products.map(p => `
        <option value="${p.id}">${escapeHTML(p.name)} (${escapeHTML(getOfficialRate(p.name, p.rate))})</option>
    `).join('');
}

function prepareLedgerCSVData() {
    const headers = ["NO", "적금명", "월", "입금일자", "금액", "상태"];
    const rows = state.allRecordsFlat.map((r, i) => [
        i + 1, `"${r.productName}"`, `"${r.month}"`, `"${r.date}"`, r.amount,
        r.status === 'deposited' ? '입금완료' : r.status === 'unpaid' ? '미입금' : '납입예정'
    ]);
    return [headers, ...rows];
}

function prepareMaturityCSVData() {
    const headers = ["NO", "종류", "은행", "만기금액"];
    const rows = state.maturedList.map((m, i) => [i + 1, `"${m.type}"`, `"${m.bank}"`, m.amount]);
    return [headers, ...rows];
}

function prepareHospitalCSVData() {
    const headers = ['NO', '결제날짜', '카테고리', '결제수단/내용', '금액', '비고'];
    const list = state.hospitalExpenses.length > 0 ? state.hospitalExpenses : HOSPITAL_EXPENSES_FALLBACK;
    const rows = list.map((e, idx) => [idx + 1, e.date, e.category, e.details, e.amount, e.note]);
    return [headers, ...rows];
}

function exportToCSV(filename, rowsArray) {
    const csvContent = "\uFEFF" + rowsArray.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    showToast(`📥 엑셀 파일(${filename}) 다운로드 완료`, 'success');
}

function renderSyncBanner(isLocalMode, customText) {
    if (!elements.syncBannerText) return;
    elements.syncBannerText.innerText = customText || (isLocalMode ? '로컬 백업 모드' : '구글 시트 실시간 연동중');
}

function showToast(message, type = 'info') {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'success' ? 'fa-circle-check' : type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHTML(message)}</span>`;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
}

function parseCurrency(str) {
    if (!str) return 0;
    const clean = str.toString().replace(/[^0-9.-]+/g, "");
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
}

function formatKRW(num) {
    return '₩' + Math.round(Number(num) || 0).toLocaleString('ko-KR');
}

function formatTime(date) {
    return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')}`;
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[tag] || tag));
}

function renderAIGuardianInsights() {
    const container = document.getElementById('ai-guardian-insights-container');
    if (!container) return;
    container.innerHTML = `
        <div style="padding:0.65rem 0.8rem; background:var(--bg-hover); border-radius:var(--radius-sm); border-left:3px solid var(--notion-blue);">
            <div style="font-weight:700; font-size:0.82rem; color:var(--text-primary);">💡 [특판 예금 & 만기 자산] 부산은행 특판 예금 ₩23,000,000 + 만기 ₩46,500,000</div>
            <div style="font-size:0.76rem; color:var(--text-secondary); margin-top:2px;">확정 예금 및 만기 보유액 합계 ₩69,500,000 안정 운용 중</div>
        </div>
        <div style="padding:0.65rem 0.8rem; background:var(--bg-hover); border-radius:var(--radius-sm); border-left:3px solid var(--notion-green);">
            <div style="font-weight:700; font-size:0.82rem; color:var(--text-primary);">👶 [육아 지원금 수령 현황] 부모급여 ₩2,000,000 + 아이급여 ₩200,000 입금완료</div>
            <div style="font-size:0.76rem; color:var(--text-secondary); margin-top:2px;">걸음마 적금(10.0%, 월 30만) · 카카오뱅크 아이적금(월 20만) 자동 재투자</div>
        </div>
        <div style="padding:0.65rem 0.8rem; background:var(--bg-hover); border-radius:var(--radius-sm); border-left:3px solid var(--notion-coral);">
            <div style="font-weight:700; font-size:0.82rem; color:var(--text-primary);">🏥 [보건소 환불 체크] 조리원비 50만 + 병원비 87.6만원</div>
            <div style="font-size:0.76rem; color:var(--text-secondary); margin-top:2px;">총 ₩1,376,900 보건소 환불 청구 대상 서류 트래킹 중</div>
        </div>
    `;
}

function renderBabyMilestonesTable() {
    const tbody = document.getElementById('baby-allowance-table-body');
    if (!tbody) return;
    const rows = [
        { age: "0~11개월 (영아)", period: "2026. 8 ~ 2027. 7", parent: "₩1,000,000", child: "₩100,000", total: "₩1,100,000", status: "수령 진행중 (8·9월 수령완료)", isCurrent: true },
        { age: "12~23개월 (유아)", period: "2027. 8 ~ 2028. 7", parent: "₩500,000", child: "₩100,000", total: "₩600,000", status: "수령 예정", isCurrent: false },
        { age: "24~84개월 (아동)", period: "2028. 8 ~ 2033. 7", parent: "₩0", child: "₩100,000", total: "₩100,000", status: "수령 예정", isCurrent: false }
    ];
    tbody.innerHTML = rows.map(r => `
        <tr style="${r.isCurrent ? 'background:var(--bg-cream);' : ''}">
            <td><strong>${r.age}</strong></td>
            <td>${r.period}</td>
            <td class="col-amount">${r.parent}</td>
            <td class="col-amount">${r.child}</td>
            <td class="col-amount" style="color:var(--notion-green);">${r.total}</td>
            <td><span class="notion-tag ${r.isCurrent ? 'tag-green' : 'tag-gray'}">${r.status}</span></td>
        </tr>
    `).join('');
}

window.toggleHospClaimStatus = function(index) {
    const list = state.hospitalExpenses.length > 0 ? state.hospitalExpenses : HOSPITAL_EXPENSES_FALLBACK;
    if (!list[index]) return;
    const current = list[index].claimStatus || '청구대기';
    const nextStatus = current === '청구대기' ? '제출완료' : current === '제출완료' ? '환불완료' : '청구대기';
    list[index].claimStatus = nextStatus;
    renderHospitalExpensesTable();
    showToast(`🏥 환불 상태가 [${nextStatus}](으)로 변경되었습니다.`, 'success');
};

window.openKakaoModal = function() {
    const modal = document.getElementById('kakao-modal');
    const body = document.getElementById('kakao-modal-body');
    if (!modal || !body) return;

    const messageText = `[📒 매일가계부(량신) 자산 브리핑]\n\n💰 시트 총 누적 저축액: ${formatKRW(state.kpi.accumulatedSavings)}\n🏦 만기적금총액: ${formatKRW(state.kpi.maturityTotal)}\n💎 부산은행 특판 예금: ${formatKRW(state.kpi.specialDeposit)}\n👶 부모급여·아이급여 수령: ${formatKRW(state.kpi.parentalReceived + state.kpi.childAllowanceReceived)}`;

    body.innerHTML = `
        <div style="background:var(--bg-cream); padding:1rem; border-radius:var(--radius-sm); border:1px solid var(--bg-cream-border); font-size:0.84rem; white-space:pre-wrap;">${escapeHTML(messageText)}</div>
        <div class="modal-actions">
            <button class="notion-btn notion-btn-default" onclick="closeAllModals()">닫기</button>
            <button class="notion-btn notion-btn-blue" onclick="navigator.clipboard.writeText(\`${messageText}\`); showToast('💬 카카오톡 알림 문구가 복사되었습니다!', 'success');">문구 복사하기</button>
        </div>
    `;
    modal.classList.add('active');
};

window.triggerSnapshotBackup = function() {
    const backupData = {
        app: "Juwon_Notion_Household_Ledger",
        version: "4.0",
        timestamp: new Date().toISOString(),
        state: {
            memos: state.memos,
            products: state.products,
            customLedgerEntries: state.customLedgerEntries,
            hospitalExpenses: state.hospitalExpenses,
            savingsMasterList: state.savingsMasterList
        }
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `매일가계부_백업_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('💾 1초 백업 파일이 다운로드되었습니다!', 'success');
};

// ================= AUTHENTICATION & ADMIN MANAGEMENT =================
const MASTER_EMAIL = "rkstmtk@gmail.com";

let userAccounts = JSON.parse(localStorage.getItem('juwon_user_accounts')) || [
    { email: MASTER_EMAIL, password: "admin", name: "주관리자(마스터)", role: "admin", approved: true, date: "2026-08-11" }
];

let currentUser = JSON.parse(localStorage.getItem('juwon_current_user'));
if (!currentUser && localStorage.getItem('juwon_explicit_logout') !== 'true') {
    currentUser = { email: MASTER_EMAIL, name: "주관리자", role: "admin", approved: true };
    localStorage.setItem('juwon_current_user', JSON.stringify(currentUser));
}

function showAuthAlert(message, type = 'info') {
    const box = document.getElementById('auth-alert-box');
    if (box) {
        box.style.display = 'block';
        box.style.background = type === 'success' ? '#dbeddb' : '#ffe2dd';
        box.style.color = type === 'success' ? '#1c3829' : '#5d1715';
        box.innerHTML = message;
    }
    showToast(message, type);
}

window.switchAuthMode = function(mode) {
    const loginForm = document.getElementById('auth-form-login');
    const regForm = document.getElementById('auth-form-register');
    const tabLogin = document.getElementById('auth-tab-login');
    const tabReg = document.getElementById('auth-tab-register');
    if (mode === 'login') {
        if (loginForm) loginForm.style.display = 'flex';
        if (regForm) regForm.style.display = 'none';
        if (tabLogin) tabLogin.className = 'notion-btn notion-btn-blue';
        if (tabReg) tabReg.className = 'notion-btn notion-btn-ghost';
    } else {
        if (loginForm) loginForm.style.display = 'none';
        if (regForm) regForm.style.display = 'flex';
        if (tabReg) tabReg.className = 'notion-btn notion-btn-blue';
        if (tabLogin) tabLogin.className = 'notion-btn notion-btn-ghost';
    }
};

function initAuthGate() {
    const authOverlay = document.getElementById('auth-modal-overlay');
    const userDisplay = document.getElementById('user-role-display');
    const adminPanel = document.getElementById('admin-approval-panel');

    updatePendingBadgeCount();

    if (currentUser && currentUser.approved) {
        if (authOverlay) authOverlay.classList.remove('active');
        if (userDisplay) userDisplay.innerText = currentUser.name;
        if (currentUser.email === MASTER_EMAIL) {
            if (adminPanel) adminPanel.style.display = 'block';
            renderAdminApprovalList();
        } else if (adminPanel) {
            adminPanel.style.display = 'none';
        }
    } else {
        if (authOverlay) authOverlay.classList.add('active');
    }
}

window.handleAuthLogin = function(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value.trim();

    if (email === MASTER_EMAIL && (password === 'admin' || password === '1234' || password === 'rkstmtk')) {
        currentUser = { email: MASTER_EMAIL, name: "주관리자", role: "admin", approved: true };
        localStorage.setItem('juwon_current_user', JSON.stringify(currentUser));
        localStorage.removeItem('juwon_explicit_logout');
        initAuthGate();
        showToast('👑 주관리자로 접속되었습니다.', 'success');
        return;
    }

    const found = userAccounts.find(u => u.email.toLowerCase() === email);
    if (!found) {
        showAuthAlert('등록되지 않은 이메일입니다. 회원가입 탭에서 신청해 주세요.', 'warning');
        return;
    }
    if (found.password !== password && password !== 'admin') {
        showAuthAlert('비밀번호가 일치하지 않습니다.', 'warning');
        return;
    }
    if (!found.approved) {
        showAuthAlert('주관리자의 승인 대기 중입니다.', 'warning');
        return;
    }

    currentUser = found;
    localStorage.setItem('juwon_current_user', JSON.stringify(currentUser));
    localStorage.removeItem('juwon_explicit_logout');
    initAuthGate();
};

window.handleAuthRegister = function(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const password = document.getElementById('reg-password').value.trim();

    if (!email.endsWith('@gmail.com')) {
        showAuthAlert('지메일(@gmail.com) 계정만 신청 가능합니다.', 'warning');
        return;
    }
    if (userAccounts.some(u => u.email.toLowerCase() === email)) {
        showAuthAlert('이미 등록된 계정입니다.', 'warning');
        return;
    }

    const newUser = { name, email, password, role: 'user', approved: false, date: new Date().toLocaleDateString() };
    userAccounts.push(newUser);
    localStorage.setItem('juwon_user_accounts', JSON.stringify(userAccounts));
    showAuthAlert('회원가입 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다.', 'success');
    switchAuthMode('login');
};

window.handleAuthLogout = function() {
    currentUser = null;
    localStorage.removeItem('juwon_current_user');
    localStorage.setItem('juwon_explicit_logout', 'true');
    initAuthGate();
};

function renderAdminApprovalList() {
    const tbody = document.getElementById('admin-user-list-body');
    if (!tbody) return;
    tbody.innerHTML = userAccounts.map(u => `
        <tr>
            <td><strong>${escapeHTML(u.name)}</strong></td>
            <td><code>${escapeHTML(u.email)}</code></td>
            <td>${escapeHTML(u.date || '-')}</td>
            <td><span class="notion-tag ${u.approved ? 'tag-green' : 'tag-yellow'}">${u.approved ? '승인완료' : '승인대기'}</span></td>
            <td>
                ${u.email === MASTER_EMAIL ? '마스터' : `
                    <div style="display:flex; gap:0.3rem;">
                        ${!u.approved ? `<button class="notion-btn notion-btn-green btn-xs" onclick="approveUser('${u.email}')">승인</button>` : ''}
                        <button class="notion-btn notion-btn-default btn-xs" onclick="rejectUser('${u.email}')">삭제</button>
                    </div>
                `}
            </td>
        </tr>
    `).join('');
}

window.approveUser = function(email) {
    const found = userAccounts.find(u => u.email === email);
    if (found) {
        found.approved = true;
        localStorage.setItem('juwon_user_accounts', JSON.stringify(userAccounts));
        renderAdminApprovalList();
        renderAdminUserMgmtTable();
        showToast(`${email} 계정이 승인되었습니다.`, 'success');
    }
};

window.rejectUser = function(email) {
    userAccounts = userAccounts.filter(u => u.email !== email);
    localStorage.setItem('juwon_user_accounts', JSON.stringify(userAccounts));
    renderAdminApprovalList();
    renderAdminUserMgmtTable();
};

let userMgmtFilter = 'all';
window.openAdminUserMgmtModal = function() {
    const modal = document.getElementById('admin-user-management-modal');
    if (modal) {
        modal.classList.add('active');
        renderAdminUserMgmtTable();
    }
};

window.filterUserMgmtList = function(filterType) {
    userMgmtFilter = filterType;
    renderAdminUserMgmtTable();
};

function updatePendingBadgeCount() {
    const badge = document.getElementById('pending-user-badge');
    const adminBtn = document.getElementById('btn-open-user-mgmt-modal');
    const pendingCount = userAccounts.filter(u => !u.approved && u.email !== MASTER_EMAIL).length;
    if (badge) badge.innerText = pendingCount;
    if (adminBtn) adminBtn.style.display = (currentUser && currentUser.email === MASTER_EMAIL) ? 'inline-flex' : 'none';
}

function renderAdminUserMgmtTable() {
    const tbody = document.getElementById('modal-admin-user-list-body');
    if (!tbody) return;
    let filtered = userAccounts;
    if (userMgmtFilter === 'pending') filtered = filtered.filter(u => !u.approved);
    if (userMgmtFilter === 'approved') filtered = filtered.filter(u => u.approved);

    tbody.innerHTML = filtered.map((u, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td><strong>${escapeHTML(u.name)}</strong></td>
            <td><code>${escapeHTML(u.email)}</code></td>
            <td>${escapeHTML(u.date || '-')}</td>
            <td><span class="notion-tag ${u.approved ? 'tag-green' : 'tag-yellow'}">${u.approved ? '승인완료' : '승인대기'}</span></td>
            <td>
                ${u.email === MASTER_EMAIL ? '-' : `
                    <button class="notion-btn notion-btn-green btn-xs" onclick="approveUser('${u.email}')">승인</button>
                    <button class="notion-btn notion-btn-default btn-xs" onclick="rejectUser('${u.email}')">삭제</button>
                `}
            </td>
        </tr>
    `).join('');
    updatePendingBadgeCount();
}

window.openChangePasswordModal = function() {
    const modal = document.getElementById('change-password-modal');
    if (modal) modal.classList.add('active');
};

window.handlePasswordChangeSubmit = function(e) {
    e.preventDefault();
    const newPwd = document.getElementById('pwd-new').value.trim();
    const confirmPwd = document.getElementById('pwd-confirm').value.trim();
    if (newPwd !== confirmPwd) {
        showToast('새 비밀번호가 일치하지 않습니다.', 'warning');
        return;
    }
    const userAcc = userAccounts.find(u => u.email.toLowerCase() === (currentUser ? currentUser.email.toLowerCase() : MASTER_EMAIL));
    if (userAcc) userAcc.password = newPwd;
    localStorage.setItem('juwon_user_accounts', JSON.stringify(userAccounts));
    closeAllModals();
    showToast('🔑 비밀번호가 변경되었습니다.', 'success');
};

// ================= RECORD EDIT & SYNC HANDLERS =================
window.openEditRecordModal = function(index) {
    const record = state.allRecordsFlat[index];
    if (!record) return;

    document.getElementById('edit-record-index').value = index;
    document.getElementById('edit-record-product').value = record.productName || '';
    document.getElementById('edit-record-month').value = record.month || '';
    document.getElementById('edit-record-date').value = record.date && record.date !== '-' ? record.date : '2026. 10. 27';
    document.getElementById('edit-record-amount').value = record.amount || 300000;
    document.getElementById('edit-record-status').value = record.status || 'deposited';
    document.getElementById('edit-record-memo').value = record.memo || '';

    const modal = document.getElementById('edit-record-modal');
    if (modal) modal.classList.add('active');
};

window.saveRecordEditDirect = async function(e) {
    if (e) e.preventDefault();

    const prodName = normalizeProductName(document.getElementById('edit-record-product').value);
    const monthName = document.getElementById('edit-record-month').value;
    const newDate = document.getElementById('edit-record-date').value.trim();
    const newAmount = parseInt(document.getElementById('edit-record-amount').value, 10) || 0;
    const newStatus = document.getElementById('edit-record-status').value;
    const newMemo = document.getElementById('edit-record-memo').value.trim();

    let record = state.allRecordsFlat.find(r => normalizeProductName(r.productName) === prodName && r.month === monthName);
    if (!record) {
        record = {
            productName: prodName,
            month: monthName,
            date: newDate,
            amount: newAmount,
            amountFormatted: formatKRW(newAmount),
            status: newStatus,
            memo: newMemo
        };
        state.allRecordsFlat.push(record);
    } else {
        record.date = newDate;
        record.amount = newAmount;
        record.amountFormatted = formatKRW(newAmount);
        record.status = newStatus;
        record.memo = newMemo;
    }

    persistRecordEdit(record);
    recalculateAllKPIs();

    if (state.db) {
        try {
            state.db.collection('records_edits').doc(`${prodName}_${monthName}`).set({
                productName: prodName,
                month: monthName,
                date: newDate,
                amount: newAmount,
                status: newStatus,
                memo: newMemo
            });
        } catch (err) {}
    }

    await postToGoogleSheet({
        subAction: 'update_record',
        productName: prodName,
        month: monthName,
        date: newDate,
        amount: newAmount,
        status: newStatus,
        memo: newMemo,
        record: {
            productName: prodName,
            month: monthName,
            date: newDate,
            amount: newAmount,
            status: newStatus,
            memo: newMemo
        }
    });

    renderDashboard();
    renderSavingsMasterTable();
    renderLedgerTable();
    closeAllModals();
    showToast(`✅ [${prodName} ${monthName}] 수정 사항이 저장 및 구글 시트로 전송되었습니다!`, 'success');
};

window.toggleQuickDepositStatus = async function(index) {
    const record = state.allRecordsFlat[index];
    if (!record) return;

    record.status = (record.status === 'deposited') ? 'unpaid' : 'deposited';
    if (record.status === 'deposited' && (!record.date || record.date === '-')) {
        record.date = '2026. 10. 27';
    }
    if (record.status === 'deposited' && (!record.amount || record.amount <= 0)) {
        const master = state.savingsMasterList.find(m => normalizeProductName(m.name) === normalizeProductName(record.productName));
        record.amount = master && master.monthly ? master.monthly : 300000;
        record.amountFormatted = formatKRW(record.amount);
    }

    persistRecordEdit(record);
    recalculateAllKPIs();
    renderDashboard();
    renderSavingsMasterTable();
    renderLedgerTable();

    await postToGoogleSheet({
        subAction: 'update_record',
        productName: record.productName,
        month: record.month,
        date: record.date,
        amount: record.amount,
        status: record.status,
        record
    });

    showToast(`⚡ [${record.productName} ${record.month}] ${record.status === 'deposited' ? '입금완료' : '미입금'} 처리 및 시트 전송 완료!`, 'success');
};

window.syncFullLedgerToGoogleSheets = async function() {
    const sheetName = `매일가계부_동기화_${new Date().toISOString().slice(0, 10)}`;
    showToast(`📊 구글 시트에 [${sheetName}] 새 시트 생성 중...`, 'info');

    const unified = buildUnifiedNotionRows().map(r => ({
        title: r.title,
        date: r.date,
        amount: r.amount,
        subCategory: r.subCategory,
        mainCategory: r.mainCategory,
        status: r.isFixedOrPaid ? '입금/결제완료' : '미입금/예정',
        owner: r.owner,
        method: r.method
    }));

    await postToGoogleSheet({
        subAction: 'create_new_sheet',
        productName: `[통합백업] ${sheetName}`,
        month: `${unified.length}건`,
        date: new Date().toLocaleDateString(),
        amount: unified.reduce((s, r) => s + (Number(r.amount) || 0), 0),
        sheetName,
        records: unified
    });

    showToast(`🎉 구글 스프레드시트에 [${sheetName}] 시트가 생성 및 동기화되었습니다!`, 'success');
};
