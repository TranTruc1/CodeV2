async function fetchAccessToken() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab) {
                resolve({ success: false, error: "Không tìm thấy tab đang hoạt động" });
                return;
            }

            const url = tab.url;
            const REQUIRED_URL = "https://business.facebook.com/billing_hub/payment_settings/?asset_id=224996445973815&payment_account_id=224996445973815&placement=ads_manager";

            if (url !== REQUIRED_URL) {
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