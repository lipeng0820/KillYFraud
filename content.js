const isTopFrame = window.top === window.self;

if (isTopFrame) {
    console.log("🚀 [X 垃圾私信斩杀器] 已在主框架启动");
    console.log("[KXF] Top Frame Initialized.");
    
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
    
    // MutationObserver to watch DOM for GrokDrawerHeader
    const topObserver = new MutationObserver((mutations) => {
        injectJumpButton();
        
        const isRequestPage = window.location.href.includes('/requests');
        if (isRequestPage) {
            injectCheckboxes();
            injectBatchPanel();
        } else {
            removeBatchPanel();
        }
        
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
            sessionStorage.setItem("kxf_auto_report", "true");
            
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
            
            // Validate if this message belongs to the current batch item
            if (window.BatchRunner && window.BatchRunner.state === 'RUNNING') {
                if (event.data.batchId && event.data.batchId !== window.BatchRunner.currentBatchId) {
                    console.log("[KXF] Ignoring stale KILL_DONE message from old batch item.");
                    return;
                }
            }

            // Force hide and remove all report iframes
            const iframes = document.querySelectorAll('iframe[src*="report_story"]');
            iframes.forEach(iframe => {
                iframe.style.pointerEvents = 'none';
                iframe.style.opacity = '0';
                setTimeout(() => { try { iframe.remove(); } catch(e){} }, 500); 
            });
            tryCloseModal();
        } else if (event.data.type === "KXF_IS_ARMED_QUERY") {
            const isArmed = sessionStorage.getItem("kxf_auto_report") === "true";
            const batchId = window.BatchRunner ? window.BatchRunner.currentBatchId : null;
            if (event.source) {
                event.source.postMessage({ 
                    type: "KXF_IS_ARMED_RESPONSE", 
                    armed: isArmed,
                    batchId: batchId 
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
                    batchId: window.BatchRunner ? window.BatchRunner.currentBatchId : null
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
        currentBatchId: null,
        countDown: undefined,
        statusText: "",

        start() {
            const checked = Array.from(document.querySelectorAll('.kxf-checkbox:checked'));
            if (checked.length === 0) {
                alert("请先勾选需要斩杀的用户！");
                return;
            }
            this.state = 'RUNNING';
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
            this.updateUI();
            const checked = document.querySelectorAll('.kxf-checkbox:checked');
            checked.forEach(cb => cb.checked = false);
            document.querySelectorAll('.kxf-processing-highlight').forEach(el => el.classList.remove('kxf-processing-highlight'));
        },

        processNext() {
            if (this.state !== 'RUNNING' || this.isLocked) return;

            // Find next checked but not yet processed (highlighted) checkbox
            const checked = Array.from(document.querySelectorAll('.kxf-checkbox:checked'));
            const nextCb = checked.find(cb => !cb.dataset.kxfProcessed);

            if (!nextCb) {
                console.log("[KXF] Batch complete!");
                this.stop();
                alert("批量斩杀完成！");
                return;
            }

            this.isLocked = true;
            this.currentBatchId = Date.now();
            this.statusText = "寻找目标...";
            this.updateUI();

            const container = nextCb.closest('[data-testid="cellInnerDiv"]');
            if (container) {
                // Highlight and scroll
                document.querySelectorAll('.kxf-processing-highlight').forEach(el => el.classList.remove('kxf-processing-highlight'));
                container.classList.add('kxf-processing-highlight');
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Find the options button and trigger
                const optBtn = container.querySelector(`button[aria-label="选项菜单"]`);
                if (optBtn) {
                    console.log("[KXF] Batch: Starting next kill with ID:", this.currentBatchId);
                    nextCb.dataset.kxfProcessed = "true";
                    
                    // Trigger the existing click logic
                    sessionStorage.setItem("kxf_auto_report", "true");
                    document.querySelectorAll('[data-kxf-clicked]').forEach(el => delete el.dataset.kxfClicked);
                    
                    // Small delay to ensure scroll finished
                    setTimeout(() => {
                        this.statusText = "触发举报菜单...";
                        this.updateUI();
                        robustClickTop(optBtn);
                    }, 1000);
                } else {
                    console.warn("[KXF] Could not find options button for item, skipping.");
                    nextCb.dataset.kxfProcessed = "true";
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
                const total = allChecked.length;
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
            if (!conv || cell.querySelector('.kxf-cb-container')) return;

            // CRITICAL: Do NOT set cell.style.position = 'relative'. 
            // X uses absolute positioning for its virtual scroll. Overriding it breaks row heights.

            const cbContainer = document.createElement('div');
            cbContainer.className = 'kxf-cb-container';
            // Use absolute positioning inside the conv container and add padding to make space
            conv.style.position = 'relative';
            conv.style.paddingLeft = '42px'; 
            
            cbContainer.style.cssText = "position: absolute; left: 10px; top: 50%; transform: translateY(-50%); z-index: 101; display: flex; align-items: center; justify-content: center; width: 20px; height: 20px;";
            cbContainer.innerHTML = `<input type="checkbox" class="kxf-checkbox" style="width: 20px; height: 20px; cursor: pointer; accent-color: rgb(244,33,46);">`;
            
            conv.insertBefore(cbContainer, conv.firstChild);
            
            const checkbox = cbContainer.querySelector('input');
            const stop = (e) => e.stopPropagation();
            cbContainer.addEventListener('click', stop);
            cbContainer.addEventListener('mousedown', stop);
            cbContainer.addEventListener('mouseup', stop);

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    cell.style.backgroundColor = 'rgba(244, 33, 46, 0.1)';
                    delete checkbox.dataset.kxfProcessed;
                } else {
                    cell.style.backgroundColor = '';
                }
            });
        });
    }
    
    // Fallback: X's React is aggressive, re-check every second on request page
    setInterval(() => {
        if (window.location.href.includes('/requests')) {
            injectCheckboxes();
        }
    }, 1000);

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
            const boxes = document.querySelectorAll('.kxf-checkbox');
            const anyUnchecked = Array.from(boxes).some(b => !b.checked);
            boxes.forEach(b => {
                b.checked = anyUnchecked;
                delete b.dataset.kxfProcessed;
                // Trigger visual update
                const container = b.closest('[data-testid="cellInnerDiv"]');
                if (container) container.style.backgroundColor = b.checked ? 'rgba(244, 33, 46, 0.1)' : '';
            });
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

} else {
    // --- IFRAME CONTEXT (`https://x.com/i/safety/report_story`) ---
    
    if (window.location.href.includes('report_story')) {
        console.log("[KXF] Iframe Initialized.");
        
        let autoReportArmed = false;
        let currentBatchId = null;

        // Trust parent window's answer if we get one
        window.addEventListener("message", (event) => {
            if (event.data && event.data.type === "KXF_IS_ARMED_RESPONSE") {
                autoReportArmed = event.data.armed;
                currentBatchId = event.data.batchId;
                console.log("[KXF Iframe] Armed Status from Parent:", autoReportArmed, "Batch ID:", currentBatchId);
                if (autoReportArmed) {
                    processIframeFlow(); // Trigger immediately!
                }
            } else if (event.data && event.data.type === "KXF_DO_KILL") {
                const blockBtn = document.querySelector('#block-btn') || document.querySelector('button[value="block"]');
                if (blockBtn) {
                    console.log("[KXF Iframe] Kill Order received. Blocking!");
                    robustClick(blockBtn);
                    
                    // Send message immediately with Batch ID
                    window.parent.postMessage({ type: "KXF_KILL_DONE", batchId: event.data.batchId || currentBatchId }, "*");
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
            // If we are armed but none of the buttons exist, check if we are on the success screen
            const text = document.body.innerText || "";
            if (text.includes("感谢") || text.includes("完成") || text.includes("Thanks")) {
                console.log("[KXF Iframe] Detected Success Screen in Iframe. Signaling parent...");
                try {
                    window.parent.postMessage({ type: "KXF_KILL_DONE" }, "*");
                } catch(e) {}
            }
        }

        const iframeObserver = new MutationObserver(() => {
            processIframeFlow();
        });

        iframeObserver.observe(document.body, { childList: true, subtree: true });
    }
}
