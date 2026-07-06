async function fetchAccessToken() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab) {
                resolve({ success: false, error: "Không tìm thấy tab đang hoạt động" });
                return;
            }

            const url = tab.url || "";
            const REQUIRED_ASSET_ID = "224996445973815";
            const REQUIRED_PAYMENT_ACCOUNT_ID = "224996445973815";

            // Chấp nhận cả business.facebook.com và adsmanager.facebook.com,
            // chấp nhận đường dẫn /billing_hub/payment_settings hoặc
            // /adsmanager/billing_hub/payment_settings, và bỏ qua các tham số
            // phụ như session_id, placement, # ... chỉ cần đúng domain + asset_id + payment_account_id
            let isCorrectPage = false;
            try {
                const u = new URL(url);
                const isFacebookDomain = /(^|\.)facebook\.com$/.test(u.hostname);
                const hasBillingPath = /\/billing_hub\/payment_settings/.test(u.pathname);
                const assetId = u.searchParams.get("asset_id");
                const paymentAccountId = u.searchParams.get("payment_account_id");

                isCorrectPage = isFacebookDomain
                    && hasBillingPath
                    && assetId === REQUIRED_ASSET_ID
                    && paymentAccountId === REQUIRED_PAYMENT_ACCOUNT_ID;
            } catch (e) {
                isCorrectPage = false;
            }

            if (!isCorrectPage) {
                resolve({ success: false, error: "not_on_correct_page" });
                return;
            }

            // Inject hàm lấy token vào MAIN world
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    try {
                        // Chạy trực tiếp trong page context
                        if (typeof require !== 'undefined') {
                            const token = require('WebApiApplication').getAccessToken();
                            return token;
                        }
                        return null;
                    } catch (e) {
                        console.error("Lỗi lấy token:", e);
                        return null;
                    }
                },
                world: 'MAIN'   // Quan trọng: chạy trong main world
            }, (results) => {
                if (chrome.runtime.lastError) {
                    console.error("executeScript error:", chrome.runtime.lastError);
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                    return;
                }
                const token = results?.[0]?.result;
                if (token && typeof token === 'string' && token.length > 0) {
                    resolve({ success: true, token: token });
                } else {
                    resolve({ success: false, error: "Không thể lấy token. Hãy đảm bảo bạn đã đăng nhập và trang đã tải xong." });
                }
            });
        });
    });
}