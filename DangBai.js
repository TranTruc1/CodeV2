// DangBai.js - Resumable upload video, copy video, sửa lỗi quét bài viết
// Đã sửa: lưu pages vào storage, chỉ load 1 lần, tự động reset token khi dưới 35 ngày
// Cập nhật: token button fixed, checkbox to hơn, mở page từ ctx menu, infinite scroll posts
// Thêm: đồng bộ tick bộ lọc, tiến trình %, nút đăng loạt luôn hiển thị

const TOKEN_KEY = 'fb_bulk_token';
const TOKEN_EXPIRY_KEY = 'fb_bulk_token_expiry';
const PAGES_DATA_KEY = 'fb_pages_data';
const FB_APP_ID = '436239572033001';
const FB_APP_SECRET = '46ba3ead34d90da033b0204ea6cf213d';

// DOM elements
const tokenInput = document.getElementById('tokenInput');
const scanBtn = document.getElementById('scanBtn');
const manageTokenBtn = document.getElementById('manageTokenBtn');
const tokenStatus = document.getElementById('tokenStatus');
const pagesSection = document.getElementById('pagesSection');
const pagesListContainer = document.getElementById('pagesListContainer');
const pageCountSpan = document.getElementById('pageCount');
const selectAllPages = document.getElementById('selectAllPages');
const startPostBtn = document.getElementById('startPostBtn');
const contextMenu = document.getElementById('contextMenu');
const ctxOpenPage = document.getElementById('ctxOpenPage');
const ctxScanPosts = document.getElementById('ctxScanPosts');
const ctxAddRole = document.getElementById('ctxAddRole');
const postsModal = document.getElementById('postsModal');
const modalPageName = document.getElementById('modalPageName');
const postsGrid = document.getElementById('postsGrid');
const postsLoadingIndicator = document.getElementById('postsLoadingIndicator');
const deleteSelectedPostsBtn = document.getElementById('deleteSelectedPostsBtn');
const selectedCountSpan = document.getElementById('selectedCount');
const closePostsModal = document.getElementById('closePostsModal');
const roleModal = document.getElementById('roleModal');
const roleUserId = document.getElementById('roleUserId');
const roleSelect = document.getElementById('roleSelect');
const submitRoleBtn = document.getElementById('submitRoleBtn');
const closeRoleModal = document.getElementById('closeRoleModal');
const progressModal = document.getElementById('progressModal');
const progressLogModal = document.getElementById('progressLogModal');
const progressSummaryModal = document.getElementById('progressSummaryModal');
const progressBarModal = document.getElementById('progressBarModal');
const closeProgressModal = document.getElementById('closeProgressModal');
const postInputModal = document.getElementById('postInputModal');
const closeInputModal = document.getElementById('closeInputModal');
const postsEditorModal = document.getElementById('postsEditorModal');
const addPostModalBtn = document.getElementById('addPostModalBtn');
const postCountModal = document.getElementById('postCountModal');
const confirmPostBtn = document.getElementById('confirmPostBtn');
const delayTypeModal = document.getElementById('delayTypeModal');
const fixedDelayBoxModal = document.getElementById('fixedDelayBoxModal');
const randomDelayBoxModal = document.getElementById('randomDelayBoxModal');
const delayFixedModal = document.getElementById('delayFixedModal');
const delayMinModal = document.getElementById('delayMinModal');
const delayMaxModal = document.getElementById('delayMaxModal');
const searchPages = document.getElementById('searchPages');
const tokenManageModal = document.getElementById('tokenManageModal');
const closeTokenModal = document.getElementById('closeTokenModal');
const resetTokenBtn = document.getElementById('resetTokenBtn');
const copyTokenBtn = document.getElementById('copyTokenBtn');
const clearTokenBtn = document.getElementById('clearTokenBtn');
const currentTokenDisplay = document.getElementById('currentTokenDisplay');
const tokenManageStatus = document.getElementById('tokenManageStatus');
const roleAllPages = document.getElementById('roleAllPages');
const roleSelectedPagesCount = document.getElementById('roleSelectedPagesCount');
const roleExtractedId = document.getElementById('roleExtractedId');
const roleStatus = document.getElementById('roleStatus');
const copySelectedPostsBtn = document.getElementById('copySelectedPostsBtn');
const copyModal = document.getElementById('copyModal');
const closeCopyModal = document.getElementById('closeCopyModal');
const copyTargetPagesList = document.getElementById('copyTargetPagesList');
const confirmCopyBtn = document.getElementById('confirmCopyBtn');
const cancelCopyBtn = document.getElementById('cancelCopyBtn');
const copyDelaySec = document.getElementById('copyDelaySec');
const tokenFixedBtn = document.getElementById('tokenFixedBtn');
const tokenDot = document.getElementById('tokenDot');
const tokenConfigModal = document.getElementById('tokenConfigModal');
const closeTokenConfigModal = document.getElementById('closeTokenConfigModal');
const emptyState = document.getElementById('emptyState');
const selectAllPostsBtn = document.getElementById('selectAllPostsBtn');
const deselectAllPostsBtn = document.getElementById('deselectAllPostsBtn');

// State
let currentToken = '';
let userAccessToken = '';
let pages = [];
let filteredPages = [];
let selectedPageIds = new Set();
let currentContextPage = null;
let currentPostsPageObj = null;
let allPosts = [];
let selectedPostIds = new Set();
let nextCursor = null;
let isLoadingPosts = false;
let noMorePosts = false;
let postsData = [];

// ========== Helper ==========
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'} ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = '0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}
function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m])); }
function formatDate(isoString) { return isoString ? new Date(isoString).toLocaleString('vi-VN') : ''; }
function getThumbnailUrl(attachments) {
    if (!attachments?.data) return null;
    const attach = attachments.data[0];
    if (!attach) return null;
    if (attach.media_type === 'photo' && attach.media?.image) return attach.media.image.src;
    if (attach.media_type === 'video' && attach.media?.image) return attach.media.image.src;
    if (attach.subattachments?.data?.length) {
        const first = attach.subattachments.data[0];
        if (first.media?.image) return first.media.image.src;
    }
    return null;
}
function isVideoFile(file) {
    if (!file) return false;
    if (file.type.startsWith('video/')) return true;
    return /\.(mp4|mov|avi|mkv|wmv|flv|m4v|3gp)$/i.test(file.name);
}
function isImageFile(file) {
    if (!file) return false;
    if (file.type.startsWith('image/')) return true;
    return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name);
}

// ========== Token dot indicator ==========
function updateTokenDot(ok) {
    tokenDot.className = 'token-dot' + (ok ? ' ok' : '');
}

// ========== Storage ==========
function saveToken(token, expiresInSeconds = 5184000) {
    const expiry = Date.now() + expiresInSeconds * 1000;
    chrome.storage.local.set({ [TOKEN_KEY]: token, [TOKEN_EXPIRY_KEY]: expiry });
    showToast('Đã lưu token', 'success');
}
async function getStoredToken() {
    return new Promise(resolve => {
        chrome.storage.local.get([TOKEN_KEY, TOKEN_EXPIRY_KEY], res => {
            const token = res[TOKEN_KEY];
            const expiry = res[TOKEN_EXPIRY_KEY];
            if (token && expiry && Date.now() < expiry) {
                const daysLeft = Math.floor((expiry - Date.now()) / (86400000));
                resolve({ token, valid: true, daysLeft });
            } else resolve({ token: null, valid: false, daysLeft: 0 });
        });
    });
}
async function clearStoredToken() {
    await chrome.storage.local.remove([TOKEN_KEY, TOKEN_EXPIRY_KEY]);
    currentToken = '';
    userAccessToken = '';
    tokenInput.value = '';
    tokenStatus.innerHTML = '<span class="tag tag-warning">⚠️ Đã xóa token</span>';
    updateTokenDot(false);
    showToast('Đã xóa token khỏi bộ nhớ', 'info');
}
async function savePagesToStorage(pagesArray) {
    return new Promise(resolve => {
        chrome.storage.local.set({ [PAGES_DATA_KEY]: pagesArray }, resolve);
    });
}
async function getStoredPages() {
    return new Promise(resolve => {
        chrome.storage.local.get([PAGES_DATA_KEY], res => {
            resolve(res[PAGES_DATA_KEY] || null);
        });
    });
}

// ========== API cơ bản (v19.0) ==========
async function exchangeToken(shortToken) {
    const url = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${shortToken}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return { token: data.access_token, expiresIn: data.expires_in || 5184000 };
}
async function fetchPages(token) {
    const url = `https://graph.facebook.com/v19.0/me/accounts?fields=name,access_token,picture{url},id&limit=100&access_token=${token}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data.data || [];
}
async function deletePost(postId, pageToken) {
    const resp = await fetch(`https://graph.facebook.com/v19.0/${postId}?access_token=${pageToken}`, { method: 'DELETE' });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data;
}
async function fetchPagePosts(pageId, pageToken, after = null) {
    let url = `https://graph.facebook.com/v19.0/${pageId}/posts?fields=id,message,created_time,attachments{media_type,media,url,target,subattachments},full_picture&limit=25&access_token=${pageToken}`;
    if (after) url += `&after=${after}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data;
}
async function addRoleToPageWithUserToken(pageId, userId, role) {
    const url = `https://graph.facebook.com/v19.0/${pageId}/roles`;
    const form = new FormData();
    form.append('user', userId);
    form.append('role', role);
    form.append('access_token', userAccessToken);
    const resp = await fetch(url, { method: 'POST', body: form });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data;
}

// ========== Resumable Upload Video ==========
async function uploadVideoToPage(pageId, pageToken, videoFile, description) {
    const fileSize = videoFile.size;
    const initForm = new FormData();
    initForm.append('upload_phase', 'start');
    initForm.append('file_size', fileSize);
    initForm.append('access_token', pageToken);
    const initRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/videos`, { method: 'POST', body: initForm });
    const initData = await initRes.json();
    if (initData.error) throw new Error(`Khởi tạo upload: ${initData.error.message}`);
    const uploadSessionId = initData.upload_session_id;

    const chunkSize = 5 * 1024 * 1024;
    let startOffset = 0;
    while (startOffset < fileSize) {
        const end = Math.min(startOffset + chunkSize, fileSize);
        const chunk = videoFile.slice(startOffset, end);
        const chunkForm = new FormData();
        chunkForm.append('upload_phase', 'transfer');
        chunkForm.append('upload_session_id', uploadSessionId);
        chunkForm.append('start_offset', startOffset);
        chunkForm.append('video_file_chunk', chunk, `chunk_${startOffset}.part`);
        chunkForm.append('access_token', pageToken);
        const chunkRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/videos`, { method: 'POST', body: chunkForm });
        const chunkData = await chunkRes.json();
        if (chunkData.error) throw new Error(`Chunk ${startOffset}: ${chunkData.error.message}`);
        startOffset = end;
    }

    const finishForm = new FormData();
    finishForm.append('upload_phase', 'finish');
    finishForm.append('upload_session_id', uploadSessionId);
    finishForm.append('description', description);
    finishForm.append('access_token', pageToken);
    const finishRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/videos`, { method: 'POST', body: finishForm });
    const finishData = await finishRes.json();
    if (finishData.error) throw new Error(`Hoàn tất upload: ${finishData.error.message}`);
    return finishData;
}

// ========== Cross-post video ==========
async function crossPostVideo(pageId, pageToken, videoId, description) {
    let form = new FormData();
    form.append('video_id', videoId);
    form.append('description', description);
    form.append('access_token', pageToken);
    let resp = await fetch(`https://graph.facebook.com/v19.0/${pageId}/videos`, { method: 'POST', body: form });
    let data = await resp.json();
    if (!data.error) return data;

    form = new FormData();
    form.append('video_asset_id', videoId);
    form.append('description', description);
    form.append('access_token', pageToken);
    resp = await fetch(`https://graph.facebook.com/v19.0/${pageId}/videos`, { method: 'POST', body: form });
    data = await resp.json();
    if (data.error) throw new Error(`Cross-post: ${data.error.message}`);
    return data;
}

// ========== Post to Page ==========
async function postToPageWithMedia(pageId, pageToken, post) {
    const allFiles = post.files || [];
    const imgs = allFiles.filter(f => isImageFile(f));
    const vids = allFiles.filter(f => isVideoFile(f));
    let finalContent = post.content || '';
    let finalHashtag = '';
    if (post.hashtag && post.hashtag.trim()) {
        let tags = post.hashtag.split(/[\s,]+/).filter(t => t.trim().length > 0);
        for (let i = tags.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tags[i], tags[j]] = [tags[j], tags[i]];
        }
        finalHashtag = tags.join(' ');
    }
    if (post.pageName) {
        finalContent = finalContent.replace(/\{name_page\}/g, post.pageName);
        finalHashtag = finalHashtag.replace(/\{name_page\}/g, post.pageName);
    }
    let fullMessage = finalContent;
    if (finalHashtag) fullMessage += '\n\n' + finalHashtag;
    fullMessage = fullMessage.trim();

    if (!fullMessage && allFiles.length === 0) throw new Error('Trống nội dung và media');
    if (vids.length > 1) throw new Error('Chỉ hỗ trợ 1 video mỗi bài');

    if (vids.length === 1) {
        return await uploadVideoToPage(pageId, pageToken, vids[0], fullMessage);
    }
    if (imgs.length === 1) {
        const form = new FormData();
        form.append('caption', fullMessage);
        form.append('source', imgs[0], imgs[0].name);
        form.append('access_token', pageToken);
        const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, { method: 'POST', body: form });
        const data = await res.json();
        if (data.error) throw new Error(`Photo: ${data.error.message}`);
        return data;
    }
    if (imgs.length > 1) {
        const mediaIds = [];
        for (const img of imgs) {
            const fd = new FormData();
            fd.append('source', img, img.name);
            fd.append('published', 'false');
            fd.append('access_token', pageToken);
            const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, { method: 'POST', body: fd });
            const data = await res.json();
            if (data.error) throw new Error(`Upload media: ${data.error.message}`);
            mediaIds.push(data.id);
        }
        const form = new FormData();
        form.append('message', fullMessage);
        form.append('access_token', pageToken);
        mediaIds.forEach(id => form.append('attached_media[]', JSON.stringify({ media_fbid: id })));
        const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, { method: 'POST', body: form });
        const data = await res.json();
        if (data.error) throw new Error(`Album: ${data.error.message}`);
        return data;
    }
    const form = new FormData();
    form.append('message', fullMessage);
    form.append('access_token', pageToken);
    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, { method: 'POST', body: form });
    const data = await res.json();
    if (data.error) throw new Error(`Text: ${data.error.message}`);
    return data;
}

// ========== Copy bài viết ==========
async function getPostContentForCopy(postId, pageToken) {
    const url = `https://graph.facebook.com/v19.0/${postId}?fields=message,attachments{media_type,media,url,target,subattachments}&access_token=${pageToken}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data;
}

async function downloadFile(url) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'downloadFile', url }, (response) => {
                if (chrome.runtime.lastError) {
                    fallbackFetch(url).then(resolve).catch(reject);
                    return;
                }
                if (response && response.error) {
                    reject(new Error(response.error));
                } else if (response && response.data) {
                    const uint8 = new Uint8Array(response.data);
                    const blob = new Blob([uint8]);
                    let filename = url.split('/').pop().split('?')[0] || 'video.mp4';
                    resolve(new File([blob], filename, { type: blob.type || 'video/mp4' }));
                } else {
                    reject(new Error('Dữ liệu không hợp lệ từ background'));
                }
            });
        });
    } else {
        return fallbackFetch(url);
    }

    async function fallbackFetch(u) {
        const resp = await fetch(u, { credentials: 'omit' });
        if (!resp.ok) throw new Error(`Download fail: ${resp.status}`);
        const blob = await resp.blob();
        let filename = u.split('/').pop().split('?')[0] || 'file';
        const ext = blob.type.split('/')[1] || 'bin';
        if (!filename.includes('.')) filename += '.' + ext;
        return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    }
}

async function copyPostToPage(pageId, pageToken, originalPost) {
    let message = originalPost.message || '';
    let attachments = originalPost.attachments?.data || [];
    let videoId = null;
    let videoSourceUrl = null;
    for (let attach of attachments) {
        if (attach.media_type === 'video') {
            videoId = attach.target?.id || attach.media?.id;
            videoSourceUrl = attach.media?.source || attach.url;
            if (videoId) break;
        }
    }

    if (videoId) {
        try {
            return await crossPostVideo(pageId, pageToken, videoId, message);
        } catch (e) {
            if (videoSourceUrl) {
                try {
                    const videoFile = await downloadFile(videoSourceUrl);
                    return await uploadVideoToPage(pageId, pageToken, videoFile, message);
                } catch (downloadErr) {
                    console.warn('Không thể tải video:', downloadErr);
                    showToast('Không thể sao chép video (tải về lỗi). Bài sẽ không có video.', 'error');
                }
            } else {
                showToast('Không thể sao chép video (thiếu source). Bài sẽ không có video.', 'error');
            }
        }
    } else if (videoSourceUrl) {
        try {
            const videoFile = await downloadFile(videoSourceUrl);
            return await uploadVideoToPage(pageId, pageToken, videoFile, message);
        } catch (e) {
            console.warn('Không thể tải video:', e);
            showToast('Không thể sao chép video. Bài sẽ không có video.', 'error');
        }
    }

    let filesToUpload = [];
    for (let attach of attachments) {
        if (attach.media_type === 'photo') {
            const imgSrc = attach.media?.image?.src || attach.url;
            if (imgSrc) {
                try { filesToUpload.push(await downloadFile(imgSrc)); } catch(e) { console.warn(e); }
            }
        } else if (attach.subattachments?.data) {
            for (let sub of attach.subattachments.data) {
                const subSrc = sub.media?.image?.src || sub.url;
                if (subSrc) {
                    try { filesToUpload.push(await downloadFile(subSrc)); } catch(e) { console.warn(e); }
                }
            }
        }
    }
    if (filesToUpload.length === 0) {
        await postToPageWithMedia(pageId, pageToken, { content: message, files: [] });
    } else if (filesToUpload.length === 1) {
        await postToPageWithMedia(pageId, pageToken, { content: message, files: filesToUpload });
    } else {
        const base = 'https://graph.facebook.com/v19.0/';
        const mediaIds = [];
        for (let file of filesToUpload) {
            const fd = new FormData();
            fd.append('source', file, file.name);
            fd.append('published', 'false');
            fd.append('access_token', pageToken);
            const res = await fetch(`${base}${pageId}/photos`, { method: 'POST', body: fd });
            const data = await res.json();
            if (data.error) throw new Error(`Upload ảnh: ${data.error.message}`);
            mediaIds.push(data.id);
        }
        const form = new FormData();
        form.append('message', message);
        form.append('access_token', pageToken);
        mediaIds.forEach(id => form.append('attached_media[]', JSON.stringify({ media_fbid: id })));
        const res = await fetch(`${base}${pageId}/feed`, { method: 'POST', body: form });
        const data = await res.json();
        if (data.error) throw new Error(`Album: ${data.error.message}`);
    }
}

// ========== Page list render ==========
function filterPages() {
    const keyword = searchPages.value.toLowerCase().trim();
    filteredPages = keyword ? pages.filter(p => p.name.toLowerCase().includes(keyword)) : [...pages];
    renderPageList();
}
function renderPageList() {
    if (!filteredPages.length) {
        pagesListContainer.innerHTML = '<div style="padding:20px;text-align:center">Không có Page nào</div>';
        pageCountSpan.innerText = '0';
        return;
    }
    pageCountSpan.innerText = filteredPages.length;
    pagesListContainer.innerHTML = filteredPages.map(page => `
        <div class="page-item" data-page-id="${page.id}">
            <input type="checkbox" class="page-checkbox" data-id="${page.id}" ${selectedPageIds.has(page.id) ? 'checked' : ''}>
            <img src="${page.picture?.data?.url || ''}" class="page-avatar" onerror="this.src='https://via.placeholder.com/36?text=?'">
            <div class="page-info">
                <div class="page-name">${escapeHtml(page.name)} <span class="badge">ID: ${page.id}</span></div>
                <div class="page-id">${escapeHtml(page.id)}</div>
            </div>
        </div>
    `).join('');
    attachPageEvents();
    updateSelectAll();
    updateStartButtonState();
}
function attachPageEvents() {
    document.querySelectorAll('.page-item').forEach(item => {
        item.onclick = (e) => {
            if (e.target.type === 'checkbox') return;
            const cb = item.querySelector('.page-checkbox');
            if (cb) {
                cb.checked = !cb.checked;
                const id = cb.dataset.id;
                if (cb.checked) selectedPageIds.add(id);
                else selectedPageIds.delete(id);
                updateSelectAll();
                updateStartButtonState();
            }
        };
        item.oncontextmenu = (e) => {
            e.preventDefault();
            const id = item.dataset.pageId;
            const page = pages.find(p => p.id === id);
            if (page) {
                currentContextPage = page;
                contextMenu.style.left = e.clientX + 'px';
                contextMenu.style.top = e.clientY + 'px';
                contextMenu.style.display = 'block';
            }
        };
    });
    document.querySelectorAll('.page-checkbox').forEach(cb => {
        cb.onchange = (e) => {
            e.stopPropagation();
            const id = cb.dataset.id;
            if (cb.checked) selectedPageIds.add(id);
            else selectedPageIds.delete(id);
            updateSelectAll();
            updateStartButtonState();
        };
    });
}
function updateSelectAll() {
    const checkboxes = document.querySelectorAll('.page-checkbox');
    const checked = document.querySelectorAll('.page-checkbox:checked').length;
    selectAllPages.checked = checkboxes.length > 0 && checked === checkboxes.length;
    selectAllPages.indeterminate = checked > 0 && checked < checkboxes.length;
}
function updateStartButtonState() {
    startPostBtn.disabled = selectedPageIds.size === 0;
}
selectAllPages.onchange = (e) => {
    const isChecked = e.target.checked;
    document.querySelectorAll('.page-checkbox').forEach(cb => {
        cb.checked = isChecked;
        const id = cb.dataset.id;
        if (isChecked) selectedPageIds.add(id);
        else selectedPageIds.delete(id);
    });
    updateStartButtonState();
};
searchPages.oninput = filterPages;

// ========== Posts editor ==========
function renderPostsEditorModal() {
    postsEditorModal.innerHTML = postsData.map((item, idx) => `
        <div class="post-item-editor" data-idx="${idx}">
            <button class="remove-post-modal" data-idx="${idx}">✖</button>
            <textarea rows="3" placeholder="Nội dung bài viết ${idx+1} (có thể dùng {name_page})..." class="post-content-modal" data-idx="${idx}">${escapeHtml(item.content)}</textarea>
            <input type="text" placeholder="Hashtag (cách nhau bằng dấu cách hoặc dấu phẩy)" class="post-hashtag-modal" data-idx="${idx}" value="${escapeHtml(item.hashtag || '')}" style="margin-top:8px;">
            <input type="file" accept="image/*,video/*" multiple class="post-file-input" data-idx="${idx}" style="margin-top:8px;">
            <div class="file-info" id="file-info-${idx}">
                ${item.files && item.files.length ? `📎 ${item.files.length} file(s) <span class="remove-file" data-idx="${idx}">🗑 Xóa</span>` : 'Chưa có ảnh/video'}
            </div>
        </div>
    `).join('');
    document.querySelectorAll('.post-content-modal').forEach(ta => {
        ta.oninput = (e) => { postsData[parseInt(e.target.dataset.idx)].content = e.target.value; };
    });
    document.querySelectorAll('.post-hashtag-modal').forEach(inp => {
        inp.oninput = (e) => { postsData[parseInt(e.target.dataset.idx)].hashtag = e.target.value; };
    });
    document.querySelectorAll('.post-file-input').forEach(inp => {
        inp.onchange = (e) => {
            const idx = parseInt(inp.dataset.idx);
            const files = Array.from(e.target.files);
            if (files.length) {
                postsData[idx].files = files;
                const infoDiv = document.getElementById(`file-info-${idx}`);
                infoDiv.innerHTML = `📎 ${files.length} file(s) <span class="remove-file" data-idx="${idx}">🗑 Xóa</span>`;
                document.querySelector(`.remove-file[data-idx="${idx}"]`).onclick = () => {
                    postsData[idx].files = [];
                    inp.value = '';
                    infoDiv.innerHTML = 'Chưa có ảnh/video';
                };
            }
        };
    });
    document.querySelectorAll('.remove-post-modal').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.idx);
            if (postsData.length > 1) {
                postsData.splice(idx, 1);
                renderPostsEditorModal();
                postCountModal.innerText = postsData.length;
                showToast('Đã xoá bài viết', 'info');
            } else showToast('Phải có ít nhất 1 bài viết', 'error');
        };
    });
    postCountModal.innerText = postsData.length;
}
addPostModalBtn.onclick = () => {
    postsData.push({ content: '', files: [], hashtag: '' });
    renderPostsEditorModal();
    showToast('Đã thêm bài viết', 'success');
};
function getDelayMs() {
    if (delayTypeModal.value === 'fixed') return parseInt(delayFixedModal.value) * 1000;
    const min = parseInt(delayMinModal.value);
    const max = parseInt(delayMaxModal.value);
    return (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
}
delayTypeModal.onchange = () => {
    if (delayTypeModal.value === 'fixed') {
        fixedDelayBoxModal.style.display = 'block';
        randomDelayBoxModal.style.display = 'none';
    } else {
        fixedDelayBoxModal.style.display = 'none';
        randomDelayBoxModal.style.display = 'block';
    }
};

// ========== Posting ==========
async function startPostingFromModal() {
    const selectedPages = pages.filter(p => selectedPageIds.has(p.id));
    if (!selectedPages.length) { showToast('Chọn ít nhất 1 Page', 'error'); return; }
    const validPosts = postsData.filter(p => p.content.trim().length > 0 || (p.files && p.files.length > 0));
    if (validPosts.length === 0) { showToast('Nhập nội dung hoặc chọn ảnh/video', 'error'); return; }
    postInputModal.style.display = 'none';
    progressModal.style.display = 'flex';
    progressLogModal.innerHTML = '';
    progressSummaryModal.innerText = '';
    progressBarModal.style.width = '0%';
    let completed = 0;
    const totalSteps = selectedPages.length * validPosts.length;
    let successCount = 0;
    for (let pIdx = 0; pIdx < selectedPages.length; pIdx++) {
        const page = selectedPages[pIdx];
        for (let cIdx = 0; cIdx < validPosts.length; cIdx++) {
            const post = validPosts[cIdx];
            const itemDiv = document.createElement('div');
            itemDiv.className = 'progress-item';
            itemDiv.innerHTML = `<strong>${escapeHtml(page.name)}</strong> - Bài ${cIdx+1}<br><span class="progress-status pending">⏳ Đang đăng...</span>`;
            progressLogModal.appendChild(itemDiv);
            progressLogModal.scrollTop = progressLogModal.scrollHeight;
            const postForPage = { content: post.content, files: post.files, hashtag: post.hashtag, pageName: page.name };
            try {
                const res = await postToPageWithMedia(page.id, page.access_token, postForPage);
                successCount++;
                const postUrl = res.id ? `https://facebook.com/${res.id}` : `https://facebook.com/${page.id}`;
                itemDiv.innerHTML = `<strong>${escapeHtml(page.name)}</strong> - Bài ${cIdx+1}<br>
                    <span class="progress-status success">✅ Thành công</span>
                    <button class="view-page-btn" data-url="${postUrl}">Xem bài viết</button>`;
                showToast(`Đã đăng lên ${page.name} bài ${cIdx+1}`, 'success');
            } catch (err) {
                itemDiv.innerHTML = `<strong>${escapeHtml(page.name)}</strong> - Bài ${cIdx+1}<br><span class="progress-status error">❌ Lỗi: ${err.message}</span>`;
                showToast(`Lỗi ${page.name}: ${err.message}`, 'error');
            }
            completed++;
            const percent = Math.round(completed / totalSteps * 100);
            progressSummaryModal.innerText = `Đã hoàn thành ${completed}/${totalSteps} bài (${percent}%)`;
            progressBarModal.style.width = percent + '%';
            if (!(pIdx === selectedPages.length-1 && cIdx === validPosts.length-1)) {
                await new Promise(r => setTimeout(r, getDelayMs()));
            }
        }
    }
    document.querySelectorAll('.view-page-btn').forEach(btn => {
        btn.onclick = () => chrome.tabs.create({ url: btn.dataset.url });
    });
    progressSummaryModal.innerHTML += ` ✅ Hoàn tất! Thành công: ${successCount}/${totalSteps}`;
    showToast('Đăng bài hoàn tất!', 'success');
}

// ========== Scan pages ==========
async function scanPages(token) {
    if (!token) { showToast('Nhập token!', 'error'); return; }
    showToast('Đang quét Page...', 'info');
    try {
        pages = await fetchPages(token);
        selectedPageIds.clear();
        filteredPages = [...pages];
        renderPageList();
        pagesSection.style.display = 'flex';
        emptyState.style.display = 'none';
        document.getElementById('postActionCard').style.display = 'block';
        await savePagesToStorage(pages);
        showToast(`Quét thành công! ${pages.length} Page`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ========== Token refresh ==========
async function refreshToken(shouldScan = true) {
    let shortToken = tokenInput.value.trim();
    if (!shortToken) {
        const stored = await getStoredToken();
        if (stored.valid) shortToken = stored.token;
        else { showToast('Nhập token ngắn hạn để reset', 'error'); return; }
    }
    showToast('Đang reset token (60 ngày)...', 'info');
    try {
        const { token, expiresIn } = await exchangeToken(shortToken);
        currentToken = token;
        userAccessToken = token;
        tokenInput.value = token;
        saveToken(token, expiresIn);
        tokenStatus.innerHTML = `<span class="tag tag-success">✅ Token mới (${Math.floor(expiresIn/86400)} ngày)</span>`;
        updateTokenDot(true);
        if (shouldScan) {
            await scanPages(token);
        } else {
            showToast('Token đã được làm mới!', 'success');
        }
        if (tokenManageModal.style.display === 'flex') updateTokenModalDisplay(token);
        return { token, expiresIn };
    } catch (err) {
        showToast(err.message, 'error');
        throw err;
    }
}
async function autoRefreshTokenIfNeeded(tokenObj) {
    if (!tokenObj || !tokenObj.valid) return null;
    if (tokenObj.daysLeft < 35) {
        showToast(`Token còn ${tokenObj.daysLeft} ngày, tự động reset lên 60 ngày...`, 'info');
        try {
            const result = await refreshToken(false);
            return result.token;
        } catch (e) {
            console.error('Auto refresh token thất bại:', e);
            return tokenObj.token;
        }
    }
    return tokenObj.token;
}

function updateTokenModalDisplay(token) {
    if (token) {
        const masked = token.substring(0, 10) + '...' + token.substring(token.length-10);
        currentTokenDisplay.innerText = masked;
    } else currentTokenDisplay.innerText = 'Chưa có token';
}

// ========== Token config modal ==========
tokenFixedBtn.onclick = () => {
    tokenConfigModal.style.display = 'flex';
};
closeTokenConfigModal.onclick = () => {
    tokenConfigModal.style.display = 'none';
};

manageTokenBtn.onclick = async () => {
    const stored = await getStoredToken();
    const token = stored.valid ? stored.token : (tokenInput.value.trim() || '');
    updateTokenModalDisplay(token);
    tokenManageModal.style.display = 'flex';
};
closeTokenModal.onclick = () => tokenManageModal.style.display = 'none';
resetTokenBtn.onclick = async () => {
    await refreshToken(true);
    tokenManageStatus.innerText = 'Đã reset token mới và quét lại pages!';
    setTimeout(() => tokenManageStatus.innerText = '', 3000);
};
copyTokenBtn.onclick = async () => {
    const stored = await getStoredToken();
    const token = stored.valid ? stored.token : tokenInput.value.trim();
    if (token) {
        await navigator.clipboard.writeText(token);
        showToast('Đã copy token', 'success');
        tokenManageStatus.innerText = 'Đã copy!';
    } else showToast('Không có token', 'error');
};
clearTokenBtn.onclick = async () => {
    if (confirm('Xóa token khỏi bộ nhớ?')) {
        await clearStoredToken();
        tokenManageModal.style.display = 'none';
        showToast('Đã xóa token', 'info');
    }
};

// ========== Copy posts ==========
copySelectedPostsBtn.onclick = () => {
    if (selectedPostIds.size === 0) { showToast('Chọn ít nhất 1 bài viết', 'error'); return; }
    const targetPages = pages.filter(p => selectedPageIds.has(p.id));
    if (targetPages.length === 0) { showToast('Chọn page đích', 'error'); return; }
    copyTargetPagesList.innerHTML = targetPages.map(p => `
        <label style="display:block; padding:6px;">
            <input type="checkbox" class="target-page-cb" value="${p.id}" data-name="${escapeHtml(p.name)}" data-token="${p.access_token}" checked> ${escapeHtml(p.name)}
        </label>
    `).join('');
    copyModal.style.display = 'flex';
};
closeCopyModal.onclick = () => copyModal.style.display = 'none';
cancelCopyBtn.onclick = () => copyModal.style.display = 'none';
confirmCopyBtn.onclick = async () => {
    const selectedTargets = [];
    document.querySelectorAll('.target-page-cb:checked').forEach(cb => {
        selectedTargets.push({ id: cb.value, name: cb.dataset.name, access_token: cb.dataset.token });
    });
    if (selectedTargets.length === 0) { showToast('Chọn ít nhất 1 page đích', 'error'); return; }
    const selectedPosts = allPosts.filter(p => selectedPostIds.has(p.id));
    selectedPosts.sort((a, b) => new Date(a.created_time) - new Date(b.created_time));
    const delaySec = parseInt(copyDelaySec.value) || 10;
    copyModal.style.display = 'none';
    progressModal.style.display = 'flex';
    progressLogModal.innerHTML = '';
    progressSummaryModal.innerText = '';
    progressBarModal.style.width = '0%';
    let completed = 0;
    const total = selectedTargets.length * selectedPosts.length;
    let successCount = 0;
    for (let t of selectedTargets) {
        for (let post of selectedPosts) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'progress-item';
            itemDiv.innerHTML = `<strong>${t.name}</strong> - Copy bài "${(post.message || '').substring(0,50)}..."<br><span class="progress-status pending">⏳ Đang copy...</span>`;
            progressLogModal.appendChild(itemDiv);
            progressLogModal.scrollTop = progressLogModal.scrollHeight;
            try {
                const fullPost = await getPostContentForCopy(post.id, currentPostsPageObj.access_token);
                await copyPostToPage(t.id, t.access_token, fullPost);
                successCount++;
                itemDiv.innerHTML = `<strong>${t.name}</strong> - Copy thành công<br><span class="progress-status success">✅ Thành công</span>`;
            } catch (err) {
                itemDiv.innerHTML = `<strong>${t.name}</strong> - Copy thất bại<br><span class="progress-status error">❌ Lỗi: ${err.message}</span>`;
            }
            completed++;
            const percent = Math.round(completed / total * 100);
            progressSummaryModal.innerText = `Đã hoàn thành ${completed}/${total} bài copy (${percent}%)`;
            progressBarModal.style.width = percent + '%';
            if (completed < total) await new Promise(r => setTimeout(r, delaySec * 1000));
        }
    }
    progressSummaryModal.innerHTML += ` ✅ Hoàn tất! Thành công: ${successCount}/${total}`;
    showToast('Copy hoàn tất!', 'success');
};

// ========== Add role ==========
async function addRole() {
    const userIdInput = roleUserId.value.trim();
    if (!userIdInput) { showToast('Nhập User ID hoặc link', 'error'); return; }
    let extracted = (() => {
        let input = userIdInput.trim();
        if (/^\d+$/.test(input)) return input;
        let match = input.match(/facebook\.com\/([^\/?]+)/);
        if (match && match[1] && !match[1].includes('profile.php')) return match[1];
        match = input.match(/id=(\d+)/);
        return match ? match[1] : null;
    })();
    if (!extracted) { showToast('Không nhận diện được ID', 'error'); return; }
    let targetUserId = extracted;
    if (!/^\d+$/.test(extracted)) {
        showToast('Đang lấy ID...', 'info');
        try {
            const url = `https://graph.facebook.com/v19.0/${extracted}?access_token=${userAccessToken}&fields=id`;
            const resp = await fetch(url);
            const data = await resp.json();
            if (data.error) throw new Error(data.error.message);
            targetUserId = data.id;
            roleExtractedId.innerText = `✅ ID: ${targetUserId}`;
        } catch (err) {
            showToast(err.message, 'error');
            return;
        }
    } else roleExtractedId.innerText = `✅ ID: ${targetUserId}`;
    const role = roleSelect.value;
    const addToAllChecked = roleAllPages.checked;
    let targetPages = [];
    if (addToAllChecked) {
        targetPages = pages.filter(p => selectedPageIds.has(p.id));
        if (targetPages.length === 0) { showToast('Chưa chọn page nào', 'error'); return; }
    } else {
        if (!currentContextPage) { showToast('Chuột phải vào page', 'error'); return; }
        targetPages = [currentContextPage];
    }
    showToast(`Đang thêm cho ${targetPages.length} page...`, 'info');
    let successCount = 0, errors = [];
    for (let page of targetPages) {
        try {
            await addRoleToPageWithUserToken(page.id, targetUserId, role);
            successCount++;
            showToast(`✅ Đã thêm vào ${page.name}`, 'success');
        } catch (err) {
            errors.push(`${page.name}: ${err.message}`);
        }
        if (targetPages.length > 1) await new Promise(r => setTimeout(r, 500));
    }
    if (errors.length) roleStatus.innerHTML = `⚠️ Lỗi: ${errors.join('; ')}`;
    else roleStatus.innerHTML = `✅ Thành công ${successCount}/${targetPages.length}`;
    setTimeout(() => roleStatus.innerHTML = '', 5000);
    roleModal.style.display = 'none';
}

// ========== Load posts ==========
function setPostsLoading(loading) {
    postsLoadingIndicator.style.display = loading ? 'block' : 'none';
}

async function loadPosts(page, after, reset = true) {
    if (!page || isLoadingPosts) return;
    if (!reset && noMorePosts) return;
    isLoadingPosts = true;
    setPostsLoading(true);
    try {
        const data = await fetchPagePosts(page.id, page.access_token, after);
        const newPosts = (data.data || []).map(p => ({
            id: p.id,
            message: p.message || '(Không nội dung)',
            created_time: p.created_time,
            thumbnail: getThumbnailUrl(p.attachments),
            attachments: p.attachments
        }));
        if (reset) {
            allPosts = newPosts;
            selectedPostIds.clear();
            noMorePosts = false;
        } else {
            allPosts.push(...newPosts);
        }
        if (newPosts.length === 0) {
            noMorePosts = true;
        }
        nextCursor = data.paging?.cursors?.after || null;
        if (!nextCursor) noMorePosts = true;
        renderPostsGrid();
        updateSelectedCount();
        if (newPosts.length > 0) showToast(`Đã tải ${newPosts.length} bài`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        isLoadingPosts = false;
        setPostsLoading(false);
    }
}

function renderPostsGrid() {
    if (!allPosts.length) {
        postsGrid.innerHTML = '<div style="text-align:center; padding:40px;">📭 Chưa có bài viết</div>';
        return;
    }
    postsGrid.innerHTML = allPosts.map(post => `
        <div class="post-card ${selectedPostIds.has(post.id) ? 'selected' : ''}" data-id="${post.id}">
            ${post.thumbnail ? `<img src="${post.thumbnail}" class="post-media" onerror="this.style.display='none'">` : ''}
            <div style="font-size:13px;">${escapeHtml((post.message || '').substring(0,200))}${(post.message || '').length>200 ? '…' : ''}</div>
            <div style="font-size:11px; color:#6c757d;">📅 ${formatDate(post.created_time)}</div>
        </div>
    `).join('');
    document.querySelectorAll('.post-card').forEach(card => {
        card.onclick = () => {
            const id = card.dataset.id;
            if (selectedPostIds.has(id)) {
                selectedPostIds.delete(id);
                card.classList.remove('selected');
            } else {
                selectedPostIds.add(id);
                card.classList.add('selected');
            }
            updateSelectedCount();
        };
    });
}
function updateSelectedCount() { selectedCountSpan.innerText = selectedPostIds.size; }

// ========== Post type detection ==========
function getPostType(post) {
    const attachments = post.attachments?.data || [];
    let hasPhoto = false, hasVideo = false;
    for (const a of attachments) {
        if (a.media_type === 'photo') hasPhoto = true;
        if (a.media_type === 'video') hasVideo = true;
        if (a.subattachments?.data) {
            for (const s of a.subattachments.data) {
                if (s.media_type === 'photo') hasPhoto = true;
                if (s.media_type === 'video') hasVideo = true;
            }
        }
    }
    return { hasPhoto, hasVideo, isText: !hasPhoto && !hasVideo };
}

function applyTypeFilterSelection() {
    const wantText  = document.getElementById('cbFilterText').checked;
    const wantPhoto = document.getElementById('cbFilterPhoto').checked;
    const wantVideo = document.getElementById('cbFilterVideo').checked;

    allPosts.forEach(post => {
        const { hasPhoto, hasVideo, isText } = getPostType(post);
        const match = (wantText && isText) || (wantPhoto && hasPhoto) || (wantVideo && hasVideo);
        if (wantText || wantPhoto || wantVideo) {
            if (match) selectedPostIds.add(post.id);
            else selectedPostIds.delete(post.id);
        }
    });

    renderPostsGrid();
    updateSelectedCount();

    document.getElementById('cbLabelText').classList.toggle('active', wantText);
    document.getElementById('cbLabelPhoto').classList.toggle('active', wantPhoto);
    document.getElementById('cbLabelVideo').classList.toggle('active', wantVideo);

    const anyActive = wantText || wantPhoto || wantVideo;
    if (anyActive) {
        showToast(`Đã chọn ${selectedPostIds.size} bài`, 'success');
    }
}

function resetTypeFilterCheckboxes() {
    document.getElementById('cbFilterText').checked = false;
    document.getElementById('cbFilterPhoto').checked = false;
    document.getElementById('cbFilterVideo').checked = false;
    document.getElementById('cbLabelText').classList.remove('active');
    document.getElementById('cbLabelPhoto').classList.remove('active');
    document.getElementById('cbLabelVideo').classList.remove('active');
}

document.getElementById('cbFilterText').onchange  = applyTypeFilterSelection;
document.getElementById('cbFilterPhoto').onchange = applyTypeFilterSelection;
document.getElementById('cbFilterVideo').onchange = applyTypeFilterSelection;

// ========== Select/Deselect all posts (đồng bộ với filter) ==========
selectAllPostsBtn.onclick = () => {
    const wantText  = document.getElementById('cbFilterText').checked;
    const wantPhoto = document.getElementById('cbFilterPhoto').checked;
    const wantVideo = document.getElementById('cbFilterVideo').checked;
    const anyFilter = wantText || wantPhoto || wantVideo;

    allPosts.forEach(post => {
        if (anyFilter) {
            const { hasPhoto, hasVideo, isText } = getPostType(post);
            const match = (wantText && isText) || (wantPhoto && hasPhoto) || (wantVideo && hasVideo);
            if (match) selectedPostIds.add(post.id);
            else selectedPostIds.delete(post.id);
        } else {
            selectedPostIds.add(post.id);
        }
    });

    renderPostsGrid();
    updateSelectedCount();
    showToast(`Đã chọn ${selectedPostIds.size} bài`, 'success');
};
deselectAllPostsBtn.onclick = () => {
    selectedPostIds.clear();
    resetTypeFilterCheckboxes();
    renderPostsGrid();
    updateSelectedCount();
    showToast('Đã bỏ chọn tất cả', 'info');
};

// Infinite scroll for postsGrid
postsGrid.addEventListener('scroll', () => {
    if (noMorePosts || isLoadingPosts) return;
    const { scrollTop, scrollHeight, clientHeight } = postsGrid;
    if (scrollTop + clientHeight >= scrollHeight - 80) {
        if (nextCursor && currentPostsPageObj) {
            loadPosts(currentPostsPageObj, nextCursor, false);
        }
    }
});

async function deleteSelectedPosts() {
    if (!selectedPostIds.size) { showToast('Chọn bài cần xoá', 'error'); return; }
    if (!confirm(`Xoá ${selectedPostIds.size} bài?`)) return;
    showToast(`Đang xoá...`, 'info');
    for (let pid of selectedPostIds) {
        try {
            await deletePost(pid, currentPostsPageObj.access_token);
            allPosts = allPosts.filter(p => p.id !== pid);
        } catch (err) { showToast(err.message, 'error'); }
    }
    selectedPostIds.clear();
    renderPostsGrid();
    updateSelectedCount();
    showToast('Đã xoá các bài được chọn', 'success');
}

// ========== Init ==========
async function init() {
    const storedToken = await getStoredToken();
    if (storedToken.valid) {
        const finalToken = await autoRefreshTokenIfNeeded(storedToken);
        userAccessToken = finalToken;
        currentToken = finalToken;
        tokenInput.value = finalToken;
        const newStored = await getStoredToken();
        const daysLeft = newStored.valid ? newStored.daysLeft : storedToken.daysLeft;
        tokenStatus.innerHTML = `<span class="tag tag-success">✅ Token còn ${daysLeft} ngày</span>`;
        if (daysLeft < 20) tokenStatus.innerHTML += ` <span class="tag tag-warning">Sắp hết hạn</span>`;
        updateTokenDot(true);

        const storedPages = await getStoredPages();
        if (storedPages && storedPages.length > 0) {
            pages = storedPages;
            filteredPages = [...pages];
            selectedPageIds.clear();
            renderPageList();
            pagesSection.style.display = 'flex';
            emptyState.style.display = 'none';
            document.getElementById('postActionCard').style.display = 'block';
            showToast(`Đã tải ${pages.length} page từ bộ nhớ`, 'success');
        } else {
            await scanPages(finalToken);
        }
    } else {
        tokenStatus.innerHTML = `<span class="tag tag-warning">⚠️ Chưa có token hoặc hết hạn</span>`;
        updateTokenDot(false);
        emptyState.style.display = 'block';
    }
    postsData = [{ content: '', files: [], hashtag: '' }];
    renderPostsEditorModal();
}

// ========== Event bindings ==========
scanBtn.onclick = () => {
    const t = tokenInput.value.trim();
    if (t) {
        currentToken = t;
        userAccessToken = t;
        scanPages(t);
        saveToken(t, 5184000);
        tokenStatus.innerHTML = '<span class="tag tag-success">✅ Đã lưu token</span>';
        updateTokenDot(true);
        tokenConfigModal.style.display = 'none';
    } else showToast('Nhập token', 'error');
};
startPostBtn.onclick = () => {
    if (selectedPageIds.size === 0) { showToast('Chọn ít nhất 1 Page', 'error'); return; }
    postsData = [{ content: '', files: [], hashtag: '' }];
    renderPostsEditorModal();
    postInputModal.style.display = 'flex';
};
closeInputModal.onclick = () => postInputModal.style.display = 'none';
confirmPostBtn.onclick = startPostingFromModal;
closeProgressModal.onclick = () => progressModal.style.display = 'none';

ctxOpenPage.onclick = () => {
    contextMenu.style.display = 'none';
    if (currentContextPage) {
        const url = `https://www.facebook.com/${currentContextPage.id}`;
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.create({ url });
        } else {
            window.open(url, '_blank');
        }
    }
};
ctxScanPosts.onclick = () => {
    contextMenu.style.display = 'none';
    if (currentContextPage) {
        currentPostsPageObj = currentContextPage;
        modalPageName.innerText = `Bài viết của ${currentContextPage.name}`;
        allPosts = [];
        selectedPostIds.clear();
        noMorePosts = false;
        nextCursor = null;
        resetTypeFilterCheckboxes();
        postsModal.style.display = 'flex';
        loadPosts(currentContextPage, null, true);
    }
};
ctxAddRole.onclick = () => {
    contextMenu.style.display = 'none';
    if (currentContextPage) {
        roleUserId.value = '';
        roleExtractedId.innerText = '';
        roleStatus.innerHTML = '';
        const selectedCount = selectedPageIds.size;
        roleSelectedPagesCount.innerText = selectedCount;
        if (selectedCount > 1) { roleAllPages.checked = true; roleAllPages.disabled = false; }
        else if (selectedCount === 1) { roleAllPages.checked = false; roleAllPages.disabled = false; }
        else { roleAllPages.checked = false; roleAllPages.disabled = true; }
        roleModal.style.display = 'flex';
    }
};
closePostsModal.onclick = () => postsModal.style.display = 'none';
closeRoleModal.onclick = () => roleModal.style.display = 'none';
deleteSelectedPostsBtn.onclick = deleteSelectedPosts;
submitRoleBtn.onclick = addRole;

window.onclick = e => {
    if (e.target === postInputModal) postInputModal.style.display = 'none';
    if (e.target === progressModal) progressModal.style.display = 'none';
    if (e.target === postsModal) postsModal.style.display = 'none';
    if (e.target === roleModal) roleModal.style.display = 'none';
    if (e.target === copyModal) copyModal.style.display = 'none';
    if (e.target === tokenConfigModal) tokenConfigModal.style.display = 'none';
    if (e.target !== contextMenu && !contextMenu.contains(e.target)) contextMenu.style.display = 'none';
};

init();