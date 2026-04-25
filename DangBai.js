// DangBai.js - Hỗ trợ hashtag động, xáo trộn, thay thế {name_page}

const TOKEN_KEY = 'fb_bulk_token';
const TOKEN_EXPIRY_KEY = 'fb_bulk_token_expiry';
const FB_APP_ID = '436239572033001';
const FB_APP_SECRET = '46ba3ead34d90da033b0204ea6cf213d';

// DOM elements (giữ nguyên như cũ, chỉ thêm một vài selector mới)
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
const ctxScanPosts = document.getElementById('ctxScanPosts');
const ctxAddRole = document.getElementById('ctxAddRole');
const postsModal = document.getElementById('postsModal');
const modalPageName = document.getElementById('modalPageName');
const postsGrid = document.getElementById('postsGrid');
const loadMorePostsBtn = document.getElementById('loadMorePostsBtn');
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
const tokenCardTitle = document.getElementById('tokenCardTitle');
const tokenContent = document.getElementById('tokenContent');
const selectAllPostsBtn = document.getElementById('selectAllPostsBtn');
const deselectAllPostsBtn = document.getElementById('deselectAllPostsBtn');
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
// Mỗi phần tử: { content: '', files: [], hashtag: '' }
let postsData = [];

// Accordion token
let tokenCollapsed = true;
tokenContent.style.maxHeight = '0';
tokenContent.style.overflow = 'hidden';
tokenContent.style.padding = '0';
tokenCardTitle.classList.add('collapsed');
tokenCardTitle.onclick = () => {
    tokenCollapsed = !tokenCollapsed;
    if (tokenCollapsed) {
        tokenContent.style.maxHeight = '0';
        tokenContent.style.padding = '0';
        tokenContent.style.overflow = 'hidden';
        tokenCardTitle.classList.add('collapsed');
    } else {
        tokenContent.style.maxHeight = tokenContent.scrollHeight + 'px';
        tokenContent.style.padding = '';
        tokenContent.style.overflow = '';
        tokenCardTitle.classList.remove('collapsed');
    }
};

// Toast
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

// Storage
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
    showToast('Đã xóa token khỏi bộ nhớ', 'info');
}

// API calls
async function exchangeToken(shortToken) {
    const url = `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${shortToken}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return { token: data.access_token, expiresIn: data.expires_in || 5184000 };
}
async function fetchPages(token) {
    const url = `https://graph.facebook.com/v20.0/me/accounts?fields=name,access_token,picture{url},id&limit=100&access_token=${token}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data.data || [];
}
async function postToPageWithMedia(pageId, pageToken, post) { // post: { content, files, hashtag, pageName }
    // Xử lý hashtag: tách chuỗi, xáo trộn, ghép lại
    let finalContent = post.content || '';
    let finalHashtag = '';
    if (post.hashtag && post.hashtag.trim()) {
        let tags = post.hashtag.split(/[\s,]+/).filter(t => t.trim().length > 0);
        if (tags.length > 0) {
            // Xáo trộn mảng tags
            for (let i = tags.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [tags[i], tags[j]] = [tags[j], tags[i]];
            }
            finalHashtag = tags.join(' ');
        }
    }
    // Thay thế {name_page} trong content và hashtag
    if (post.pageName) {
        finalContent = finalContent.replace(/\{name_page\}/g, post.pageName);
        finalHashtag = finalHashtag.replace(/\{name_page\}/g, post.pageName);
    }
    // Ghép nội dung + hashtag
    let fullMessage = finalContent;
    if (finalHashtag) fullMessage += '\n\n' + finalHashtag;
    fullMessage = fullMessage.trim();
    
    const imgs = (post.files || []).filter(f => f.type.startsWith('image/'));
    const vids = (post.files || []).filter(f => f.type.startsWith('video/'));
    const hasText = fullMessage.length > 0;

    if (!hasText && (post.files || []).length === 0) {
        throw new Error('Bài đăng trống: Hãy nhập nội dung hoặc chọn ảnh/video');
    }
    if (vids.length > 1) {
        throw new Error('Facebook chỉ hỗ trợ 1 video mỗi bài đăng');
    }

    const toForm = (obj) => {
        const fd = new FormData();
        Object.entries(obj).forEach(([k, v]) => fd.append(k, v));
        return fd;
    };
    const base = 'https://graph.facebook.com/v20.0/';

    try {
        if (vids.length) {
            const res = await fetch(`${base}${pageId}/videos`, {
                method: 'POST',
                body: toForm({ description: fullMessage, source: vids[0], access_token: pageToken })
            });
            const data = await res.json();
            if (data.error) throw new Error(`Video: ${data.error.message}`);
            return data;
        } 
        else if (imgs.length === 1) {
            const res = await fetch(`${base}${pageId}/photos`, {
                method: 'POST',
                body: toForm({ caption: fullMessage, source: imgs[0], access_token: pageToken })
            });
            const data = await res.json();
            if (data.error) throw new Error(`Photo: ${data.error.message}`);
            return data;
        }
        else if (imgs.length > 1) {
            const mediaIds = [];
            for (const img of imgs) {
                const res = await fetch(`${base}${pageId}/photos`, {
                    method: 'POST',
                    body: toForm({ source: img, published: 'false', access_token: pageToken })
                });
                const data = await res.json();
                if (data.error) throw new Error(`Upload media: ${data.error.message}`);
                mediaIds.push(data.id);
            }
            const form = new FormData();
            form.append('message', fullMessage);
            form.append('access_token', pageToken);
            mediaIds.forEach(id => form.append('attached_media[]', JSON.stringify({ media_fbid: id })));
            const res = await fetch(`${base}${pageId}/feed`, { method: 'POST', body: form });
            const data = await res.json();
            if (data.error) throw new Error(`Album: ${data.error.message}`);
            return data;
        }
        else {
            const res = await fetch(`${base}${pageId}/feed`, {
                method: 'POST',
                body: toForm({ message: fullMessage, access_token: pageToken })
            });
            const data = await res.json();
            if (data.error) throw new Error(`Text post: ${data.error.message}`);
            return data;
        }
    } catch (err) {
        throw err;
    }
}
async function deletePost(postId, pageToken) {
    const resp = await fetch(`https://graph.facebook.com/v20.0/${postId}?access_token=${pageToken}`, { method: 'DELETE' });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data;
}
async function fetchPagePosts(pageId, pageToken, after = null) {
    let url = `https://graph.facebook.com/v20.0/${pageId}/posts?fields=id,message,created_time,attachments{media_type,media,url,subattachments{media,url}},full_picture&limit=25&access_token=${pageToken}`;
    if (after) url += `&after=${after}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data;
}
async function addRoleToPageWithUserToken(pageId, userId, role) {
    const url = `https://graph.facebook.com/v20.0/${pageId}/roles`;
    const form = new FormData();
    form.append('user', userId);
    form.append('role', role);
    form.append('access_token', userAccessToken);
    const resp = await fetch(url, { method: 'POST', body: form });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data;
}
// Các hàm copy (giữ nguyên như cũ, nhưng có thể bổ sung xử lý hashtag nếu cần - tạm thời giữ)
async function getPostContentForCopy(postId, pageToken) {
    const url = `https://graph.facebook.com/v20.0/${postId}?fields=message,attachments{media_type,media,url,subattachments{media,url}}&access_token=${pageToken}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data;
}
async function downloadFile(url) {
    const resp = await fetch(url, { credentials: 'omit' });
    if (!resp.ok) throw new Error(`Tải file thất bại: ${resp.status}`);
    const blob = await resp.blob();
    let filename = 'file';
    const contentDisposition = resp.headers.get('content-disposition');
    if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) filename = match[1].replace(/['"]/g, '');
    } else {
        const urlParts = url.split('/');
        let last = urlParts.pop() || urlParts.pop();
        if (last.includes('?')) last = last.split('?')[0];
        if (last) filename = last;
    }
    const ext = blob.type.split('/')[1] || 'bin';
    if (!filename.includes('.')) filename += '.' + ext;
    return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
}
async function copyPostToPage(pageId, pageToken, originalPost) {
    let message = originalPost.message || '';
    let attachments = originalPost.attachments?.data || [];
    let filesToUpload = [];
    for (let attach of attachments) {
        if (attach.media_type === 'photo') {
            const imgSrc = attach.media?.image?.src || attach.url;
            if (imgSrc) {
                try {
                    const file = await downloadFile(imgSrc);
                    filesToUpload.push(file);
                } catch (e) { console.warn('Download ảnh lỗi:', e); }
            }
        } else if (attach.media_type === 'video') {
            const videoUrl = attach.url || attach.media?.source;
            if (videoUrl) {
                try {
                    const file = await downloadFile(videoUrl);
                    filesToUpload.push(file);
                } catch (e) { console.warn('Download video lỗi:', e); }
            }
        } else if (attach.subattachments?.data) {
            for (let sub of attach.subattachments.data) {
                const subSrc = sub.media?.image?.src || sub.url;
                if (subSrc) {
                    try {
                        const file = await downloadFile(subSrc);
                        filesToUpload.push(file);
                    } catch (e) { console.warn('Download subattachment lỗi:', e); }
                }
            }
        }
    }
    // Đối với copy, tạm thời không xử lý hashtag động (giữ nguyên nội dung gốc)
    if (filesToUpload.length === 0) {
        await postToPageWithMedia(pageId, pageToken, { content: message, files: [] });
    }
    else if (filesToUpload.length === 1) {
        await postToPageWithMedia(pageId, pageToken, { content: message, files: filesToUpload });
    }
    else {
        const toForm = (obj) => {
            const fd = new FormData();
            Object.entries(obj).forEach(([k,v]) => fd.append(k, v));
            return fd;
        };
        const base = 'https://graph.facebook.com/v20.0/';
        const mediaIds = [];
        for (let file of filesToUpload) {
            const res = await fetch(`${base}${pageId}/photos`, {
                method: 'POST',
                body: toForm({ source: file, published: 'false', access_token: pageToken })
            });
            const data = await res.json();
            if (data.error) throw new Error(`Upload media: ${data.error.message}`);
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

// Helper
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
function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m])); }
function formatDate(isoString) { return isoString ? new Date(isoString).toLocaleString('vi-VN') : ''; }

// Render pages (giữ nguyên)
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

// Modal nhập bài (có hashtag)
function renderPostsEditorModal() {
    postsEditorModal.innerHTML = postsData.map((item, idx) => `
        <div class="post-item-editor" data-idx="${idx}">
            <button class="remove-post-modal" data-idx="${idx}">✖</button>
            <textarea rows="3" placeholder="Nội dung bài viết ${idx+1} (có thể dùng {name_page})..." class="post-content-modal" data-idx="${idx}">${escapeHtml(item.content)}</textarea>
            <input type="text" placeholder="Hashtag (cách nhau bằng dấu cách hoặc dấu phẩy, ví dụ: #abc #xyz)" class="post-hashtag-modal" data-idx="${idx}" value="${escapeHtml(item.hashtag || '')}" style="margin-top:8px;">
            <input type="file" accept="image/*,video/*" multiple class="post-file-input" data-idx="${idx}" style="margin-top:8px;">
            <div class="file-info" id="file-info-${idx}">
                ${item.files && item.files.length ? `📎 ${item.files.length} file(s) <span class="remove-file" data-idx="${idx}">🗑 Xóa</span>` : 'Chưa có ảnh/video'}
            </div>
        </div>
    `).join('');
    // Gắn sự kiện
    document.querySelectorAll('.post-content-modal').forEach(ta => {
        ta.oninput = (e) => {
            const idx = parseInt(e.target.dataset.idx);
            postsData[idx].content = e.target.value;
        };
    });
    document.querySelectorAll('.post-hashtag-modal').forEach(inp => {
        inp.oninput = (e) => {
            const idx = parseInt(e.target.dataset.idx);
            postsData[idx].hashtag = e.target.value;
        };
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
delayTypeModal.onchange = () => {
    if (delayTypeModal.value === 'fixed') {
        fixedDelayBoxModal.style.display = 'block';
        randomDelayBoxModal.style.display = 'none';
    } else {
        fixedDelayBoxModal.style.display = 'none';
        randomDelayBoxModal.style.display = 'block';
    }
};
function getDelayMs() {
    if (delayTypeModal.value === 'fixed') return parseInt(delayFixedModal.value) * 1000;
    const min = parseInt(delayMinModal.value);
    const max = parseInt(delayMaxModal.value);
    return (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
}

// Đăng bài (có truyền thêm pageName)
async function startPostingFromModal() {
    const selectedPages = pages.filter(p => selectedPageIds.has(p.id));
    if (!selectedPages.length) { showToast('Chọn ít nhất 1 Page', 'error'); return; }
    const validPosts = postsData.filter(p => p.content.trim().length > 0 || (p.files && p.files.length > 0));
    if (validPosts.length === 0) { showToast('Nhập nội dung hoặc chọn ảnh/video cho ít nhất 1 bài viết', 'error'); return; }
    
    postInputModal.style.display = 'none';
    progressModal.style.display = 'flex';
    progressLogModal.innerHTML = '';
    progressSummaryModal.innerText = '';
    
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
            
            // Tạo bản sao của post với pageName để xử lý hashtag và thay thế tên page
            const postForPage = {
                content: post.content,
                files: post.files,
                hashtag: post.hashtag,
                pageName: page.name
            };
            
            try {
                const res = await postToPageWithMedia(page.id, page.access_token, postForPage);
                successCount++;
                const postUrl = res.id ? `https://facebook.com/${res.id}` : `https://facebook.com/${page.id}/posts/${res.id}`;
                itemDiv.innerHTML = `<strong>${escapeHtml(page.name)}</strong> - Bài ${cIdx+1}<br>
                    <span class="progress-status success">✅ Thành công</span>
                    <button class="view-page-btn" data-url="${postUrl}">Xem bài viết</button>`;
                showToast(`Đã đăng lên ${page.name} bài ${cIdx+1}`, 'success');
            } catch (err) {
                itemDiv.innerHTML = `<strong>${escapeHtml(page.name)}</strong> - Bài ${cIdx+1}<br><span class="progress-status error">❌ Lỗi: ${err.message}</span>`;
                showToast(`Lỗi ${page.name}: ${err.message}`, 'error');
            }
            completed++;
            progressSummaryModal.innerText = `Đã hoàn thành ${completed}/${totalSteps} bài`;
            
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

// Quét page, refresh token, quản lý token, copy, role... (giữ nguyên từ code trước, không thay đổi)
// ... (phần còn lại giữ nguyên như đã có, chỉ cần copy tiếp từ dưới đây)

// Quét page
async function scanPages(token) {
    if (!token) { showToast('Nhập token!', 'error'); return; }
    showToast('Đang quét Page...', 'info');
    try {
        pages = await fetchPages(token);
        selectedPageIds.clear();
        filteredPages = [...pages];
        renderPageList();
        pagesSection.style.display = 'block';
        document.getElementById('postActionCard').style.display = 'block';
        showToast(`Quét thành công! ${pages.length} Page`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function refreshToken() {
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
        await scanPages(token);
        showToast('Token đã được reset thành công!', 'success');
        if (tokenManageModal.style.display === 'flex') updateTokenModalDisplay(token);
    } catch (err) { showToast(err.message, 'error'); }
}

function updateTokenModalDisplay(token) {
    if (token) {
        const masked = token.substring(0, 10) + '...' + token.substring(token.length-10);
        currentTokenDisplay.innerText = masked;
    } else {
        currentTokenDisplay.innerText = 'Chưa có token';
    }
}
manageTokenBtn.onclick = async () => {
    const stored = await getStoredToken();
    const token = stored.valid ? stored.token : (tokenInput.value.trim() || '');
    updateTokenModalDisplay(token);
    tokenManageModal.style.display = 'flex';
};
closeTokenModal.onclick = () => tokenManageModal.style.display = 'none';
resetTokenBtn.onclick = async () => {
    await refreshToken();
    tokenManageStatus.innerText = 'Đã reset token mới!';
    setTimeout(() => { tokenManageStatus.innerText = ''; }, 3000);
};
copyTokenBtn.onclick = async () => {
    const stored = await getStoredToken();
    const token = stored.valid ? stored.token : tokenInput.value.trim();
    if (token) {
        await navigator.clipboard.writeText(token);
        showToast('Đã copy token', 'success');
        tokenManageStatus.innerText = 'Đã copy!';
    } else {
        showToast('Không có token', 'error');
    }
};
clearTokenBtn.onclick = async () => {
    if (confirm('Xóa token khỏi bộ nhớ?')) {
        await clearStoredToken();
        tokenManageModal.style.display = 'none';
        showToast('Đã xóa token', 'info');
    }
};
window.onclick = e => {
    if (e.target === tokenManageModal) tokenManageModal.style.display = 'none';
};

// Copy bài viết (giữ nguyên)
copySelectedPostsBtn.onclick = () => {
    if (selectedPostIds.size === 0) {
        showToast('Chọn ít nhất 1 bài viết để copy', 'error');
        return;
    }
    const targetPages = pages.filter(p => selectedPageIds.has(p.id));
    if (targetPages.length === 0) {
        showToast('Vui lòng chọn page đích trong danh sách chính trước', 'error');
        return;
    }
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
        selectedTargets.push({
            id: cb.value,
            name: cb.dataset.name,
            access_token: cb.dataset.token
        });
    });
    if (selectedTargets.length === 0) {
        showToast('Chọn ít nhất 1 page đích', 'error');
        return;
    }
    const selectedPosts = allPosts.filter(p => selectedPostIds.has(p.id));
    selectedPosts.sort((a, b) => new Date(a.created_time) - new Date(b.created_time));
    const delaySeconds = parseInt(copyDelaySec.value) || 10;
    copyModal.style.display = 'none';
    progressModal.style.display = 'flex';
    progressLogModal.innerHTML = '';
    progressSummaryModal.innerText = '';
    let completed = 0;
    const total = selectedTargets.length * selectedPosts.length;
    let successCount = 0;
    for (let t of selectedTargets) {
        for (let post of selectedPosts) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'progress-item';
            itemDiv.innerHTML = `<strong>${t.name}</strong> - Copy bài "${post.message.substring(0,50)}..."<br><span class="progress-status pending">⏳ Đang copy...</span>`;
            progressLogModal.appendChild(itemDiv);
            progressLogModal.scrollTop = progressLogModal.scrollHeight;
            try {
                const fullPost = await getPostContentForCopy(post.id, currentPostsPageObj.access_token);
                await copyPostToPage(t.id, t.access_token, fullPost);
                successCount++;
                itemDiv.innerHTML = `<strong>${t.name}</strong> - Copy bài thành công<br><span class="progress-status success">✅ Thành công</span>`;
            } catch (err) {
                itemDiv.innerHTML = `<strong>${t.name}</strong> - Copy bài thất bại<br><span class="progress-status error">❌ Lỗi: ${err.message}</span>`;
            }
            completed++;
            progressSummaryModal.innerText = `Đã hoàn thành ${completed}/${total} bài copy`;
            if (completed < total) await new Promise(r => setTimeout(r, delaySeconds * 1000));
        }
    }
    progressSummaryModal.innerHTML += ` ✅ Hoàn tất! Thành công: ${successCount}/${total}`;
    showToast('Copy hoàn tất!', 'success');
};

// Thêm role (giữ nguyên)
async function addRole() {
    const userIdInput = roleUserId.value.trim();
    if (!userIdInput) { showToast('Nhập User ID hoặc link Facebook', 'error'); return; }
    let extracted = extractUserIdFromInput(userIdInput);
    if (!extracted) { showToast('Không thể nhận diện User ID hoặc link', 'error'); return; }
    let targetUserId = extracted;
    if (!/^\d+$/.test(extracted)) {
        showToast('Đang lấy ID từ username...', 'info');
        try {
            targetUserId = await resolveUserId(extracted, userAccessToken);
            roleExtractedId.innerText = `✅ ID: ${targetUserId}`;
        } catch (err) {
            showToast(err.message, 'error');
            return;
        }
    } else {
        roleExtractedId.innerText = `✅ ID: ${targetUserId}`;
    }
    const role = roleSelect.value;
    const addToAllChecked = roleAllPages.checked;
    let targetPages = [];
    if (addToAllChecked) {
        targetPages = pages.filter(p => selectedPageIds.has(p.id));
        if (targetPages.length === 0) {
            showToast('Không có page nào được chọn! Hãy tick chọn page trước.', 'error');
            return;
        }
    } else {
        if (!currentContextPage) {
            showToast('Không xác định page. Hãy chuột phải vào page cần thêm.', 'error');
            return;
        }
        targetPages = [currentContextPage];
    }
    showToast(`Đang thêm cho ${targetPages.length} page...`, 'info');
    let successCount = 0;
    let errorList = [];
    for (const page of targetPages) {
        try {
            await addRoleToPageWithUserToken(page.id, targetUserId, role);
            successCount++;
            showToast(`✅ Đã thêm ${targetUserId} vào ${page.name} với vai trò ${role}`, 'success');
        } catch (err) {
            errorList.push(`${page.name}: ${err.message}`);
            showToast(`❌ Lỗi ${page.name}: ${err.message}`, 'error');
        }
        if (targetPages.length > 1) await new Promise(r => setTimeout(r, 500));
    }
    if (errorList.length) {
        roleStatus.innerHTML = `⚠️ Lỗi: ${errorList.join('; ')}`;
    } else {
        roleStatus.innerHTML = `✅ Thành công ${successCount}/${targetPages.length} page`;
    }
    setTimeout(() => { roleStatus.innerHTML = ''; }, 5000);
    roleModal.style.display = 'none';
}
function extractUserIdFromInput(input) {
    input = input.trim();
    if (!input) return null;
    if (/^\d+$/.test(input)) return input;
    let match;
    match = input.match(/facebook\.com\/([^\/?]+)/);
    if (match && match[1] && !match[1].includes('profile.php')) {
        return match[1];
    }
    match = input.match(/id=(\d+)/);
    if (match) return match[1];
    return null;
}
async function resolveUserId(identifier, token) {
    if (/^\d+$/.test(identifier)) return identifier;
    try {
        const url = `https://graph.facebook.com/v20.0/${identifier}?access_token=${token}&fields=id`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.error) throw new Error(data.error.message);
        return data.id;
    } catch (err) {
        throw new Error(`Không thể lấy ID từ ${identifier}`);
    }
}

// Khởi tạo
async function init() {
    tokenContent.style.maxHeight = '0';
    tokenContent.style.overflow = 'hidden';
    tokenContent.style.padding = '0';
    tokenCardTitle.classList.add('collapsed');
    tokenCollapsed = true;
    const stored = await getStoredToken();
    if (stored.valid) {
        userAccessToken = stored.token;
        currentToken = stored.token;
        tokenInput.value = stored.token;
        tokenStatus.innerHTML = `<span class="tag tag-success">✅ Token còn ${stored.daysLeft} ngày</span>`;
        if (stored.daysLeft < 20) tokenStatus.innerHTML += ` <span class="tag tag-warning">Sắp hết hạn</span>`;
        await scanPages(stored.token);
    } else {
        tokenStatus.innerHTML = `<span class="tag tag-warning">⚠️ Chưa có token hoặc hết hạn</span>`;
    }
    postsData = [{ content: '', files: [], hashtag: '' }];
    renderPostsEditorModal();
}

// Event listeners chính
scanBtn.onclick = () => {
    const t = tokenInput.value.trim();
    if (t) {
        currentToken = t;
        userAccessToken = t;
        scanPages(t);
        saveToken(t, 5184000);
        tokenStatus.innerHTML = '<span class="tag tag-success">✅ Đã lưu token</span>';
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
window.onclick = e => {
    if (e.target === postInputModal) postInputModal.style.display = 'none';
    if (e.target === progressModal) progressModal.style.display = 'none';
    if (e.target === postsModal) postsModal.style.display = 'none';
    if (e.target === roleModal) roleModal.style.display = 'none';
    if (e.target === copyModal) copyModal.style.display = 'none';
    if (e.target !== contextMenu && !contextMenu.contains(e.target)) contextMenu.style.display = 'none';
};

ctxScanPosts.onclick = () => {
    contextMenu.style.display = 'none';
    if (currentContextPage) {
        currentPostsPageObj = currentContextPage;
        modalPageName.innerText = `Bài viết của ${currentContextPage.name}`;
        allPosts = [];
        selectedPostIds.clear();
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
        if (selectedCount > 1) {
            roleAllPages.checked = true;
            roleAllPages.disabled = false;
        } else if (selectedCount === 1) {
            roleAllPages.checked = false;
            roleAllPages.disabled = false;
        } else {
            roleAllPages.checked = false;
            roleAllPages.disabled = true;
        }
        roleModal.style.display = 'flex';
    }
};
closePostsModal.onclick = () => postsModal.style.display = 'none';
closeRoleModal.onclick = () => roleModal.style.display = 'none';
loadMorePostsBtn.onclick = () => { if (nextCursor && currentPostsPageObj) loadPosts(currentPostsPageObj, nextCursor, false); else showToast('Đã hết bài', 'error'); };
deleteSelectedPostsBtn.onclick = deleteSelectedPosts;
submitRoleBtn.onclick = addRole;
selectAllPostsBtn.onclick = () => {
    allPosts.forEach(post => selectedPostIds.add(post.id));
    renderPostsGrid();
    updateSelectedCount();
    showToast(`Đã chọn ${selectedPostIds.size} bài`, 'success');
};
deselectAllPostsBtn.onclick = () => {
    selectedPostIds.clear();
    renderPostsGrid();
    updateSelectedCount();
    showToast('Đã bỏ chọn tất cả', 'info');
};

async function loadPosts(page, after, reset = true) {
    if (!page || isLoadingPosts) return;
    isLoadingPosts = true;
    try {
        const data = await fetchPagePosts(page.id, page.access_token, after);
        const newPosts = data.data.map(p => ({
            id: p.id,
            message: p.message || '(Không nội dung)',
            created_time: p.created_time,
            thumbnail: getThumbnailUrl(p.attachments),
            attachments: p.attachments
        }));
        if (reset) { allPosts = newPosts; selectedPostIds.clear(); } else allPosts.push(...newPosts);
        nextCursor = data.paging?.cursors?.after || null;
        renderPostsGrid();
        updateSelectedCount();
        showToast(`Đã tải ${newPosts.length} bài`, 'success');
    } catch (err) { showToast(err.message, 'error'); }
    finally { isLoadingPosts = false; }
}
function renderPostsGrid() {
    if (!allPosts.length) { postsGrid.innerHTML = '<div style="text-align:center; padding:40px;">📭 Chưa có bài viết</div>'; return; }
    postsGrid.innerHTML = allPosts.map(post => `
        <div class="post-card ${selectedPostIds.has(post.id) ? 'selected' : ''}" data-id="${post.id}">
            ${post.thumbnail ? `<img src="${post.thumbnail}" class="post-media" onerror="this.style.display='none'">` : ''}
            <div style="font-size:13px;">${escapeHtml(post.message.substring(0,200))}${post.message.length>200 ? '…' : ''}</div>
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

init();