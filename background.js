/*jshint esversion: 6 */
(function () {
    'use strict';

    const debug = false;

    /*global chrome:false */
    //chrome.browserAction.setBadgeText({text: '(ツ)'});
    //chrome.browserAction.setBadgeBackgroundColor({color: '#eae'});

    const pinterestProto = "https://";
    const defaultCountryPrefix = "www";
    const pinterestURLTemplate = ".pinterest.com/pin/find/?url=";
    var baseURL = pinterestProto + defaultCountryPrefix + pinterestURLTemplate;
    var pinterestTabsIDs = {};
    var countryChosen = false;

    function debugLog(message) {
        if (debug) console.warn(message);
    }

    function onError(error) {
        console.error(`Error: ${error}`);
    }

    function handlePinterestTabRemoved(tabId, removeInfo) {
        if (pinterestTabsIDs[tabId]) {
            delete pinterestTabsIDs[tabId];
        }
    }

    function handlePinterestTabUpdated(tabId, changeInfo, tabInfo) {

        function markCountryChosen(countryPrefix) {
            countryChosen = countryPrefix;
            delete pinterestTabsIDs[tabId];
            if (Object.keys(pinterestTabsIDs).length === 0) {
                debugLog('REMOVE LISTENER');
                browser.tabs.onUpdated.removeListener(handlePinterestTabUpdated);
                browser.tabs.onRemoved.removeListener(handlePinterestTabRemoved);
            }
        }

        if (pinterestTabsIDs[tabId]) {
            if (!countryChosen) {
                if (changeInfo.url) {
                    let countryPrefix = new URL(changeInfo.url).hostname.split('.')[0];
                    if (countryPrefix !== defaultCountryPrefix) {
                        baseURL = pinterestProto + countryPrefix + pinterestURLTemplate;
                        browser.tabs.update(tabId, {
                            'url': pinterestProto + countryPrefix + '.' + pinterestTabsIDs[tabId]
                        });
                        debugLog(`[pinterest_light:${tabId}] Changing country to "${countryPrefix}"...`);
                        markCountryChosen(countryPrefix);
                    }
                } else if (changeInfo.status === 'complete') {
                    debugLog(tabInfo);
                    debugLog("[pinterest_light] Country change doesn't needed.");
                    markCountryChosen(defaultCountryPrefix);
                }
            } else {
                let countryPrefix = new URL(tabInfo.url).hostname.split('.')[0];
                if (countryPrefix !== countryChosen) {
                    debugLog(`[pinterest_light:${tabId}] Changing country to ALREADY SELECTED "${countryChosen}"...`);
                    browser.tabs.update(tabId, {
                        'url': pinterestProto + countryChosen + '.' + pinterestTabsIDs[tabId]
                    });
                    markCountryChosen(countryChosen);
                }
            }
        }
    }

    function pinterestTabCreated(tab) {
        console.log(`Going to pin ${tab.url}`);
        debugLog(tab);
        pinterestTabsIDs[tab.id] = tab.title;
        if (!browser.tabs.onUpdated.hasListener(handlePinterestTabUpdated)) {
            debugLog('ADD LISTENER');
            browser.tabs.onUpdated.addListener(handlePinterestTabUpdated);
            browser.tabs.onRemoved.addListener(handlePinterestTabRemoved);
        }
    }

    function foundActiveTabs(tabs) {
        let tab = tabs[0]; // Safe to assume there will only be one result
        let encodedURL = encodeURIComponent(tab.url);
        let resultURL = baseURL + encodedURL;
        let newTabPromise = browser.tabs.create({'url': resultURL, 'active': true});
        if (!countryChosen) {
            newTabPromise.then(pinterestTabCreated, onError);
        }
    }

    //chrome.browserAction.onClicked.addListener(function(aTab) {
        //browser.tabs.query({currentWindow: true, active: true}).then(foundActiveTabs, onError);
    //});
    chrome.pageAction.onClicked.addListener(function(aTab) {
        browser.tabs.query({currentWindow: true, active: true}).then(foundActiveTabs, onError);
    });

}());
