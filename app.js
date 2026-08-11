/**
 * 주원 적금 통합 & 자산 가계부 대시보드 (App.js)
 * Real-time Google Sheets Sync & Deletion / Modification Detector Engine
 */

const DEFAULT_TSV_URL = "https://docs.google.com/spreadsheets/d/16xlN-rZwRRsOhdylZGZZL1-FF3flTthARoE6Tr4Xwrg/export?format=tsv&gid=661362148";
const PUBLISHED_GRID_TSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTPvEFs3NNn16Nka-d2UBt6DzejrnHqWyxnz1iCCqLukYStOof4YN7zIHXc8DXflDip6uVzqn0H2GPl/pub?gid=661362148&single=true&output=tsv";

// Initial Sample Memos (Used only when no memos exist anywhere)
const INITIAL_SAMPLE_MEMOS = [
    { date: "2026-08-07", time: "11:19", category: "일상업무", content: "걸음마 적금 / 하나은행 적금 납입 상태 확인" },
    { date: "2026-08-07", time: "14:30", category: "적금입금", content: "IBK 청년미래적금 자동이체 확인 (₩500,000)" },
    { date: "2026-08-25", time: "10:00", category: "적금입금", content: "IBK 청년미래적금 약정 납입일" }
];

// Global Application State
const state = {
    webappUrl: localStorage.getItem('juwon_webapp_url') || 'https://script.google.com/macros/s/AKfycbzv46eUI_Y-DoICIGb6fLZa5FaWamZbByCt0tqvDfWzIw6bAvWE-wCrWZ2j4GdPBwbJvA/exec',
    isUnlinkedLocalMode: localStorage.getItem('juwon_unlinked_mode') === 'true',
    
    // Firebase Config State
    firebaseConfig: JSON.parse(localStorage.getItem('juwon_fb_config')) || {
        apiKey: "AIzaSyDZLZT8OAcgV0UTC3FBtFfNsrWp_0YsbAk",
        authDomain: "nocaptialyouth.firebaseapp.com",
        projectId: "nocaptialyouth",
        appId: "1:789489809787:web:fd1df94f9aae22281965de"
    },
    db: null,

    // Recommendation Widget State
    recCategory: 'baby',
    recSeed: 0,

    // Multi-Tab Data Collections
    savingsMasterList: [],
    hospitalExpenses: [],

    lastUpdated: null,
    kpi: {
        accumulatedSavings: 0,
        maturityTotal: 0,
        parentalTotal: 0,
        totalNetWorth: 0
    },
    products: [],
    maturedList: [],
    allRecordsFlat: [],
    paidCount: 0,

    calCurrentDate: new Date(2026, 7, 7),
    calSelectedDateStr: "2026-08-07",
    memos: JSON.parse(localStorage.getItem('juwon_memos')) || INITIAL_SAMPLE_MEMOS,

    // Auto Polling Timer (5 seconds)
    autoSyncTimer: null,
    autoSyncIntervalSec: 5
};

// DOM Element Selectors
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

    // Hospital Expenses Tab DOM Elements
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

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initSetupPanel();
    initFirebase();
    setupTabNavigation();
    setupEventListeners();
    renderCalendar();
    fetchData();
    startAutoSyncTimer(state.autoSyncIntervalSec);
});

function initFirebase() {
    if (state.firebaseConfig && typeof firebase !== 'undefined') {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(state.firebaseConfig);
            }
            state.db = firebase.firestore();
            console.log("🔥 Firebase Firestore Connected!");
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
        snapshot.forEach(doc => {
            memos.push(doc.data());
        });
        if (memos.length > 0) {
            state.memos = memos;
            localStorage.setItem('juwon_memos', JSON.stringify(memos));
            renderCalendar();
        }
    }, err => console.warn("Firebase listener error:", err));
}

function startAutoSyncTimer(seconds) {
    if (state.autoSyncTimer) {
        clearInterval(state.autoSyncTimer);
        state.autoSyncTimer = null;
    }
    if (seconds > 0) {
        state.autoSyncTimer = setInterval(() => {
            fetchData(true); // background silent fetch
        }, seconds * 1000);
    }
}

function initSetupPanel() {
    elements.webappUrlInput.value = state.isUnlinkedLocalMode ? '' : state.webappUrl;
    if (state.firebaseConfig) {
        if (elements.fbApiKey) elements.fbApiKey.value = state.firebaseConfig.apiKey || 'AIzaSyDZLZT8OAcgV0UTC3FBtFfNsrWp_0YsbAk';
        if (elements.fbProjectId) elements.fbProjectId.value = state.firebaseConfig.projectId || 'nocaptialyouth';
        if (elements.fbAuthDomain) elements.fbAuthDomain.value = state.firebaseConfig.authDomain || 'nocaptialyouth.firebaseapp.com';
        if (elements.fbAppId) elements.fbAppId.value = state.firebaseConfig.appId || '1:789489809787:web:fd1df94f9aae22281965de';
    }
}

function setupTabNavigation() {
    elements.navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            elements.navTabs.forEach(t => t.classList.remove('active'));
            elements.tabPages.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const targetPage = document.getElementById(`tab-${targetTab}`);
            if (targetPage) targetPage.classList.add('active');
        });
    });
}

function setupEventListeners() {
    elements.topSyncBtn.addEventListener('click', () => {
        elements.topSyncIcon.classList.add('fa-spin');
        fetchData().finally(() => {
            setTimeout(() => elements.topSyncIcon.classList.remove('fa-spin'), 600);
        });
    });

    if (elements.btnSaveFirebase) {
        elements.btnSaveFirebase.addEventListener('click', () => {
            const apiKey = elements.fbApiKey.value.trim();
            const projectId = elements.fbProjectId.value.trim() || 'nocaptial-2f737';
            const authDomain = elements.fbAuthDomain.value.trim() || `${projectId}.firebaseapp.com`;
            const appId = elements.fbAppId.value.trim();

            if (!apiKey || !appId) {
                showToast('🔥 Firebase apiKey와 appId를 입력해 주세요!', 'warning');
                return;
            }

            const config = { apiKey, projectId, authDomain, appId };
            state.firebaseConfig = config;
            localStorage.setItem('juwon_fb_config', JSON.stringify(config));
            
            if (initFirebase()) {
                showToast('🔥 Firebase 0초 실시간 연동 성공!', 'success');
            } else {
                showToast('Firebase 키를 확인해 주세요.', 'warning');
            }
        });
    }

    if (elements.btnClearFirebase) {
        elements.btnClearFirebase.addEventListener('click', () => {
            state.firebaseConfig = null;
            localStorage.removeItem('juwon_fb_config');
            if (elements.fbApiKey) elements.fbApiKey.value = '';
            if (elements.fbAppId) elements.fbAppId.value = '';
            showToast('🔥 Firebase 연동 해제됨', 'info');
        });
    }

    if (elements.autoSyncIntervalSelect) {
        elements.autoSyncIntervalSelect.addEventListener('change', (e) => {
            const sec = parseInt(e.target.value, 10);
            state.autoSyncIntervalSec = sec;
            startAutoSyncTimer(sec);
            if (sec > 0) {
                showToast(`⚡ ${sec}초 마다 실시간 감지 동기화 설정 완료`, 'info');
            } else {
                showToast('수동 동기화 모드로 변경되었습니다.', 'info');
            }
        });
    }

    elements.btnSaveUrl.addEventListener('click', () => {
        const val = elements.webappUrlInput.value.trim();
        if (val) {
            state.webappUrl = val;
            state.isUnlinkedLocalMode = false;
            localStorage.setItem('juwon_webapp_url', val);
            localStorage.setItem('juwon_unlinked_mode', 'false');
            showToast('연동 URL이 저장되었습니다.', 'success');
            fetchData();
        } else {
            showToast('연동 URL을 입력하세요.', 'warning');
        }
    });

    elements.btnClearUrl.addEventListener('click', () => {
        state.isUnlinkedLocalMode = true;
        state.webappUrl = '';
        elements.webappUrlInput.value = '';
        localStorage.setItem('juwon_unlinked_mode', 'true');
        localStorage.removeItem('juwon_webapp_url');
        showToast('연동 URL 해제됨 (공개 시트 실시간 동기화 모드)', 'info');
        fetchData();
    });

    elements.btnCopyCode.addEventListener('click', () => {
        const codeText = elements.codeContent.innerText;
        navigator.clipboard.writeText(codeText).then(() => {
            showToast('📋 구글 Apps Script 매크로 코드가 복사되었습니다!', 'success');
        });
    });

    elements.calPrevBtn.addEventListener('click', () => {
        state.calCurrentDate.setMonth(state.calCurrentDate.getMonth() - 1);
        renderCalendar();
    });

    elements.calNextBtn.addEventListener('click', () => {
        state.calCurrentDate.setMonth(state.calCurrentDate.getMonth() + 1);
        renderCalendar();
    });

    elements.btnOpenScheduleModal.addEventListener('click', () => {
        elements.schedDateInput.value = state.calSelectedDateStr;
        elements.scheduleModal.classList.add('active');
    });

    elements.scheduleModalClose.addEventListener('click', closeAllModals);
    elements.btnSchedCancel.addEventListener('click', closeAllModals);

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
                try {
                    state.db.collection('memos').add(newMemo);
                } catch (e) {
                    console.warn("Firestore memo write error:", e);
                }
            }

            if (state.webappUrl && !state.isUnlinkedLocalMode) {
                try {
                    await fetch(state.webappUrl, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newMemo)
                    });
                } catch (err) {
                    console.warn('WebApp post error:', err);
                }
            }

            showToast('일정이 성공적으로 저장되었습니다!', 'success');
            closeAllModals();
            elements.scheduleForm.reset();
            renderCalendar();
        }
    });

    elements.ledgerSearchInput.addEventListener('input', renderLedgerTable);
    elements.ledgerStatusSelect.addEventListener('change', renderLedgerTable);

    if (elements.hospSearchInput) elements.hospSearchInput.addEventListener('input', renderHospitalExpensesTable);
    if (elements.hospCatSelect) elements.hospCatSelect.addEventListener('change', renderHospitalExpensesTable);

    elements.btnExportExcel.addEventListener('click', () => exportToCSV('Juwon_Savings_Ledger.csv', prepareLedgerCSVData()));
    elements.btnExportMaturityExcel.addEventListener('click', () => exportToCSV('Juwon_Maturity_Assets.csv', prepareMaturityCSVData()));
    if (elements.btnExportHospExcel) {
        elements.btnExportHospExcel.addEventListener('click', () => exportToCSV('Juwon_Hospital_Care_Expenses.csv', prepareHospitalCSVData()));
    }

    const btnRefreshRec = document.getElementById('btn-refresh-recommend');
    if (btnRefreshRec) {
        btnRefreshRec.addEventListener('click', () => {
            state.recSeed++;
            renderRecommendations();
            showToast('🔄 2026 추천 적금 목록이 새롭게 갱신되었습니다!', 'info');
        });
    }

    elements.btnOpenDepositModal.addEventListener('click', () => {
        populateProductSelect();
        elements.depositModal.classList.add('active');
    });
    elements.depositModalClose.addEventListener('click', closeAllModals);
    elements.btnDepositCancel.addEventListener('click', closeAllModals);

    elements.depositForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const prodId = elements.modalProductSelect.value;
        const month = document.getElementById('modal-month-input').value.trim();
        const date = document.getElementById('modal-date-input').value.trim();
        const amount = parseFloat(document.getElementById('modal-amount-input').value) || 0;

        const product = state.products.find(p => p.id === prodId);
        if (product) {
            product.records.push({
                month, date, amount, amountFormatted: formatKRW(amount), status: 'deposited'
            });
            product.totalDeposited += amount;
            showToast(`${product.name} ${month} 입금(${formatKRW(amount)}) 등록 완료!`, 'success');
            closeAllModals();
            elements.depositForm.reset();
            renderDashboard();
            renderLedgerTable();
        }
    });

    if (elements.btnOpenNewProductModal) {
        elements.btnOpenNewProductModal.addEventListener('click', () => {
            if (elements.newProductModal) elements.newProductModal.classList.add('active');
        });
    }
    if (elements.newProductModalClose) elements.newProductModalClose.addEventListener('click', closeAllModals);
    if (elements.btnNewProdCancel) elements.btnNewProdCancel.addEventListener('click', closeAllModals);

    if (elements.newProductForm) {
        elements.newProductForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('new-prod-name').value.trim();
            const rate = document.getElementById('new-prod-rate').value.trim() || '5.0%';
            const owner = document.getElementById('new-prod-owner').value;
            const monthly = parseFloat(document.getElementById('new-prod-monthly').value) || 300000;
            const initial = parseFloat(document.getElementById('new-prod-initial').value) || 0;
            const startDate = document.getElementById('new-prod-start').value.trim() || '2026. 8. 11';
            const endDate = document.getElementById('new-prod-end').value.trim() || '2027. 8. 11';

            if (!name) return;

            const newProd = {
                id: `prod_new_${Date.now()}`,
                name,
                rate,
                records: initial > 0 ? [{
                    id: `rec_${Date.now()}`,
                    productName: name,
                    rate,
                    month: '8월',
                    date: startDate,
                    amount: initial,
                    amountFormatted: formatKRW(initial),
                    status: 'deposited'
                }] : [],
                totalDeposited: initial
            };

            state.products.push(newProd);

            state.savingsMasterList.push({
                name,
                owners: [owner],
                monthly,
                monthlyFormatted: formatKRW(monthly),
                total: initial,
                totalFormatted: formatKRW(initial),
                startDate,
                endDate
            });

            if (state.db) {
                try {
                    state.db.collection('products').add({ name, rate, owner, monthly, initial, startDate, endDate });
                } catch (err) {
                    console.warn("Firestore addProduct error:", err);
                }
            }

            showToast(`🎉 [${name}] 적금 상품이 성공적으로 신규 등록되었습니다!`, 'success');
            closeAllModals();
            elements.newProductForm.reset();
            renderDashboard();
            renderSavingsMasterTable();
        });
    }

    // ESC Key listener to close all modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });

    // Close modals on overlay background click
    [elements.depositModal, elements.scheduleModal, elements.productDetailModal, elements.newProductModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeAllModals();
            });
        }
    });

    elements.productDetailClose.addEventListener('click', closeAllModals);
}

function closeAllModals() {
    if (elements.depositModal) elements.depositModal.classList.remove('active');
    if (elements.scheduleModal) elements.scheduleModal.classList.remove('active');
    if (elements.productDetailModal) elements.productDetailModal.classList.remove('active');
    if (elements.newProductModal) elements.newProductModal.classList.remove('active');
}

// Bank Search & Official Information Link Mapping
const BANK_LINKS = {
    "걸음마 적금(새마을금고)": "https://search.naver.com/search.naver?query=새마을금고+걸음마+적금",
    "하나은행(산모)": "https://search.naver.com/search.naver?query=하나은행+아이키움+적금",
    "하나은행": "https://search.naver.com/search.naver?query=하나은행+아이키움+적금",
    "굴비적금(토스)": "https://search.naver.com/search.naver?query=토스뱅크+굴비적금",
    "굴비적금": "https://search.naver.com/search.naver?query=토스뱅크+굴비적금",
    "카카오뱅크 아이적금": "https://search.naver.com/search.naver?query=카카오뱅크+아이적금",
    "청년미래적금계좌": "https://search.naver.com/search.naver?query=IBK+청년미래적금",
    "IBK 청년미래적금(우대형)": "https://search.naver.com/search.naver?query=IBK+청년미래적금",
    "너만SOLO": "https://search.naver.com/search.naver?query=신한은행+너만SOLO+적금",
    "부모급여": "https://search.naver.com/search.naver?query=2026+부모급여+혜택",
    "새마을금고예금": "https://search.naver.com/search.naver?query=새마을금고+정기예금",
    "부산기쁨두배통장": "https://search.naver.com/search.naver?query=부산+기쁨두배통장"
};

const OFFICIAL_RATES = {
    "걸음마 적금(새마을금고)": "10.0%",
    "하나은행(산모)": "5.0%",
    "하나은행": "5.0%",
    "굴비적금(토스)": "4.3%",
    "굴비적금": "4.3%",
    "카카오뱅크 아이적금": "5.0%",
    "청년미래적금계좌": "6.0% (일반형)",
    "IBK 청년미래적금(우대형)": "6.0% (일반형)",
    "너만SOLO": "6.0%",
    "부모급여": "정부지원",
    "새마을금고예금": "4.0%",
    "부산기쁨두배통장": "1+1+이자"
};

const PRODUCT_EPISODES = {
    "걸음마 적금(새마을금고)": 12,
    "하나은행(산모)": 12,
    "하나은행": 12,
    "굴비적금(토스)": 6,
    "굴비적금": 6,
    "카카오뱅크 아이적금": 26,
    "청년미래적금계좌": 36,
    "IBK 청년미래적금(우대형)": 36,
    "너만SOLO": 36,
    "부모급여": 12,
    "새마을금고예금": 1,
    "부산기쁨두배통장": 36
};

const BABY_RECOMMENDATIONS = [
    { name: "새마을금고 용용적금/걸음마 특판", rate: "최고 10.0%", desc: "2026년 출생아 우대 최고 연 10.0% 출생축하 우대금리", query: "새마을금고+용용적금+걸음마적금" },
    { name: "하나은행 아이키움 적금", rate: "최고 5.0%", desc: "양육수당/아기 수당 수령 시 우대 금리 혜택", query: "하나은행+아이키움적금" },
    { name: "KB국민 아이사랑 적금", rate: "최고 6.5%", desc: "미성년 아기 명의 가입 시 출생 우대금리 최고 6.5%", query: "KB국민은행+아이사랑적금" },
    { name: "신한은행 아기드림 적금", rate: "최고 5.5%", desc: "영유아 전용 우대금리 및 첫 만기 축하금 지원", query: "신한은행+아이드림적금" },
    { name: "카카오뱅크 26주 아이적금", rate: "최고 5.0%", desc: "매주 자동이체 성공 시 단계별 우대금리 5.0%", query: "카카오뱅크+26주적금" },
    { name: "우리은행 우리아이 처음적금", rate: "최고 5.5%", desc: "아기 첫 통장 개설 우대쿠폰 1만원 추가 혜택", query: "우리은행+우리아이처음적금" },
    { name: "농협은행 아이행복 적금", rate: "최고 4.8%", desc: "아기 출생 증명서 제출 시 우대 금리 즉시 적용", query: "NH농협+아이행복적금" }
];

const HIGH_YIELD_RECOMMENDATIONS = [
    { name: "IBK기업은행 청년미래/도약 적금", rate: "최고 6.0%", desc: "정부 연계 청년 저축계좌 일반형 연 6.0%", query: "IBK+청년미래적금" },
    { name: "신한은행 SOL 너만SOLO 적금", rate: "최고 6.0%", desc: "약정 납입 달성 시 최고 연 6.0% 우대 적금", query: "신한은행+너만SOLO적금" },
    { name: "토스뱅크 굴비적금", rate: "최고 4.3%", desc: "굴비 저금 시 매달 자동 우대 이율 반영 최고 연 4.3%", query: "토스뱅크+굴비적금" },
    { name: "부산은행 기쁨두배 통장", rate: "1+1 원금매칭", desc: "부산시 청년 지원 1+1 원금 매칭 및 이자 혜택", query: "부산은행+기쁨두배통장" },
    { name: "새마을금고 2000만원 정기예금", rate: "연 4.0%", desc: "확정 금리 4.0% 비과세 활용 정기예금", query: "새마을금고+정기예금+금리" },
    { name: "K뱅크 챌린지 적금", rate: "최고 7.0%", desc: "매일 저축 챌린지 성공 시 최고 연 7.0% 적용", query: "케이뱅크+챌린지적금" },
    { name: "전북은행 JB 퍼스트 적금", rate: "최고 8.0%", desc: "첫 거래 고객 전용 특판 고금리 연 8.0%", query: "전북은행+JB퍼스트적금" }
];

window.switchRecommendCategory = function(cat) {
    state.recCategory = cat;
    const babyTab = document.getElementById('rec-tab-baby');
    const highTab = document.getElementById('rec-tab-high');
    if (babyTab && highTab) {
        if (cat === 'baby') {
            babyTab.className = "btn btn-teal btn-sm active";
            highTab.className = "btn btn-outline btn-sm";
        } else {
            babyTab.className = "btn btn-outline btn-sm";
            highTab.className = "btn btn-teal btn-sm active";
        }
    }
    renderRecommendations();
};

function renderRecommendations() {
    const listContainer = document.getElementById('recommend-list');
    if (!listContainer) return;

    const sourceList = state.recCategory === 'high' ? HIGH_YIELD_RECOMMENDATIONS : BABY_RECOMMENDATIONS;
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const offset = (dayOfYear + state.recSeed) % sourceList.length;

    const displayItems = [];
    for (let i = 0; i < 5; i++) {
        displayItems.push(sourceList[(offset + i) % sourceList.length]);
    }

    listContainer.innerHTML = displayItems.map(item => `
        <div class="recommend-item" style="padding:0.6rem 0; border-bottom:1px dashed var(--border-color); display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
            <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.15rem;">
                    <strong style="font-size:0.86rem; color:var(--text-primary);">${escapeHTML(item.name)}</strong>
                    <span class="rate-badge" style="font-size:0.72rem; padding:0.1rem 0.4rem; background:#ccfbf1; color:#0f766e;"><i class="fa-solid fa-percent"></i> ${escapeHTML(item.rate)}</span>
                </div>
                <div style="font-size:0.75rem; color:var(--text-secondary); line-height:1.3;">${escapeHTML(item.desc)}</div>
            </div>
            <a href="https://search.naver.com/search.naver?query=${encodeURIComponent(item.query)}" target="_blank" rel="noopener noreferrer" class="btn btn-teal btn-sm" style="font-size:0.75rem; padding:0.3rem 0.6rem; white-space:nowrap; text-decoration:none;">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> 조회
            </a>
        </div>
    `).join('');
}

function getBankLink(name) {
    if (!name) return "https://search.naver.com/search.naver?query=적금+추천";
    const foundKey = Object.keys(BANK_LINKS).find(k => name.includes(k) || k.includes(name));
    return foundKey ? BANK_LINKS[foundKey] : `https://search.naver.com/search.naver?query=${encodeURIComponent(name)}`;
}

function getOfficialRate(name, currentRate) {
    if (currentRate && currentRate !== '이율 정보 없음' && currentRate !== '약정 이율' && !currentRate.includes('12.0%')) return currentRate;
    const foundKey = Object.keys(OFFICIAL_RATES).find(k => name.includes(k) || k.includes(name));
    return foundKey ? OFFICIAL_RATES[foundKey] : (currentRate || '약정 이율');
}

function getTargetEpisodes(name, actualRecordCount) {
    const foundKey = Object.keys(PRODUCT_EPISODES).find(k => name.includes(k) || k.includes(name));
    const target = foundKey ? PRODUCT_EPISODES[foundKey] : 12;
    return Math.max(target, actualRecordCount || 0);
}

// Embedded Multi-Tab Fallback Data
const SAVINGS_MASTER_FALLBACK = [
    { name: "걸음마 적금(새마을금고)", owners: ["주원"], rate: "10.0%", monthly: 300000, monthlyFormatted: "₩300,000", total: 300000, totalFormatted: "₩300,000", startDate: "2026. 7. 30", endDate: "2027. 7. 30" },
    { name: "하나은행(산모)", owners: ["지헌"], rate: "5.0%", monthly: 300000, monthlyFormatted: "₩300,000", total: 300000, totalFormatted: "₩300,000", startDate: "-", endDate: "-" },
    { name: "굴비적금(토스)", owners: ["지헌"], rate: "4.3%", monthly: 300000, monthlyFormatted: "₩300,000", total: 1200000, totalFormatted: "₩1,200,000", startDate: "-", endDate: "-" },
    { name: "카카오뱅크 아이적금", owners: ["주원"], rate: "5.0%", monthly: 0, monthlyFormatted: "₩0", total: 0, totalFormatted: "₩0", startDate: "-", endDate: "-" },
    { name: "청년미래적금계좌", owners: ["준영"], rate: "6.0% (일반형)", monthly: 500000, monthlyFormatted: "₩500,000", total: 500000, totalFormatted: "₩500,000", startDate: "2026. 8. 25", endDate: "2029. 8. 25" },
    { name: "너만SOLO", owners: ["지헌"], rate: "6.0%", monthly: 300000, monthlyFormatted: "₩300,000", total: 10000000, totalFormatted: "₩10,000,000", startDate: "2023. 8. 25", endDate: "2026. 8. 25" },
    { name: "부모급여", owners: ["지헌"], rate: "정부지원", monthly: 1000000, monthlyFormatted: "₩1,000,000", total: 19000000, totalFormatted: "₩19,000,000", startDate: "2026. 8. 25", endDate: "2027. 8. 25" },
    { name: "새마을금고예금", owners: ["준영"], rate: "4.0%", monthly: 20000000, monthlyFormatted: "₩20,000,000", total: 20000000, totalFormatted: "₩20,000,000", startDate: "2026. 6. 25", endDate: "2026. 9. 25" },
    { name: "부산기쁨두배통장", owners: ["지헌"], rate: "1+1+이자", monthly: 100000, monthlyFormatted: "₩100,000", total: 300000, totalFormatted: "₩300,000", startDate: "2025. 8. 25", endDate: "2028. 8. 25" }
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

// Zero-Cache Fetch Engine (Multi-Tab TSV Parser)
async function fetchData(isSilent = false) {
    // 1. Fetch Savings Master Tab (gid=7284588)
    try {
        const masterRes = await fetch(`https://docs.google.com/spreadsheets/d/16xlN-rZwRRsOhdylZGZZL1-FF3flTthARoE6Tr4Xwrg/export?format=tsv&gid=7284588&nocache=${Date.now()}`);
        if (masterRes.ok) {
            const masterText = await masterRes.text();
            parseSavingsMasterTSV(masterText);
        }
    } catch (e) {
        console.warn("Savings Master TSV fetch error:", e);
    }

    // 2. Fetch Hospital & Postpartum Expenses Tab (gid=1541600042)
    try {
        const hospRes = await fetch(`https://docs.google.com/spreadsheets/d/16xlN-rZwRRsOhdylZGZZL1-FF3flTthARoE6Tr4Xwrg/export?format=tsv&gid=1541600042&nocache=${Date.now()}`);
        if (hospRes.ok) {
            const hospText = await hospRes.text();
            parseHospitalTSV(hospText);
        }
    } catch (e) {
        console.warn("Hospital TSV fetch error:", e);
    }

    // 3. Fetch Monthly Grid Tab (gid=661362148)
    let urlsToTry = [DEFAULT_TSV_URL, PUBLISHED_GRID_TSV_URL];
    if (state.webappUrl && !state.isUnlinkedLocalMode && !urlsToTry.includes(state.webappUrl)) {
        urlsToTry.push(state.webappUrl);
    }

    let success = false;

    for (const url of urlsToTry) {
        try {
            const cacheBustUrl = `${url}${url.includes('?') ? '&' : '?'}nocache=${Date.now()}`;
            const res = await fetch(cacheBustUrl, { 
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
            });

            if (!res.ok) continue;

            const text = await res.text();
            if (text.includes('accounts.google.com') || text.includes('<!doctype html>')) {
                continue;
            }

            try {
                const json = JSON.parse(text);
                if (json.grid) {
                    parseGridArray(json.grid);
                    parseMemosFromSheet(json.memos || []);
                } else {
                    parseGridArray(json);
                }
            } catch (e) {
                parseTSVString(text);
            }

            success = true;
            renderSyncBanner(false, '구글 시트 3개 시트 탭 실시간 연동 완료 (100% 동기화)');
            break;
        } catch (err) {
            console.warn(`Fetch failed for ${url}:`, err);
        }
    }

    if (!success) {
        loadBackupData();
        renderSyncBanner(true, '로컬 백업 모드로 가동 중입니다.');
    }

    renderDashboard();
    renderSavingsMasterTable();
    renderHospitalExpensesTable();
    renderLedgerTable();
    renderMaturityTable();
    renderCalendar();
    state.lastUpdated = new Date();
    elements.bannerUpdatedTime.innerText = `기준일시: ${formatTime(state.lastUpdated)}`;
    
    if (!isSilent && success) {
        showToast('구글 시트 3개 탭 변경 사항 자동 수집 완료', 'success');
    }
}

function parseSavingsMasterTSV(tsvText) {
    if (!tsvText) return;
    const lines = tsvText.split(/\r?\n/).map(line => line.split('\t'));
    const masterList = [];

    for (let r = 0; r < lines.length; r++) {
        const row = lines[r];
        if (!row || row.length < 3) continue;
        const name = (row[2] || '').trim();
        const juwon = (row[3] || '').trim();
        const jihyeon = (row[4] || '').trim();
        const junyeong = (row[5] || '').trim();
        const monthly = parseCurrency(row[6]);
        const total = parseCurrency(row[7]);
        const startDate = (row[8] || '').trim();
        const endDate = (row[9] || '').trim();

        if (name && name !== '종류' && (monthly > 0 || total > 0 || juwon === 'O' || jihyeon === 'O' || junyeong === 'O')) {
            const owners = [];
            if (juwon === 'O') owners.push('주원');
            if (jihyeon === 'O') owners.push('지헌');
            if (junyeong === 'O') owners.push('준영');

            masterList.push({
                name,
                owners: owners.length ? owners : ['가족공용'],
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

function parseHospitalTSV(tsvText) {
    if (!tsvText) return;
    const lines = tsvText.split(/\r?\n/).map(line => line.split('\t'));
    const expenses = [];

    for (let r = 0; r < lines.length; r++) {
        const row = lines[r];
        if (!row || row.length < 4) continue;
        const date = (row[0] || '').trim();
        const category = (row[1] || '').trim();
        const details = (row[2] || '').trim();
        const amount = parseCurrency(row[3]);
        const note = (row[4] || '').trim();

        if (date && date.includes('202') && category && amount > 0) {
            expenses.push({
                date, category, details, amount,
                amountFormatted: formatKRW(amount),
                note: note || '-'
            });
        }
    }

    if (expenses.length > 0) {
        state.hospitalExpenses = expenses;
    }
}

// Multi-Section Reset-First Grid Parser (Eliminates column leakage and duplicates)
function parseGridArray(grid) {
    if (!grid || grid.length < 3) return;

    state.products = [];
    state.maturedList = [];
    state.allRecordsFlat = [];

    let accumulatedSavingsFromKPI = 0;
    let maturityTotalFromKPI = 0;
    let parentalTotalFromKPI = 0;
    let paidCount = 0;

    // 1. Scan Top KPI Cards (Lines 0 to 15)
    for (let r = 0; r < Math.min(grid.length, 15); r++) {
        const row = grid[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
            const cell = (row[c] || '').toString().trim();
            if (cell.includes('총 누적 저축액')) {
                accumulatedSavingsFromKPI = parseCurrency(grid[r+1]?.[c] || grid[r]?.[c+1] || grid[r+1]?.[c+1]);
            } else if (cell.includes('만기적금총액')) {
                maturityTotalFromKPI = parseCurrency(grid[r+1]?.[c] || grid[r]?.[c+1] || grid[r+1]?.[c+1]);
            } else if (cell.includes('부모급여') && (cell.includes('총액') || r < 12)) {
                parentalTotalFromKPI = parseCurrency(grid[r+1]?.[c] || grid[r]?.[c+1] || grid[r+1]?.[c+1]);
            }
        }
    }

    // 2. Scan ALL header rows containing product titles and subheader "월"
    for (let r = 0; r < grid.length - 1; r++) {
        const row = grid[r];
        const subRow = grid[r + 1] || [];
        if (!row || !subRow) continue;

        for (let c = 0; c < subRow.length; c++) {
            const subCell = (subRow[c] || '').toString().trim();
            if (subCell === '월') {
                let prodName = '';
                let rateStr = '이율 정보 없음';

                for (let offset = -2; offset <= 3; offset++) {
                    const targetIdx = c + offset;
                    if (targetIdx >= 0 && targetIdx < row.length) {
                        const candidate = (row[targetIdx] || '').toString().trim();
                        if (candidate && !candidate.includes('이율') && candidate !== '월' && candidate !== '입금날짜' && candidate !== '금액' && candidate !== '현재날짜') {
                            if (!prodName) prodName = candidate;
                        }
                        if (candidate && candidate.includes('이율')) {
                            rateStr = candidate;
                        }
                    }
                }

                if (prodName) {
                    const monthCol = c;
                    let dateCol = c + 1;
                    let amountCol = c + 2;
                    if ((subRow[c + 1] || '').toString().includes('입금날짜') || (subRow[c + 1] || '').toString().includes('받는날짜')) dateCol = c + 1;
                    if ((subRow[c + 2] || '').toString().includes('금액')) amountCol = c + 2;

                    const cleanName = prodName.replace(/이율\([^)]+\)/g, '').trim();

                    let prodObj = state.products.find(p => p.name === cleanName);
                    if (!prodObj) {
                        prodObj = {
                            id: `prod_${state.products.length}`,
                            name: cleanName,
                            rate: rateStr,
                            records: [],
                            totalDeposited: 0
                        };
                        state.products.push(prodObj);
                    }

                    // Parse monthly rows specifically for this grid block
                    for (let mr = r + 2; mr < grid.length; mr++) {
                        const mRow = grid[mr];
                        if (!mRow) break;
                        const monthVal = (mRow[monthCol] || '').toString().trim();
                        const dateVal = (mRow[dateCol] || '').toString().trim();
                        const amountVal = (mRow[amountCol] || '').toString().trim();

                        if (monthVal === '총액' || monthVal === '총역' || monthVal === '총급여' || monthVal === '월') {
                            break; // End of this product block
                        }

                        if (monthVal && monthVal !== '종류' && monthVal !== '현재날짜') {
                            const amountNum = parseCurrency(amountVal);
                            let status = 'scheduled';

                            if (dateVal && dateVal !== '미입금' && amountNum > 0) {
                                status = 'deposited';
                                prodObj.totalDeposited += amountNum;
                                paidCount++;
                            } else if (dateVal === '미입금' || (monthVal.includes('8월') && !dateVal)) {
                                status = 'unpaid';
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

    // 3. Scan Matured Deposits List Items
    for (let r = 0; r < grid.length; r++) {
        const row = grid[r];
        if (!row) continue;
        for (let c = 0; c < row.length - 2; c++) {
            const cell = (row[c] || '').toString().trim();
            if (cell.includes('만기적금') || cell.includes('예금만기') || cell.includes('청년도약계좌')) {
                const bankVal = (row[c + 1] || '').toString().trim();
                const amountVal = (row[c + 2] || '').toString().trim();
                const amountNum = parseCurrency(amountVal);
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

    // 4. Merge ALL products from savingsMasterList
    const masterListToMerge = state.savingsMasterList.length > 0 ? state.savingsMasterList : SAVINGS_MASTER_FALLBACK;
    masterListToMerge.forEach(masterItem => {
        let existing = state.products.find(p => p.name.includes(masterItem.name) || masterItem.name.includes(p.name));
        if (!existing) {
            existing = {
                id: `prod_master_${state.products.length}`,
                name: masterItem.name,
                rate: '약정 이율',
                records: [],
                totalDeposited: masterItem.total || 0
            };
            state.products.push(existing);
        } else {
            const depSum = existing.records.filter(r => r.status === 'deposited').reduce((s, r) => s + r.amount, 0);
            existing.totalDeposited = depSum > 0 ? depSum : (masterItem.total || 0);
        }
    });

    const totalAccumulatedSavings = state.products.reduce((s, p) => s + p.totalDeposited, 0) || accumulatedSavingsFromKPI;
    const totalMatured = state.maturedList.reduce((s, m) => s + m.amount, 0) || maturityTotalFromKPI;

    state.kpi.accumulatedSavings = totalAccumulatedSavings;
    state.kpi.maturityTotal = totalMatured;
    state.kpi.parentalTotal = parentalTotalFromKPI || 19000000;
    state.kpi.totalNetWorth = totalAccumulatedSavings + totalMatured;
    state.paidCount = paidCount;
}

function parseTSVString(tsvText) {
    const lines = tsvText.split(/\r?\n/).map(line => line.split('\t'));
    parseGridArray(lines);
}

function parseMemosFromSheet(memoRows) {
    const memos = [];
    if (memoRows && memoRows.length > 1) {
        for (let r = 1; r < memoRows.length; r++) {
            const row = memoRows[r];
            if (row && row[0]) {
                memos.push({
                    date: (row[0] || '').toString().trim(),
                    time: (row[1] || '10:00').toString().trim(),
                    category: (row[2] || '일정').toString().trim(),
                    content: (row[3] || '').toString().trim()
                });
            }
        }
    }
    // Fully overwrite state.memos so deleted memos disappear immediately
    state.memos = memos;
    localStorage.setItem('juwon_memos', JSON.stringify(memos));
}

// Render Dashboard (Tab 1)
function renderDashboard() {
    elements.kpiTotalNetworth.innerText = formatKRW(state.kpi.totalNetWorth);
    elements.kpiAccumulatedSavings.innerText = formatKRW(state.kpi.accumulatedSavings);
    elements.kpiMaturityTotal.innerText = formatKRW(state.kpi.maturityTotal);
    elements.kpiParentalTotal.innerText = formatKRW(state.kpi.parentalTotal);

    const totalPossible = state.allRecordsFlat.length;
    const pct = totalPossible > 0 ? Math.min(100, Math.round((state.paidCount / totalPossible) * 100)) : 0;

    elements.overallCompletionRate.innerText = `진행률 ${pct}%`;
    elements.overallProgressBar.style.width = `${pct}%`;
    elements.statPaidCount.innerText = `${state.paidCount}회 / 총 ${totalPossible}회`;
    elements.statProductCount.innerText = `${state.products.length}개 상품`;

    renderProductsGrid();
    renderMaturedList();
    renderRecommendations();
}

function renderProductsGrid() {
    if (state.products.length === 0) {
        elements.productsContainer.innerHTML = `<p style="padding:2rem; text-align:center; color:var(--text-secondary);">등록된 적금 상품이 없습니다.</p>`;
        return;
    }

    elements.productsContainer.innerHTML = state.products.map(prod => {
        const deposited = prod.records.filter(r => r.status === 'deposited').length;
        const targetEpisodes = getTargetEpisodes(prod.name, prod.records.length);
        const lastRec = prod.records.filter(r => r.status === 'deposited').slice(-1)[0];

        const masterInfo = state.savingsMasterList.find(m => m.name.includes(prod.name) || prod.name.includes(m.name));
        const ownersHTML = masterInfo ? masterInfo.owners.map(o => `<span class="owner-badge ${o}">${o}</span>`).join(' ') : '';
        const bankLink = getBankLink(prod.name);
        const rateDisplay = getOfficialRate(prod.name, prod.rate);
        const completionPct = Math.min(100, Math.round((deposited / targetEpisodes) * 100));

        let statusTagHTML = `<span class="badge-emerald">${deposited > 0 ? `진행중 (${deposited}회)` : '예정'}</span>`;
        if (completionPct >= 100) {
            statusTagHTML = `<span class="tag tag-gold" style="font-weight:700;"><i class="fa-solid fa-flag-checkered"></i> 만기/해지가능</span>`;
        } else if (completionPct >= 90) {
            statusTagHTML = `<span class="tag tag-blue" style="background:#3b82f6; color:#fff; font-weight:700;"><i class="fa-solid fa-hourglass-half"></i> 만기임박 (${completionPct}%)</span>`;
        }

        return `
            <div class="card product-card">
                <div class="product-head">
                    <div class="product-title-group">
                        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                            <h4 style="margin:0;">${escapeHTML(prod.name)}</h4>
                            ${ownersHTML}
                        </div>
                        <span class="rate-badge" style="margin-top:0.25rem;"><i class="fa-solid fa-percent"></i> ${escapeHTML(rateDisplay)}</span>
                    </div>
                    <div class="product-total-box">
                        <span class="kpi-label">현재 누적액</span>
                        <div class="product-total-amount">${formatKRW(prod.totalDeposited)}</div>
                    </div>
                </div>

                <div class="product-status-mini">
                    <div><i class="fa-solid fa-calendar-check"></i> 납입: <strong>${deposited} / ${targetEpisodes}회 (${completionPct}%)</strong></div>
                    <div>최근입금: <strong>${lastRec ? lastRec.date : '-'}</strong></div>
                </div>

                <!-- Product Progress Bar -->
                <div style="width:100%; background:rgba(255,255,255,0.08); height:6px; border-radius:3px; overflow:hidden; margin:0.6rem 0;">
                    <div style="width:${completionPct}%; background:${completionPct >= 100 ? '#f59e0b' : '#10b981'}; height:100%; transition:width 0.3s ease;"></div>
                </div>

                <div class="product-actions">
                    ${statusTagHTML}
                    <div style="display:flex; gap:0.35rem;">
                        <a href="${bankLink}" target="_blank" rel="noopener noreferrer" class="btn btn-dark-slate btn-sm" title="네이버/공식 은행 정보 검색" style="padding:0.35rem 0.6rem; text-decoration:none;">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> 정보
                        </a>
                        <button class="btn btn-teal btn-sm" onclick="openProductDetail('${prod.id}')">
                            <i class="fa-solid fa-list"></i> 상세 내역
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderMaturedList() {
    if (state.maturedList.length === 0) {
        elements.maturedList.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">만기 자산이 없습니다.</p>`;
        return;
    }

    elements.maturedList.innerHTML = state.maturedList.map(item => `
        <div class="matured-item">
            <div>
                <div class="matured-name">${escapeHTML(item.type)}</div>
                <div class="matured-bank"><i class="fa-solid fa-building-columns"></i> ${escapeHTML(item.bank)}</div>
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
        const y = parts[0];
        const m = String(parts[1]).padStart(2, '0');
        const d = String(parts[2]).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return str;
}

// Render Calendar
function renderCalendar() {
    const year = state.calCurrentDate.getFullYear();
    const month = state.calCurrentDate.getMonth();

    elements.calMonthTitle.innerText = `${year}년 ${month + 1}월`;

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevLastDate = new Date(year, month, 0).getDate();

    let html = '';

    for (let i = firstDay - 1; i >= 0; i--) {
        html += `<div class="cal-day-cell other-month">${prevLastDate - i}</div>`;
    }

    for (let day = 1; day <= lastDate; day++) {
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const fullDateStr = `${year}-${monthStr}-${dayStr}`;

        const isToday = fullDateStr === "2026-08-07" || fullDateStr === "2026-08-11";
        const isSelected = fullDateStr === state.calSelectedDateStr;
        
        const hasManualMemo = state.memos.some(m => formatStandardDateKey(m.date) === fullDateStr);
        const hasDepositRecord = state.allRecordsFlat.some(r => r.status === 'deposited' && formatStandardDateKey(r.date) === fullDateStr);
        const hasEvent = hasManualMemo || hasDepositRecord;

        html += `
            <div class="cal-day-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" 
                 onclick="selectCalendarDate('${fullDateStr}')">
                ${day}
                ${hasEvent ? `<span class="event-dot" style="background:${hasDepositRecord ? '#10b981' : '#f59e0b'};"></span>` : ''}
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
    const [y, m, d] = state.calSelectedDateStr.split('-');
    const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const dayName = dayNames[dateObj.getDay()];

    elements.selectedDateDisplay.innerText = `${y}년 ${m}월 ${d}일 ${dayName}요일`;

    const dayMemos = state.memos.filter(memo => formatStandardDateKey(memo.date) === state.calSelectedDateStr);

    const autoDeposits = state.allRecordsFlat.filter(r => r.status === 'deposited' && formatStandardDateKey(r.date) === state.calSelectedDateStr);

    const autoDepositMemos = autoDeposits.map(r => ({
        category: '적금입금',
        time: '10:00',
        content: `✅ [입금완료] ${r.productName} ${r.month} (${r.amountFormatted}) 정상 입금 확인`,
        isAuto: true
    }));

    const combined = [...autoDepositMemos, ...dayMemos];

    if (combined.length === 0) {
        elements.dailyNotesList.innerHTML = `<p style="color:var(--text-muted); font-size:0.8rem; padding:0.5rem 0;">등록된 일정이나 입금 내역이 없습니다.</p>`;
        return;
    }

    elements.dailyNotesList.innerHTML = combined.map(m => `
        <div class="note-item-card" style="${m.isAuto ? 'border-left-color: #10b981; background: rgba(16, 185, 129, 0.15);' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="note-cat-tag ${escapeHTML(m.category)}" style="${m.isAuto ? 'background: rgba(16, 185, 129, 0.25); color: #34d399;' : ''}">
                    ${m.isAuto ? '<i class="fa-solid fa-circle-check"></i> ' : ''}${escapeHTML(m.category)}
                </span>
                <span class="note-time">${escapeHTML(m.time)}</span>
            </div>
            <div class="note-text" style="${m.isAuto ? 'font-weight:700; color:#f1f5f9;' : ''}">${escapeHTML(m.content)}</div>
        </div>
    `).join('');
}

function renderLedgerTable() {
    const query = elements.ledgerSearchInput.value.toLowerCase().trim();
    const statusFilter = elements.ledgerStatusSelect.value;

    const filtered = state.allRecordsFlat.filter(r => {
        const matchQuery = !query || 
            r.productName.toLowerCase().includes(query) || 
            r.month.toLowerCase().includes(query) || 
            r.date.toLowerCase().includes(query);
        
        const matchStatus = statusFilter === 'all' || r.status === statusFilter;

        return matchQuery && matchStatus;
    });

    if (filtered.length === 0) {
        elements.ledgerTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">검색 결과가 없습니다.</td></tr>`;
        return;
    }

    elements.ledgerTableBody.innerHTML = filtered.map((r, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td><strong>${escapeHTML(r.productName)}</strong></td>
            <td>${escapeHTML(r.month)}</td>
            <td>${escapeHTML(r.date)}</td>
            <td><strong style="color:var(--text-primary);">${r.amountFormatted}</strong></td>
            <td>
                <span class="status-badge-inline ${r.status}">
                    ${r.status === 'deposited' ? '입금 완료' : r.status === 'unpaid' ? '미입금' : '납입 예정'}
                </span>
            </td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="showToast('${r.productName} ${r.month} 정보 확인 완료', 'info')">
                    <i class="fa-solid fa-info-circle"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function renderMaturityTable() {
    if (state.maturedList.length === 0) {
        elements.maturityTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">만기 데이터가 존재하지 않습니다.</td></tr>`;
        return;
    }

    elements.maturityTableBody.innerHTML = state.maturedList.map((item, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td><strong>${escapeHTML(item.type)}</strong></td>
            <td><i class="fa-solid fa-building-columns"></i> ${escapeHTML(item.bank)}</td>
            <td><strong style="color:var(--accent-amber);">${item.amountFormatted}</strong></td>
            <td><span class="badge-emerald">확정 예금 자산</span></td>
        </tr>
    `).join('');
}

function renderSavingsMasterTable() {
    if (!elements.savingsMasterTableBody) return;
    const list = state.savingsMasterList.length > 0 ? state.savingsMasterList : SAVINGS_MASTER_FALLBACK;
    elements.savingsMasterTableBody.innerHTML = list.map((item, idx) => {
        const bankLink = getBankLink(item.name);
        const rateDisplay = getOfficialRate(item.name, item.rate);
        return `
            <tr>
                <td>${idx + 1}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:0.4rem;">
                        <strong>${escapeHTML(item.name)}</strong>
                        <a href="${bankLink}" target="_blank" rel="noopener noreferrer" style="color:var(--text-secondary); font-size:0.8rem;" title="네이버 공식 상품 검색">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>
                    </div>
                </td>
                <td>
                    ${item.owners.map(o => `<span class="owner-badge ${o}">${o}</span>`).join(' ')}
                </td>
                <td><span class="rate-badge" style="font-size:0.8rem;"><i class="fa-solid fa-percent"></i> ${escapeHTML(rateDisplay)}</span></td>
                <td><strong>${item.monthlyFormatted || formatKRW(item.monthly)}</strong></td>
                <td><strong style="color:var(--accent-emerald);">${item.totalFormatted || formatKRW(item.total)}</strong></td>
                <td>${escapeHTML(item.startDate || item.start || '-')}</td>
                <td>${escapeHTML(item.endDate || item.end || '-')}</td>
            </tr>
        `;
    }).join('');
}

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
        const matchQuery = !query || e.details.toLowerCase().includes(query) || e.category.toLowerCase().includes(query) || e.note.toLowerCase().includes(query);
        const matchCat = catFilter === 'all' || e.category === catFilter;
        return matchQuery && matchCat;
    });

    if (filtered.length === 0) {
        elements.hospitalTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">검색 조건에 맞는 지출 내역이 없습니다.</td></tr>`;
        return;
    }

    elements.hospitalTableBody.innerHTML = filtered.map((e, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td><strong>${escapeHTML(e.date)}</strong></td>
            <td><span class="hosp-cat-tag ${escapeHTML(e.category)}">${escapeHTML(e.category)}</span></td>
            <td><strong>${escapeHTML(e.details)}</strong></td>
            <td><strong style="color:#f87171;">${e.amountFormatted || formatKRW(e.amount)}</strong></td>
            <td><span style="color:var(--text-secondary); font-size:0.85rem;">${escapeHTML(e.note || '-')}</span></td>
        </tr>
    `).join('');
}

function prepareHospitalCSVData() {
    const headers = ['NO', '결제날짜', '카테고리', '결제수단/내용', '금액', '비고'];
    const list = state.hospitalExpenses.length > 0 ? state.hospitalExpenses : HOSPITAL_EXPENSES_FALLBACK;
    const rows = list.map((e, idx) => [
        idx + 1, e.date, e.category, e.details, e.amount, e.note
    ]);
    return [headers, ...rows];
}

function getNextUnpaidMonth(product) {
    if (!product || !product.records) return '8월';
    const unpaid = product.records.find(r => r.status !== 'deposited');
    return unpaid ? unpaid.month : '8월';
}

window.openProductDetail = function(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const bankLink = getBankLink(product.name);
    const rateDisplay = getOfficialRate(product.name, product.rate);

    elements.productDetailTitle.innerText = `${product.name} 상세 입금 내역`;
    elements.productDetailBody.innerHTML = `
        <div style="margin-bottom: 1.2rem; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25); padding:0.85rem 1rem; border-radius:var(--radius-sm); border:1px solid var(--border-color); flex-wrap:wrap; gap:0.5rem;">
            <div>
                <div style="font-size:0.85rem; color:var(--text-secondary);">적금 이율 (최고)</div>
                <strong style="color:#60a5fa; font-size:1.05rem;">${escapeHTML(rateDisplay)}</strong>
            </div>
            <a href="${bankLink}" target="_blank" rel="noopener noreferrer" class="btn btn-dark-slate btn-sm" style="font-size:0.8rem; padding:0.35rem 0.75rem; text-decoration:none;">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> 네이버/은행 공식 페이지
            </a>
            <div style="text-align:right;">
                <div style="font-size:0.85rem; color:var(--text-secondary);">현재 누적 입금 총액</div>
                <strong style="color:var(--accent-emerald); font-size:1.15rem;">${formatKRW(product.totalDeposited)}</strong>
            </div>
        </div>

        <!-- Quick Inline Deposit Form -->
        <div class="card" style="background:rgba(15, 23, 42, 0.9); border:1px solid rgba(0, 168, 132, 0.4); padding:1rem; margin-bottom:1.2rem;">
            <div style="font-weight:700; color:var(--accent-teal); font-size:0.9rem; margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center;">
                <span><i class="fa-solid fa-plus-circle"></i> ${escapeHTML(product.name)} 신규 입금 등록</span>
                <span style="font-size:0.75rem; color:var(--text-muted);">* 등록 시 구글 시트 & DB 자동 전송</span>
            </div>
            <form onsubmit="submitInlineDeposit(event, '${product.id}')" style="display:grid; grid-template-columns: 1fr 1.2fr 1fr auto; gap:0.5rem; align-items:end;">
                <div>
                    <label style="font-size:0.75rem; color:var(--text-secondary); display:block; margin-bottom:0.25rem;">납입 월</label>
                    <input type="text" id="inline-month-${product.id}" class="url-text-input" value="${getNextUnpaidMonth(product)}" placeholder="예: 8월" required style="padding:0.4rem 0.6rem; font-size:0.85rem;">
                </div>
                <div>
                    <label style="font-size:0.75rem; color:var(--text-secondary); display:block; margin-bottom:0.25rem;">입금 날짜</label>
                    <input type="text" id="inline-date-${product.id}" class="url-text-input" value="2026. 8. 11" placeholder="예: 2026. 8. 11" required style="padding:0.4rem 0.6rem; font-size:0.85rem;">
                </div>
                <div>
                    <label style="font-size:0.75rem; color:var(--text-secondary); display:block; margin-bottom:0.25rem;">입금 금액(원)</label>
                    <input type="number" id="inline-amount-${product.id}" class="url-text-input" value="300000" placeholder="300000" required style="padding:0.4rem 0.6rem; font-size:0.85rem;">
                </div>
                <button type="submit" class="btn btn-teal btn-sm" style="height:36px; padding:0 0.85rem; white-space:nowrap;">
                    <i class="fa-solid fa-paper-plane"></i> 입금 등록
                </button>
            </form>
        </div>

        <table class="master-table">
            <thead>
                <tr><th>월</th><th>입금일자</th><th>금액</th><th>상태</th></tr>
            </thead>
            <tbody>
                ${product.records.map(r => `
                    <tr>
                        <td><strong>${escapeHTML(r.month)}</strong></td>
                        <td>${escapeHTML(r.date)}</td>
                        <td>${formatKRW(r.amount)}</td>
                        <td><span class="status-badge-inline ${r.status}">${r.status === 'deposited' ? '입금완료' : r.status === 'unpaid' ? '미입금' : '예정'}</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    elements.productDetailModal.classList.add('active');
};

window.submitInlineDeposit = async function(event, productId) {
    event.preventDefault();
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const monthInput = document.getElementById(`inline-month-${productId}`);
    const dateInput = document.getElementById(`inline-date-${productId}`);
    const amountInput = document.getElementById(`inline-amount-${productId}`);

    const month = monthInput ? monthInput.value.trim() : '';
    const date = dateInput ? dateInput.value.trim() : '';
    const amount = amountInput ? (parseFloat(amountInput.value) || 0) : 0;

    if (!month || !date || amount <= 0) {
        showToast('납입 월, 입금 날짜, 올바른 금액을 입력해 주세요.', 'warning');
        return;
    }

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

    product.totalDeposited = product.records.filter(r => r.status === 'deposited').reduce((s, r) => s + r.amount, 0);

    const payload = {
        action: 'deposit',
        productName: product.name,
        month, date, amount
    };

    if (state.webappUrl && !state.isUnlinkedLocalMode) {
        try {
            await fetch(state.webappUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.warn("WebApp POST error:", e);
        }
    }

    if (state.db) {
        try {
            state.db.collection('deposits').add(payload);
        } catch (e) {
            console.warn("Firestore deposit write error:", e);
        }
    }

    showToast(`${product.name} ${month} 입금(${formatKRW(amount)})이 성공적으로 등록되었습니다!`, 'success');
    renderDashboard();
    renderLedgerTable();
    openProductDetail(productId);
};

function populateProductSelect() {
    elements.modalProductSelect.innerHTML = state.products.map(p => `
        <option value="${p.id}">${escapeHTML(p.name)} (${escapeHTML(p.rate)})</option>
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
    const rows = state.maturedList.map((m, i) => [
        i + 1, `"${m.type}"`, `"${m.bank}"`, m.amount
    ]);
    return [headers, ...rows];
}

function exportToCSV(filename, rowsArray) {
    const csvContent = "\uFEFF" + rowsArray.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    showToast(`엑셀 파일(${filename})이 다운로드되었습니다.`, 'success');
}

function renderSyncBanner(isLocalMode, customText) {
    if (isLocalMode) {
        elements.syncBanner.style.background = 'rgba(59, 130, 246, 0.1)';
        elements.syncBanner.style.borderColor = 'rgba(59, 130, 246, 0.3)';
        elements.syncBanner.style.color = '#60a5fa';
        elements.syncBannerText.innerText = customText || '로컬 독립 백업 모드로 100% 정상 작동 중입니다.';
    } else {
        elements.syncBanner.style.background = 'rgba(16, 185, 129, 0.1)';
        elements.syncBanner.style.borderColor = 'rgba(16, 185, 129, 0.25)';
        elements.syncBanner.style.color = 'var(--accent-emerald)';
        elements.syncBannerText.innerText = customText || '구글 스프레드시트 백업/연동이 100% 정상 작동 중입니다.';
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'success' ? 'fa-circle-check' : type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHTML(message)}</span>`;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function parseCurrency(str) {
    if (!str) return 0;
    const clean = str.toString().replace(/[^0-9.-]+/g, "");
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
}

function formatKRW(num) {
    return '₩' + Math.round(num).toLocaleString('ko-KR');
}

function formatTime(date) {
    return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')}`;
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[tag] || tag));
}
