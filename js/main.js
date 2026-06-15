const WORKER_URL = 'https://quicksaveplus.seniworo.workers.dev';
const RENDER_API = 'https://quicksaveplus.onrender.com';

function resolveUrl(url) {
    if (!url) return url;
    if (url.startsWith('/')) return RENDER_API + url;
    return url;
}

function makeFilename(platform, ext, postId = null) {
    const id = postId ? postId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) : Date.now();
    return `QuickSavePlus-${platform}-${id}.${ext}`;
}

function extractId(url) {
    try {
        const u = new URL(url);
        const ttMatch = u.pathname.match(/\/video\/(\d+)/);
        if (ttMatch) return ttMatch[1];
        const igMatch = u.pathname.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
        if (igMatch) return igMatch[2];
        const ytV = u.searchParams.get('v');
        if (ytV) return ytV;
        const ytShort = u.pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/);
        if (ytShort) return ytShort[1];
        const xMatch = u.pathname.match(/\/status\/(\d+)/);
        if (xMatch) return xMatch[1];
        const fbVid = u.searchParams.get('vid') || u.searchParams.get('v');
        if (fbVid) return fbVid;
    } catch { }
    return null;
}

function placeholder(label = 'No+Preview') {
    return `https://placehold.co/600x340/131629/7c3aed?text=${label}`;
}

// ── DOM helpers (each page must have these elements) ──
function getEl(id) { return document.getElementById(id); }

function toggleLoading(on, msg) {
    const loader = getEl('loader');
    const loaderText = getEl('loaderText');
    const analyzeBtn = getEl('analyzeBtn');
    const pasteBtn = getEl('pasteBtn');
    if (loader) loader.style.display = on ? 'flex' : 'none';
    if (loaderText && msg) loaderText.textContent = msg;
    if (analyzeBtn) analyzeBtn.disabled = on;
    if (pasteBtn) pasteBtn.disabled = on;
}

function showError(msg) {
    const errorAlert = getEl('errorAlert');
    const errorText = getEl('errorText');
    if (errorText) errorText.textContent = msg;
    if (errorAlert) errorAlert.style.display = 'flex';
}

function hideError() {
    const errorAlert = getEl('errorAlert');
    if (errorAlert) errorAlert.style.display = 'none';
}

// ── Worker call ──
async function callWorker(mediaUrl, platform, isAudioOnly) {
    const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaUrl, platform, isAudioOnly }),
    });
    if (!res.ok) throw new Error('Proxy error — please retry.');
    const data = await res.json();
    if (data.status === 'error') throw new Error(data.text || 'Could not fetch this video.');
    return data;
}

// ── Download ──
async function processDownload(targetUrl, filename) {
    if (!targetUrl) { showError('Download URL not found.'); return; }
    const btn = event?.currentTarget;
    const orig = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Downloading…`; }
    try {
        const res = await fetch(targetUrl);
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl; a.download = filename; a.style.display = 'none';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
    } catch {
        window.open(targetUrl, '_blank');
    } finally {
        if (btn) { btn.innerHTML = orig; btn.disabled = false; }
    }
}

// ── Theme toggle ──
function initTheme() {
    const themeToggle = getEl('themeToggle');
    const themeIcon = getEl('themeIcon');
    const html = document.documentElement;
    if (!themeToggle) return;
    themeToggle.addEventListener('click', () => {
        const isDark = html.getAttribute('data-theme') === 'dark';
        const next = isDark ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        localStorage.setItem('qs-theme', next);
    });
}

// ── Sidebar ──
function initSidebar() {
    const hamburgerBtn = getEl('hamburgerBtn');
    const sidebar = getEl('sidebar');
    const sidebarOverlay = getEl('sidebarOverlay');
    if (!hamburgerBtn) return;
    hamburgerBtn.addEventListener('click', () => {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    });
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
}

function closeSidebar() {
    const sidebar = getEl('sidebar');
    const sidebarOverlay = getEl('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('open');
    document.body.style.overflow = '';
}

// ── FAQ ──
function toggleFaq(el) {
    const item = el.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
}

// ── Paste button ──
function initPaste(inputId) {
    const pasteBtn = getEl('pasteBtn');
    const input = getEl(inputId);
    if (!pasteBtn || !input) return;
    pasteBtn.addEventListener('click', async () => {
        hideError();
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                const text = await navigator.clipboard.readText();
                if (text.trim()) input.value = text.trim();
            } else {
                showError('Your browser blocks clipboard access. Please paste manually (Ctrl+V / Cmd+V).');
            }
        } catch {
            showError('Please grant clipboard permission to use the quick-paste feature.');
        }
    });
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') getEl('analyzeBtn')?.click();
    });
}

// ── Persist theme across pages ──
(function () {
    const saved = localStorage.getItem('qs-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    // Update icon once DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        const icon = document.getElementById('themeIcon');
        if (icon) icon.className = saved === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    });
})();

// Init on every page
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initSidebar();
});