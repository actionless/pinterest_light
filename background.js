/*jshint esversion: 6 */
(function () {
    'use strict';

    //const debug = false;
    const debug = true;

    /*global chrome:false */
    var browser = browser || null;

    const pinterestProto = "https://";
    const defaultCountryPrefix = "www";
    const pinterestURLTemplate = ".pinterest.com/pin-builder/";
    var baseURL = pinterestProto + defaultCountryPrefix + pinterestURLTemplate;
    var pinterestTabsIDs = {};
    var countryChosen = false;

    function debugLog(message) {
        if (debug) console.warn(message);
    }

    function onError(error) {
        console.error(`Error: ${error}`);
    }

    function handlePinterestCountryCheckRemoved(tabId, removeInfo) {
        if (pinterestTabsIDs[tabId]) {
            delete pinterestTabsIDs[tabId];
        }
    }

    function handlePinterestCountryCheckUpdated(tabId, changeInfo, tabInfo) {

        function markCountryChosen(countryPrefix, searchURL) {
            countryChosen = countryPrefix;
            delete pinterestTabsIDs[tabId];
            if (Object.keys(pinterestTabsIDs).length === 0) {
                debugLog('REMOVE LISTENER');
                chrome.tabs.onUpdated.removeListener(handlePinterestCountryCheckUpdated);
                chrome.tabs.onRemoved.removeListener(handlePinterestCountryCheckRemoved);
                doSearch(tabId, searchURL);
            }
        }

        if (pinterestTabsIDs[tabId]) {
            if (!countryChosen) {
                if (changeInfo.url) {
                    let countryPrefix = new URL(changeInfo.url).hostname.split('.')[0];
                    if (countryPrefix !== defaultCountryPrefix) {
                        baseURL = pinterestProto + countryPrefix + pinterestURLTemplate;
                        chrome.tabs.update(tabId, {
                            'url': pinterestProto + countryPrefix + '.' + pinterestTabsIDs[tabId].pinterestURL
                        });
                        console.log(`[pinterest_light:${tabId}] Changing country to "${countryPrefix}"...`);
                        markCountryChosen(countryPrefix, pinterestTabsIDs[tabId].searchURL);
                    }
                } else if (changeInfo.status === 'complete') {
                    debugLog(tabInfo);
                    debugLog("[pinterest_light] Country change doesn't needed.");
                    markCountryChosen(defaultCountryPrefix, pinterestTabsIDs[tabId].searchURL);
                }
            } else {
                debugLog(tabInfo.url);
                let countryPrefix = new URL(pinterestProto + pinterestTabsIDs[tabId].pinterestURL).hostname.split('.')[0];
                debugLog([countryPrefix, countryChosen]);
                if (countryPrefix !== countryChosen) {
                    debugLog(`[pinterest_light:${tabId}] Changing country to ALREADY SELECTED "${countryChosen}"...`);
                    chrome.tabs.update(tabId, {
                        'url': pinterestProto + countryChosen + '.' + pinterestTabsIDs[tabId].pinterestURL
                    });
                } else {
                    debugLog(`[pinterest_light:${tabId}] Country is already selected: "${countryChosen}"...`);
                }
                markCountryChosen(countryChosen, pinterestTabsIDs[tabId].searchURL);
            }
        }
    }

    function checkPinterestCountry(tab, searchURL) {
        debugLog('Check language:');
        pinterestTabsIDs[tab.id] = {'pinterestURL': tab.title, 'searchURL': searchURL};
        if (!chrome.tabs.onUpdated.hasListener(handlePinterestCountryCheckUpdated)) {
            debugLog('ADD LISTENER');
            chrome.tabs.onUpdated.addListener(handlePinterestCountryCheckUpdated);
            chrome.tabs.onRemoved.addListener(handlePinterestCountryCheckRemoved);
        }
    }

    function doSearch(tabId, queryURL) {
        debugLog(`Do search for ${queryURL}: ${tabId}`);
    }

    function foundActiveTabs(tabs) {
        let tab = tabs[0]; // Safe to assume there will only be one result
        debugLog(`Found active tabs: ${tab.url}`);
        let newTabCallback = (newTab) => {
            checkPinterestCountry(newTab, tab.url);
        }
        chrome.tabs.create({'url': baseURL, 'active': true}, newTabCallback);
    }

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

    function handleBrowserURLChange(tabId, changeInfo, tab) {
        if (changeInfo.url) {
            handleNewURL(changeInfo.url);
        }
    }

    chrome.tabs.onActivated.addListener(handleBrowserTabChange);
    chrome.tabs.onUpdated.addListener(handleBrowserURLChange);

    chrome.browserAction.onClicked.addListener(function(aTab) {
        if (browser) {
            browser.tabs.query({currentWindow: true, active: true}).then(foundActiveTabs, onError);
        } else {
            chrome.tabs.query({currentWindow: true, active: true}, tabs => {
                try{
                    foundActiveTabs(tabs);
                } catch (error) {
                    onError(error);
                }
            });
        }
    });

}());
