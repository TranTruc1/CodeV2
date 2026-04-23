// danhsach.js

// Biến toàn cục
let selectedPages = new Set();
let rememberedLists = {};
let currentPageData = [];

// ========== STORAGE UTILS ==========
async function saveToChromeStorage(key, data) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: data }, () => resolve());
    });
}

async function loadFromChromeStorage(key, defaultValue = null) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            const value = result[key] !== undefined ? result[key] : defaultValue;
            resolve(value);
        });
    });
}

// ========== SAVE & LOAD DATA ==========
async function saveAllData() {
    await saveToChromeStorage('page_id', currentPageData);
    await saveToChromeStorage('remembered_lists', rememberedLists);
    await saveToChromeStorage('selected_pages', Array.from(selectedPages));
}

async function loadData() {
    try {
        const storedPages = await loadFromChromeStorage('page_id', []);
        currentPageData = storedPages;

        const storedLists = await loadFromChromeStorage('remembered_lists', {});
        rememberedLists = storedLists;

        const storedSelected = await loadFromChromeStorage('selected_pages', []);
        selectedPages.clear();
        storedSelected.forEach(id => selectedPages.add(id));

        createButtons();
        updateRememberedTags();
        updateRememberListUI();

        document.title = `Quản Lý Fanpage Facebook`;
    } catch (error) {
        showToast("Lỗi load dữ liệu!", "error");
    }
}

// ========== UTILS ==========
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✔' : type === 'error' ? '✖' : 'ℹ️';
    toast.innerHTML = `<span style="margin-right: 10px; font-size: 18px;">${icon}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

async function convertImageToBase64(url) {
    if (!url) return '';
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch (err) { return ''; }
}

function copyToClipboard(text, successMsg) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg, 'success');
    }).catch(() => {
        showToast('Không thể copy', 'error');
    });
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

function getRoleInfo(perms) {
    if (!perms || !Array.isArray(perms) || perms.length === 0) return { label: 'Biên tập', class: 'role-btv', priority: 1 };
    if (perms.includes('ADMINISTER')) return { label: 'Admin', class: 'role-admin', priority: 2 };
    return { label: 'Biên tập', class: 'role-btv', priority: 1 };
}

// ========== DATA PROCESSING ==========
function processRawData(item) {
    return {
        id: String(item.id || item.ID || ''),
        attribute: item.name || item.attribute || 'No Name',
        image: item.picture?.data?.url || item.image || '',
        img3: item.img3 || '',
        perms: item.perms || [],
        followers: item.followers_count || item.followers || 0,
        likes: item.fan_count || item.likes || 0,
        unread: item.unread_message_count || item.unread || 0,
        total_msg: item.conversations?.summary?.total_count || item.total_msg || 0,
        roles: item.roles?.data || item.roles || []
    };
}

async function fetchAllPages(jsonDataString) {
    let jsonData;
    try { jsonData = JSON.parse(jsonDataString); } catch (err) { return showToast('JSON không hợp lệ!', 'error'); }

    const rawList = jsonData.data ? jsonData.data : (Array.isArray(jsonData) ? jsonData : []);
    if (rawList.length === 0) return showToast('Không tìm thấy dữ liệu page!', 'error');

    const formattedData = rawList.map(item => processRawData(item));
    const promises = formattedData.map(async (item) => {
        if (!item.img3 && item.image) item.img3 = await convertImageToBase64(item.image);
    });
    await Promise.all(promises);

    currentPageData = formattedData;
    await saveAllData();
    createButtons();
    updateRememberedTags();
    showToast(`Đã lưu ${formattedData.length} page!`, 'success');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== AUTOCOMPLETE GỢI Ý TÊN ==========
function getAllUniqueUsers() {
    const userMap = new Map();
    currentPageData.forEach(page => {
        if (page.roles && Array.isArray(page.roles)) {
            page.roles.forEach(user => {
                if (user.name) {
                    if (!userMap.has(user.name)) {
                        userMap.set(user.name, { count: 0, id: user.id || null });
                    }
                    userMap.get(user.name).count++;
                }
            });
        }
    });
    return Array.from(userMap.entries()).sort((a, b) => b[1].count - a[1].count);
}

const searchInput = document.getElementById('searchInput');
const searchSuggestions = document.getElementById('searchSuggestions');
const searchByRoleCb = document.getElementById('searchByRoleCheckbox');

searchInput?.addEventListener('input', function () {
    const isRoleSearch = searchByRoleCb?.checked;
    if (!isRoleSearch) {
        searchSuggestions.style.display = 'none';
        createButtons();
        return;
    }

    const rawVal = this.value;
    const parts = rawVal.split(',');
    const currentPart = parts[parts.length - 1].trim().toLowerCase();

    if (currentPart.length === 0) {
        searchSuggestions.style.display = 'none';
        createButtons();
        return;
    }

    const allUsers = getAllUniqueUsers();
    const matchedUsers = allUsers.filter(([name]) => name.toLowerCase().includes(currentPart));

    if (matchedUsers.length === 0) {
        searchSuggestions.style.display = 'none';
        createButtons();
        return;
    }

    searchSuggestions.innerHTML = '';
    matchedUsers.forEach(([name, data]) => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `<span>${name}</span> <span style="font-size: 11px; color:#888;">${data.count} page</span>`;

        div.onclick = () => {
            parts[parts.length - 1] = ' ' + name;
            searchInput.value = parts.join(',').trim() + ', ';
            searchSuggestions.style.display = 'none';
            createButtons();
            searchInput.focus();
        };
        searchSuggestions.appendChild(div);
    });
    searchSuggestions.style.display = 'block';
});

document.addEventListener('click', (e) => {
    if (e.target !== searchInput && e.target !== searchSuggestions) {
        if (searchSuggestions) searchSuggestions.style.display = 'none';
    }
});

// ========== RENDER TABLE & TÌM KIẾM ĐA NHIỆM ==========
function createButtons() {
    const container = document.getElementById('buttonContainer');
    if (!container) return;

    container.innerHTML = '';

    const rawInput = document.getElementById('searchInput')?.value || '';
    const searchByRole = searchByRoleCb?.checked || false;

    let rawRoleKeywords = [];
    let pageKeywordLower = '';

    if (searchByRole) {
        const rawParts = rawInput.split(',');
        if (rawParts.length > 1) {
            pageKeywordLower = rawParts.pop().trim().toLowerCase();
            rawRoleKeywords = rawParts.map(s => s.trim()).filter(s => s.length > 0);
        } else {
            rawRoleKeywords = [rawParts[0].trim()].filter(s => s.length > 0);
        }
    } else {
        rawRoleKeywords = rawInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    const roleKeywordsLower = rawRoleKeywords.map(s => s.toLowerCase());
    let displayData = [...currentPageData];

    if (searchByRole) {
        if (pageKeywordLower) {
            displayData = displayData.filter(item => {
                const nameLower = item.attribute.toLowerCase();
                return nameLower.includes(pageKeywordLower) || item.id.includes(pageKeywordLower);
            });
        }

        if (roleKeywordsLower.length > 0) {
            displayData.forEach(item => {
                let isFullMatch = true;
                let missingNames = [];
                roleKeywordsLower.forEach((kw, idx) => {
                    const hasUser = item.roles && item.roles.some(user => user.name && user.name.toLowerCase() === kw);
                    if (!hasUser) {
                        isFullMatch = false;
                        missingNames.push(rawRoleKeywords[idx]);
                    }
                });
                item._isFullMatch = isFullMatch;
                item._missingNames = missingNames;
            });
        }
    } else {
        if (roleKeywordsLower.length > 0) {
            displayData = displayData.filter(item => {
                const nameLower = item.attribute.toLowerCase();
                return roleKeywordsLower.some(kw => nameLower.includes(kw) || item.id.includes(kw));
            });
        }
    }

    const sortType = document.getElementById('sortSelect')?.value || 'default';

    displayData.sort((a, b) => {
        if (searchByRole && roleKeywordsLower.length > 0) {
            if (a._isFullMatch !== b._isFullMatch) {
                return a._isFullMatch ? -1 : 1;
            }
        }
        if (sortType === 'likes_desc') return (b.likes || 0) - (a.likes || 0);
        if (sortType === 'likes_asc') return (a.likes || 0) - (b.likes || 0);
        if (sortType === 'role_admin') return getRoleInfo(b.perms).priority - getRoleInfo(a.perms).priority;
        return 0;
    });

    if (displayData.length === 0) {
        container.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px;">📭 Không có dữ liệu.</td></tr>';
        return;
    }

    displayData.forEach((item, index) => {
        const row = document.createElement('tr');

        if (searchByRole && roleKeywordsLower.length > 0) {
            row.style.backgroundColor = item._isFullMatch ? '#d4edda' : '#f8d7da';
            row.style.transition = 'background-color 0.3s ease';
        }

        const sttCell = document.createElement('td');
        sttCell.textContent = index + 1;
        row.appendChild(sttCell);

        const imgCell = document.createElement('td');
        const img = document.createElement('img');
        img.src = item.img3 || item.image || 'https://via.placeholder.com/50';
        img.onclick = (e) => { e.stopPropagation(); showPageInfo(item); };
        imgCell.appendChild(img);
        row.appendChild(imgCell);

        const role = getRoleInfo(item.perms);
        const nameCell = document.createElement('td');
        const likeText = item.likes ? `<span style="font-size:13px; color:#666; font-weight:normal;"> - ${Number(item.likes).toLocaleString()} likes</span>` : '';

        let missingNoteHtml = '';
        if (searchByRole && roleKeywordsLower.length > 0 && !item._isFullMatch) {
            missingNoteHtml = `<div style="color: #dc3545; font-size: 12px; margin-top: 6px; font-weight: bold;">⚠️ Thiếu: ${item._missingNames.join(', ')}</div>`;
        }

        nameCell.innerHTML = `
            <div style="display:flex; align-items:center;">
                <span class="role-badge ${role.class}">${role.label}</span>
                <span class="page-name-text">${escapeHtml(item.attribute)}</span>
            </div>
            <div style="margin-top:6px;">${likeText}</div>
            ${missingNoteHtml}
        `;
        nameCell.onclick = (e) => { e.stopPropagation(); showPageInfo(item); };
        row.appendChild(nameCell);

        const actionCell = document.createElement('td');

        const btnFb = document.createElement('button');
        btnFb.textContent = '📱 Mở Trang';
        btnFb.onclick = () => window.open(`https://www.facebook.com/${item.id}`, '_blank');
        actionCell.appendChild(btnFb);

        const btnChat = document.createElement('button');
        btnChat.textContent = '💬 Mở Chat';
        btnChat.onclick = () => window.open(`https://business.facebook.com/latest/inbox/all/?asset_id=${item.id}`, '_blank');
        actionCell.appendChild(btnChat);

        const btnCare = document.createElement('button');
        btnCare.textContent = '⭐ Mở Chăm';
        btnCare.onclick = () => window.open(`https://www.facebook.com/?id=${item.id}`, '_blank');
        actionCell.appendChild(btnCare);

        const btnEdit = document.createElement('button');
        btnEdit.textContent = '✏️ Sửa';
        btnEdit.style.backgroundColor = '#ffc107';
        btnEdit.style.color = '#333';
        btnEdit.onclick = () => openEditModal(item);
        actionCell.appendChild(btnEdit);

        if (sortType === 'default' && rawRoleKeywords.length === 0 && !pageKeywordLower && !searchByRole) {
            const sortBtn = document.createElement('button');
            sortBtn.textContent = '⋮⋮';
            sortBtn.className = 'sort-handle';
            actionCell.appendChild(sortBtn);
        }

        row.appendChild(actionCell);

        const checkCell = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = item.id;
        checkbox.checked = selectedPages.has(item.id);
        checkbox.onchange = async () => {
            checkbox.checked ? selectedPages.add(item.id) : selectedPages.delete(item.id);
            await saveToChromeStorage('selected_pages', Array.from(selectedPages));
            const selectAll = document.getElementById('selectAll');
            if (selectAll) {
                const allCheckboxes = document.querySelectorAll('#buttonContainer input[type="checkbox"]');
                selectAll.checked = allCheckboxes.length > 0 && Array.from(allCheckboxes).every(cb => cb.checked);
            }
        };
        checkCell.appendChild(checkbox);
        row.appendChild(checkCell);

        container.appendChild(row);
    });
}

document.getElementById('sortSelect')?.addEventListener('change', () => createButtons());
document.getElementById('searchByRoleCheckbox')?.addEventListener('change', () => createButtons());

// ========== MỞ TAB FB TỪ BẢNG TỔNG HỢP & CHỌN NHIỀU NGƯỜI ==========
function renderAllUsersModal() {
    const users = getAllUniqueUsers();
    const listContainer = document.getElementById('allUsersList');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    let tempSelectedUsers = new Set();

    if (users.length === 0) {
        listContainer.innerHTML = '<i style="color: #888;">Chưa có dữ liệu thành viên. Hãy lấy lại Data.</i>';
    } else {
        users.forEach(([name, data]) => {
            const count = data.count;
            const userId = data.id;

            const userTag = document.createElement('div');
            userTag.innerHTML = `<b>${name}</b> <span style="font-size: 11px; background: #e9ecef; padding: 2px 6px; border-radius: 10px; margin-left: 5px; color: #333;">${count}</span>`;
            userTag.style.cssText = 'background: #fff; border: 1px solid #ced4da; padding: 6px 12px; border-radius: 20px; font-size: 13px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; color: #333; user-select: none;';

            userTag.onmouseenter = () => { if (!tempSelectedUsers.has(name)) userTag.style.borderColor = '#1877f2'; };
            userTag.onmouseleave = () => { if (!tempSelectedUsers.has(name)) userTag.style.borderColor = '#ced4da'; };

            userTag.onclick = () => {
                const isProfileOpen = document.getElementById('openProfileCheckbox')?.checked;

                if (isProfileOpen) {
                    if (userId) { window.open(`https://www.facebook.com/${userId}`, '_blank'); }
                    else { showToast('Facebook không cấp ID công khai cho người này!', 'error'); }
                } else {
                    if (tempSelectedUsers.has(name)) {
                        tempSelectedUsers.delete(name);
                        userTag.style.background = '#fff';
                        userTag.style.color = '#333';
                        userTag.style.borderColor = '#ced4da';
                    } else {
                        tempSelectedUsers.add(name);
                        userTag.style.background = '#e7f3ff';
                        userTag.style.color = '#007bff';
                        userTag.style.borderColor = '#007bff';
                    }
                }
            };

            listContainer.appendChild(userTag);
        });
    }

    document.getElementById('allUsersModal').style.display = 'flex';

    const searchBtn = document.getElementById('searchSelectedUsersBtn');
    if (searchBtn) {
        const newSearchBtn = searchBtn.cloneNode(true);
        searchBtn.parentNode.replaceChild(newSearchBtn, searchBtn);

        newSearchBtn.addEventListener('click', () => {
            if (tempSelectedUsers.size === 0) {
                showToast('Vui lòng click chọn ít nhất 1 người!', 'error');
                return;
            }
            if (searchInput) searchInput.value = Array.from(tempSelectedUsers).join(', ') + ', ';
            if (searchByRoleCb) searchByRoleCb.checked = true;
            createButtons();
            closeModal('allUsersModal');
            showToast(`Đang lọc các page của ${tempSelectedUsers.size} người`, 'info');
        });
    }
}

document.getElementById('showAllUsersBtn')?.addEventListener('click', renderAllUsersModal);
document.getElementById('closeAllUsersModalBtn')?.addEventListener('click', () => closeModal('allUsersModal'));

// ========== INFO MODAL ==========
function showPageInfo(item) {
    document.getElementById('infoImg').src = item.img3 || item.image || '';
    document.getElementById('infoName').textContent = item.attribute;
    document.getElementById('infoId').textContent = 'ID: ' + item.id;

    const role = getRoleInfo(item.perms);
    document.getElementById('infoRoleText').textContent = `Quyền của bạn: ${role.label}`;
    document.getElementById('infoRoleText').style.color = role.priority >= 2 ? '#dc3545' : '#28a745';

    const permsText = item.perms && item.perms.length ? item.perms.join(', ') : 'Không có dữ liệu';

    let rolesHtml = '<div style="margin-top:15px; border-top:1px dashed #ccc; padding-top:10px;">';
    rolesHtml += '<strong style="color:#1877f2;">👥 Danh sách thành viên:</strong>';

    if (item.roles && item.roles.length > 0) {
        rolesHtml += '<ul style="padding-left: 20px; margin-top: 8px; font-size: 13px;">';
        item.roles.forEach(r => {
            const roleName = r.role || (r.tasks ? r.tasks.join(', ') : 'Không rõ');
            rolesHtml += `<li style="margin-bottom: 5px;"><b>${r.name}</b> <span style="color:#666; font-size: 11px;">(${roleName})</span></li>`;
        });
        rolesHtml += '</ul></div>';
    } else {
        rolesHtml += '<div style="font-size: 12px; color: #888; margin-top: 5px;"><i>Chưa lấy được dữ liệu thành viên. Hãy lấy lại Data bằng link mới!</i></div></div>';
    }

    document.getElementById('infoPermsDetail').innerHTML = `<strong>Perms:</strong> ${permsText} <br> ${rolesHtml}`;

    const fmt = (n) => Number(n).toLocaleString('vi-VN');
    document.getElementById('infoFollows').textContent = fmt(item.followers);
    document.getElementById('infoLikes').textContent = fmt(item.likes);
    document.getElementById('infoUnread').textContent = fmt(item.unread);
    document.getElementById('infoTotalMsg').textContent = fmt(item.total_msg);
    document.getElementById('infoModal').style.display = 'flex';
}

document.getElementById('closeInfoModalBtn')?.addEventListener('click', () => closeModal('infoModal'));

// ========== DELETE SELECTED ==========
document.getElementById('deleteSelectedBtn')?.addEventListener('click', async () => {
    if (selectedPages.size === 0) return showToast('Chưa chọn page nào để xóa!', 'error');
    if (!confirm(`CẢNH BÁO: Bạn có chắc muốn xóa ${selectedPages.size} page đã chọn không?`)) return;

    currentPageData = currentPageData.filter(item => !selectedPages.has(item.id));
    for (let k in rememberedLists) {
        rememberedLists[k] = rememberedLists[k].filter(id => !selectedPages.has(id));
    }

    await saveAllData();
    selectedPages.clear();
    const selectAll = document.getElementById('selectAll');
    if (selectAll) selectAll.checked = false;

    createButtons();
    updateRememberedTags();
    updateRememberListUI();
    showToast(`Đã xóa các page được chọn!`, 'success');
});

// ========== OTHER ACTIONS ==========
document.getElementById('saveTokenBtn')?.addEventListener('click', () => {
    const val = document.getElementById('tokenInput').value;
    if (val) fetchAllPages(val);
});
document.getElementById('addPageBtn')?.addEventListener('click', () => {
    document.getElementById('modalPageId').value = '';
    document.getElementById('modalPageName').value = '';
    document.getElementById('modalPageImage').value = '';
    document.getElementById('addPageModal').style.display = 'flex';
});
document.getElementById('addByJsBtn')?.addEventListener('click', () => {
    document.getElementById('addByJsModal').style.display = 'flex';
    document.getElementById('jsInput').value = '';
    renderAddByJsRememberLists();
});
document.getElementById('confirmAddByJsBtn')?.addEventListener('click', async () => {
    const raw = document.getElementById('jsInput').value.trim();
    if (!raw) return;
    let parsed = [];
    try { const temp = JSON.parse(raw); parsed = temp.data ? temp.data : temp; } catch (e) { return showToast('Lỗi JSON', 'error'); }
    if (!Array.isArray(parsed)) return showToast('Sai định dạng', 'error');

    let newPages = parsed.map(item => processRawData(item)).filter(p => p.id);
    await Promise.all(newPages.map(async (p) => { if (!p.img3 && p.image) p.img3 = await convertImageToBase64(p.image); }));

    const clearAll = document.getElementById('clearAllBeforeAdd').checked;
    let currentData = clearAll ? [] : [...currentPageData];
    const map = new Map();
    currentData.forEach(p => map.set(p.id, p));
    newPages.forEach(p => map.set(p.id, p));

    currentPageData = Array.from(map.values());

    const checkedLists = document.querySelectorAll('#addByJsRememberLists input:checked');
    checkedLists.forEach(cb => {
        const listName = cb.value;
        if (!rememberedLists[listName]) rememberedLists[listName] = [];
        newPages.forEach(p => { if (!rememberedLists[listName].includes(p.id)) rememberedLists[listName].push(p.id); });
    });

    await saveAllData();
    createButtons();
    updateRememberedTags();
    updateRememberListUI();
    closeModal('addByJsModal');
    showToast(`Thêm thành công ${newPages.length} page!`, 'success');
});

// ========== ADD/EDIT PAGE MODAL ==========
async function saveNewPage() {
    const id = document.getElementById('modalPageId').value.trim();
    const name = document.getElementById('modalPageName').value.trim();
    const img = document.getElementById('modalPageImage').value.trim();
    if (!id || !name) return showToast('Thiếu ID/Tên', 'error');
    const newItem = processRawData({ id, name, image: img });
    newItem.img3 = await convertImageToBase64(img);
    currentPageData.push(newItem);
    await saveAllData();
    createButtons();
    closeModal('addPageModal');
    showToast('Đã thêm page!', 'success');
}
document.getElementById('saveNewPageBtn')?.addEventListener('click', saveNewPage);
document.getElementById('closeAddPageModalBtn')?.addEventListener('click', () => closeModal('addPageModal'));

let editId = null;
function openEditModal(item) {
    editId = item.id;
    document.getElementById('editPageId').value = item.id;
    document.getElementById('editPageName').value = item.attribute;
    document.getElementById('editPageImage').value = item.image || '';
    document.getElementById('editPageModal').style.display = 'flex';
}
async function saveEditedPage() {
    const id = document.getElementById('editPageId').value.trim();
    const name = document.getElementById('editPageName').value.trim();
    const img = document.getElementById('editPageImage').value.trim();

    const idx = currentPageData.findIndex(p => p.id === editId);
    if (idx === -1) return;

    const oldItem = currentPageData[idx];
    const newItem = { ...oldItem, id: id, attribute: name, image: img };
    if (img !== oldItem.image) newItem.img3 = await convertImageToBase64(img);

    if (oldItem.id !== id) {
        if (selectedPages.has(oldItem.id)) {
            selectedPages.delete(oldItem.id);
            selectedPages.add(id);
        }
        for (let k in rememberedLists) {
            const i = rememberedLists[k].indexOf(oldItem.id);
            if (i !== -1) rememberedLists[k][i] = id;
        }
    }
    currentPageData[idx] = newItem;
    await saveAllData();
    createButtons();
    updateRememberedTags();
    updateRememberListUI();
    closeModal('editPageModal');
    showToast('Sửa xong', 'success');
}
document.getElementById('saveEditedPageBtn')?.addEventListener('click', saveEditedPage);
document.getElementById('closeEditPageModalBtn')?.addEventListener('click', () => closeModal('editPageModal'));

// ========== CHECKBOX SELECT ALL ==========
function toggleSelectAll() {
    const checked = document.getElementById('selectAll').checked;
    const checkboxes = document.querySelectorAll('#buttonContainer input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked) { selectedPages.add(cb.value); } else { selectedPages.delete(cb.value); }
    });
    saveToChromeStorage('selected_pages', Array.from(selectedPages));
}
document.getElementById('selectAll')?.addEventListener('change', toggleSelectAll);

// ========== COPY & OPEN LIST ==========
document.getElementById('copyJsonBtn')?.addEventListener('click', () => {
    if (selectedPages.size === 0) return showToast('Chưa chọn page', 'error');
    copyToClipboard(JSON.stringify(currentPageData.filter(p => selectedPages.has(p.id)), null, 2), 'Đã copy JSON');
});
document.getElementById('openAllFacebookBtn')?.addEventListener('click', () => {
    if (selectedPages.size === 0) return showToast('Chưa chọn page', 'error');
    selectedPages.forEach(id => window.open(`https://www.facebook.com/${id}`, '_blank'));
});
document.getElementById('openAllChatBtn')?.addEventListener('click', () => {
    if (selectedPages.size === 0) return showToast('Chưa chọn page', 'error');
    selectedPages.forEach(id => window.open(`https://business.facebook.com/latest/inbox/all/?asset_id=${id}`, '_blank'));
});
document.getElementById('openAllCareBtn')?.addEventListener('click', () => {
    if (selectedPages.size === 0) return showToast('Chưa chọn page', 'error');
    selectedPages.forEach(id => window.open(`https://www.facebook.com/?id=${id}`, '_blank'));
});
document.getElementById('copyPagesBtn')?.addEventListener('click', () => {
    if (selectedPages.size === 0) return showToast('Chưa chọn page', 'error');
    const list = currentPageData.filter(p => selectedPages.has(p.id)).map((p, i) => `${i + 1}. ${p.attribute} - https://fb.com/${p.id}`).join('\n');
    copyToClipboard(list, 'Đã copy list tên');
});
document.getElementById('copyMessBtn')?.addEventListener('click', () => {
    if (selectedPages.size === 0) return showToast('Chưa chọn page', 'error');
    const list = Array.from(selectedPages).map(id => `https://business.facebook.com/latest/inbox/all?asset_id=${id}`).join('\n');
    copyToClipboard(list, 'Đã copy link inbox');
});

// ========== REMEMBERED LISTS ==========
document.getElementById('rememberBtn')?.addEventListener('click', () => {
    if (selectedPages.size === 0) return showToast('Chưa chọn page', 'error');
    document.getElementById('rememberModal').style.display = 'flex';
    updateRememberListUI();
});
async function saveRememberedList() {
    const name = document.getElementById('rememberName').value.trim();
    if (!name) return showToast('Vui lòng nhập tên danh sách!', 'error');
    if (rememberedLists[name]) return showToast('Tên danh sách đã tồn tại!', 'error');

    rememberedLists[name] = Array.from(selectedPages);
    await saveToChromeStorage('remembered_lists', rememberedLists);
    closeModal('rememberModal');
    updateRememberedTags();
    updateRememberListUI();
    showToast(`Đã lưu danh sách "${name}"!`, 'success');
}
document.getElementById('saveRememberedListBtn')?.addEventListener('click', saveRememberedList);
document.getElementById('closeRememberModalBtn')?.addEventListener('click', () => closeModal('rememberModal'));

async function deleteRememberedList(name) {
    if (confirm(`Xóa danh sách "${name}"?`)) {
        delete rememberedLists[name];
        await saveToChromeStorage('remembered_lists', rememberedLists);
        updateRememberedTags();
        updateRememberListUI();
        showToast(`Đã xóa danh sách "${name}"!`, 'success');
    }
}
function loadRememberedList(name) {
    selectedPages = new Set(rememberedLists[name] || []);
    saveToChromeStorage('selected_pages', Array.from(selectedPages));
    createButtons();
    closeModal('rememberModal');
    showToast(`Đã tải danh sách: ${name}`, 'success');
}

function updateRememberListUI() {
    const ul = document.getElementById('rememberedLists');
    if (!ul) return;
    ul.innerHTML = '';
    for (let name in rememberedLists) {
        const li = document.createElement('li');
        li.style.cssText = 'display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;';
        const nameSpan = document.createElement('span');
        nameSpan.style.cssText = 'cursor: pointer; color: #007bff; font-weight: 500;';
        nameSpan.textContent = `${name} (${rememberedLists[name].length})`;
        nameSpan.onclick = () => loadRememberedList(name);
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Xóa';
        deleteBtn.className = 'delete';
        deleteBtn.style.cssText = 'padding: 5px 10px; font-size: 12px; height: auto;';
        deleteBtn.onclick = () => deleteRememberedList(name);
        li.appendChild(nameSpan);
        li.appendChild(deleteBtn);
        ul.appendChild(li);
    }
}
function updateRememberedTags() {
    const div = document.getElementById('rememberedTags');
    if (!div) return;
    div.innerHTML = '';
    for (let name in rememberedLists) {
        const tag = document.createElement('div');
        tag.className = 'remembered-tag';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        nameSpan.onclick = () => loadRememberedList(name);
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '×';
        deleteBtn.className = 'delete-tag';
        deleteBtn.onclick = () => deleteRememberedList(name);
        tag.appendChild(nameSpan);
        tag.appendChild(deleteBtn);
        div.appendChild(tag);
    }
    renderAddByJsRememberLists();
}
function renderAddByJsRememberLists() {
    const div = document.getElementById('addByJsRememberLists');
    if (!div) return;
    div.innerHTML = '';
    if (Object.keys(rememberedLists).length === 0) {
        div.innerHTML = '<i style="color:#888;">Chưa có nhóm nào.</i>';
        return;
    }
    for (let name in rememberedLists) {
        const label = document.createElement('label');
        label.style.cssText = 'display: block; margin-bottom: 5px; cursor: pointer;';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = name;
        cb.style.cssText = 'width: auto; margin-right: 8px;';
        label.appendChild(cb);
        label.appendChild(document.createTextNode(` ${name}`));
        div.appendChild(label);
    }
}
document.getElementById('closeAddByJsModalBtn')?.addEventListener('click', () => closeModal('addByJsModal'));

// ========== SORTABLE ==========
if (document.getElementById('buttonContainer')) {
    new Sortable(document.getElementById('buttonContainer'), {
        handle: '.sort-handle',
        animation: 150,
        onEnd: async () => {
            const sortType = document.getElementById('sortSelect').value;
            if (sortType !== 'default') return;
            const rows = document.querySelectorAll('#buttonContainer tr');
            const newOrderIds = Array.from(rows).map(row => {
                const cb = row.querySelector('input[type="checkbox"]');
                return cb ? cb.value : null;
            }).filter(id => id);

            currentPageData = newOrderIds.map(id => currentPageData.find(item => item.id === id)).filter(x => x);
            await saveToChromeStorage('page_id', currentPageData);
            showToast('Đã lưu thứ tự mới!', 'success');
        }
    });
}

// ========== TAB UTILS ==========
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function findTabByUrl(url) {
    return new Promise((resolve) => {
        chrome.tabs.query({ url: url }, (tabs) => {
            resolve(tabs.length ? tabs[0] : null);
        });
    });
}

async function createTab(url) {
    return new Promise((resolve) => {
        chrome.tabs.create({ url: url, active: true }, (tab) => resolve(tab));
    });
}

// ========== OVERLAY INJECT VÀO TAB FB BUSINESS ==========
// Dùng chrome.scripting.executeScript để inject thẳng vào tab, không cần content script riêng

async function tabShowOverlay(tabId, message = 'Đang lấy Token...') {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            func: (msg) => {
                // Nếu đã có thì chỉ cập nhật text
                const existing = document.getElementById('__ext_token_overlay__');
                if (existing) {
                    const title = existing.querySelector('#__ext_ol_title__');
                    if (title) title.textContent = msg;
                    return;
                }

                // Tạo style
                const style = document.createElement('style');
                style.id = '__ext_overlay_style__';
                style.textContent = `
                    #__ext_token_overlay__ {
                        position: fixed;
                        inset: 0;
                        z-index: 2147483647;
                        background: rgba(0,0,0,0.6);
                        backdrop-filter: blur(4px);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        animation: __ext_fi__ 0.25s ease;
                    }
                    @keyframes __ext_fi__ { from{opacity:0} to{opacity:1} }
                    @keyframes __ext_fo__ { from{opacity:1} to{opacity:0} }
                    @keyframes __ext_spin__ { to{transform:rotate(360deg)} }
                    #__ext_ol_box__ {
                        background: #fff;
                        border-radius: 18px;
                        padding: 40px 56px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 16px;
                        box-shadow: 0 12px 48px rgba(0,0,0,0.3);
                        min-width: 280px;
                        text-align: center;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    }
                    #__ext_ol_spinner__ {
                        width: 56px;
                        height: 56px;
                        border: 5px solid #e4e6eb;
                        border-top-color: #1877f2;
                        border-radius: 50%;
                        animation: __ext_spin__ 0.8s linear infinite;
                    }
                    #__ext_ol_tick__ {
                        display: none;
                        font-size: 52px;
                        line-height: 1;
                    }
                    #__ext_ol_title__ {
                        font-size: 17px;
                        font-weight: 700;
                        color: #1c1e21;
                        margin: 0;
                    }
                    #__ext_ol_sub__ {
                        font-size: 13px;
                        color: #65676b;
                        margin: 0;
                        line-height: 1.5;
                    }
                `;
                document.head.appendChild(style);

                // Tạo overlay
                const overlay = document.createElement('div');
                overlay.id = '__ext_token_overlay__';
                overlay.innerHTML = `
                    <div id="__ext_ol_box__">
                        <div id="__ext_ol_spinner__"></div>
                        <div id="__ext_ol_tick__">✅</div>
                        <p id="__ext_ol_title__">${msg}</p>
                        <p id="__ext_ol_sub__">Vui lòng không đóng tab này.<br>Extension đang xác thực tự động.</p>
                    </div>
                `;
                document.body.appendChild(overlay);
            },
            args: [message]
        });
    } catch (e) {
        // Tab chưa sẵn sàng hoặc không inject được, bỏ qua
    }
}

async function tabHideOverlay(tabId, { success = true, doneMsg = '' } = {}) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            func: (isSuccess, msg) => {
                const overlay = document.getElementById('__ext_token_overlay__');
                if (!overlay) return;

                if (isSuccess) {
                    // Đổi spinner → tick, cập nhật text rồi fade out
                    const spinner = document.getElementById('__ext_ol_spinner__');
                    const tick    = document.getElementById('__ext_ol_tick__');
                    const title   = document.getElementById('__ext_ol_title__');
                    const sub     = document.getElementById('__ext_ol_sub__');

                    if (spinner) spinner.style.display = 'none';
                    if (tick)    tick.style.display    = 'block';
                    if (title)   title.textContent     = msg || 'Lấy token thành công!';
                    if (sub)     sub.textContent       = 'Đang tải danh sách page...';

                    setTimeout(() => {
                        overlay.style.animation = '__ext_fo__ 0.4s ease forwards';
                        setTimeout(() => {
                            overlay.remove();
                            document.getElementById('__ext_overlay_style__')?.remove();
                        }, 400);
                    }, 1000);
                } else {
                    // Ẩn ngay
                    overlay.style.animation = '__ext_fo__ 0.3s ease forwards';
                    setTimeout(() => {
                        overlay.remove();
                        document.getElementById('__ext_overlay_style__')?.remove();
                    }, 300);
                }
            },
            args: [success, doneMsg]
        });
    } catch (e) {
        // Bỏ qua nếu tab đã đóng
    }
}

// ========== LOADING MODAL (trong popup) ==========
let reloadCancelled = false;
let loadingModal = null;
let loadingStatus = null;

function showLoadingModal(message = "Đang chuẩn bị...") {
    loadingModal = document.getElementById('loadingModal');
    loadingStatus = document.getElementById('loadingStatus');
    if (loadingModal) {
        loadingModal.style.display = 'flex';
        if (loadingStatus) loadingStatus.innerText = message;
    }
    const cancelBtn = document.getElementById('cancelReloadBtn');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            reloadCancelled = true;
            closeModal('loadingModal');
            showToast("Đã hủy lấy dữ liệu.", "info");
        };
    }
}

function updateLoadingStatus(message) {
    if (loadingStatus) loadingStatus.innerText = message;
}

function hideLoadingModal() {
    if (loadingModal) closeModal('loadingModal');
    reloadCancelled = false;
}

async function ensureTabAtRequiredUrl(tabId, requiredUrl) {
    const tab = await new Promise((resolve) => {
        chrome.tabs.get(tabId, (tab) => resolve(tab));
    });
    if (!tab) return null;
    if (tab.url !== requiredUrl) {
        updateLoadingStatus(`Tab đang ở trang khác, tự động chuyển hướng...`);
        await chrome.tabs.update(tabId, { url: requiredUrl, active: true });
        await sleep(3000);
    }
    return tab;
}

// ========== RELOAD DATA TỰ ĐỘNG ==========
async function reloadDataFromFB() {
    if (reloadCancelled) return;
    showLoadingModal("Đang chuẩn bị lấy token...");

    const requiredUrl = "https://business.facebook.com/billing_hub/payment_settings/?asset_id=224996445973815&payment_account_id=224996445973815&placement=ads_manager";

    // 1. Tìm hoặc mở tab
    let tab = await findTabByUrl(requiredUrl);
    if (!tab) {
        updateLoadingStatus("Chưa có tab Facebook Business, đang mở...");
        tab = await createTab(requiredUrl);
        await sleep(3000);
    } else {
        await chrome.tabs.update(tab.id, { active: true });
        await sleep(1000);
    }

    // 2. Hiện overlay lên tab FB Business
    await tabShowOverlay(tab.id, 'Đang lấy Token...');

    // 3. Thử lấy token nhiều lần
    let tokenResult = null;
    let attempts = 0;
    const maxAttempts = 12;

    while (attempts < maxAttempts && !reloadCancelled) {
        const currentTab = await ensureTabAtRequiredUrl(tab.id, requiredUrl);
        if (!currentTab) {
            updateLoadingStatus("Mất kết nối tab, đang thử lại...");
            tab = await createTab(requiredUrl);
            await sleep(2000);
            // Hiện lại overlay sau khi mở tab mới
            await tabShowOverlay(tab.id, 'Đang lấy Token...');
            attempts++;
            continue;
        }

        const statusMsg = `Đang lấy danh sách page...`;
        updateLoadingStatus(statusMsg);
        await tabShowOverlay(tab.id, statusMsg);

        tokenResult = await fetchAccessToken(); // từ token.js
        if (tokenResult.success && tokenResult.token) break;

        attempts++;
        await sleep(2000);

        if (attempts === 6) {
            const reloadMsg = 'Lâu quá, đang reload lại tab...';
            updateLoadingStatus(reloadMsg);
            await tabShowOverlay(tab.id, reloadMsg);
            await chrome.tabs.reload(tab.id);
            await sleep(4000);
            await tabShowOverlay(tab.id, 'Đang thử lại sau reload...');
        }
    }

    // Người dùng hủy
    if (reloadCancelled) {
        await tabHideOverlay(tab.id, { success: false });
        hideLoadingModal();
        return;
    }

    // Lấy token thất bại
    if (!tokenResult || !tokenResult.success || !tokenResult.token) {
        await tabHideOverlay(tab.id, { success: false });
        hideLoadingModal();
        showToast("Không thể lấy token sau nhiều lần thử. Vui lòng kiểm tra đăng nhập Facebook Business và thử lại.", "error");
        return;
    }

    const token = tokenResult.token;
    updateLoadingStatus("Đã lấy token, đang tải danh sách page...");

    // 4. Gọi API Graph
    try {
        const apiUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,picture,perms,access_token,followers_count,fan_count,unread_message_count,roles{id,name,tasks,role}&limit=10000&access_token=${token}`;
        const response = await fetch(apiUrl);
        const json = await response.json();
        if (json.error) throw new Error(json.error.message);

        const rawList = json.data || [];
        if (rawList.length === 0) {
            await tabHideOverlay(tab.id, { success: false });
            hideLoadingModal();
            showToast("Không tìm thấy page nào! Hãy đảm bảo token có quyền truy cập pages.", "error");
            return;
        }

        const formattedData = rawList.map(item => processRawData(item));
        for (let item of formattedData) {
            if (!item.img3 && item.image) item.img3 = await convertImageToBase64(item.image);
        }

        currentPageData = formattedData;
        await saveAllData();
        createButtons();
        updateRememberedTags();

        // Ẩn overlay với tick thành công
        await tabHideOverlay(tab.id, {
            success: true,
            doneMsg: `✅ Lấy thành công ${formattedData.length} page!`
        });

        hideLoadingModal();
        showToast(`Đã tải thành công ${formattedData.length} page!`, "success");

    } catch (err) {
        await tabHideOverlay(tab.id, { success: false });
        hideLoadingModal();
        showToast("Lỗi khi gọi API: " + err.message, "error");
    }
}

document.getElementById('reloadDataBtn')?.addEventListener('click', reloadDataFromFB);

// ========== INIT PAGE ==========
async function initPage() {
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }
    await loadData();
    if (currentPageData.length === 0) {
        showToast("Chào mừng! Nhấn '🔄 Lấy lại danh sách' để lấy danh sách page từ Facebook.", "info");
    }
}

initPage();