const openManagerBtn = document.getElementById("openManagerBtn");
const toggleBtn = document.getElementById("toggleBtn");
const statusSpan = document.getElementById("statusSpan");
const pageCountSpan = document.getElementById("pageCount");
const getTokenBtn = document.getElementById("getTokenBtn");
const tokenResult = document.getElementById("tokenResult");
const copyTokenBtn = document.getElementById("copyTokenBtn");
const warningBox = document.getElementById("warningBox");
const openTokenPageLink = document.getElementById("openTokenPageLink");

const TOKEN_PAGE_URL = "https://business.facebook.com/billing_hub/payment_settings/?asset_id=224996445973815&payment_account_id=224996445973815&placement=ads_manager";

function showToastMessage(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = type === 'success' ? '#28a745' : '#dc3545';
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = '10000';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = 'bold';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function openManager() {
    chrome.tabs.create({ url: chrome.runtime.getURL("danhsach.html") });
}

function loadStatus() {
    chrome.storage.local.get(["enabled", "page_id"], (res) => {
        const isEnabled = res.enabled === true;
        updateButtonStatus(isEnabled);
        if (statusSpan) {
            statusSpan.textContent = isEnabled ? "Đang hoạt động" : "Đã tắt";
            statusSpan.style.color = isEnabled ? "#28a745" : "#dc3545";
        }
        const pages = res.page_id || [];
        if (pageCountSpan) pageCountSpan.textContent = pages.length;
    });
}

function updateButtonStatus(isEnabled) {
    if (isEnabled) {
        toggleBtn.textContent = "✅ Đang Bật";
        toggleBtn.classList.add("active");
        toggleBtn.style.background = "linear-gradient(135deg, #28a745, #1e7e34)";
    } else {
        toggleBtn.textContent = "⭕ Đang Tắt";
        toggleBtn.classList.remove("active");
        toggleBtn.style.background = "linear-gradient(135deg, #dc3545, #a71d2a)";
    }
}

function toggleStatus() {
    chrome.storage.local.get(["enabled"], (res) => {
        const newStatus = !(res.enabled === true);
        chrome.storage.local.set({ enabled: newStatus }, () => {
            updateButtonStatus(newStatus);
            if (statusSpan) {
                statusSpan.textContent = newStatus ? "Đang hoạt động" : "Đã tắt";
                statusSpan.style.color = newStatus ? "#28a745" : "#dc3545";
            }
        });
    });
}

if (getTokenBtn) {
    getTokenBtn.onclick = async () => {
        if (warningBox) warningBox.style.display = 'none';
        getTokenBtn.disabled = true;
        getTokenBtn.textContent = "⏳ Đang lấy...";
        
        const result = await fetchAccessToken();
        
        getTokenBtn.disabled = false;
        getTokenBtn.textContent = "🔑 Lấy Token User";
        
        if (result.success) {
            tokenResult.value = result.token;
            showToastMessage("✅ Đã lấy token thành công!", "success");
            navigator.clipboard.writeText(result.token);
            showToastMessage("📋 Token đã được copy vào clipboard!", "success");
        } else if (result.error === "not_on_correct_page") {
            if (warningBox) warningBox.style.display = 'block';
            if (openTokenPageLink) openTokenPageLink.textContent = TOKEN_PAGE_URL;
            showToastMessage("⚠️ Bạn chưa ở đúng trang lấy token!", "error");
        } else {
            showToastMessage(result.error, "error");
        }
    };
}

if (copyTokenBtn) {
    copyTokenBtn.onclick = () => {
        if (tokenResult.value) {
            navigator.clipboard.writeText(tokenResult.value);
            showToastMessage("📋 Đã copy token!", "success");
        } else {
            showToastMessage("❌ Chưa có token để copy!", "error");
        }
    };
}

if (openTokenPageLink) {
    openTokenPageLink.textContent = TOKEN_PAGE_URL;
    openTokenPageLink.onclick = (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: TOKEN_PAGE_URL });
    };
}

if (openManagerBtn) openManagerBtn.onclick = openManager;
if (toggleBtn) toggleBtn.onclick = toggleStatus;

chrome.storage.onChanged.addListener((changes) => {
    if (changes.page_id && pageCountSpan) {
        pageCountSpan.textContent = (changes.page_id.newValue || []).length;
    }
});

// ... giữ nguyên toàn bộ code cũ ...

// Thêm sự kiện mở trang DangBai
const openDangBaiBtn = document.getElementById("openDangBaiBtn");
if (openDangBaiBtn) {
    openDangBaiBtn.onclick = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("DangBai.html") });
    };
}

// ... phần còn lại giữ nguyên ...

loadStatus();