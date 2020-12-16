((() => {
    'use strict';


    //const debug = false;
    const debug = true;
    function debugLog(message) {
        if (debug) console.warn(message);
    }
    function debugLogTab(tabId, message) {
        debugLog(`[pinterest_light:${tabId}] ${message}`)
    }
    function logTab(tabId, message) {
        console.log(`[pinterest_light:${tabId}] ${message}`)
    }


    /*global chrome:false */
    var browser = browser || null;

    const pinterestProto = "https://";
    const defaultCountryPrefix = "www";
    const pinterestURLTemplate = ".pinterest.com/pin-builder/";
    var baseURL = pinterestProto + defaultCountryPrefix + pinterestURLTemplate;
    var pinterestTabsIDs = {};
    var countryChosen = false;

    function getCountryPrefix(url) {
        return new URL(url).hostname.split('.')[0];
    }



    // Content script logic: <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

    function doSearch(tabId, queryURL) {
        debugLogTab(tabId, `Do search for ${queryURL}`);
        (browser || chrome).tabs.executeScript(tabId, {
            code: `
                alert("Search for ${queryURL}");
                console.log('location:', window.location.href);
            `
        });
    }



    // Handle redirections to country-based website domain: <<<<<<<<<<<<<<<<<<<

    function handlePinterestCountryCheckRemoved(tabId, _removeInfo) {
        if (pinterestTabsIDs[tabId]) {
            delete pinterestTabsIDs[tabId];
        }
    }


    function handlePinterestCountryCheckUpdated(tabId, changeInfo, tabInfo) {

        debugLogTab(tabId, `tab changed:`);
        debugLog(changeInfo);

        if (!(pinterestTabsIDs[tabId])) {
            debugLogTab(tabId, `tab isn't registered`);
            return;
        }
        if (tabInfo.url === 'about:blank') {
            debugLogTab(tabId, `tab seems to be still loading`);
            return;
        }

        function _onPageLoadCompleted() {
            doSearch(tabId, pinterestTabsIDs[tabId].searchURL);
            delete pinterestTabsIDs[tabId];
            if (Object.keys(pinterestTabsIDs).length === 0) {
                debugLog('REMOVE LISTENER');
                chrome.tabs.onUpdated.removeListener(handlePinterestCountryCheckUpdated);
                chrome.tabs.onRemoved.removeListener(handlePinterestCountryCheckRemoved);
            }
        }

        if (!countryChosen) {
            if (changeInfo.url) {
                let countryPrefix = getCountryPrefix(changeInfo.url);
                if (countryPrefix !== defaultCountryPrefix) {
                    baseURL = pinterestProto + countryPrefix + pinterestURLTemplate;
                    logTab(tabId, `Changing country to "${countryPrefix}"...`);
                    chrome.tabs.update(tabId, {
                        'url': pinterestProto + countryPrefix + '.' + pinterestTabsIDs[tabId].pinterestURL
                    });
                } else {
                    debugLogTab(tabId, `Country seems to be already selected: "${defaultCountryPrefix}", ` +
                                `but we don't know yet if it's a final redirect.`);
                }
            } else if (changeInfo.status === 'complete') {
                countryChosen = getCountryPrefix(tabInfo.url);
                logTab(tabId, `Country is already selected: "${countryChosen}". Saving...`);
            }
        } else {
            let countryPrefix = getCountryPrefix(tabInfo.url);
            if (countryPrefix !== countryChosen) {
                logTab(tabId, `Changing country from ${countryPrefix} to ALREADY SELECTED "${countryChosen}"...`);
                chrome.tabs.update(tabId, {
                    'url': pinterestProto + countryChosen + '.' + pinterestTabsIDs[tabId].pinterestURL
                });
            } else {
                debugLogTab(tabId, `Country is already selected: "${countryChosen}"...`);
            }
            if (changeInfo.status === "complete") {
                _onPageLoadCompleted();
            }
        }
    }


    function searchCurrentTabURLonPinterest(currentTab) {
        const searchURL = currentTab.url;
        debugLog(`Found active tab: ${searchURL}`);
        chrome.tabs.create({'url': baseURL, 'active': true}, newTab => {
            debugLogTab(newTab.id, 'Gonna wait for pinterest tab to be ready');
            pinterestTabsIDs[newTab.id] = {'pinterestURL': newTab.title, 'searchURL': searchURL};
            if (!chrome.tabs.onUpdated.hasListener(handlePinterestCountryCheckUpdated)) {
                debugLog('ADD LISTENER');
                chrome.tabs.onUpdated.addListener(handlePinterestCountryCheckUpdated);
                chrome.tabs.onRemoved.addListener(handlePinterestCountryCheckRemoved);
            }
        });
    }



    // Handlers for extension button status: <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

    function handleNewURL(url) {
        if (['http:', 'https:'].includes(new URL(url).protocol)) {
            chrome.browserAction.enable();
        } else {
            chrome.browserAction.disable();
        }
    }

    function handleBrowserTabChange(activeInfo) {
        if (browser) {
            browser.tabs.get(activeInfo.tabId).then(tab => {
                handleNewURL(tab.url);
            });
        } else {
            chrome.tabs.get(activeInfo.tabId, tab => {
                handleNewURL(tab.url);
            });
        }
    }

    function handleBrowserURLChange(tabId, changeInfo, _tab) {
        if (changeInfo.url) {
            handleNewURL(changeInfo.url);
        }
    }



    // Actual event listeners: <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

    chrome.tabs.onActivated.addListener(handleBrowserTabChange);
    chrome.tabs.onUpdated.addListener(handleBrowserURLChange);
    chrome.browserAction.onClicked.addListener(searchCurrentTabURLonPinterest);


})());
//  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
