((() => {
    'use strict';


    //const debug = false;
    const debug = true;
    function debugLog(...message) {
        if (debug) console.warn(...message);
    }
    function debugLogTab(tabId, ...message) {
        debugLog(`[pinterest_light:${tabId}]`, ...message)
    }
    function logTab(tabId, ...message) {
        console.log(`[pinterest_light:${tabId}]`, ...message)
    }


    /*global chrome:false */
    var browser = browser || null;

    const hostPermissionUrl = "*://*.pinterest.com/pin-builder/*";
    const pinterestProto = "https://";
    const defaultCountryPrefix = "www";
    const pinterestURLTemplate = ".pinterest.com/pin-builder/?tab=save_from_url";
    let baseURL = pinterestProto + defaultCountryPrefix + pinterestURLTemplate;
    let pinterestTabsIDs = {};
    let countryChosen = false;

    function getCountryPrefix(url) {
        return new URL(url).hostname.split('.')[0];
    }



    // Content script logic: <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

    async function doSearch(tabId, queryURL) {
        debugLogTab(tabId, `Do search for ${queryURL}`);
        try {
            await (browser || chrome).scripting.executeScript({
                target: {
                    allFrames: true,
                    tabId: tabId
                },
                args: [queryURL],
                func: queryURL => {

                    function triggerFocus(element) {
                        let eventType = "onfocusin" in element ? "focusin" : "focus";
                        let bubbles = "onfocusin" in element;
                        let event;

                        if ("createEvent" in document) {
                            event = document.createEvent("Event");
                            event.initEvent(eventType, bubbles, true);
                        }
                        else if ("Event" in window) {
                            event = new Event(eventType, { bubbles: bubbles, cancelable: true });
                        }

                        element.focus();
                        element.dispatchEvent(event);
                    }

                    let getBySelector = (selector) => { return Array.from(document.querySelectorAll(selector)); };

                    function xpath(selector) {
                        return document.evaluate(
                            selector,
                            document, null, XPathResult.ANY_TYPE, null
                        ).iterateNext()
                    }

                    function waitForElmXpath(selector) {
                        return new Promise(resolve => {
                            if (xpath(selector)) {
                                return resolve(xpath(selector));
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
                    }

                    function waitForElmId(id) {
                        return new Promise(resolve => {
                            if (document.getElementById(id)) {
                                return resolve(document.getElementById(id));
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
                        });
                    }

                    let customLog = (...msgs) => { console.log(`[PinterestLight] ${msgs.join(" ")}`); };

                    customLog(`Gonna search for ${queryURL}...`);

                    const inputId = "scrape-view-website-link";
                    waitForElmId(inputId).then((elm) => {
                        waitForElmXpath('//button[@aria-label="Submit"]').then((_submitElm) => {

                            customLog("Found", elm);

                            triggerFocus(elm);

                            document.getElementById(inputId).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: "a" }));
                            elm.click();
                            customLog("Before:", elm.value);
                            elm.value = queryURL;
                            customLog("After:", elm.value);

                            document.getElementById(inputId).dispatchEvent(new Event('input', { bubbles: true }));
                            document.getElementById(inputId).dispatchEvent(new Event('blur', { bubbles: true }));
                            document.getElementById(inputId).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, keyCode: 13 }));

                            let intervalId;
                            let delayedSetValue = () => {
                                let elm = document.getElementById(inputId);

                                elm.click();
                                triggerFocus(elm);

                                customLog("checker", elm.value);
                                elm.value = queryURL;
                                customLog("checker_After:", elm.value);

                                document.evaluate(
                                    '//button[@aria-label="Submit"]',
                                    document, null, XPathResult.ANY_TYPE, null
                                ).iterateNext().click();

                                if (getBySelector('[data-test-id="image-from-search-container"]').length > 0) {
                                    customLog("Results loaded - stopping observer.")
                                    clearInterval(intervalId);
                                }
                            };
                            intervalId = setInterval(delayedSetValue, 500);

                        });
                    });
                }
            })
        } catch (err) {
            console.error(`failed to execute script: ${err}`);
        }
        debugLogTab(tabId, "ALRIGHT");
    }



    // Handle redirections to country-based website domain: <<<<<<<<<<<<<<<<<<<

    function handlePinterestPageLoadCompleted(tabId) {
        doSearch(tabId, pinterestTabsIDs[tabId].searchURL);
        delete pinterestTabsIDs[tabId];
        if (Object.keys(pinterestTabsIDs).length === 0) {
            debugLog('REMOVE LISTENER');
            chrome.tabs.onUpdated.removeListener(handlePinterestTabUpdated);
            chrome.tabs.onRemoved.removeListener(handlePinterestTabRemoved);
        }
    }


    function handlePinterestTabRemoved(tabId, _removeInfo) {
        if (pinterestTabsIDs[tabId]) {
            delete pinterestTabsIDs[tabId];
        }
    }


    function handlePinterestTabUpdated(tabId, changeInfo, tabInfo) {

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
                let countryPrefix = getCountryPrefix(changeInfo.url);
                if (countryPrefix !== defaultCountryPrefix) {
                    baseURL = pinterestProto + countryPrefix + pinterestURLTemplate;
                    const newURL = `${pinterestProto}${countryPrefix}.${pinterestTabsIDs[tabId].pinterestURL}`;
                    if (newURL !== changeInfo.url) {
                        logTab(tabId, `Changing country to "${countryPrefix}"...`);
                        logTab([newURL, changeInfo.url]);
                        chrome.tabs.update(tabId, {
                            'url': newURL
                        });
                    } else {
                        countryChosen = countryPrefix;
                        debugLogTab(tabId, `Country is already selected: "${countryChosen}" - Saved.`);
                    }
                }
            }
        }
        if (countryChosen) {
            let countryPrefix = getCountryPrefix(tabInfo.url);
            if (countryPrefix !== countryChosen) {
                logTab(tabId, `Changing country from ${countryPrefix} to ALREADY SELECTED "${countryChosen}"...`);
                chrome.tabs.update(tabId, {
                    'url': pinterestProto + countryChosen + '.' + pinterestTabsIDs[tabId].pinterestURL
                });
            }
            if (changeInfo.status === "complete") {
                handlePinterestPageLoadCompleted(tabId);
            }
        }
    }


    async function searchCurrentTabURLonPinterest(currentTab) {
        const searchURL = currentTab.url;
        debugLog(`Found active tab: ${searchURL}`);
        await requestPermissions();
        chrome.tabs.create({'url': baseURL, 'active': true}, newTab => {
            debugLogTab(newTab.id, 'Gonna wait for pinterest tab to be ready');
            pinterestTabsIDs[newTab.id] = {'pinterestURL': newTab.title, 'searchURL': searchURL};
            if (!chrome.tabs.onUpdated.hasListener(handlePinterestTabUpdated)) {
                debugLog('ADD LISTENER');
                chrome.tabs.onUpdated.addListener(handlePinterestTabUpdated);
                chrome.tabs.onRemoved.addListener(handlePinterestTabRemoved);
            }
        });
    }

    async function requestPermissions() {
        await (browser || chrome).permissions.request(
            {
                origins: [
                    hostPermissionUrl
                ]
            }
        );
    }

    // Handlers for extension button status: <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

    function handleNewURL(url) {
        if (['http:', 'https:'].includes(new URL(url).protocol)) {
            chrome.action.enable();
        } else {
            chrome.action.disable();
        }
    }

    async function handleBrowserTabChange(activeInfo) {
        let tab
        if (browser) {
            tab = await browser.tabs.get(activeInfo.tabId)
            handleNewURL(tab.url);
        } else {
            chrome.tabs.get(activeInfo.tabId, tab => {
                handleNewURL(tab.url);
            });
        }
    }

    async function handleBrowserURLChange(tabId, changeInfo, _tab) {
        if (changeInfo.url) {
            handleNewURL(changeInfo.url);
        }
    }



    // Actual event listeners: <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

    chrome.tabs.onActivated.addListener(handleBrowserTabChange);
    chrome.tabs.onUpdated.addListener(handleBrowserURLChange);
    chrome.action.onClicked.addListener(searchCurrentTabURLonPinterest);


})());
//  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
