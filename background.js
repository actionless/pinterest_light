((() => {
    'use strict';

    /*global chrome:false */
    var browser = browser || null; /* eslint-disable-line */

    //const debug = false;
    const debug = true,
    ZERO = 0,
    debugLog = (...message) => {
        if (debug) {console.warn(...message); }
    },
    debugLogTab = (tabId, ...message) => {
        debugLog(`[pinterest_light:${tabId}]`, ...message)
    },
    logTab = (tabId, ...message) => {
        console.log(`[pinterest_light:${tabId}]`, ...message)
    },
    pinterestProto = "https://",
    defaultCountryPrefix = "www",
    pinterestURLTemplate = ".pinterest.com/pin-builder/?tab=save_from_url",
    hostPermissionUrl = "*://*.pinterest.com/pin-builder/*",
    getCountryPrefix = (url) => new URL(url).hostname.split('.')[ZERO],
    pinterestTabsIDs = {},

    // Content script logic: <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    //
    doSearch = async (tabId, queryURL) => { /* eslint-disable-line max-lines-per-function */
        debugLogTab(tabId, `Do search for ${queryURL}`);
        try {
            await (browser || chrome).scripting.executeScript({
                args: [queryURL],
                target: {
                    allFrames: true,
                    tabId
                },
                func: async url => { /* eslint-disable-line sort-keys, max-lines-per-function */

                    // content script helpers <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
                    const
                    ZERO_BROWSER = 0,
                    UPDATE_INTERVAL_MS = 500,
                    inputId = "scrape-view-website-link",
                    submitXpath = '//button[@aria-label="Submit"]',
                    searchResultSelector = '[data-test-id="image-from-search-container"]',
                    noResultSelector = '[data-test-id="pinbuilder-pin-draft-input-scrape-grid-error-message"]',

                    customLog = (...msgs) => { console.log("[PinterestLight]", ...msgs); },
                    getBySelector = (selector) => Array.from(document.querySelectorAll(selector)),

                    triggerFocus = (element) => {
                        const bubbles = "onfocusin" in element,
                            eventType = "onfocusin" in element ? "focusin" : "focus";
                        let event = null;
                        if ("createEvent" in document) {
                            event = document.createEvent("Event");
                            event.initEvent(eventType, bubbles, true);
                        }
                        else if ("Event" in window) {
                            event = new Event(eventType, { bubbles, cancelable: true });
                        }
                        element.focus();
                        if (event) { element.dispatchEvent(event); };
                    },

                    waitForElmId = (id) => new Promise(resolve => {
                            if (document.getElementById(id)) {
                                resolve(document.getElementById(id));
                                return;
                            }
                            const observer = new MutationObserver(_mutations => {
                                if (document.getElementById(id)) {
                                    observer.disconnect();
                                    resolve(document.getElementById(id));
                                }
                            });
                            observer.observe(document.body, {
                                childList: true,
                                subtree: true
                            });
                        }),

                    xpath = (selector) => document.evaluate(
                        selector,
                        document, null, XPathResult.ANY_TYPE, null
                    ).iterateNext(),

                    waitForElmXpath = (selector) => new Promise(resolve => {
                        if (xpath(selector)) {
                            resolve(xpath(selector));
                            return;
                        }
                        const observer = new MutationObserver(_mutations => {
                            if (xpath(selector)) {
                                observer.disconnect();
                                resolve(xpath(selector));
                            }
                        });
                        observer.observe(document.body, {
                            childList: true,
                            subtree: true
                        });
                    });


                    // content script main part <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
                    customLog(`Gonna search for ${url}...`);

                    const elm = await waitForElmId(inputId);
                    await waitForElmXpath(submitXpath);
                    customLog("Found", elm);

                    triggerFocus(elm);
                    document.getElementById(inputId).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: "a" }));
                    elm.click();
                    customLog("Before:", elm.value);
                    elm.value = url;
                    customLog("After:", elm.value);
                    document.getElementById(inputId).dispatchEvent(new Event('input', { bubbles: true }));
                    document.getElementById(inputId).dispatchEvent(new Event('blur', { bubbles: true }));
                    document.getElementById(inputId).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, keyCode: 13 }));

                    let intervalId; /* eslint-disable-line */
                    const delayedSetValue = () => {
                        const inputElement = document.getElementById(inputId);
                        customLog("checker_Before:", inputElement.value);

                        inputElement.click();
                        triggerFocus(inputElement);
                        customLog("checker:", inputElement.value);

                        inputElement.value = url;
                        customLog("checker_After:", inputElement.value);

                        document.evaluate(
                            submitXpath,
                            document, null, XPathResult.ANY_TYPE, null
                        ).iterateNext().click();

                        if (getBySelector(searchResultSelector).length > ZERO_BROWSER) {
                            customLog("Results loaded - stopping observer.");
                            clearInterval(intervalId);
                        } else if (getBySelector(noResultSelector).length > ZERO_BROWSER) {
                            customLog("No results found by Pinterest - stopping observer.");
                            clearInterval(intervalId);
                        }
                    };
                    intervalId = setInterval(delayedSetValue, UPDATE_INTERVAL_MS);
                    // content script main part end >>>>>>>>>>>>>>>>>>>>>>>>>>>
                }
            });
        } catch (err) {
            console.error(`failed to execute script: ${err}`);
        }
        debugLogTab(tabId, "ALRIGHT");
    };
    // Content script logic end >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>


    // Handle redirections to country-based website domain: <<<<<<<<<<<<<<<<<<<
    let baseURL = pinterestProto + defaultCountryPrefix + pinterestURLTemplate,
        countryChosen = false;

    const
    handlePinterestPageLoadCompleted = async (tabId) => {
        await doSearch(tabId, pinterestTabsIDs[tabId].searchURL);
        delete pinterestTabsIDs[tabId];
        if (Object.keys(pinterestTabsIDs).length === ZERO) {
            debugLog('REMOVE LISTENER');
            chrome.tabs.onUpdated.removeListener(handlePinterestTabUpdated); /* eslint-disable-line no-use-before-define */
            chrome.tabs.onRemoved.removeListener(handlePinterestTabRemoved); /* eslint-disable-line no-use-before-define */
        }
    },
    handlePinterestTabRemoved = (tabId, _removeInfo) => {
        if (pinterestTabsIDs[tabId]) {
            delete pinterestTabsIDs[tabId];
        }
    },
    handlePinterestTabUpdated = async (tabId, changeInfo, tabInfo) => { /* eslint-disable-line max-statements */

        debugLogTab(tabId, `tab changed:`);
        debugLogTab(tabId, changeInfo);

        if (!(pinterestTabsIDs[tabId])) {
            debugLogTab(tabId, `tab isn't registered`);
            return;
        }
        if (tabInfo.url === 'about:blank') {
            debugLogTab(tabId, `tab seems to be still loading`);
            return;
        }

        if (!countryChosen) {
            if (changeInfo.url) {
                const countryPrefix = getCountryPrefix(changeInfo.url);
                if (countryPrefix !== defaultCountryPrefix) {
                    baseURL = pinterestProto + countryPrefix + pinterestURLTemplate;
                    const newURL = `${pinterestProto}${countryPrefix}.${pinterestTabsIDs[tabId].pinterestURL}`;
                    if (newURL === changeInfo.url) {
                        countryChosen = countryPrefix;
                        debugLogTab(tabId, `Country is already selected: "${countryChosen}" - Saved.`);
                    } else {
                        logTab(tabId, `Changing country to "${countryPrefix}"...`);
                        logTab([newURL, changeInfo.url]);
                        chrome.tabs.update(tabId, {
                            'url': newURL
                        });
                    }
                }
            }
        }
        if (countryChosen) {
            const countryPrefix = getCountryPrefix(tabInfo.url);
            if (countryPrefix !== countryChosen) {
                logTab(tabId, `Changing country from ${countryPrefix} to ALREADY SELECTED "${countryChosen}"...`);
                chrome.tabs.update(tabId, {
                    'url': `${pinterestProto + countryChosen  }.${  pinterestTabsIDs[tabId].pinterestURL}`
                });
            }
            if (changeInfo.status === "complete") {
                await handlePinterestPageLoadCompleted(tabId);
            }
        }
    },

    // Handlers for extension button click: <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    requestPermissions = async () => {
        await (browser || chrome).permissions.request(
            {
                origins: [
                    hostPermissionUrl
                ]
            }
        );
    },
    searchCurrentTabURLonPinterest = async (currentTab) => {
        const searchURL = currentTab.url;
        debugLog(`Found active tab: ${searchURL}`);
        await requestPermissions();
        chrome.tabs.create({'active': true, 'url': baseURL}, newTab => {
            debugLogTab(newTab.id, 'Gonna wait for pinterest tab to be ready');
            pinterestTabsIDs[newTab.id] = {'pinterestURL': newTab.title, searchURL};
            if (!chrome.tabs.onUpdated.hasListener(handlePinterestTabUpdated)) {
                debugLog('ADD LISTENER');
                chrome.tabs.onUpdated.addListener(handlePinterestTabUpdated);
                chrome.tabs.onRemoved.addListener(handlePinterestTabRemoved);
            }
        });
    },

    // Handlers for extension button status: <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    handleNewURL = (url) => {
        if (['http:', 'https:'].includes(new URL(url).protocol)) {
            chrome.action.enable();
        } else {
            chrome.action.disable();
        }
    },
    handleBrowserTabChange = async (activeInfo) => {
        if (browser) {
            const tab = await browser.tabs.get(activeInfo.tabId)
            handleNewURL(tab.url);
        } else {
            chrome.tabs.get(activeInfo.tabId, tab => {
                handleNewURL(tab.url);
            });
        }
    },
    handleBrowserURLChange = (tabId, changeInfo, _tab) => {
        if (changeInfo.url) {
            handleNewURL(changeInfo.url);
        }
    };

    // Actual event listeners: <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    chrome.tabs.onActivated.addListener(handleBrowserTabChange);
    chrome.tabs.onUpdated.addListener(handleBrowserURLChange);
    chrome.action.onClicked.addListener(searchCurrentTabURLonPinterest);

})());
//  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
