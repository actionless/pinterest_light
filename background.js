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
    defaultCountryPrefix = "www",
    hostPermissionUrl = "*://*.pinterest.com/pin-builder/*",
    pinterestProto = "https://",
    pinterestURLTemplate = ".pinterest.com/pin-builder/?tab=save_from_url",
    pinterestTabsIDs = {},
    getCountryPrefix = (url) => new URL(url).hostname.split('.')[ZERO],
    // Content script logic: <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    doSearch = async (tabId, queryURL) => { /* eslint-disable-line max-lines-per-function */
        debugLogTab(tabId, `Do search for ${queryURL}`);
        try {
            await (browser || chrome).scripting.executeScript({
                args: [queryURL],
                target: {
                    allFrames: true,
                    tabId
                },
                func: url => { /* eslint-disable-line sort-keys, max-lines-per-function */

                    const customLog = (...msgs) => { console.log(`[PinterestLight] ${msgs.join(" ")}`); },
                        inputId = "scrape-view-website-link",
                        UPDATE_INTERVAL_MS = 500,
                        ZERO_BROWSER = 0,
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

                    customLog(`Gonna search for ${url}...`);

                    waitForElmId(inputId).then((elm) => {
                        waitForElmXpath('//button[@aria-label="Submit"]').then((_submitElm) => { /* eslint-disable-line max-statements */

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

                                inputElement.click();
                                triggerFocus(inputElement);

                                customLog("checker", inputElement.value);
                                inputElement.value = url;
                                customLog("checker_After:", inputElement.value);

                                document.evaluate(
                                    '//button[@aria-label="Submit"]',
                                    document, null, XPathResult.ANY_TYPE, null
                                ).iterateNext().click();

                                if (getBySelector('[data-test-id="image-from-search-container"]').length > ZERO_BROWSER) {
                                    customLog("Results loaded - stopping observer.")
                                    clearInterval(intervalId);
                                }
                            };
                            intervalId = setInterval(delayedSetValue, UPDATE_INTERVAL_MS);

                        });
                    });
                }
            })
        } catch (err) {
            console.error(`failed to execute script: ${err}`);
        }
        debugLogTab(tabId, "ALRIGHT");
    };

    let baseURL = pinterestProto + defaultCountryPrefix + pinterestURLTemplate,
        countryChosen = false;

    // Handle redirections to country-based website domain: <<<<<<<<<<<<<<<<<<<
    const /* eslint-disable-line one-var */
    handlePinterestPageLoadCompleted = (tabId) => {
        doSearch(tabId, pinterestTabsIDs[tabId].searchURL);
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
    handlePinterestTabUpdated = (tabId, changeInfo, tabInfo) => { /* eslint-disable-line max-statements */

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
                handlePinterestPageLoadCompleted(tabId);
            }
        }
    },

    requestPermissions = async () => {
        await (browser || chrome).permissions.request(
            {
                origins: [
                    hostPermissionUrl
                ]
            }
        );
    },
    searchCurrentTabURLonPinterest= async (currentTab) => {
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
