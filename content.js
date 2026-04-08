const isTopFrame = window.top === window.self;

if (isTopFrame) {
    console.log("🚀 [X 垃圾私信斩杀器] 已在主框架启动");
    console.log("[KXF] Top Frame Initialized.");
    window.lastProcessedKillId = null;
    window.currentKillId = null;
    
    // --- 1. Quick Jump Button ---
    const JUMP_URL = "https://x.com/messages/requests";
    function injectJumpButton() {
        if (document.querySelector('.kxf-jump-btn')) return; // Already injected
        
        const btn = document.createElement('a');
        btn.className = 'kxf-jump-btn';
        btn.title = "X 垃圾私信斩杀器";
        
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" class="size-8" width="1em" height="1em" style="width: 26px; height: 26px;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="22" y1="12" x2="18" y2="12"></line>
                <line x1="6" y1="12" x2="2" y2="12"></line>
                <line x1="12" y1="6" x2="12" y2="2"></line>
                <line x1="12" y1="22" x2="12" y2="18"></line>
            </svg>
        `;
        
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = JUMP_URL;
        });
        
        document.body.appendChild(btn);
    }

    function createKillId(source = 'kill') {
        return `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    
    // --- 1. Settings & UI Management ---
    async function applySettings() {
        try {
            // Check if context is still valid
            if (!chrome.runtime?.id) {
                console.log("[KXF] Extension context invalidated. Stopping operations.");
                return;
            }

            const data = await chrome.storage.local.get(['enabled', 'batchEnabled']);
            
            if (data.enabled === false) {
                const btn = document.querySelector('.kxf-jump-btn');
                if (btn) btn.remove();
                removeBatchPanel();
                removeCheckboxes();
                return;
            }

            injectJumpButton();
            
            const isRequestPage = window.location.href.includes('/requests');
            if (isRequestPage && data.batchEnabled) {
                document.body.classList.add('kxf-batch-mode');
                injectCheckboxes();
                injectBatchPanel();
            } else {
                document.body.classList.remove('kxf-batch-mode');
                removeBatchPanel();
                removeCheckboxes();
            }
        } catch (e) {
            if (e.message.includes('context invalidated')) {
                // Silent stop
                return;
            }
            console.error("[KXF] applySettings error:", e);
        }
    }

    // Listen for setting changes from popup
    chrome.storage.onChanged.addListener((changes) => {
        if (!chrome.runtime?.id) return;
        
        if (changes.enabled || changes.batchEnabled) {
            console.log("[KXF] Settings changed, applying...");
            applySettings().catch(() => {});
        }
    });

    // Initial apply
    applySettings().catch(() => {});

    // MutationObserver to watch DOM for changes
    const topObserver = new MutationObserver(async (mutations) => {
        if (!chrome.runtime?.id) {
            topObserver.disconnect();
            return;
        }
        applySettings().catch(() => {});
        
        // Also watch for Report menu when auto-report is active
        if (sessionStorage.getItem("kxf_auto_report") === "true") {
            const menuItems = Array.from(document.querySelectorAll('div[role="menuitem"]'));
            const reportItem = menuItems.find(el => el.textContent.includes('举报 @'));
            
            if (reportItem && reportItem.dataset.kxfClicked !== "true") {
                reportItem.dataset.kxfClicked = "true";
                console.log("[KXF] Found 'Report' menu item, clicking...");
                
                // Native click + React simulated click
                reportItem.click();
                const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
                const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
                reportItem.dispatchEvent(mousedown);
                reportItem.dispatchEvent(mouseup);
            }
        }
    });
    
    topObserver.observe(document.body, { childList: true, subtree: true });
    
    // --- 2. Action Trigger for SVG click ---
    const TARGET_SVG_PATH = "M12 3.75c-4.56 0-8.25 3.69-8.25 8.25s3.69 8.25 8.25 8.25 8.25-3.69 8.25-8.25S16.56 3.75 12 3.75zM1.75 12C1.75 6.34 6.34 1.75 12 1.75S22.25 6.34 22.25 12 17.66 22.25 12 22.25 1.75 17.66 1.75 12zm8.84 0l-2.3-2.29 1.42-1.42 2.29 2.3 2.29-2.3 1.42 1.42-2.3 2.29 2.3 2.29-1.42 1.42-2.29-2.3-2.29 2.3-1.42-1.42 2.3-2.29z";
    
    document.addEventListener('click', (e) => {
        let path = null;
        if (e.target.tagName && e.target.tagName.toLowerCase() === 'path') {
            path = e.target;
        } else {
            const btn = e.target.closest('button') || e.target.closest('svg');
            if (btn) path = btn.querySelector('path');
        }

        if (path && path.getAttribute('d') === TARGET_SVG_PATH) {
            console.log("[KXF] Delete icon clicked. Arming Auto-Report!");
            window.currentKillId = createKillId('single');
            sessionStorage.setItem("kxf_auto_report", "true");
            
            // Extract handle for logging
            const container = e.target.closest('[data-testid="cellInnerDiv"]');
            if (container && window.BatchRunner) {
                const handleEl = container.querySelector('a[data-testid="DM_Conversation_Avatar"]') || 
                                 container.querySelector('a[href^="/"]');
                if (handleEl) {
                    const href = handleEl.getAttribute('href');
                    window.BatchRunner.currentTargetHandle = href.split('/').filter(p => p).shift();
                    console.log("[KXF] Manual target handle extracted:", window.BatchRunner.currentTargetHandle);
                }
            }

            // Critical: Reset all click markers on existing elements so we can trigger again
            // X often reuses menu elements and buttons; if we don't clear these, 
            // the second run will "think" it already clicked the button.
            document.querySelectorAll('[data-kxf-clicked]').forEach(el => delete el.dataset.kxfClicked);
            document.querySelectorAll('[data-kxf-seen]').forEach(el => delete el.dataset.kxfSeen);
        }
    }, true); // Added capture phase to prevent React from eating the event

    // --- 3. Message Listener for IFRAME interactions ---
    window.addEventListener("message", (event) => {
        if (!event.data) return;

        if (event.data.type === "KXF_SHOW_KILL_PROMPT") {
            showKillPrompt();
        } else if (event.data.type === "KXF_KILL_DONE") {
            console.log("[KXF] Action complete inside iframe. Cleaning up...");
            
            // Deduplicate by the kill session ID so single mode and batch mode are both protected.
            const msgKillId = event.data.killId ||
                              event.data.batchId ||
                              window.currentKillId ||
                              (window.BatchRunner ? window.BatchRunner.currentBatchId : null);
            if (msgKillId && window.lastProcessedKillId === msgKillId) {
                console.log("[KXF] Already processed this kill session. Ignoring duplicate.");
                return;
            }
            window.lastProcessedKillId = msgKillId;

            // Force hide and remove all report iframes
            const iframes = document.querySelectorAll('iframe[src*="report_story"]');
            iframes.forEach(iframe => {
                iframe.style.pointerEvents = 'none';
                iframe.style.opacity = '0';
                setTimeout(() => { try { iframe.remove(); } catch(e){} }, 500); 
            });

            // LOGGING: Record the ban
            const handle = window.BatchRunner ? window.BatchRunner.currentTargetHandle : "未知用户";
            recordBan(handle);

            tryCloseModal();
        } else if (event.data.type === "KXF_IS_ARMED_QUERY") {
            const isArmed = sessionStorage.getItem("kxf_auto_report") === "true";
            const batchId = window.BatchRunner ? window.BatchRunner.currentBatchId : null;
            const killId = window.currentKillId || batchId;
            if (event.source) {
                event.source.postMessage({ 
                    type: "KXF_IS_ARMED_RESPONSE", 
                    armed: isArmed,
                    batchId: batchId,
                    killId: killId
                }, "*");
            }
        }
    });

    // Aggressive retry closer: tries to click Done/Close until the iframe actually disappears
    function tryCloseModal() {
        let attempts = 0;
        console.log("[KXF] Starting aggressive modal closure sequence...");
        
        const tryClick = () => {
            attempts++;
            if (attempts > 60) { // Give up after ~15-20 seconds
                console.log("[KXF] Modal closure timeout. Giving up.");
                sessionStorage.removeItem("kxf_auto_report");
                window.currentKillId = null;
                return;
            }
            
            // 1. Identify the container
            const dialog = document.querySelector('[role="dialog"]');
            const root = dialog || document;
            
            // 2. Find anything that looks like a "Done" button
            const candidateElements = Array.from(root.querySelectorAll('button, [role="button"], div[dir="ltr"], span'));
            const doneCandidates = candidateElements.filter(el => {
                const text = (el.innerText || el.textContent || "").trim();
                return text === '完成' || text === 'Done';
            });

            // Map candidates to their actual button wrappers
            const doneBtns = doneCandidates.map(el => {
                // Return either the element itself if it's a button, or its closest button parent
                return el.closest('button') || el.closest('[role="button"]') || (el.tagName === 'BUTTON' ? el : null);
            }).filter(el => el);

            const closeBtn = root.querySelector('[data-testid="app-bar-close"]') || 
                             root.querySelector('[aria-label="关闭"]') ||
                             root.querySelector('[aria-label="Close"]');

            let anyClicked = false;
            
            // Try visible "完成" buttons
            const uniqueDone = [...new Set(doneBtns)];
            uniqueDone.forEach(btn => {
                if (btn.offsetParent !== null || btn.getClientRects().length > 0) { 
                    console.log("[KXF] Clicking 'Done' button candidate...");
                    robustClickTop(btn);
                    // Also try clicking the specific text element inside it just in case
                    const textEl = doneCandidates.find(c => btn.contains(c));
                    if (textEl && textEl !== btn) robustClickTop(textEl);
                    anyClicked = true;
                }
            });

            // Try the "X" if no "完成" button worked or was found
            if (!anyClicked && closeBtn && (closeBtn.offsetParent !== null || closeBtn.getClientRects().length > 0)) {
                console.log("[KXF] Clicking 'X' Close button...");
                robustClickTop(closeBtn);
                anyClicked = true;
            }

            // check if we succeeded
            setTimeout(() => {
                const iframe = document.querySelector('iframe[src*="report_story"]');
                if (iframe) {
                    tryClick(); 
                } else {
                    console.log("[KXF] Success: Modal is gone.");
                    sessionStorage.removeItem("kxf_auto_report");
                    window.currentKillId = null;
                    
                    // If batching, move to next after cooling down
                    if (window.BatchRunner && window.BatchRunner.state === 'RUNNING') {
                        window.BatchRunner.statusText = "清理环境中...";
                        window.BatchRunner.updateUI();
                        
                        setTimeout(() => {
                            window.BatchRunner.isLocked = false;
                            window.BatchRunner.processNext();
                        }, 2500); // 2.5s mandatory cooldown for React/X state sync
                    }
                }
            }, 300); // Fast interval
        };
        
        setTimeout(tryClick, 400); 
    }

    // Helper to force React 18+ to recognize click with full pointer chain and coordinates
    function robustClickTop(node) {
        if (!node || typeof node.dispatchEvent !== 'function') return;
        
        try {
            node.focus();
            const rect = node.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            
            const opts = { 
                bubbles: true, 
                cancelable: true, 
                view: window, 
                buttons: 1,
                clientX: x,
                clientY: y,
                screenX: x,
                screenY: y,
                pointerId: 1,
                isPrimary: true,
                pointerType: 'mouse'
            };
            
            // Dispatch the full gamut of interactions that React/Modern JS apps look for
            const eventSequence = [
                ['mouseenter', MouseEvent],
                ['mouseover', MouseEvent],
                ['pointerover', PointerEvent],
                ['pointerenter', PointerEvent],
                ['pointerdown', PointerEvent],
                ['mousedown', MouseEvent],
                ['pointerup', PointerEvent],
                ['mouseup', MouseEvent],
                ['click', MouseEvent]
            ];
            
            eventSequence.forEach(([type, Constructor]) => {
                node.dispatchEvent(new Constructor(type, opts));
            });
            
            if (typeof node.click === 'function') node.click();
            
        } catch (e) {
            console.error("[KXF] Error during robust click:", e);
        }
    }

    // Storage Helper for Logging
    async function recordBan(handle) {
        try {
            if (!chrome.runtime?.id) return;

            console.log(`[KXF] Recording ban for: ${handle}`);
            const data = await chrome.storage.local.get(['banCount', 'banLogs']);
            const newCount = (data.banCount || 0) + 1;
            const newLogs = data.banLogs || [];
            
            newLogs.push({
                handle: handle.startsWith('@') ? handle : `@${handle}`,
                timestamp: Date.now()
            });
            
            // Keep only last 200 logs
            if (newLogs.length > 200) newLogs.shift();
            
            await chrome.storage.local.set({ 
                banCount: newCount, 
                banLogs: newLogs 
            });
        } catch (e) {
            if (e.message?.includes('context invalidated')) return;
            console.error("[KXF] recordBan error:", e);
        }
    }

    function showKillPrompt() {
        if (document.getElementById('kxf-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'kxf-overlay';
        overlay.className = 'kxf-overlay';
        
        overlay.innerHTML = `
            <div class="kxf-modal">
                <h2>🔪 X 垃圾私信斩杀器</h2>
                <p>是否执行“自动报蔽”流程？</p>
                <div class="kxf-btn-group">
                    <button class="kxf-btn kxf-btn-cancel" id="kxf-cancel">仅举报</button>
                    <button class="kxf-btn kxf-btn-kill" id="kxf-kill">报蔽之 (3s)</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);

        let countdown = 3;
        const killBtn = document.getElementById('kxf-kill');
        const cancelBtn = document.getElementById('kxf-cancel');

        const doKill = () => {
            overlay.innerHTML = `<div class="kxf-modal"><h2>🔪 Killing...</h2></div>`;
            // Broadcast to all iframes
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                iframe.contentWindow.postMessage({ 
                    type: "KXF_DO_KILL",
                    batchId: window.BatchRunner ? window.BatchRunner.currentBatchId : null,
                    killId: window.currentKillId || (window.BatchRunner ? window.BatchRunner.currentBatchId : null)
                }, "*");
            });
            setTimeout(() => {
                overlay.remove();
            }, 1000); // Give the UI a second before removing the overlay, to let the background clicks process
        };

        const timer = setInterval(() => {
            countdown--;
            if (window.BatchRunner) window.BatchRunner.countDown = countdown;
            if (window.BatchRunner) window.BatchRunner.updateUI();

            if (countdown > 0) {
                killBtn.textContent = `报蔽之 (${countdown}s)`;
            } else {
                clearInterval(timer);
                if (window.BatchRunner) delete window.BatchRunner.countDown;
                doKill();
            }
        }, 1000);

        cancelBtn.addEventListener('click', () => {
            clearInterval(timer);
            if (window.BatchRunner) delete window.BatchRunner.countDown;
            overlay.remove();
            tryCloseModal();
        });

        killBtn.addEventListener('click', () => {
            clearInterval(timer);
            if (window.BatchRunner) delete window.BatchRunner.countDown;
            doKill();
        });
    }

    // --- 4. Batch Processing Implementation ---

    window.BatchRunner = {
        state: 'IDLE', // IDLE, RUNNING, PAUSED
        isLocked: false,
        totalTasks: 0,
        countDown: undefined,
        statusText: "",
        currentTargetHandle: null,
        selectedHandles: new Set(),
        taskQueue: [],

        start() {
            if (this.selectedHandles.size === 0) {
                alert("请先勾选需要斩杀的用户！");
                return;
            }
            this.state = 'RUNNING';
            this.taskQueue = Array.from(this.selectedHandles);
            this.totalTasks = this.taskQueue.length;
            this.isLocked = false;
            this.updateUI();
            this.processNext();
        },

        pause() {
            this.state = 'PAUSED';
            this.updateUI();
        },

        resume() {
            this.state = 'RUNNING';
            this.updateUI();
            this.processNext();
        },

        stop() {
            this.state = 'IDLE';
            this.isLocked = false;
            this.currentBatchId = null;
            this.currentTargetHandle = null;
            this.taskQueue = [];
            this.selectedHandles.clear();
            window.currentKillId = null;
            this.updateUI();
            
            // Clear all checkboxes in DOM
            document.querySelectorAll('.kxf-checkbox').forEach(cb => cb.checked = false);
            document.querySelectorAll('.kxf-processing-highlight').forEach(el => el.classList.remove('kxf-processing-highlight'));
            document.querySelectorAll('div[data-testid="cellInnerDiv"]').forEach(cell => cell.style.backgroundColor = '');
        },

        processNext() {
            if (this.state !== 'RUNNING' || this.isLocked) return;

            if (this.taskQueue.length === 0) {
                console.log("[KXF] Batch complete!");
                this.stop();
                alert("批量斩杀完成！");
                return;
            }

            const nextHandle = this.taskQueue.shift();
            this.currentTargetHandle = nextHandle;
            
            // Try to find the row for this handle in the DOM
            const cells = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"]'));
            const targetCell = cells.find(cell => {
                const hEl = cell.querySelector('a[data-testid="DM_Conversation_Avatar"]') || 
                            cell.querySelector('a[href^="/"]');
                if (!hEl) return false;
                const href = hEl.getAttribute('href');
                const handle = href.split('/').filter(p => p).shift();
                return handle === nextHandle;
            });

            if (!targetCell) {
                console.warn(`[KXF] Target handle @${nextHandle} not found in current view. Skipping.`);
                this.processNext();
                return;
            }

            this.isLocked = true;
            this.currentBatchId = createKillId('batch');
            window.currentKillId = this.currentBatchId;
            this.statusText = `正在斩杀 @${nextHandle}...`;
            this.updateUI();

            const container = targetCell;
            if (container) {
                // Highlight and scroll
                document.querySelectorAll('.kxf-processing-highlight').forEach(el => el.classList.remove('kxf-processing-highlight'));
                container.classList.add('kxf-processing-highlight');
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Find the options button and trigger
                const optBtn = container.querySelector(`button[aria-label="选项菜单"]`);
                if (optBtn) {
                    // Mark this handle as done in the UI persistence
                    this.selectedHandles.delete(nextHandle);
                    
                    // Trigger the existing click logic
                    sessionStorage.setItem("kxf_auto_report", "true");
                    document.querySelectorAll('[data-kxf-clicked]').forEach(el => delete el.dataset.kxfClicked);
                    
                    // Small delay to ensure scroll finished
                    setTimeout(() => {
                        this.statusText = "发现菜单...";
                        this.updateUI();
                        robustClickTop(optBtn);
                    }, 1000);
                } else {
                    console.warn("[KXF] Could not find options button for item, skipping.");
                    this.isLocked = false;
                    this.processNext();
                }
            }
        },

        updateUI() {
            const panel = document.getElementById('kxf-batch-panel');
            if (!panel) return;

            const startBtn = panel.querySelector('.kxf-btn-start');
            const pauseBtn = panel.querySelector('.kxf-btn-pause');
            const stopBtn = panel.querySelector('.kxf-btn-stop');
            const progressContainer = panel.querySelector('.kxf-progress-container');

            if (this.state === 'IDLE') {
                startBtn.classList.remove('kxf-hidden');
                pauseBtn.classList.add('kxf-hidden');
                stopBtn.classList.add('kxf-hidden');
                progressContainer.classList.add('kxf-hidden');
            } else {
                startBtn.classList.add('kxf-hidden');
                pauseBtn.classList.remove('kxf-hidden');
                stopBtn.classList.remove('kxf-hidden');
                progressContainer.classList.remove('kxf-hidden');
                pauseBtn.textContent = this.state === 'RUNNING' ? '暂停' : '继续';

                // Update Progress Data
                const allChecked = Array.from(document.querySelectorAll('.kxf-checkbox:checked'));
                const processed = allChecked.filter(cb => cb.dataset.kxfProcessed === "true").length;
                const total = this.totalTasks || allChecked.length;
                const percent = Math.round((processed / total) * 100);

                const countEl = panel.querySelector('.kxf-progress-count');
                const barEl = panel.querySelector('.kxf-progress-bar-fill');
                
                // Show countdown or status if active
                if (this.countDown !== undefined) {
                    countEl.innerHTML = `<span style="color:rgb(244,33,46); font-weight:bold;">斩杀中: ${this.countDown}s</span> | ${processed} / ${total}`;
                } else if (this.statusText) {
                    countEl.innerHTML = `<span style="color:#1d9bf0;">${this.statusText}</span> | ${processed} / ${total}`;
                } else {
                    countEl.textContent = `${processed} / ${total}`;
                }
                
                barEl.style.width = `${percent}%`;
            }
        }
    };

    function injectCheckboxes() {
        const cells = document.querySelectorAll('div[data-testid="cellInnerDiv"]');
        cells.forEach(cell => {
            const conv = cell.querySelector('div[data-testid="conversation"]');
            if (!conv) return;

            // Extract the handle for this row
            const handleEl = cell.querySelector('a[data-testid="DM_Conversation_Avatar"]') || 
                             cell.querySelector('a[href^="/"]');
            if (!handleEl) return;
            const href = handleEl.getAttribute('href');
            const handle = href.split('/').filter(p => p).shift();
            if (!handle) return;

            let checkboxContainer = cell.querySelector('.kxf-cb-container');
            let checkbox;

            if (!checkboxContainer) {
                checkboxContainer = document.createElement('div');
                checkboxContainer.className = 'kxf-cb-container';
                checkboxContainer.innerHTML = `<input type="checkbox" class="kxf-checkbox" style="width: 20px; height: 20px; cursor: pointer; accent-color: rgb(244,33,46);">`;
                conv.insertBefore(checkboxContainer, conv.firstChild);
                
                checkbox = checkboxContainer.querySelector('input');
                const stop = (e) => e.stopPropagation();
                checkboxContainer.addEventListener('click', stop);
                checkboxContainer.addEventListener('mousedown', stop);
                checkboxContainer.addEventListener('mouseup', stop);

                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        window.BatchRunner.selectedHandles.add(handle);
                        cell.style.backgroundColor = 'rgba(244, 33, 46, 0.1)';
                    } else {
                        window.BatchRunner.selectedHandles.delete(handle);
                        cell.style.backgroundColor = '';
                    }
                    if (window.BatchRunner.state === 'IDLE') {
                        window.BatchRunner.updateUI();
                    }
                });
            } else {
                checkbox = checkboxContainer.querySelector('input');
            }

            // Sync visual state with memory
            const isSelected = window.BatchRunner.selectedHandles.has(handle);
            if (checkbox.checked !== isSelected) {
                checkbox.checked = isSelected;
                cell.style.backgroundColor = isSelected ? 'rgba(244, 33, 46, 0.1)' : '';
            }
        });
    }
    
    // Fallback: X's React is aggressive, re-check occasionally
    const mainInterval = setInterval(() => {
        if (!chrome.runtime?.id) {
            clearInterval(mainInterval);
            return;
        }
        applySettings().catch(() => {});
    }, 2000);

    function injectBatchPanel() {
        if (document.getElementById('kxf-batch-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'kxf-batch-panel';
        panel.className = 'kxf-batch-panel';
        panel.innerHTML = `
            <div class="kxf-batch-title">批量斩杀控制</div>
            <button class="kxf-batch-btn kxf-select-all-btn">全选/取消</button>
            <button class="kxf-batch-btn kxf-btn-primary kxf-btn-start">🚀 开始批量斩杀</button>
            <button class="kxf-batch-btn kxf-btn-secondary kxf-btn-pause kxf-hidden">暂停</button>
            <button class="kxf-batch-btn kxf-btn-stop kxf-hidden">停止</button>
            
            <div class="kxf-progress-container kxf-hidden">
                <div class="kxf-progress-text">
                    <span>进度</span>
                    <span class="kxf-progress-count">0 / 0</span>
                </div>
                <div class="kxf-progress-bar-bg">
                    <div class="kxf-progress-bar-fill"></div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        panel.querySelector('.kxf-select-all-btn').addEventListener('click', () => {
            const cells = document.querySelectorAll('div[data-testid="cellInnerDiv"]');
            const visibleHandles = [];
            cells.forEach(cell => {
                const hEl = cell.querySelector('a[data-testid="DM_Conversation_Avatar"]') || 
                            cell.querySelector('a[href^="/"]');
                if (hEl) {
                    const href = hEl.getAttribute('href');
                    const handle = href.split('/').filter(p => p).shift();
                    if (handle) visibleHandles.push(handle);
                }
            });

            const allVisibleSelected = visibleHandles.every(h => window.BatchRunner.selectedHandles.has(h));
            
            if (allVisibleSelected) {
                // Deselect all visible
                visibleHandles.forEach(h => window.BatchRunner.selectedHandles.delete(h));
            } else {
                // Select all visible
                visibleHandles.forEach(h => window.BatchRunner.selectedHandles.add(h));
            }
            
            // Sync UI
            injectCheckboxes();
            window.BatchRunner.updateUI();
        });

        panel.querySelector('.kxf-btn-start').addEventListener('click', () => window.BatchRunner.start());
        
        panel.querySelector('.kxf-btn-pause').addEventListener('click', () => {
            if (window.BatchRunner.state === 'RUNNING') window.BatchRunner.pause();
            else window.BatchRunner.resume();
        });

        panel.querySelector('.kxf-btn-stop').addEventListener('click', () => window.BatchRunner.stop());
    }

    function removeBatchPanel() {
        const panel = document.getElementById('kxf-batch-panel');
        if (panel) panel.remove();
    }

    function removeCheckboxes() {
        // 1. Remove the checkbox containers
        document.querySelectorAll('.kxf-cb-container').forEach(el => el.remove());
        
        // 2. Reset cell background colors
        document.querySelectorAll('div[data-testid="cellInnerDiv"]').forEach(cell => {
            if (cell.style.backgroundColor.includes('rgba(244, 33, 46, 0.1)')) {
                cell.style.backgroundColor = '';
            }
        });
    }

} else {
    // --- IFRAME CONTEXT (`https://x.com/i/safety/report_story`) ---
    
    if (window.location.href.includes('report_story')) {
        console.log("[KXF] Iframe Initialized.");
        
        let autoReportArmed = false;
        let currentBatchId = null;
        let currentKillId = null;
        window.kxfDoneSent = false;

        // Trust parent window's answer if we get one
        window.addEventListener("message", (event) => {
            if (event.data && event.data.type === "KXF_IS_ARMED_RESPONSE") {
                autoReportArmed = event.data.armed;
                currentBatchId = event.data.batchId;
                currentKillId = event.data.killId || currentKillId;
                console.log("[KXF Iframe] Armed Status from Parent:", autoReportArmed, "Batch ID:", currentBatchId, "Kill ID:", currentKillId);
                if (autoReportArmed) {
                    processIframeFlow(); // Trigger immediately!
                }
            } else if (event.data && event.data.type === "KXF_DO_KILL") {
                const blockBtn = document.querySelector('#block-btn') || document.querySelector('button[value="block"]');
                currentKillId = event.data.killId || currentKillId;
                if (blockBtn) {
                    console.log("[KXF Iframe] Kill Order received. Blocking!");
                    robustClick(blockBtn);
                    
                    if (!window.kxfDoneSent) {
                        window.kxfDoneSent = true;
                        // Notify parent immediately so it can close the modal without waiting for another DOM mutation.
                        window.parent.postMessage({ 
                            type: "KXF_KILL_DONE",
                            batchId: event.data.batchId || currentBatchId,
                            killId: currentKillId || event.data.batchId || currentBatchId
                        }, "*");
                    }
                }
            }
        });

        // Request state from parent proactively
        try {
            window.parent.postMessage({ type: "KXF_IS_ARMED_QUERY" }, "*");
        } catch(e) {}

        // Fallback: check sessionStorage just in case SAME-ORIGIN allows it
        try {
            if (sessionStorage.getItem("kxf_auto_report") === "true") {
                autoReportArmed = true;
                setTimeout(processIframeFlow, 100);
            }
        } catch (e) {}

        // Helper to force React to recognize click
        function robustClick(node) {
            node.click();
            const opts = { bubbles: true, cancelable: true, view: window };
            node.dispatchEvent(new MouseEvent('mousedown', opts));
            node.dispatchEvent(new MouseEvent('mouseup', opts));
        }

        function processIframeFlow() {
            if (!autoReportArmed) return;

            // 1. Click "Spam" option
            const spamBtn = document.querySelector('#spam-btn') || document.querySelector('button[value="SpamOption"]');
            if (spamBtn && spamBtn.dataset.kxfClicked !== "true") {
                console.log("[KXF Iframe] Found Spam button, clicking.");
                spamBtn.dataset.kxfClicked = "true";
                robustClick(spamBtn);
                return;
            }
            
            // 2. Click "Submit" after marking spam
            const submitBtn = document.querySelector('.submit-btn');
            if (submitBtn && submitBtn.dataset.kxfClicked !== "true") {
                console.log("[KXF Iframe] Found Submit button, clicking.");
                submitBtn.dataset.kxfClicked = "true";
                robustClick(submitBtn);
                return;
            }

            // 3. Wait for "Block" option
            const blockBtn = document.querySelector('#block-btn') || document.querySelector('button[value="block"]');
            if (blockBtn && blockBtn.dataset.kxfSeen !== "true") {
                console.log("[KXF Iframe] Found Block button, halting to ask for Kill.");
                blockBtn.dataset.kxfSeen = "true";
                // Notify Top Frame to show KILL prompt
                try {
                    window.parent.postMessage({ type: "KXF_SHOW_KILL_PROMPT" }, "*");
                } catch (e) {
                    console.error("[KXF] Could not message parent window:", e);
                }
                return;
            }

            // 4. Check for Success Step (if blockers are gone)
            const isBlockVisible = !!(document.querySelector('#block-btn') || document.querySelector('button[value="block"]'));
            const isSpamVisible = !!(document.querySelector('#spam-btn') || document.querySelector('button[value="SpamOption"]'));
            const isSubmitVisible = !!(document.querySelector('.submit-btn'));

            if (!isBlockVisible && !isSpamVisible && !isSubmitVisible) {
                const text = document.body.innerText || "";
                if (text.includes("感谢") || text.includes("完成") || text.includes("Thanks")) {
                    if (window.kxfDoneSent) return;
                    
                    window.kxfDoneSent = true;
                    console.log("[KXF Iframe] Detected Success Screen in Iframe. Signaling parent...");
                    try {
                        window.parent.postMessage({ 
                            type: "KXF_KILL_DONE", 
                            batchId: currentBatchId,
                            killId: currentKillId || currentBatchId
                        }, "*");
                    } catch(e) {}
                }
            }
        }

        const iframeObserver = new MutationObserver(() => {
            processIframeFlow();
        });

        iframeObserver.observe(document.body, { childList: true, subtree: true });
    }
}
