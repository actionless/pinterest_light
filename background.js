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

    function doSearch(tabId, queryURL) {
        debugLog(`[pinterest_light:${tabId}] Do search for ${queryURL}`);
        (browser || chrome).tabs.executeScript(tabId, {
            code: `
                alert("Search for ${queryURL}");
                console.log('location:', window.location.href);
            `
        });
    }

    function handlePinterestCountryCheckUpdated(tabId, changeInfo, tabInfo) {

        debugLog(`[pinterest_light:${tabId}] tab changed:`);
        debugLog(changeInfo);

        function _onPageLoadCompleted() {
            doSearch(tabId, pinterestTabsIDs[tabId].searchURL);
            delete pinterestTabsIDs[tabId];
            if (Object.keys(pinterestTabsIDs).length === 0) {
                debugLog('REMOVE LISTENER');
                chrome.tabs.onUpdated.removeListener(handlePinterestCountryCheckUpdated);
                chrome.tabs.onRemoved.removeListener(handlePinterestCountryCheckRemoved);
            }
        }

        if (pinterestTabsIDs[tabId]) {
            if (!countryChosen) {
                if (changeInfo.url) {
                    let countryPrefix = new URL(changeInfo.url).hostname.split('.')[0];
                    if (countryPrefix !== defaultCountryPrefix) {
                        baseURL = pinterestProto + countryPrefix + pinterestURLTemplate;
                        console.log(`[pinterest_light:${tabId}] Changing country to "${countryPrefix}"...`);
                        chrome.tabs.update(tabId, {
                            'url': pinterestProto + countryPrefix + '.' + pinterestTabsIDs[tabId].pinterestURL
                        });
                    } else {
                        debugLog(`[pinterest_light:${tabId}] Country is already selected: "${defaultCountryPrefix}"...`);
                    }
                } else if (changeInfo.status === 'complete') {
                    countryChosen = new URL(tabInfo.url).hostname.split('.')[0];
                    debugLog(`[pinterest_light:${tabId}] Country is already selected: "${countryChosen}". Saving...`);
                }
            } else if (tabInfo.url!=='about:blank') {
                let countryPrefix = new URL(tabInfo.url).hostname.split('.')[0];
                if (countryPrefix !== countryChosen) {
                    debugLog(`[pinterest_light:${tabId}] Changing country from ${countryPrefix} to ALREADY SELECTED "${countryChosen}"...`);
                    chrome.tabs.update(tabId, {
                        'url': pinterestProto + countryChosen + '.' + pinterestTabsIDs[tabId].pinterestURL
                    });
                } else {
                    debugLog(`[pinterest_light:${tabId}] Country is already selected: "${countryChosen}"...`);
                }
                if (changeInfo.status === "complete") {
                    _onPageLoadCompleted();
                }
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
