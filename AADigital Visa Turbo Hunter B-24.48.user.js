// ==UserScript==
// @name         AADigital Visa Turbo Hunter FINAL B
// @namespace    http://tampermonkey.net/
// @version      24.48
// @description  Auto-fill, inject date, retry at 58.900 with big clock and beep on click
// @match        *://egy.almaviva-visa.it/appointment*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const MAX_ATTEMPTS = 25;
    const CHECK_INTERVAL_MS = 5;
    let attempts = 0;
    let retryTimer = null;
    let hunting = false;
    let lastTriggerMinute = -1;
    let fieldsReady = false;
    let appointmentFound = false;

    function setSelection(key, value) {
        localStorage.setItem('almaviva_' + key, value);
    }

    function getSelection(key) {
        return localStorage.getItem('almaviva_' + key);
    }

    function initScript() {
        createClock();
        createControlPanel();
        waitForFieldsProperly();
    }

    function createClock() {
        const clockDiv = document.createElement('div');
        clockDiv.style.cssText = 'position:fixed;top:400px;right:5px;padding:10px 15px;background:#007bff;color:white;font-size:24px;font-weight:bold;z-index:9999;border-radius:6px;box-shadow:0 0 6px rgba(0,0,0,0.3);';
        document.body.appendChild(clockDiv);
        setInterval(() => {
            const now = new Date();
            clockDiv.innerText = now.toLocaleTimeString() + '.' + now.getMilliseconds().toString().padStart(3, '0');
        }, 50);
    }

    function createControlPanel() {
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;top:100px;right:5px;width:260px;padding:8px;background:#fff;border:1px solid #007bff;z-index:9999;border-radius:5px;font-size:13px;';
        container.innerHTML = `
            <label>Center:</label>
            <select id="center" style="width:100%;padding:4px;">
                <option value="mat-option-0">Cairo</option>
                <option value="mat-option-1">Alexandria</option>
            </select>
            <label>Visa:</label>
            <select id="visaType" style="width:100%;padding:4px;">
                <option value="mat-option-4">Business</option>
                <option value="mat-option-7">Tourism</option>
                <option value="mat-option-6">Study</option>
            </select>
            <label>Date:</label>
            <input id="dateInput" type="date" style="width:100%;padding:4px;margin-bottom:5px;">
            <button id="startRefreshBtn" style="width:100%;padding:8px;margin-top:5px;background:#28a745;color:#fff;border:none;">Start (Refresh)</button>
            <button id="startRetryBtn" style="width:49%;padding:8px;margin-top:5px;background:#ffc107;color:#000;border:none;float:left;">Start Hunting</button>
            <button id="stopRetryBtn" style="width:49%;padding:8px;margin-top:5px;background:#dc3545;color:#fff;border:none;float:right;">Stop</button>
            <div style="clear:both;"></div>
            <p id="retries" style="text-align:center;color:#dc3545;font-weight:bold;margin-top:8px;font-size:16px;">Attempts: 0</p>
        `;
        document.body.appendChild(container);

        document.getElementById('center').value = getSelection('center') || 'mat-option-0';
        document.getElementById('visaType').value = getSelection('visaType') || 'mat-option-4';
        document.getElementById('dateInput').value = getSelection('selectedDate') || new Date().toISOString().split('T')[0];

        document.getElementById('center').addEventListener('change', () => setSelection('center', document.getElementById('center').value));
        document.getElementById('visaType').addEventListener('change', () => setSelection('visaType', document.getElementById('visaType').value));
        document.getElementById('dateInput').addEventListener('change', () => setSelection('selectedDate', document.getElementById('dateInput').value));



        document.getElementById('startRetryBtn').onclick = () => {
            if (!hunting && fieldsReady) startHunting();
        };

        document.getElementById('stopRetryBtn').onclick = () => {
            stopHunting();
            alert('Hunting manually stopped.');
        };
    }

    function waitForFieldsProperly() {
        const check = setInterval(() => {
            const centerDropdown = document.querySelector('#mat-select-value-1');
            const visaDropdown = document.querySelector('#mat-select-value-3');
            const cityField = document.querySelector('input[placeholder*="city of entry"]');
            const checkboxes = document.querySelectorAll('input[type=checkbox]');
            const dateField = document.querySelector('input[placeholder="DD/MM/YYYY"]');

            if (centerDropdown && visaDropdown && cityField && dateField && checkboxes.length > 0) {
                clearInterval(check);
                setTimeout(() => {
                    fillForm();
                }, 600);
            }
        }, 50);
    }

    function fillForm() {
        selectDropdown('#mat-select-value-1', getSelection('center'), () => {
            selectDropdown('#mat-select-value-5', 'mat-option-2', () => {
                selectDropdown('#mat-select-value-3', getSelection('visaType'), () => {
                    fillInputs(() => {
                        fieldsReady = true;
                        injectDateByCalendarClick(() => {
                            clickAvailability(); // Initial click
                        });
                    });
                });
            });
        });
    }

    function selectDropdown(selector, optionId, callback) {
        const dropdown = document.querySelector(selector);
        if (dropdown && optionId) {
            dropdown.click();
            const waitOption = setInterval(() => {
                const option = document.getElementById(optionId);
                if (option) {
                    clearInterval(waitOption);
                    option.click();
                    setTimeout(callback, 300);
                }
            }, 50);
        }
    }

    function fillInputs(callback) {
        const cityField = document.querySelector('input[placeholder*="city of entry"]');
        if (cityField) {
            cityField.value = 'Rome';
            cityField.dispatchEvent(new Event('input', { bubbles: true }));
        }
        document.querySelectorAll('input[type=checkbox]').forEach(cb => {
            if (!cb.checked) cb.click();
        });
        setTimeout(callback, 200);
    }

    function injectDateByCalendarClick(callback) {
        const calendarButton = document.querySelector('button[aria-label*="Open calendar"]');
        if (!calendarButton) {
            console.warn("❌ Calendar button not found.");
            return;
        }

        calendarButton.click();

        setTimeout(() => {
            function sendKey(key) {
                const keyCodeMap = { "ArrowDown": 40, "ArrowLeft": 37, "Enter": 13 };
                const target = document.activeElement;
                const e = new KeyboardEvent("keydown", {
                    key: key,
                    code: key,
                    keyCode: keyCodeMap[key],
                    which: keyCodeMap[key],
                    bubbles: true
                });
                target.dispatchEvent(e);
            }

            sendKey("ArrowDown");
            setTimeout(() => {
                sendKey("ArrowDown");
                setTimeout(() => {
                    sendKey("ArrowLeft");
                    setTimeout(() => {
                        sendKey("Enter");
                        console.log("✅ Date selected via keyboard simulation");
                        setTimeout(callback, 300);
                    }, 100);
                }, 100);
            }, 100);
        }, 300);
    }

    function playClickBeep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = 950;
            gain.gain.value = 0.1;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) {
            console.warn("⚠️ AudioContext beep failed.");
        }
    }

    function clickAvailability() {
        const button = document.evaluate(
            '//*[@id="cdk-step-content-0-0"]/app-memebers-number/div[2]/div/button',
            document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
        ).singleNodeValue;

        if (button) {
            playClickBeep();// Play short beep
            button.click();
            attempts++;
            document.getElementById('retries').innerText = `Attempts: ${attempts}`;
        }
    }

    function startHunting() {
        hunting = true;
        retryTimer = setInterval(() => {
            const now = new Date();
            if (now.getSeconds() === 58 && now.getMilliseconds() >= 890 && now.getMilliseconds() <= 999) {
                if (now.getMinutes() !== lastTriggerMinute && !appointmentFound) {
                    lastTriggerMinute = now.getMinutes();
                    clickAvailability();
                }
            }
        }, CHECK_INTERVAL_MS);
        document.getElementById('startRetryBtn').innerText = 'Hunting...';
    }

    function stopHunting() {
        if (retryTimer) clearInterval(retryTimer);
        hunting = false;
        lastTriggerMinute = -1;
        document.getElementById('startRetryBtn').innerText = 'Start Hunting';
    }

    if (document.readyState === 'complete') {
        setTimeout(initScript, 300);
    } else {
        window.addEventListener('load', () => {
            setTimeout(initScript, 300);
        });
    }
})();