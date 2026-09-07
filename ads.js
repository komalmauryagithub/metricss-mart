let adsUser = null;

(function initAdsUser() {
    try {
        const u = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (u) adsUser = u;
    } catch(e) {}
})();

window.currentActiveAdsProject = null;
window.currentActiveAdsProjectObj = null;

// -------- loadAssignedAdsProjects --------
window.loadAssignedAdsProjects = async function() {
    const containers = {
        assigned: document.getElementById('assignedAdsContainer') || document.getElementById('assignedContainer'),
        ongoing: document.getElementById('ongoingAdsContainer') || document.getElementById('ongoingContainer'),
        completed: document.getElementById('completedAdsContainer') || document.getElementById('completedContainer')
    };

    try {
        const userStr = localStorage.getItem('currentUser');
        if (!userStr) return;
        const user = JSON.parse(userStr);
        adsUser = user;
        const userId = user.id || user.userId || user.emp_id || user.employee_id || user.user_id;
        if (!userId) return;

        const res = await fetch('/api/employee-ads-assignments/' + userId);
        const data = await res.json();
        if (!data.success) return;

        const projects = data.data || [];

        const assigned = projects.filter(p => {
            const s = (p.status || '').toLowerCase();
            return s === 'active' || s === 'assigned';
        });
        const ongoing = projects.filter(p => (p.status || '').toLowerCase() === 'active');
        const completed = projects.filter(p => {
            const s = (p.status || '').toLowerCase();
            return s === 'completed' || s === 'stopped';
        });

        // Update Ads counter badges if present
        if (document.getElementById('adsAssignedCount')) document.getElementById('adsAssignedCount').textContent = assigned.length;
        if (document.getElementById('adsOngoingCount')) document.getElementById('adsOngoingCount').textContent = ongoing.length;
        if (document.getElementById('adsCompletedCount')) document.getElementById('adsCompletedCount').textContent = completed.length;

        // Render Cards into dedicated containers or append with visual separation
        renderAdsCards(assigned, document.getElementById('assignedAdsContainer'), document.getElementById('assignedContainer'), 'Ads Projects');
        renderAdsCards(ongoing, document.getElementById('ongoingAdsContainer'), document.getElementById('ongoingContainer'), 'Ads Projects');
        renderAdsCards(completed, document.getElementById('completedAdsContainer'), document.getElementById('completedContainer'), 'Ads Projects');

    } catch(err) {
        console.error('loadAssignedAdsProjects error:', err);
    }
};

function renderAdsCards(list, dedicatedContainer, fallbackContainer, sectionTitle) {
    if (dedicatedContainer) {
        if (list.length === 0) {
            dedicatedContainer.innerHTML = '<p style="color:#888; font-size:13px;">No Ads projects assigned.</p>';
        } else {
            dedicatedContainer.innerHTML = list.map(proj => renderAdsProjectCard(proj)).join('');
        }
        return;
    }

    if (fallbackContainer && list.length > 0) {
        let adsSection = fallbackContainer.querySelector('.ads-projects-section');
        if (!adsSection) {
            adsSection = document.createElement('div');
            adsSection.className = 'ads-projects-section';
            adsSection.style.cssText = 'width:100%; margin-top:20px; border-top:2px dashed #cbd5e1; padding-top:15px;';
            adsSection.innerHTML = `<h4 style="color:#f97316; font-size:15px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:8px;"><i class="fas fa-bullhorn"></i> ${sectionTitle}</h4><div class="ads-cards-wrapper" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:15px;"></div>`;
            fallbackContainer.appendChild(adsSection);
        }
        const wrapper = adsSection.querySelector('.ads-cards-wrapper');
        if (wrapper) {
            wrapper.innerHTML = list.map(proj => renderAdsProjectCard(proj)).join('');
        }
    }
}

// -------- renderAdsProjectCard --------
function renderAdsProjectCard(proj) {
    const priorityColors = {
        'Urgent': { bg: '#fff5ed', border: '#f97316' },
        'High': { bg: '#faf5ff', border: '#a855f7' },
        'Medium': { bg: '#f0f9ff', border: '#0284c7' },
        'Low': { bg: '#f5f5f5', border: '#94a3b8' }
    };
    const pStyle = priorityColors[proj.priority] || priorityColors['Medium'];
    const statusLower = (proj.status || '').toLowerCase();
    const canWork = (statusLower === 'active' || statusLower === 'assigned');
    const canReactivate = (statusLower === 'completed' || statusLower === 'stopped');

    const safeName = (proj.project_name || '').replace(/'/g, "\\'");
    const safeClient = (proj.client_name || '').replace(/'/g, "\\'");
    const coAssigneesStr = (proj.co_assignees || '').trim();
    const safeCoAssignees = coAssigneesStr.replace(/'/g, "\\'");

    const coAssigneesHtml = coAssigneesStr
        ? `<p style="margin:4px 0; color:#0f172a; font-size:12.5px;"><strong>Also Assigned To:</strong> <span style="color:#c026d3; font-weight:700;">${escapeHtml(coAssigneesStr)}</span></p>`
        : `<p style="margin:4px 0; color:#64748b; font-size:12px;"><strong>Also Assigned To:</strong> <span style="font-style:italic; color:#94a3b8;">Only You (Solo)</span></p>`;

    return `
        <div class="project-card ads-project-card" style="background:${pStyle.bg}; border-left: 4px solid ${pStyle.border}; border-radius:10px; padding:18px; position:relative; box-shadow:0 2px 8px rgba(0,0,0,0.07); border-top:1px solid #f1f5f9; border-right:1px solid #f1f5f9; border-bottom:1px solid #f1f5f9;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <h3 style="margin:0; font-size:17px; color:#1e293b; font-weight:700;">${escapeHtml(proj.project_name || 'Untitled Ads Project')}</h3>
                <span style="background:linear-gradient(135deg, #f97316, #a855f7); color:white; font-size:11px; font-weight:bold; padding:3px 10px; border-radius:20px; display:inline-flex; align-items:center; gap:4px;">
                    <i class="fas fa-bullhorn" style="font-size:10px;"></i> Ads Project
                </span>
            </div>
            <p style="margin:4px 0; color:#475569; font-size:13px;"><strong>Client:</strong> ${escapeHtml(proj.client_name || 'N/A')}</p>
            ${coAssigneesHtml}
            <p style="margin:4px 0; color:#475569; font-size:13px;"><strong>Status:</strong> <span style="font-weight:600; color:${statusLower==='active'?'#16a34a':'#dc2626'};">${escapeHtml(proj.status || 'N/A')}</span> &nbsp;|&nbsp; <strong>Priority:</strong> ${escapeHtml(proj.priority || 'Medium')}</p>
            <p style="margin:4px 0; color:#475569; font-size:13px;"><strong>Start Date:</strong> ${proj.start_date ? new Date(proj.start_date).toLocaleDateString() : 'N/A'}</p>
            <div style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap;">
                ${canWork ? `<button class="btn" style="background:linear-gradient(135deg, #ea580c, #c026d3); color:white; border:none; padding:7px 14px; border-radius:6px; font-weight:600; font-size:12.5px; cursor:pointer; display:inline-flex; align-items:center; gap:5px;" onclick="openAdsWork('${proj.id}', '${safeName}', '${proj.status}', '${safeClient}', '${proj.start_date||''}', '${safeCoAssignees}')"><i class="fas fa-external-link-alt"></i> Open Ads Workspace</button>` : ''}
                ${canReactivate ? `<button class="btn gray" onclick="reactivateAdsAction('${proj.id}')">Reactivate</button>` : ''}
            </div>
        </div>
    `;
}

// -------- openAdsWork --------
window.openAdsWork = async function(assignmentId, projectName, status, clientName, startDate, coAssignees) {
    try {
        window.currentActiveAdsProject = assignmentId;
        window.currentActiveAdsProjectObj = { id: assignmentId, assignmentId, projectName, status, clientName, startDate, coAssignees };

        // Switch to Ads workspace section
        if (typeof showSection === 'function') {
            showSection('ads-workspace');
        } else {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            const ws = document.getElementById('ads-workspace');
            if (ws) ws.classList.add('active');
        }

        const wsEl = document.getElementById('ads-workspace');
        if (wsEl) {
            document.querySelectorAll('.section').forEach(s => {
                s.classList.remove('active');
                s.style.display = 'none';
            });
            wsEl.classList.add('active');
            wsEl.style.display = 'block';
        }

        const stopBtn = document.getElementById('adsWorkspaceStopBtn');
        const reactBtn = document.getElementById('adsWorkspaceReactivateBtn');
        const stLower = (status || '').toLowerCase();

        if (stLower === 'active' || stLower === 'assigned') {
            if (stopBtn) stopBtn.style.display = 'inline-flex';
            if (reactBtn) reactBtn.style.display = 'none';
        } else {
            if (stopBtn) stopBtn.style.display = 'none';
            if (reactBtn) reactBtn.style.display = 'inline-flex';
        }

        // Fetch full project details for this assignment
        await loadAdsProjectDetailsInWorkspace(assignmentId, projectName, clientName, startDate, coAssignees);

    } catch(err) {
        console.error('Error opening Ads workspace:', err);
    }
};

window.loadAdsProjectDetailsInWorkspace = async function(assignmentId, fallbackName, fallbackClient, fallbackStart, coAssignees) {
    let pData = null;
    try {
        const res = await fetch('/api/ads-assignments');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
            pData = data.data.find(p => String(p.id) === String(assignmentId));
        }
    } catch(e) {}

    if (!pData) {
        pData = {
            id: assignmentId,
            client_name: fallbackClient || 'N/A',
            project_name: fallbackName || 'Google Ads Project',
            service_type: 'ads',
            start_date: fallbackStart || '',
            status: 'Active'
        };
    }

    window.currentActiveAdsProjectObj = pData;

    // Set Workspace Header
    if (document.getElementById('adsWorkspaceProjectTitle')) {
        document.getElementById('adsWorkspaceProjectTitle').innerHTML = `<i class="fas fa-bullhorn" style="color:#ea580c;"></i> ${escapeHtml(pData.project_name || pData.client_name || 'Ads Project')}`;
    }
    if (document.getElementById('adsWorkspaceProjectClient')) {
        document.getElementById('adsWorkspaceProjectClient').textContent = 'Client: ' + (pData.client_name || fallbackClient || 'N/A');
    }
    if (document.getElementById('adsWorkspaceProjectCoAssignees')) {
        document.getElementById('adsWorkspaceProjectCoAssignees').innerHTML = coAssignees ? `<strong>Also Assigned To:</strong> ${escapeHtml(coAssignees)}` : `<strong>Also Assigned To:</strong> <span style="font-style:italic; font-weight:normal;">Only You (Solo)</span>`;
    }

    // Render Master Table Row (Matching Google Sheet 13 Columns)
    const masterTbody = document.getElementById('adsWsMasterTableBody');
    if (masterTbody) {
        const startDateFormatted = pData.start_date ? new Date(pData.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : (fallbackStart || '-');
        const gmailEscaped = (pData.gmail_id || '').replace(/'/g, "\\'");
        const passEscaped = (pData.pass || '').replace(/'/g, "\\'");

        const gmailHtml = pData.gmail_id ? `
            <div class="pass-wrapper">
                <span>${escapeHtml(pData.gmail_id)}</span>
                <button class="copy-icon-btn" onclick="copyVaultText('${gmailEscaped}', 'Gmail ID')" title="Copy Email"><i class="fas fa-copy"></i></button>
            </div>
        ` : '<span style="color:#94a3b8;">-</span>';

        const passHtml = pData.pass ? `
            <div class="pass-wrapper">
                <span id="wsPassSpan_${pData.id}">••••••••</span>
                <button class="copy-icon-btn" onclick="toggleVaultPass(this, 'wsPassSpan_${pData.id}', '${passEscaped}')" title="Show/Hide Password"><i class="fas fa-eye"></i></button>
                <button class="copy-icon-btn" onclick="copyVaultText('${passEscaped}', 'Password')" title="Copy Password"><i class="fas fa-copy"></i></button>
            </div>
        ` : '<span style="color:#94a3b8;">-</span>';

        masterTbody.innerHTML = `
            <tr>
                <td><strong style="color:#0f172a;">${escapeHtml(pData.client_name || fallbackClient || 'N/A')}</strong></td>
                <td><span style="color:#ea580c; font-weight:600;">${escapeHtml(pData.project_name || pData.service_type || 'Google Ads: Search Ad')}</span></td>
                <td><span style="color:#15803d; font-weight:600;">${escapeHtml(pData.objective || 'Lead Generation')}</span></td>
                <td>${escapeHtml(pData.ad_account_details || '-')}</td>
                <td>${escapeHtml(pData.payment_made_by || '-')}</td>
                <td><strong style="color:#16a34a; font-size:15px;">${pData.budget ? '₹' + pData.budget : '-'}</strong></td>
                <td>${escapeHtml(pData.location || '-')}</td>
                <td>${escapeHtml(pData.other_info || pData.website || '-')}</td>
                <td>${escapeHtml(startDateFormatted)}</td>
                <td>${gmailHtml}</td>
                <td>${passHtml}</td>
                <td style="font-style:italic; color:#64748b; font-size:12.5px;">${escapeHtml(pData.remarks || '-')}</td>
                <td style="text-align:right;">
                    <button type="button" class="btn" style="background:linear-gradient(135deg, #ea580c, #c026d3); color:white; font-size:11.5px; padding:4px 10px; font-weight:600;" onclick="openEditCurrentAdsProjectModal()">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </td>
            </tr>
        `;
    }

    // Status Badge
    if (document.getElementById('adsWsStatusBadge')) {
        const st = (pData.status || 'Active');
        document.getElementById('adsWsStatusBadge').textContent = st;
        document.getElementById('adsWsStatusBadge').className = st.toLowerCase() === 'active' ? 'rank-badge top3' : 'rank-badge none';
    }

    // Load Daily Work History
    await loadAdsWorkspaceHistory(assignmentId);
};

window.openEditCurrentAdsProjectModal = function() {
    const item = window.currentActiveAdsProjectObj;
    if (!item || !item.id) return;
    openEditAdsProjectModal(item.id);
};

window.openAddAdsDailyWorkModal = function() {
    const assignmentId = window.currentActiveAdsProject;
    if (!assignmentId) {
        alert('Please select an Ads project first.');
        return;
    }
    document.getElementById('adsDailyAssignmentId').value = assignmentId;
    document.getElementById('adsDailyWorkDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('adsDailyDescription').value = '';
    document.getElementById('adsDailyUrls').value = '';
    document.getElementById('adsDailyRemarks').value = '';
    document.getElementById('adsDailyWorkModal').classList.remove('hidden');
};

window.saveAdsDailyWork = async function(e) {
    e.preventDefault();
    const assignmentId = document.getElementById('adsDailyAssignmentId').value;
    const saveBtn = document.getElementById('saveAdsDailyWorkBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    let empId = null;
    try {
        const userObj = JSON.parse(localStorage.getItem('user') || '{}');
        empId = userObj.id || null;
    } catch(err) {}

    const payload = {
        assignment_id: assignmentId,
        employee_id: empId,
        work_date: document.getElementById('adsDailyWorkDate').value,
        platform: document.getElementById('adsDailyPlatform').value,
        work_type: document.getElementById('adsDailyWorkType').value,
        description: document.getElementById('adsDailyDescription').value,
        status: document.getElementById('adsDailyStatus').value,
        remarks: document.getElementById('adsDailyRemarks').value,
        urls: document.getElementById('adsDailyUrls').value
    };

    try {
        const editId = window.currentEditingAdsWorkId;
        const url = editId ? `/api/ads-daily-work/${editId}` : '/api/ads-daily-work';
        const method = editId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            window.currentEditingAdsWorkId = null;
            document.getElementById('adsDailyWorkModal').classList.add('hidden');
            await loadAdsWorkspaceHistory(assignmentId);
        } else {
            alert(data.message || 'Failed to save daily work.');
        }
    } catch(err) {
        console.error(err);
        alert('Server error saving daily work.');
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Daily Work Log'; }
    }
};

// -------- loadAdsWorkspaceHistory --------
window.loadAdsWorkspaceHistory = async function(assignmentId) {
    try {
        const res = await fetch('/api/ads-daily-work/' + assignmentId);
        const data = await res.json();
        const tbody = document.getElementById('adsWsHistoryBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (data.success && data.data) {
            window.currentAdsDailyWorkList = data.data;
            renderAdsWorkHistoryTable(data.data);
        }
    } catch(err) {
        console.error('loadAdsWorkspaceHistory error:', err);
    }
};

window.renderAdsWorkHistoryTable = function(dataList) {
    const tbody = document.getElementById('adsWsHistoryBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (dataList && dataList.length > 0) {
        tbody.innerHTML = dataList.map(item => {
            const dateStr = item.work_date ? new Date(item.work_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
            const stLower = (item.status || 'completed').toLowerCase();
            let badgeClass = 'completed';
            if (['in progress', 'ongoing'].includes(stLower)) badgeClass = 'ongoing';
            if (['pending', 'on hold', 'blocked'].includes(stLower)) badgeClass = 'attendance';

            return `
                <tr>
                    <td><strong>${escapeHtml(dateStr)}</strong></td>
                    <td>
                        <span class="rank-badge top3" style="font-size:11px; padding:3px 8px;">${escapeHtml(item.platform || 'Google Ads')}</span>
                        <div style="font-size:12px; color:#475569; font-weight:600; margin-top:3px;">${escapeHtml(item.work_type || '')}</div>
                    </td>
                    <td>
                        <div style="font-weight:600; color:#0f172a;">${escapeHtml(item.description || '-')}</div>
                        ${item.urls ? `<div style="margin-top:4px;"><a href="${escapeHtml(item.urls)}" target="_blank" style="color:#0284c7; font-size:12px; font-weight:600;"><i class="fas fa-external-link-alt"></i> View Proof / Link</a></div>` : ''}
                    </td>
                    <td><span class="status-pill ${badgeClass}">${escapeHtml(item.status || 'Completed')}</span></td>
                    <td style="color:#64748b; font-size:12.5px;">${escapeHtml(item.remarks || '-')}</td>
                    <td style="text-align:right; white-space:nowrap;">
                        <button type="button" class="btn" onclick="openEditAdsDailyWorkModal(${item.id})" style="background:#e0f2fe; color:#0369a1; font-size:11.5px; padding:4px 10px; font-weight:600;" title="Edit Entry"><i class="fas fa-edit"></i> Edit</button>
                        <button type="button" class="copy-icon-btn" onclick="deleteAdsDailyWork(${item.id})" style="color:#ef4444;" title="Delete Entry"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:#94a3b8;"><i class="fas fa-history" style="font-size:24px; margin-bottom:8px; display:block;"></i>No daily work entries logged yet. Click "+ Log Today's Ads Work" above.</td></tr>`;
    }
};

window.filterAdsWorkHistoryByMonth = function() {
    const filterVal = document.getElementById('adsHistoryMonthFilter')?.value;
    const all = window.currentAdsDailyWorkList || [];
    if (!filterVal) {
        renderAdsWorkHistoryTable(all);
        return;
    }
    const [year, month] = filterVal.split('-');
    const filtered = all.filter(item => {
        if (!item.work_date) return false;
        const d = new Date(item.work_date);
        return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month);
    });
    renderAdsWorkHistoryTable(filtered);
};

window.downloadAdsMonthlyWorkReportExcel = function() {
    const filterVal = document.getElementById('adsHistoryMonthFilter')?.value;
    const all = window.currentAdsDailyWorkList || [];
    let listToExport = all;

    if (filterVal) {
        const [year, month] = filterVal.split('-');
        listToExport = all.filter(item => {
            if (!item.work_date) return false;
            const d = new Date(item.work_date);
            return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month);
        });
    }

    if (listToExport.length === 0) {
        alert('No Ads daily work logs found for the selected month to export.');
        return;
    }

    const projName = window.currentActiveAdsProjectObj ? (window.currentActiveAdsProjectObj.projectName || window.currentActiveAdsProjectObj.project_name || 'Ads_Project') : 'Ads_Project';
    
    let csv = ["Date,Platform,Work Type / Category,Description,Proof Links / URLs,Status,Remarks"];
    listToExport.forEach(item => {
        const dateStr = item.work_date ? new Date(item.work_date).toLocaleDateString() : '';
        csv.push([
            escapeCsvCell(dateStr),
            escapeCsvCell(item.platform),
            escapeCsvCell(item.work_type),
            escapeCsvCell(item.description),
            escapeCsvCell(item.urls),
            escapeCsvCell(item.status),
            escapeCsvCell(item.remarks)
        ].join(','));
    });

    const monthTag = filterVal ? filterVal : 'All_Time';
    const filename = `${projName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Ads_Work_Report_${monthTag}.csv`;
    downloadCsvFile(filename, csv.join('\n'));
};

window.openEditAdsDailyWorkModal = function(id) {
    const list = window.currentAdsDailyWorkList || [];
    const item = list.find(i => String(i.id) === String(id));
    if (!item) return;

    window.currentEditingAdsWorkId = id;
    if (document.getElementById('adsDailyAssignmentId')) document.getElementById('adsDailyAssignmentId').value = item.assignment_id || window.currentActiveAdsProject;
    if (document.getElementById('adsDailyWorkDate')) document.getElementById('adsDailyWorkDate').value = item.work_date ? item.work_date.split('T')[0] : '';
    if (document.getElementById('adsDailyPlatform')) document.getElementById('adsDailyPlatform').value = item.platform || 'Google Ads';
    if (document.getElementById('adsDailyWorkType')) document.getElementById('adsDailyWorkType').value = item.work_type || 'Campaign Setup & Launch';
    if (document.getElementById('adsDailyDescription')) document.getElementById('adsDailyDescription').value = item.description || '';
    if (document.getElementById('adsDailyStatus')) document.getElementById('adsDailyStatus').value = item.status || 'Completed';
    if (document.getElementById('adsDailyRemarks')) document.getElementById('adsDailyRemarks').value = item.remarks || '';
    if (document.getElementById('adsDailyUrls')) document.getElementById('adsDailyUrls').value = item.urls || '';

    const modal = document.getElementById('adsDailyWorkModal');
    if (modal) modal.classList.remove('hidden');
};

window.deleteAdsDailyWork = async function(id) {
    if (!confirm('Are you sure you want to delete this Ads daily work entry?')) return;
    try {
        const res = await fetch(`/api/ads-daily-work/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            alert('Ads daily work entry deleted.');
            loadAdsWorkspaceHistory(window.currentActiveAdsProject);
        }
    } catch(e) { console.error(e); }
};

// -------- loadAdsCampaigns --------
window.loadAdsCampaigns = async function(assignmentId) {
    try {
        const res = await fetch('/api/ads-campaigns/' + assignmentId);
        const data = await res.json();
        const container = document.getElementById('adsCampaignsListContainer');
        const selectInputs = document.querySelectorAll('.ads-campaign-select');

        if (!data.success) return;

        const campaigns = data.data || [];

        // Update campaign select dropdowns in forms
        selectInputs.forEach(select => {
            const curr = select.value;
            let options = '<option value="">-- Select Campaign --</option>';
            campaigns.forEach(c => {
                options += `<option value="${escapeHtml(c.campaign_name)}" data-id="${c.id}">${escapeHtml(c.campaign_name)} (${escapeHtml(c.platform)})</option>`;
            });
            select.innerHTML = options;
            if (curr) select.value = curr;
        });

        // Render campaigns list card grid
        if (container) {
            if (campaigns.length === 0) {
                container.innerHTML = '<div style="color:#888; font-size:13.5px; padding:15px; background:#f8fafc; border-radius:8px; text-align:center;">No campaigns created yet. Click "+ Add New Campaign" to create one.</div>';
            } else {
                container.innerHTML = campaigns.map(c => `
                    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:14px; box-shadow:0 1px 3px rgba(0,0,0,0.05); position:relative;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <strong style="color:#0f172a; font-size:14.5px;">${escapeHtml(c.campaign_name)}</strong>
                            <span style="font-size:11px; padding:2px 8px; border-radius:10px; font-weight:600; background:${c.status==='Active'?'#dcfce7':'#f1f5f9'}; color:${c.status==='Active'?'#15803d':'#64748b'};">${escapeHtml(c.status)}</span>
                        </div>
                        <div style="font-size:12.5px; color:#475569; margin-bottom:4px;"><strong>Platform:</strong> ${escapeHtml(c.platform)} | <strong>Objective:</strong> ${escapeHtml(c.objective || 'N/A')}</div>
                        <div style="font-size:12.5px; color:#475569;"><strong>Budget:</strong> ₹${Number(c.budget || 0).toLocaleString()}</div>
                    </div>
                `).join('');
            }
        }

    } catch(err) {
        console.error('loadAdsCampaigns error:', err);
    }
};

// -------- loadAdsPerformanceHistory --------
window.loadAdsPerformanceHistory = async function(assignmentId) {
    try {
        const res = await fetch('/api/ads-performance/' + assignmentId);
        const data = await res.json();
        const tbody = document.getElementById('adsPerformanceHistoryBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        let totalSpend = 0, totalClicks = 0, totalLeads = 0, totalConversions = 0, totalImpressions = 0;

        if (data.success && data.data && data.data.length > 0) {
            data.data.forEach(item => {
                totalSpend += Number(item.spend || 0);
                totalClicks += Number(item.clicks || 0);
                totalLeads += Number(item.leads || 0);
                totalConversions += Number(item.conversions || 0);
                totalImpressions += Number(item.impressions || 0);

                tbody.innerHTML += `<tr>
                    <td style="font-weight:600; color:#334155;">${new Date(item.record_date).toLocaleDateString()}</td>
                    <td>${escapeHtml(item.campaign_name || 'All Campaigns')}</td>
                    <td style="font-weight:700; color:#ea580c;">₹${Number(item.spend || 0).toLocaleString()}</td>
                    <td>${Number(item.clicks || 0).toLocaleString()}</td>
                    <td style="font-weight:700; color:#16a34a;">${Number(item.leads || 0).toLocaleString()}</td>
                    <td style="font-weight:600; color:#0284c7;">₹${Number(item.cpl || 0).toFixed(2)}</td>
                    <td>${Number(item.conversions || 0).toLocaleString()}</td>
                    <td>${Number(item.ctr || 0).toFixed(2)}%</td>
                    <td style="color:#64748b; font-size:12.5px;">${escapeHtml(item.remarks || '-')}</td>
                </tr>`;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#888; padding:20px;">No performance records logged yet. Click "+ Log Performance" to update.</td></tr>';
        }

        const avgCpl = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : '0.00';
        const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : (totalClicks > 0 ? 'N/A' : '0.00');

        if (document.getElementById('adsMetricTotalSpend')) document.getElementById('adsMetricTotalSpend').textContent = '₹' + totalSpend.toLocaleString();
        if (document.getElementById('adsMetricTotalClicks')) document.getElementById('adsMetricTotalClicks').textContent = totalClicks.toLocaleString();
        if (document.getElementById('adsMetricTotalLeads')) document.getElementById('adsMetricTotalLeads').textContent = totalLeads.toLocaleString();
        if (document.getElementById('adsMetricAvgCpl')) document.getElementById('adsMetricAvgCpl').textContent = '₹' + avgCpl;
        if (document.getElementById('adsMetricAvgCtr')) document.getElementById('adsMetricAvgCtr').textContent = avgCtr + (avgCtr !== 'N/A' ? '%' : '');

    } catch(err) {
        console.error('loadAdsPerformanceHistory error:', err);
    }
};

// -------- Modals & Actions --------
window.openAddAdsDailyWorkModal = function() {
    const modal = document.getElementById('adsAddWorkModal');
    const form = document.getElementById('adsDailyWorkForm');
    if (modal) modal.classList.remove('hidden');
    if (form) {
        form.reset();
        const dateInput = document.getElementById('adsWorkDate');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        const campInput = document.getElementById('adsCampaignSelect');
        if (campInput) {
            const pObj = window.currentActiveAdsProjectObj || {};
            campInput.value = pObj.project_name || pObj.service_type || 'Google Ads Search Campaign';
        }
    }
};

window.closeAdsAddWorkModal = function() {
    const modal = document.getElementById('adsAddWorkModal');
    if (modal) modal.classList.add('hidden');
};

window.saveAdsDailyWork = async function() {
    const assignmentId = window.currentActiveAdsProject;
    if (!assignmentId) { showSeoToast('No active Ads project selected', 'error'); return; }

    const date = document.getElementById('adsWorkDate')?.value;
    const platform = document.getElementById('adsPlatformSelect')?.value;
    const campaignName = document.getElementById('adsCampaignSelect')?.value || document.getElementById('adsCustomCampaignInput')?.value || '';
    const workType = document.getElementById('adsWorkTypeSelect')?.value;
    const description = document.getElementById('adsWorkDescription')?.value?.trim();
    const status = document.getElementById('adsWorkStatusSelect')?.value || 'Completed';
    const remarks = document.getElementById('adsWorkRemarksInput')?.value || '';
    const urls = document.getElementById('adsWorkUrlsInput')?.value || '';

    if (!date || !platform || !workType || !description) {
        showSeoToast('Please fill out Date, Platform, Work Type and Description (Mandatory)', 'error');
        return;
    }

    const payload = {
        assignment_id: assignmentId,
        employee_id: adsUser ? adsUser.id : '',
        work_date: date,
        platform: platform,
        campaign_name: campaignName,
        work_type: workType,
        description: description,
        status: status,
        remarks: remarks,
        urls: urls
    };

    try {
        const res = await fetch('/api/ads-daily-work', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            showSeoToast('Ads daily work saved successfully!', 'success');
            closeAdsAddWorkModal();
            loadAdsWorkspaceHistory(assignmentId);
        } else {
            showSeoToast(data.message || 'Failed to save Ads daily work', 'error');
        }
    } catch(err) {
        showSeoToast('Error: ' + err.message, 'error');
    }
};

// Campaign Modal & Save
window.openAddAdsCampaignModal = function() {
    const modal = document.getElementById('adsAddCampaignModal');
    const form = document.getElementById('adsCampaignForm');
    if (modal) modal.classList.remove('hidden');
    if (form) form.reset();
};

window.closeAdsAddCampaignModal = function() {
    const modal = document.getElementById('adsAddCampaignModal');
    if (modal) modal.classList.add('hidden');
};

window.saveAdsCampaign = async function() {
    const assignmentId = window.currentActiveAdsProject;
    if (!assignmentId) return;

    const campaign_name = document.getElementById('adsCampaignNameInput')?.value?.trim();
    const platform = document.getElementById('adsCampaignPlatformSelect')?.value;
    const objective = document.getElementById('adsCampaignObjectiveSelect')?.value;
    const budget = document.getElementById('adsCampaignBudgetInput')?.value || 0;
    const status = document.getElementById('adsCampaignStatusSelect')?.value || 'Active';

    if (!campaign_name || !platform) {
        showSeoToast('Campaign Name and Platform are mandatory', 'error');
        return;
    }

    try {
        const res = await fetch('/api/ads-campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignment_id: assignmentId, campaign_name, platform, objective, budget, status })
        });
        const data = await res.json();
        if (data.success) {
            showSeoToast('Campaign created successfully!', 'success');
            closeAdsAddCampaignModal();
            loadAdsCampaigns(assignmentId);
        } else {
            showSeoToast(data.message || 'Failed to create campaign', 'error');
        }
    } catch(err) {
        showSeoToast('Error: ' + err.message, 'error');
    }
};

// Performance Modal & Save
window.openAddAdsPerformanceModal = function() {
    const modal = document.getElementById('adsAddPerformanceModal');
    const form = document.getElementById('adsPerformanceForm');
    if (modal) modal.classList.remove('hidden');
    if (form) {
        form.reset();
        const dateInput = document.getElementById('adsPerformanceDate');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    }
};

window.closeAdsAddPerformanceModal = function() {
    const modal = document.getElementById('adsAddPerformanceModal');
    if (modal) modal.classList.add('hidden');
};

window.saveAdsPerformance = async function() {
    const assignmentId = window.currentActiveAdsProject;
    if (!assignmentId) return;

    const campaign_name = document.getElementById('adsPerfCampaignSelect')?.value || 'All Campaigns';
    const record_date = document.getElementById('adsPerformanceDate')?.value;
    const spend = document.getElementById('adsPerfSpendInput')?.value || 0;
    const clicks = document.getElementById('adsPerfClicksInput')?.value || 0;
    const leads = document.getElementById('adsPerfLeadsInput')?.value || 0;
    const cpl = document.getElementById('adsPerfCplInput')?.value || 0;
    const conversions = document.getElementById('adsPerfConversionsInput')?.value || 0;
    const ctr = document.getElementById('adsPerfCtrInput')?.value || 0;
    const impressions = document.getElementById('adsPerfImpressionsInput')?.value || 0;
    const remarks = document.getElementById('adsPerfRemarksInput')?.value || '';

    if (!record_date) {
        showSeoToast('Record Date is required', 'error');
        return;
    }

    try {
        const res = await fetch('/api/ads-performance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignment_id: assignmentId, campaign_name, record_date, spend, clicks, leads, cpl, conversions, ctr, impressions, remarks })
        });
        const data = await res.json();
        if (data.success) {
            showSeoToast('Ads performance metrics saved!', 'success');
            closeAdsAddPerformanceModal();
            loadAdsPerformanceHistory(assignmentId);
        } else {
            showSeoToast(data.message || 'Failed to save performance', 'error');
        }
    } catch(err) {
        showSeoToast('Error: ' + err.message, 'error');
    }
};

// Stop / Reactivate Ads
window.openStopAdsModal = function() {
    const modal = document.getElementById('stopAdsModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeStopAdsModal = function() {
    const modal = document.getElementById('stopAdsModal');
    if (modal) modal.classList.add('hidden');
};

window.confirmStopAds = async function() {
    const stopDate = document.getElementById('adsStopDate')?.value;
    const stopReason = document.getElementById('adsStopReason')?.value;
    const assignmentId = window.currentActiveAdsProject;
    if (!assignmentId) return;

    try {
        const res = await fetch('/api/ads-assignments/' + assignmentId + '/stop', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stop_date: stopDate, stop_reason: stopReason })
        });
        const data = await res.json();
        if (data.success) {
            closeStopAdsModal();
            showSeoToast('Ads work stopped successfully.', 'success');
            loadAssignedAdsProjects();
            if (typeof showSection === 'function') showSection('assigned');
        } else {
            showSeoToast(data.message || 'Failed to stop', 'error');
        }
    } catch(err) {
        showSeoToast('Error: ' + err.message, 'error');
    }
};

window.reactivateAdsAction = async function(id) {
    const targetId = id || window.currentActiveAdsProject;
    if (!targetId) return;
    try {
        await fetch('/api/ads-assignments/' + targetId + '/reactivate', { method: 'PUT' });
        showSeoToast('Ads project reactivated successfully!', 'success');
        loadAssignedAdsProjects();
        if (typeof showSection === 'function') showSection('assigned');
    } catch(err) {
        showSeoToast(err.message, 'error');
    }
};

// Auto load Ads projects alongside SEO projects
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (typeof loadAssignedAdsProjects === 'function') loadAssignedAdsProjects();
        if (typeof loadMasterAdsProjects === 'function') loadMasterAdsProjects();
    }, 600);
});

// ==================== MASTER ADS PROJECTS TABLE LOGIC ====================

window.allMasterAdsProjectsList = [];

window.loadMasterAdsProjects = async function() {
    const tbody = document.getElementById('masterAdsTableBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding:24px; color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Loading Ads Projects...</td></tr>`;

    try {
        const res = await fetch('/api/ads-assignments');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
            window.allMasterAdsProjectsList = data.data;
            renderMasterAdsTable(window.allMasterAdsProjectsList);
        } else {
            tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; color:#ef4444;">Failed to load Ads projects.</td></tr>`;
        }
    } catch(err) {
        console.error('loadMasterAdsProjects error:', err);
        tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; color:#ef4444;">Server error loading Ads projects.</td></tr>`;
    }
};

window.renderMasterAdsTable = function(projects) {
    const tbody = document.getElementById('masterAdsTableBody');
    if (!tbody) return;

    if (!projects || projects.length === 0) {
        tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding:30px; color:#94a3b8;"><i class="fas fa-bullhorn" style="font-size:28px; margin-bottom:10px; display:block;"></i>No Ads projects found. Click "+ Add Ads Project" above.</td></tr>`;
        return;
    }

    tbody.innerHTML = projects.map((p, idx) => {
        const passMasked = '••••••••';
        const passEscaped = (p.pass || '').replace(/'/g, "\\'");
        const gmailEscaped = (p.gmail_id || '').replace(/'/g, "\\'");
        const safeProjName = (p.project_name || p.service_type || 'Ads Project').replace(/'/g, "\\'");
        const safeClientName = (p.client_name || '').replace(/'/g, "\\'");
        const startStr = p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';

        return `
            <tr>
                <td style="font-weight:700; color:#94a3b8;">${idx + 1}</td>
                <td><strong>${escapeHtml(p.client_name || 'N/A')}</strong></td>
                <td><span class="ads-platform-badge">${escapeHtml(p.project_name || p.service_type || 'Google Ads')}</span></td>
                <td><span class="ads-obj-badge">${escapeHtml(p.objective || 'Lead Generation')}</span></td>
                <td style="font-size:12.5px; color:#334155;">${escapeHtml(p.ad_account_details || '-')}</td>
                <td><span style="font-weight:600; color:#475569;">${escapeHtml(p.payment_made_by || '-')}</span></td>
                <td style="font-weight:700; color:#16a34a;">${p.budget ? '₹' + escapeHtml(p.budget) : '-'}</td>
                <td style="font-size:12.5px;">${escapeHtml(p.location || '-')}</td>
                <td style="font-size:12px; max-width:200px; word-break:break-all;">
                    ${p.other_info ? escapeHtml(p.other_info) : (p.website ? `<a href="${escapeHtml(p.website)}" target="_blank" style="color:#0284c7; text-decoration:underline;">${escapeHtml(p.website)}</a>` : '-')}
                </td>
                <td style="font-size:12.5px; white-space:nowrap;">${startStr}</td>
                <td>
                    ${p.gmail_id ? `
                        <div class="pass-wrapper">
                            <span>${escapeHtml(p.gmail_id)}</span>
                            <button class="copy-icon-btn" onclick="copyVaultText('${gmailEscaped}', 'Gmail ID')" title="Copy Email"><i class="fas fa-copy"></i></button>
                        </div>
                    ` : '<span style="color:#94a3b8;">-</span>'}
                </td>
                <td>
                    ${p.pass ? `
                        <div class="pass-wrapper">
                            <span id="adsPassSpan_${p.id}">${passMasked}</span>
                            <button class="copy-icon-btn" onclick="toggleVaultPass(this, 'adsPassSpan_${p.id}', '${passEscaped}')" title="Show/Hide Password"><i class="fas fa-eye"></i></button>
                            <button class="copy-icon-btn" onclick="copyVaultText('${passEscaped}', 'Password')" title="Copy Password"><i class="fas fa-copy"></i></button>
                        </div>
                    ` : '<span style="color:#94a3b8;">-</span>'}
                </td>
                <td>
                    <button class="btn" style="background:#0f766e; color:white; font-size:11.5px; padding:4px 8px; font-weight:600;" onclick="openProjectSheetAccess('${p.id}', '${(p.sheet_url||'').replace(/'/g, "\\'")}', '${safeProjName}', '${safeClientName}')">
                        <i class="fas fa-folder-open"></i> Vault
                    </button>
                </td>
                <td style="color:#64748b; font-size:12px;">${escapeHtml(p.remarks || '-')}</td>
                <td style="text-align:right; white-space:nowrap;">
                    <button class="copy-icon-btn" onclick="openEditAdsProjectModal(${p.id})" style="color:#0284c7;" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="copy-icon-btn" onclick="openAdsWork('${p.id}', '${safeProjName}', '${p.status||'Active'}', '${safeClientName}', '${p.start_date||''}', '')" style="color:#ea580c;" title="Open Workspace"><i class="fas fa-external-link-alt"></i></button>
                    <button class="copy-icon-btn" onclick="deleteAdsProject(${p.id})" style="color:#ef4444;" title="Delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
};

window.filterMasterAdsTable = function() {
    const q = (document.getElementById('adsSearchInput')?.value || '').toLowerCase().trim();
    const pf = (document.getElementById('adsPlatformFilter')?.value || '').toLowerCase().trim();
    const list = window.allMasterAdsProjectsList || [];

    const filtered = list.filter(p => {
        const client = (p.client_name || '').toLowerCase();
        const platform = (p.project_name || p.service_type || '').toLowerCase();
        const obj = (p.objective || '').toLowerCase();
        const loc = (p.location || '').toLowerCase();
        const gmail = (p.gmail_id || '').toLowerCase();

        const matchQ = !q || client.includes(q) || platform.includes(q) || obj.includes(q) || loc.includes(q) || gmail.includes(q);
        const matchPf = !pf || platform.includes(pf);

        return matchQ && matchPf;
    });

    renderMasterAdsTable(filtered);
};

window.generateRandomAdsPass = function() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 12; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const input = document.getElementById('adsPass');
    if (input) input.value = pass;
};

window.openAddAdsProjectModal = function() {
    document.getElementById('adsProjectId').value = '';
    document.getElementById('adsClientName').value = '';
    document.getElementById('adsPlatform').value = 'Google Ads: Search Ad';
    document.getElementById('adsObjective').value = 'Lead Generation';
    document.getElementById('adsAccountDetails').value = '';
    document.getElementById('adsPaymentMadeBy').value = '';
    document.getElementById('adsBudget').value = '';
    document.getElementById('adsLocation').value = '';
    document.getElementById('adsOtherInfo').value = '';
    document.getElementById('adsWorkStart').value = new Date().toISOString().split('T')[0];
    document.getElementById('adsGmailId').value = '';
    document.getElementById('adsPass').value = '';
    document.getElementById('adsAccessUrl').value = '';
    document.getElementById('adsRemarks').value = '';
    document.getElementById('adsFormModalTitle').innerHTML = `<i class="fas fa-bullhorn"></i> Add Ads Project`;
    document.getElementById('adsProjectFormModal').classList.remove('hidden');
};

window.openEditAdsProjectModal = async function(id) {
    const targetId = id || window.currentActiveAdsProject;
    let item = null;

    if (window.currentActiveAdsProjectObj && String(window.currentActiveAdsProjectObj.id || window.currentActiveAdsProjectObj.assignmentId) === String(targetId)) {
        item = window.currentActiveAdsProjectObj;
    }

    if ((!item || !item.client_name) && window.allMasterAdsProjectsList && Array.isArray(window.allMasterAdsProjectsList)) {
        item = window.allMasterAdsProjectsList.find(p => String(p.id) === String(targetId));
    }

    if (!item || !item.client_name) {
        try {
            const res = await fetch('/api/ads-assignments');
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                window.allMasterAdsProjectsList = data.data;
                item = data.data.find(p => String(p.id) === String(targetId));
            }
        } catch(e) {}
    }

    if (!item) {
        item = { id: targetId };
    }

    document.getElementById('adsProjectId').value = item.id || targetId || '';
    document.getElementById('adsClientName').value = item.client_name || item.clientName || '';
    document.getElementById('adsPlatform').value = item.project_name || item.projectName || item.service_type || 'Google Ads: Search Ad';
    document.getElementById('adsObjective').value = item.objective || 'Lead Generation';
    document.getElementById('adsAccountDetails').value = item.ad_account_details || '';
    document.getElementById('adsPaymentMadeBy').value = item.payment_made_by || '';
    document.getElementById('adsBudget').value = item.budget || '';
    document.getElementById('adsLocation').value = item.location || '';
    document.getElementById('adsOtherInfo').value = item.other_info || item.website || '';
    document.getElementById('adsWorkStart').value = item.start_date ? item.start_date.split('T')[0] : new Date().toISOString().split('T')[0];
    document.getElementById('adsGmailId').value = item.gmail_id || '';
    document.getElementById('adsPass').value = item.pass || '';
    document.getElementById('adsAccessUrl').value = item.sheet_url || '';
    document.getElementById('adsRemarks').value = item.remarks || '';

    document.getElementById('adsFormModalTitle').innerHTML = `<i class="fas fa-edit"></i> Edit Ads Project Details`;
    document.getElementById('adsProjectFormModal').classList.remove('hidden');
};

window.saveAdsProject = async function(e) {
    e.preventDefault();
    const id = document.getElementById('adsProjectId').value;
    const saveBtn = document.getElementById('saveAdsProjectBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    const payload = {
        client_name: document.getElementById('adsClientName').value,
        project_name: document.getElementById('adsPlatform').value,
        service_type: document.getElementById('adsPlatform').value,
        objective: document.getElementById('adsObjective').value,
        ad_account_details: document.getElementById('adsAccountDetails').value,
        payment_made_by: document.getElementById('adsPaymentMadeBy').value,
        budget: document.getElementById('adsBudget').value,
        location: document.getElementById('adsLocation').value,
        other_info: document.getElementById('adsOtherInfo').value,
        website: document.getElementById('adsOtherInfo').value,
        start_date: document.getElementById('adsWorkStart').value,
        gmail_id: document.getElementById('adsGmailId').value,
        pass: document.getElementById('adsPass').value,
        sheet_url: document.getElementById('adsAccessUrl').value,
        remarks: document.getElementById('adsRemarks').value
    };

    try {
        const url = id ? `/api/ads-assignments/${id}` : `/api/ads-assignments`;
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('adsProjectFormModal').classList.add('hidden');
            if (typeof loadMasterAdsProjects === 'function') loadMasterAdsProjects();
            if (typeof loadAssignedAdsProjects === 'function') loadAssignedAdsProjects();
            if (window.currentActiveAdsProject) {
                loadAdsProjectDetailsInWorkspace(window.currentActiveAdsProject);
            }
        } else {
            alert(data.message || 'Failed to save Ads project');
        }
    } catch(err) {
        console.error(err);
        alert('Server error saving Ads project');
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Ads Project'; }
    }
};

window.deleteAdsProject = async function(id) {
    if (!confirm('Are you sure you want to delete this Ads project?')) return;
    try {
        const res = await fetch(`/api/ads-assignments/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            loadMasterAdsProjects();
            if (typeof loadAssignedAdsProjects === 'function') loadAssignedAdsProjects();
        }
    } catch(e) { console.error(e); }
};
