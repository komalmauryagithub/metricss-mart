// ====================== DAILY WORK LOGIC ======================
// This file is used in all employee panels and the admin panel.

if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
}
if (typeof escapeHtml !== 'function') {
    var escapeHtml = window.escapeHtml;
}

(function injectDailyWorkCSS() {
    if (document.getElementById('daily-work-css')) return;
    const style = document.createElement('style');
    style.id = 'daily-work-css';
    style.innerHTML = `
        /* Daily Work Section Styles */
        #daily-work {
            background: #ffffff;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
            margin-bottom: 30px;
        }
        #daily-work .log-table-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            margin-bottom: 20px;
            gap: 15px;
        }
        #daily-work h2 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #1e293b;
            margin: 0;
        }
        #daily-work .log-table-filters {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 15px 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            flex-wrap: wrap;
        }
        #daily-work .log-table-filters label {
            font-size: 0.85rem;
            font-weight: 600;
            color: #475569;
        }
        #daily-work input[type="month"], 
        #daily-work input[type="date"],
        #daily-work select,
        #daily-work .search-box {
            height: 38px;
            padding: 8px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            outline: none;
            color: #1e293b;
            font-family: inherit;
            transition: all 0.2s;
        }
        #daily-work input[type="month"]:focus, 
        #daily-work input[type="date"]:focus,
        #daily-work select:focus,
        #daily-work .search-box:focus {
            border-color: #0f766e;
            box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.15);
        }
        #daily-work .action-btn {
            background: #0f766e;
            color: white;
            border: none;
            padding: 9px 18px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        #daily-work .action-btn:hover { background: #115e59; }
        
        #daily-work .log-table-wrapper {
            overflow-x: auto;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            background: #fff;
        }
        #daily-work .log-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
        }
        #daily-work .log-table th {
            background: #f8fafc;
            color: #475569;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 0.5px;
            padding: 14px 16px;
            text-align: left;
            border-bottom: 2px solid #cbd5e1;
            white-space: nowrap;
        }
        #daily-work .log-table td {
            padding: 14px 16px;
            color: #334155;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: middle;
        }
        #daily-work .log-table tr { transition: background 0.2s; }
        #daily-work .log-table tr:hover { background: #f1f5f9; }
        
        /* Badges */
        .dw-status-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .dw-status-badge.completed { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .dw-status-badge.in-progress { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
        .dw-status-badge.pending { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .dw-status-badge.on-hold { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }

        .dw-edit-btn {
            background: transparent;
            color: #64748b;
            border: 1px solid #cbd5e1;
            padding: 5px 10px;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .dw-edit-btn:hover {
            background: #f1f5f9;
            color: #0f172a;
            border-color: #94a3b8;
        }
    `;
    document.head.appendChild(style);
})();
const ROLE_CONFIG = {
    'dev': {
        fields: ['work_title', 'blocker'],
        labels: { client: 'Project', work_title: 'Work Title', blocker: 'Blocker' }
    },
    'tme': {
        fields: ['task_module', 'hours'],
        labels: { client: 'Project/Client', task_module: 'Task/Module', hours: 'Hours' }
    },
    'seo': {
        fields: ['seo_works'],
        labels: { client: 'Project', seo_works: 'SEO Work Details' }
    },
    'email_marketing': {
        fields: ['positive_clients', 'negative_clients', 'emails_sent', 'positive_result', 'negative_result'],
        labels: { client: 'Client', positive_clients: 'Positive Clients', negative_clients: 'Negative Clients', emails_sent: 'Emails Sent', positive_result: 'Positive Result', negative_result: 'Negative Result' }
    },
    'smo': {
        fields: ['platform', 'content_type'],
        labels: { client: 'Client', platform: 'Platform', content_type: 'Content Type' }
    },
    'me': {
        fields: ['lead_source', 'calls_made', 'meetings', 'follow_ups', 'next_follow_up'],
        labels: { client: 'Client/Lead', lead_source: 'Lead Source', calls_made: 'Calls Made', meetings: 'Meetings', follow_ups: 'Follow-ups', next_follow_up: 'Next Follow-up Date' }
    },
    'accounts': {
        fields: ['task_type', 'amount'],
        labels: { client: 'Client/Vendor', task_type: 'Task Type', amount: 'Amount' }
    },
    'hr': {
        fields: ['task_type', 'interviews_calls', 'action_taken'],
        labels: { client: 'Employee/Candidate', task_type: 'Task Type', interviews_calls: 'Interviews/Calls', action_taken: 'Follow-up/Action Taken' }
    }
};

let currentDailyWorkEditId = null;

function getCurrentUserSafe() {
    try {
        return JSON.parse(localStorage.getItem('currentUser') || 'null');
    } catch (e) {
        return null;
    }
}

function addDwUrlInput(val = '') {
    const container = document.getElementById('dwUrlsContainer');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'dw-url-row';
    div.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 6px;';

    const safeVal = typeof val === 'string' ? val.replace(/"/g, '&quot;') : '';
    div.innerHTML = `
        <input type="url" class="dw-url-input" value="${safeVal}" placeholder="E.g., https://demo.com or PR link" style="flex: 1; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; outline: none;">
        <button type="button" onclick="this.parentElement.remove()" style="background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold;" title="Remove URL">&times;</button>
    `;

    container.appendChild(div);
}

function collectDwUrls() {
    const inputs = document.querySelectorAll('.dw-url-input');
    const urls = [];
    inputs.forEach(input => {
        const val = String(input.value || '').trim();
        if (val) urls.push(val);
    });
    return urls;
}

function renderDwMediaHtml(details = {}) {
    let html = '';
    
    // Multiple URLs
    const urls = Array.isArray(details.urls) ? details.urls : (details.url ? [details.url] : []);
    const validUrls = urls.filter(u => typeof u === 'string' && u.trim() !== '');
    if (validUrls.length > 0) {
        html += `<div style="margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap;">`;
        validUrls.forEach((u, idx) => {
            const cleanUrl = u.trim();
            const labelText = validUrls.length > 1 ? `Link ${idx + 1}` : 'Reference Link';
            html += `<a href="${cleanUrl}" target="_blank" style="color: #0284c7; font-size: 11.5px; font-weight: 600; text-decoration: underline; background: #f0f9ff; border: 1px solid #bae6fd; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;"><i class="fas fa-external-link-alt"></i> ${labelText}</a>`;
        });
        html += `</div>`;
    }

    // Multiple Images
    const images = Array.isArray(details.images) ? details.images : (details.image ? [details.image] : []);
    const validImages = images.filter(img => typeof img === 'string' && img.trim() !== '');
    if (validImages.length > 0) {
        html += `<div style="margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap;">`;
        images.forEach(img => {
            const cleanImg = escapeHtml(String(img).trim());
            if (cleanImg) {
                const displayUrl = cleanImg.startsWith('http') || cleanImg.startsWith('/') || cleanImg.startsWith('uploads/') ? cleanImg : `/uploads/${cleanImg}`;
                html += `<a href="${displayUrl}" target="_blank" title="Click to view image"><img src="${displayUrl}" onerror="this.parentElement.style.display='none';" style="max-width: 60px; max-height: 42px; border-radius: 4px; border: 1px solid #cbd5e1; object-fit: cover;"></a>`;
            }
        });html += `</div>`;
    }

    return html;
}

function initDailyWorkModal() {
    if (document.getElementById('dailyWorkModal')) return;
    
    const modalHtml = `
    <style>
      .dw-modal-overlay {
        display: none; position: fixed; z-index: 9999; left: 0; top: 0;
        width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }
      .dw-modal-content {
        background-color: #fff;
        margin: 5vh auto; /* Center vertically and horizontally */
        padding: 25px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        width: 90%; max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
        animation: dw-modal-slide-down 0.3s ease-out;
      }
      @keyframes dw-modal-slide-down {
        from { transform: translateY(-30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .dw-modal-content .close {
        color: #64748b; float: right; font-size: 28px; font-weight: bold; cursor: pointer; transition: color 0.2s;
      }
      .dw-modal-content .close:hover { color: #f43f5e; }
      .dw-modal-content h2 { color: #1e293b; margin-top: 0; margin-bottom: 20px; font-size: 1.5rem; }
      .dw-form-group { margin-bottom: 15px; }
      .dw-form-group label { display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.9rem; color: #475569; }
      .dw-form-group input, .dw-form-group select, .dw-form-group textarea {
        width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; outline: none; transition: border-color 0.2s;
      }
      .dw-form-group input:focus, .dw-form-group select:focus, .dw-form-group textarea:focus { 
        border-color: #cbd5e1; /* Base focus color, updated dynamically if needed */
        outline: none;
      }
      .dw-form-group.theme-red input:focus, .dw-form-group.theme-red select:focus, .dw-form-group.theme-red textarea:focus {
        border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15);
      }
      .dw-form-group.theme-green input:focus, .dw-form-group.theme-green select:focus, .dw-form-group.theme-green textarea:focus {
        border-color: #059669; box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
      }
      
      .dw-submit-btn {
        color: white; border: none; padding: 12px 20px; border-radius: 8px;
        font-size: 1rem; font-weight: 600; cursor: pointer; width: 100%; transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
        margin-top: 10px;
        background: linear-gradient(135deg, #059669 0%, #10b981 100%); /* Default Green */
      }
      .dw-submit-btn:disabled { background: #94a3b8 !important; cursor: not-allowed; transform: none; box-shadow: none !important; }
      
      .dw-submit-btn.theme-red {
        background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
      }
      .dw-submit-btn.theme-red:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(220, 38, 38, 0.3); }

      .dw-submit-btn.theme-green {
        background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      }
      .dw-submit-btn.theme-green:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(5, 150, 105, 0.3); }
    </style>
    <div id="dailyWorkModal" class="dw-modal-overlay">
      <div class="dw-modal-content">
        <span class="close" onclick="closeDailyWorkModal()">&times;</span>
        <h2 id="dwModalTitle">Add Daily Work</h2>
        <form id="dailyWorkForm" onsubmit="saveDailyWork(event)">
            <div class="dw-form-group">
                <label>Date</label>
                <input type="date" id="dwFormDate" required />
            </div>
            <div class="dw-form-group">
                <label id="dwLabelClient">Client/Project</label>
                <input type="text" id="dwFormClient" required />
            </div>
            
            <div id="dwDynamicFields"></div>
            
            <div class="dw-form-group">
                <label>Work Description <span style="color:red;">*</span></label>
                <textarea id="dwFormDescription" rows="3" required placeholder="Detailed description of daily work done (Mandatory)..."></textarea>
            </div>

            <!-- Multiple URLs Input Group -->
            <div class="dw-form-group">
                <label>Work / Reference URLs <span style="color:#64748b; font-weight:normal; font-size:12px;">(Optional, Multiple)</span></label>
                <div id="dwUrlsContainer" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;"></div>
                <button type="button" onclick="addDwUrlInput()" style="background: #f1f5f9; color: #0f766e; border: 1px dashed #0f766e; padding: 7px 12px; border-radius: 6px; font-size: 12.5px; font-weight: 600; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 5px;">
                    <i class="fas fa-plus"></i> Add Another URL Link
                </button>
            </div>

            <!-- Multiple Images Upload Group -->
            <div class="dw-form-group">
                <label>Screenshots / Image Attachments <span style="color:#64748b; font-weight:normal; font-size:12px;">(Optional, Multiple Images)</span></label>
                <input type="file" id="dwFormImages" accept="image/*" multiple style="padding: 8px; font-size: 13px;" />
                <div id="dwExistingImagesContainer" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;"></div>
            </div>

            <div class="dw-form-group">
                <label>Status</label>
                <select id="dwFormStatus" required>
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Pending">Pending</option>
                    <option value="On Hold">On Hold</option>
                </select>
            </div>
            <div class="dw-form-group">
                <label>Remarks</label>
                <input type="text" id="dwFormRemarks" />
            </div>
            <button type="submit" class="dw-submit-btn" id="dwSubmitBtn">Save Work</button>
        </form>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function getRoleKey() {
    const user = getCurrentUserSafe();
    let role = user ? (user.role || '').toLowerCase().trim() : '';
    if (role === 'email marketing') return 'email_marketing';
    return role;
}

function openDailyWorkModal(editDataStr = null) {
    initDailyWorkModal();
    const roleKey = getRoleKey();
    const config = ROLE_CONFIG[roleKey] || ROLE_CONFIG['dev']; // fallback to dev

    document.getElementById('dwLabelClient').innerText = config.labels.client || 'Client/Project';
    
    // Build dynamic fields
    const dynamicContainer = document.getElementById('dwDynamicFields');
    dynamicContainer.innerHTML = '';
    
    const user = getCurrentUserSafe();
    const isRedSea = user && (user.comp_name || '').toLowerCase().includes('redsea');
    const themeClass = isRedSea ? 'theme-red' : 'theme-green';
    
    const submitBtn = document.getElementById('dwSubmitBtn');
    if (submitBtn) {
        submitBtn.className = `dw-submit-btn ${themeClass}`;
    }

    config.fields.forEach(f => {
        let inputHtml = '';
        if (f === 'platform') {
            inputHtml = `<select id="dwForm_${f}">
                <option value="">Select Platform</option>
                <option value="Instagram">Instagram</option>
                <option value="Facebook">Facebook</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="X">X (Twitter)</option>
                <option value="YouTube">YouTube</option>
                <option value="Other">Other</option>
            </select>`;
        } else if (f === 'content_type') {
            inputHtml = `<select id="dwForm_${f}">
                <option value="">Select Content Type</option>
                <option value="Post">Post</option>
                <option value="Reel">Reel</option>
                <option value="Story">Story</option>
                <option value="Carousel">Carousel</option>
                <option value="Video">Video</option>
                <option value="Other">Other</option>
            </select>`;
        } else if (f === 'seo_works') {
            inputHtml = `
                <div id="seoWorksList"></div>
                <button type="button" onclick="addSeoWorkField()" style="background: #e2e8f0; color: #475569; border: 1px dashed #cbd5e1; padding: 8px; border-radius: 6px; width: 100%; font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 5px;">+ Add Another Work Type</button>
                <input type="hidden" id="dwForm_${f}" />
            `;
        } else {
            let inputType = 'text';
            if (f === 'hours' || f === 'emails_sent' || f === 'calls_made' || f === 'meetings' || f === 'follow_ups' || f === 'amount') {
                inputType = 'number';
            }
            if (f === 'next_follow_up') {
                inputType = 'date';
            }
            inputHtml = `<input type="${inputType}" id="dwForm_${f}" />`;
        }
        
        dynamicContainer.innerHTML += `
            <div class="dw-form-group ${themeClass}">
                <label>${config.labels[f]}</label>
                ${inputHtml}
            </div>
        `;
    });

    // Reset or populate
    const form = document.getElementById('dailyWorkForm');
    form.reset();
    
    // Apply theme to static form groups
    const staticGroups = form.querySelectorAll('.dw-form-group:not(#dwDynamicFields .dw-form-group)');
    staticGroups.forEach(group => {
        group.classList.remove('theme-red', 'theme-green');
        group.classList.add(themeClass);
    });

    const urlsContainer = document.getElementById('dwUrlsContainer');
    if (urlsContainer) urlsContainer.innerHTML = '';

    const existingImgContainer = document.getElementById('dwExistingImagesContainer');
    if (existingImgContainer) existingImgContainer.innerHTML = '';
    const imagesFileInput = document.getElementById('dwFormImages');
    if (imagesFileInput) imagesFileInput.value = '';

    if (editDataStr) {
        try {
            const data = typeof editDataStr === 'string' ? JSON.parse(decodeURIComponent(editDataStr)) : editDataStr;
            currentDailyWorkEditId = data.id;
            document.getElementById('dwModalTitle').innerText = "Edit Daily Work";
            document.getElementById('dwSubmitBtn').innerText = "Update Work";
            
            document.getElementById('dwFormDate').value = data.work_date ? data.work_date.split('T')[0] : '';
            document.getElementById('dwFormClient').value = data.client_or_project || '';
            document.getElementById('dwFormDescription').value = (data.work_details && data.work_details.work_description) ? data.work_details.work_description : '';
            document.getElementById('dwFormStatus').value = data.status || 'Completed';
            document.getElementById('dwFormRemarks').value = data.remarks || '';
            
            if (data.work_details) {
                config.fields.forEach(f => {
                    const el = document.getElementById(`dwForm_${f}`);
                    if (el && data.work_details[f] !== undefined) {
                        if (f === 'seo_works') {
                            try {
                                const parsed = JSON.parse(data.work_details[f]);
                                parsed.forEach(item => addSeoWorkField(item.type, item.desc));
                            } catch(e) {
                                addSeoWorkField();
                            }
                        } else {
                            el.value = data.work_details[f];
                        }
                    }
                });

                // Populate URLs
                const urls = Array.isArray(data.work_details.urls) ? data.work_details.urls : (data.work_details.url ? [data.work_details.url] : []);
                if (urls.length > 0) {
                    urls.forEach(u => addDwUrlInput(u));
                } else {
                    addDwUrlInput();
                }

                // Populate Existing Images
                const images = Array.isArray(data.work_details.images) ? data.work_details.images : (data.work_details.image ? [data.work_details.image] : []);
                images.forEach(img => {
                    if (img && existingImgContainer) {
                        const safeImg = typeof img === 'string' ? img.replace(/"/g, '&quot;') : '';
                        const displayUrl = safeImg.startsWith('http') || safeImg.startsWith('/') || safeImg.startsWith('uploads/') ? safeImg : `/uploads/${safeImg}`;
                        existingImgContainer.innerHTML += `
                            <div style="position: relative; display: inline-block;">
                                <a href="${displayUrl}" target="_blank"><img src="${displayUrl}" onerror="this.parentElement.style.display='none';" style="width: 50px; height: 40px; border-radius: 4px; border: 1px solid #cbd5e1; object-fit: cover;"></a>
                                <input type="hidden" class="dw-existing-image-val" value="${safeImg}">
                                <button type="button" onclick="this.parentElement.remove()" style="position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 16px; height: 16px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Remove Image">&times;</button>
                            </div>
                        `;
                    }
                });
            } else {
                addDwUrlInput();
            }
        } catch (e) { 
            console.error(e); 
            addDwUrlInput();
        }
    } else {
        currentDailyWorkEditId = null;
        document.getElementById('dwModalTitle').innerText = "Add Daily Work";
        document.getElementById('dwSubmitBtn').innerText = "Save Work";
        document.getElementById('dwFormDate').value = new Date().toISOString().split('T')[0];
        if (config.fields.includes('seo_works')) {
            addSeoWorkField();
        }
        addDwUrlInput();
    }

    document.getElementById('dailyWorkModal').style.display = 'block';
}

function addSeoWorkField(type = '', desc = '') {
    const container = document.getElementById('seoWorksList');
    if (!container) return;
    
    const idx = container.children.length;
    const div = document.createElement('div');
    div.className = "seo-work-item";
    div.style.cssText = "background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; margin-bottom: 10px; position: relative;";
    
    div.innerHTML = `
        <button type="button" onclick="this.parentElement.remove(); syncSeoWorks();" style="position: absolute; right: 10px; top: 10px; background: none; border: none; color: #ef4444; cursor: pointer; font-size: 16px;">&times;</button>
        <div style="margin-bottom: 8px;">
            <label style="display:block; font-size: 12px; margin-bottom: 4px; color: #475569;">Work Type</label>
            <select class="seo-work-type" onchange="syncSeoWorks()" style="width: 100%; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
                <option value="">Select Work Type</option>
                <optgroup label="SEO">
                    <option value="On Page SEO" ${type === 'On Page SEO' ? 'selected' : ''}>On Page SEO</option>
                    <option value="Off Page SEO" ${type === 'Off Page SEO' ? 'selected' : ''}>Off Page SEO</option>
                    <option value="Technical SEO" ${type === 'Technical SEO' ? 'selected' : ''}>Technical SEO</option>
                    <option value="Keyword Research" ${type === 'Keyword Research' ? 'selected' : ''}>Keyword Research</option>
                    <option value="Backlink Creation" ${type === 'Backlink Creation' ? 'selected' : ''}>Backlink Creation</option>
                </optgroup>
                <optgroup label="Ads (Google/Meta)">
                    <option value="Campaign Setup" ${type === 'Campaign Setup' ? 'selected' : ''}>Campaign Setup</option>
                    <option value="Campaign Optimization" ${type === 'Campaign Optimization' ? 'selected' : ''}>Campaign Optimization</option>
                    <option value="Ad Copy / Creatives" ${type === 'Ad Copy / Creatives' ? 'selected' : ''}>Ad Copy / Creatives</option>
                    <option value="Budget Optimization" ${type === 'Budget Optimization' ? 'selected' : ''}>Budget Optimization</option>
                </optgroup>
                <optgroup label="SMO">
                    <option value="Social Media Strategy" ${type === 'Social Media Strategy' ? 'selected' : ''}>Social Media Strategy</option>
                    <option value="Content Creation" ${type === 'Content Creation' ? 'selected' : ''}>Content Creation</option>
                    <option value="Post Publishing" ${type === 'Post Publishing' ? 'selected' : ''}>Post Publishing</option>
                </optgroup>
                <option value="Other" ${type === 'Other' ? 'selected' : ''}>Other</option>
            </select>
        </div>
        <div>
            <label style="display:block; font-size: 12px; margin-bottom: 4px; color: #475569;">Description</label>
            <input type="text" class="seo-work-desc" oninput="syncSeoWorks()" value="${desc}" placeholder="Enter work details..." style="width: 100%; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
        </div>
    `;
    container.appendChild(div);
    syncSeoWorks();
}

function syncSeoWorks() {
    const container = document.getElementById('seoWorksList');
    const hiddenInput = document.getElementById('dwForm_seo_works');
    if (!container || !hiddenInput) return;
    
    const items = [];
    container.querySelectorAll('.seo-work-item').forEach(div => {
        const type = div.querySelector('.seo-work-type').value;
        const desc = div.querySelector('.seo-work-desc').value;
        if (type || desc) {
            items.push({ type, desc });
        }
    });
    
    hiddenInput.value = JSON.stringify(items);
}

function closeDailyWorkModal() {
    const modal = document.getElementById('dailyWorkModal');
    if (modal) modal.style.display = 'none';
}

async function saveDailyWork(event) {
    event.preventDefault();
    const user = getCurrentUserSafe();
    if (!user) return alert("User session not found.");
    
    const roleKey = getRoleKey();
    const config = ROLE_CONFIG[roleKey] || ROLE_CONFIG['dev'];

    const btn = document.getElementById('dwSubmitBtn');
    btn.disabled = true;
    btn.innerText = "Uploading & Saving...";

    try {
        // Handle Image Uploads
        const imageInput = document.getElementById('dwFormImages');
        let uploadedImages = [];

        // Collect existing preserved images
        document.querySelectorAll('.dw-existing-image-val').forEach(el => {
            if (el.value) uploadedImages.push(el.value);
        });

        if (imageInput && imageInput.files && imageInput.files.length > 0) {
            for (let i = 0; i < imageInput.files.length; i++) {
                const formData = new FormData();
                formData.append('file', imageInput.files[i]);
                try {
                    const uploadRes = await fetch('/api/upload-file', {
                        method: 'POST',
                        body: formData
                    });
                    const uploadData = await uploadRes.json();
                    if (uploadData.success) {
                        uploadedImages.push(uploadData.url);
                    }
                } catch(e) {
                    console.error("Failed to upload daily work image file", e);
                }
            }
        }

        const urlsList = collectDwUrls();

        const work_details = {
            work_description: document.getElementById('dwFormDescription').value,
            urls: urlsList,
            images: uploadedImages
        };
        
        config.fields.forEach(f => {
            const el = document.getElementById(`dwForm_${f}`);
            if (el) work_details[f] = el.value;
        });

        const payload = {
            userId: user.id,
            role_snapshot: roleKey,
            work_date: document.getElementById('dwFormDate').value,
            client_or_project: document.getElementById('dwFormClient').value,
            status: document.getElementById('dwFormStatus').value,
            remarks: document.getElementById('dwFormRemarks').value,
            work_details
        };

        let url = '/api/daily-work';
        let method = 'POST';
        
        if (currentDailyWorkEditId) {
            url = `/api/daily-work/${currentDailyWorkEditId}`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (data.success) {
            alert(data.message || "Saved successfully");
            closeDailyWorkModal();
            loadDailyWork();
        } else {
            alert(data.message || "Failed to save.");
        }
    } catch (err) {
        console.error(err);
        alert("Server error while saving.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Work";
    }
}

async function loadDailyWork() {
    const user = getCurrentUserSafe();
    if (!user) return;
    
    // Set default month filter if empty
    const monthFilter = document.getElementById('dwMonthFilter');
    const dateFilter = document.getElementById('dwDateFilter');
    
    if (!monthFilter.value && !dateFilter.value) {
        const now = new Date();
        monthFilter.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    let query = `?userId=${user.id}`;
    if (dateFilter.value) {
        query += `&date=${dateFilter.value}`;
        monthFilter.value = ''; // mutually exclusive
    } else if (monthFilter.value) {
        query += `&month=${monthFilter.value}`;
    }

    const tbody = document.getElementById('dwTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Loading...</td></tr>';
    
    try {
        const res = await fetch(`/api/daily-work/my${query}`);
        const result = await res.json();
        
        if (!result.success) throw new Error(result.message);
        
        const roleKey = getRoleKey();
        const config = ROLE_CONFIG[roleKey] || ROLE_CONFIG['dev'];
        
        // Build Header
        const thead = document.getElementById('dwTableHead');
        let thHtml = `
            <th>Date</th>
            <th>${config.labels.client || 'Client/Project'}</th>
            <th>Description</th>
        `;
        config.fields.forEach(f => {
            thHtml += `<th>${config.labels[f]}</th>`;
        });
        thHtml += `
            <th>Status</th>
            <th>Remarks</th>
            <th>Action</th>
        `;
        thead.innerHTML = thHtml;

        if (!result.data || result.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${4 + config.fields.length}" style="text-align:center;">No records found.</td></tr>`;
            return;
        }

        let tbHtml = '';
        result.data.forEach(row => {
            let details = row.work_details || {};
            if (typeof details === 'string') {
                try { details = JSON.parse(details); } catch(e) {}
            }
            
            const encodedRow = encodeURIComponent(JSON.stringify(row));
            const formattedDate = new Date(row.work_date).toLocaleDateString('en-IN');
            
            let descCell = escapeHtml(details.work_description || row.description || '-');
            descCell += renderDwMediaHtml(details);

            tbHtml += `<tr>
                <td>${formattedDate}</td>
                <td>${escapeHtml(row.client_or_project || '-')}</td>
                <td>${descCell}</td>`;
                
            config.fields.forEach(f => {
                if (f === 'seo_works') {
                    let formatted = '-';
                    if (details[f]) {
                        try {
                            const works = JSON.parse(details[f]);
                            formatted = works.map(w => `<div style="margin-bottom:4px;"><span style="background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">${escapeHtml(w.type)}</span> <span style="font-size:13px;">${escapeHtml(w.desc)}</span></div>`).join('');
                        } catch(e) {
                            formatted = escapeHtml(details[f]);
                        }
                    }
                    tbHtml += `<td>${formatted}</td>`;
                } else {
                    tbHtml += `<td>${escapeHtml(details[f] || '-')}</td>`;
                }
            });
            
            tbHtml += `
                <td><span class="dw-status-badge ${String(row.status).replace(/\s+/g, '-').toLowerCase()}">${escapeHtml(row.status)}</span></td>
                <td>${escapeHtml(row.remarks || '-')}</td>
                <td><button class="dw-edit-btn" onclick="openDailyWorkModal('${encodedRow}')"><i class="fas fa-edit"></i> Edit</button></td>
            </tr>`;
        });
        
        tbody.innerHTML = tbHtml;
        
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:red;">Error loading records.</td></tr>';
    }
}

// ---------------- ADMIN LOGIC ----------------

let allAdminDwEmployees = [];
let lastAdminDwScope = null;

async function populateDwAdminEmployees(selectedRole = '') {
    const select = document.getElementById('dwAdminEmployee');
    if (!select) return;
    
    let companyScope = '';
    if (typeof getAdminPanelCompanyScope === 'function') {
        companyScope = getAdminPanelCompanyScope();
    }
    
    try {
        // Fetch only if scope changed or cache is empty
        if (allAdminDwEmployees.length === 0 || lastAdminDwScope !== companyScope) {
            let url = `/api/admin/team-report`;
            if (companyScope) {
                url += `?companyScope=${encodeURIComponent(companyScope)}`;
            }
            const res = await fetch(url);
            const result = await res.json();
            if (result.success && result.data) {
                allAdminDwEmployees = result.data;
                lastAdminDwScope = companyScope;
            }
        }
        
        // Save current selection to restore it if it's still valid
        const currentVal = select.value;
        
        // Filter by role
        const filtered = selectedRole 
            ? allAdminDwEmployees.filter(u => String(u.role).toLowerCase() === String(selectedRole).toLowerCase())
            : allAdminDwEmployees;
            
        select.innerHTML = '<option value="">All Employees</option>';
        filtered.forEach(u => {
            select.innerHTML += `<option value="${u.id}">${u.name} (${u.role})</option>`;
        });
        
        // Restore value if present in new options
        if (currentVal && Array.from(select.options).some(opt => opt.value === currentVal)) {
            select.value = currentVal;
        }
    } catch(e) {
        console.error("Failed to load employees for DW dropdown", e);
    }
}

async function loadAdminDailyWork() {
    const tbody = document.getElementById('dwAdminTableBody');
    if (!tbody) return; // Not on admin page
    
    const roleEl = document.getElementById('dwAdminRole');
    const role = roleEl ? roleEl.value : '';
    await populateDwAdminEmployees(role);

    const dateFrom = document.getElementById('dwAdminDateFrom')?.value || '';
    const dateTo = document.getElementById('dwAdminDateTo')?.value || '';
    const employeeId = document.getElementById('dwAdminEmployee')?.value || '';
    
    // Automatically use scope in Admin Panel (from crm-security/admin.js)
    let companyScope = '';
    if (typeof getAdminPanelCompanyScope === 'function') {
        companyScope = getAdminPanelCompanyScope();
    }

    let url = `/api/admin/daily-work?companyScope=${encodeURIComponent(companyScope)}&role=${role}&employeeId=${employeeId}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading...</td></tr>';
    
    try {
        const res = await fetch(url);
        const result = await res.json();
        
        if (!result.success) throw new Error(result.message);
        
        const thead = document.getElementById('dwAdminTableHead');
        let config = null;
        if (role && ROLE_CONFIG[role]) {
            config = ROLE_CONFIG[role];
        }

        if (config) {
            let thHtml = `<th>Date</th><th>Employee</th><th>Role</th><th>${config.labels.client || 'Client/Project'}</th><th>Description</th>`;
            config.fields.forEach(f => { thHtml += `<th>${config.labels[f]}</th>`; });
            thHtml += `<th>Status</th><th>Remarks</th>`;
            if (thead) thead.innerHTML = thHtml;
        } else {
            if (thead) thead.innerHTML = `<th>Date</th><th>Employee</th><th>Role</th><th>Client/Project</th><th>Status</th><th>Remarks</th><th>Work Details</th>`;
        }

        if (!result.data || result.data.length === 0) {
            const cols = config ? (7 + config.fields.length) : 7;
            tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;">No records found for the selected filters.</td></tr>`;
            return;
        }
        
        let tbHtml = '';
        result.data.forEach(row => {
            let details = row.work_details || {};
            if (typeof details === 'string') {
                try { details = JSON.parse(details); } catch(e) {}
            }
            const formattedDate = new Date(row.work_date).toLocaleDateString('en-IN');
            const empName = `<b>${escapeHtml(row.employee_name || '-')}</b>`;
            const roleBadge = `<span style="text-transform:uppercase; font-size:12px; background:#e2e8f0; padding:2px 6px; border-radius:4px; color:#334155;">${escapeHtml(row.role_snapshot || row.employee_role || '')}</span>`;
            const statusBadge = `<span class="dw-status-badge ${String(row.status || '').replace(/\s+/g, '-').toLowerCase()}">${escapeHtml(row.status || '-')}</span>`;

            let descCell = escapeHtml(row.description || details.work_description || '-');
            descCell += renderDwMediaHtml(details);

            if (config) {
                let rowHtml = `<tr>
                    <td style="white-space:nowrap;">${formattedDate}</td>
                    <td>${empName}</td>
                    <td>${roleBadge}</td>
                    <td>${escapeHtml(row.client_or_project || '-')}</td>
                    <td>${descCell}</td>
                `;
                config.fields.forEach(f => {
                    const val = details[f] || '-';
                    if (typeof val === 'string' && val.startsWith('http')) {
                        rowHtml += `<td><a href="${escapeHtml(val)}" target="_blank" style="color:var(--admin-accent, #3b82f6); text-decoration:underline;">Link</a></td>`;
                    } else {
                        rowHtml += `<td>${escapeHtml(typeof val === 'object' ? JSON.stringify(val) : String(val))}</td>`;
                    }
                });
                rowHtml += `
                    <td>${statusBadge}</td>
                    <td>${escapeHtml(row.remarks || '-')}</td>
                </tr>`;
                tbHtml += rowHtml;
            } else {
                let detailsStr = '';
                for (const [k, v] of Object.entries(details)) {
                    if (k === 'urls' || k === 'images' || k === 'url' || k === 'image' || k === 'work_description') continue;
                    if (v && typeof v === 'string' && v.trim() !== '') {
                        const cleanK = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        detailsStr += `<div style="font-size:0.85em; margin-bottom:2px;"><b>${escapeHtml(cleanK)}:</b> ${escapeHtml(v)}</div>`;
                    }
                }
                const mediaHtml = renderDwMediaHtml(details);
                if (mediaHtml) detailsStr += `<div style="margin-top: 4px;">${mediaHtml}</div>`;

                tbHtml += `<tr>
                    <td style="white-space:nowrap;">${formattedDate}</td>
                    <td>${empName}</td>
                    <td>${roleBadge}</td>
                    <td>${escapeHtml(row.client_or_project || '-')}</td>
                    <td>${statusBadge}</td>
                    <td>${escapeHtml(row.remarks || '-')}</td>
                    <td>${detailsStr || '-'}</td>
                </tr>`;
            }
        });
        
        tbody.innerHTML = tbHtml;
        
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error loading records.</td></tr>';
    }
}

function exportDailyWork() {
    const dateFrom = document.getElementById('dwAdminDateFrom')?.value || '';
    const dateTo = document.getElementById('dwAdminDateTo')?.value || '';
    const role = document.getElementById('dwAdminRole')?.value || '';
    const employeeId = document.getElementById('dwAdminEmployee')?.value || '';
    
    let companyScope = '';
    if (typeof getAdminPanelCompanyScope === 'function') {
        companyScope = getAdminPanelCompanyScope();
    }
    
    let url = `/api/admin/daily-work/export?companyScope=${encodeURIComponent(companyScope)}&role=${role}&employeeId=${employeeId}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
    
    window.open(url, '_blank');
}

// Hook into existing view transitions to load data
const originalShowSection = window.showSection;
if (typeof originalShowSection === 'function') {
    window.showSection = function(sectionId) {
        originalShowSection(sectionId);
        if (sectionId === 'daily-work') {
        if (document.getElementById('dwAdminTableBody')) {
            loadAdminDailyWork();
        } else {
            loadDailyWork();
        }
    }
    };
}
