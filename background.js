chrome.runtime.onInstalled.addListener(() => {
    console.log("Facebook Tool extension đã được cài đặt!");
});

// Lắng nghe message từ content script để tải file
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'downloadFile') {
        fetch(request.url)
            .then(response => {
                if (!response.ok) throw new Error(`Download failed: ${response.status}`);
                return response.arrayBuffer();
            })
            .then(buffer => {
                const uint8 = new Uint8Array(buffer);
                sendResponse({ data: Array.from(uint8) });
            })
            .catch(err => sendResponse({ error: err.message }));
        return true; // giữ kênh mở để response bất đồng bộ
    }
});