(async function() {
    "use strict";

    // 1. Lấy dữ liệu từ storage
    const getStorageData = () => {
        return new Promise((resolve) => {
            chrome.storage.local.get(['page_id'], (result) => {
                const rawData = result.page_id || [];
                const mappedData = rawData.map(item => ({
                    id: item.id,
                    name: item.attribute || 'Unknown Page', 
                    avatar: item.img3 || item.image || ''   
                }));
                resolve(mappedData);
            });
        });
    };

    const dataFromAPI = await getStorageData();

// 2. Nút Click Nhanh 10 lần (có timeout 10s)
function setupFastClickButton() {
    let attempts = 0;
    const maxTime = 10000; // 10 giây
    const interval = 500;
    const maxAttempts = maxTime / interval;

    const checkExist = setInterval(() => {
        const sendBtnBox = document.querySelector('.sendbtnbox');
        const btnStartSend = document.getElementById('btnStartSend');
        
        if (sendBtnBox && btnStartSend && !document.getElementById('fastClickBtn')) {
            clearInterval(checkExist);
            const fastClickButton = document.createElement('button');
            fastClickButton.id = 'fastClickBtn';
            fastClickButton.textContent = 'Click Nhanh 10 lần';
            fastClickButton.className = 'btn_dl2811'; 
            fastClickButton.style.marginRight = '5px';
            sendBtnBox.insertBefore(fastClickButton, sendBtnBox.firstChild);

            fastClickButton.addEventListener('click', () => {
                for (let i = 0; i < 10; i++) btnStartSend.click();
            });
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
            clearInterval(checkExist);
        }
    }, interval);
}


    // 3. Update thông tin lên ô URL
    function updatePagePreview(page) {
        const urlInput = document.getElementById('page_url');
        if (urlInput) {
            urlInput.value = `${page.name} (${page.id})`;
            if (page.avatar) {
                urlInput.style.backgroundImage = `url('${page.avatar}')`;
                urlInput.style.backgroundRepeat = 'no-repeat';
                urlInput.style.backgroundSize = '25px 25px';
                urlInput.style.backgroundPosition = '5px center';
                urlInput.style.paddingLeft = '35px';
            } else {
                urlInput.style.backgroundImage = 'none';
                urlInput.style.paddingLeft = '10px';
            }
        }
    }

    // 4. Hàm thực thi giả lập Click Lọc
    function triggerFilter() {
        const filterButton = document.getElementById('btnReloadFriendList');
        if (filterButton) {
            filterButton.click();
            filterButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            filterButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        }
    }

    // 5. Điền tự động và Lọc
    function autoFillAndFilter(idValue, pageData = null) {
        const inputField = document.getElementById('page_id');
        if (inputField) {
            inputField.value = idValue;
            inputField.dispatchEvent(new Event('input', { bubbles: true }));
            inputField.dispatchEvent(new Event('change', { bubbles: true }));
            
            if (pageData) updatePagePreview(pageData);
            setTimeout(triggerFilter, 300);
        }
    }

   // 6. Tạo Menu Gợi ý (có timeout 10s)
function createSuggestionUI() {
    let attempts = 0;
    const maxTime = 10000;
    const interval = 500;
    const maxAttempts = maxTime / interval;

    const checkInput = setInterval(() => {
        const inputId = document.getElementById('page_id');
        if (inputId) {
            clearInterval(checkInput);
            const menu = document.createElement('div');
            menu.id = 'page-suggestions';
            menu.style.cssText = 'position:absolute; background:white; border:1px solid #ccc; z-index:100001; display:none; max-height:250px; overflow-y:auto; box-shadow:0 4px 8px rgba(0,0,0,0.1); border-radius: 5px;';
            document.body.appendChild(menu);

            inputId.addEventListener('click', (e) => {
                const rect = inputId.getBoundingClientRect();
                menu.style.top = (rect.bottom + window.scrollY + 2) + 'px';
                menu.style.left = (rect.left + window.scrollX) + 'px';
                menu.style.width = rect.width + 'px';
                
                menu.innerHTML = '';
                dataFromAPI.forEach(page => {
                    const item = document.createElement('div');
                    item.style.cssText = 'display:flex; align-items:center; padding:8px; cursor:pointer; border-bottom:1px solid #f0f0f0;';
                    
                    const avatarHTML = page.avatar 
                        ? `<img src="${page.avatar}" style="width:30px; height:30px; border-radius:50%; margin-right:10px; object-fit: cover;">`
                        : `<div style="width:30px; height:30px; border-radius:50%; margin-right:10px; background-color:#1877f2; color:white; display:flex; justify-content:center; align-items:center; font-weight:bold; font-size:14px; flex-shrink:0;">${page.name.charAt(0).toUpperCase()}</div>`;

                    item.innerHTML = `
                        ${avatarHTML}
                        <div style="font-size:12px; color: black; overflow: hidden;">
                            <div style="font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${page.name}</div>
                            <div style="color:gray;">ID: ${page.id}</div>
                        </div>
                    `;
                    
                    item.onclick = () => {
                        menu.style.display = 'none';
                        autoFillAndFilter(page.id, page); 
                    };
                    item.onmouseenter = () => item.style.backgroundColor = '#f8f9fa';
                    item.onmouseleave = () => item.style.backgroundColor = 'white';

                    menu.appendChild(item);
                });
                menu.style.display = 'block';
                e.stopPropagation();
            });

            document.addEventListener('click', () => menu.style.display = 'none');
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
            clearInterval(checkInput);
        }
    }, interval);
}

    // 7. Chạy code quan trọng
    function injectImportantScript() {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('important_code.js');
            (document.head || document.documentElement).appendChild(script);
            script.onload = () => { script.remove(); resolve(); };
        });
    }

    // 8. Init
    async function init() {
        createSuggestionUI();
        setupFastClickButton();

        const url = window.location.href;
        const match = url.match(/[?&]id=([0-9]+)/);

        if (match && match[1]) {
            const currentId = match[1];
            const validPage = dataFromAPI.find(item => String(item.id) === String(currentId));

            if (validPage) {
                await injectImportantScript();
                autoFillAndFilter(currentId, validPage);
            }
        }
    }

    init();
})();