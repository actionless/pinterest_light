/*jshint esversion: 6 */
(function () {
    'use strict';

    /*global chrome:false */
    //chrome.browserAction.setBadgeText({text: '(ツ)'});
    //chrome.browserAction.setBadgeBackgroundColor({color: '#eae'});

    //https://nl.pinterest.com/pin/find/?url=https%3A%2F%2Fexample.com%2Ffoobar%2F
    //const baseURL = "https://nl.pinterest.com/pin/find/?url=";
    const pinterestProto = "https://";
    const defaultCountryPrefix = "www";
    const pinterestURLTemplate = ".pinterest.com/pin/find/?url=";
    var baseURL = pinterestProto + defaultCountryPrefix + pinterestURLTemplate;
    var pinterestTabsIDs = {};
    var countryChosen = false;


    function onError(error) {
        console.log(`Error: ${error}`);
    }

    function handlePinterestTabUpdated(tabId, changeInfo, tabInfo) {

        function markCountryChosen(countryPrefix) {
            countryChosen = countryPrefix;
            delete pinterestTabsIDs[tabId];
            if (pinterestTabsIDs.length === 0) {
                console.log('REMOVE LISTENER');
                browser.tabs.onUpdated.removeListener(handlePinterestTabUpdated);
            }
        }

        //console.log(pinterestTabsIDs);
        //console.log(changeInfo);
        if (pinterestTabsIDs[tabId]) {
            if (!countryChosen) {
                if (changeInfo.url) {
                    let countryPrefix = new URL(changeInfo.url).hostname.split('.')[0];
                    if (countryPrefix !== defaultCountryPrefix) {
                        baseURL = pinterestProto + countryPrefix + pinterestURLTemplate;
                        browser.tabs.update(tabId, {
                            'url': pinterestProto + countryPrefix + '.' + pinterestTabsIDs[tabId]
                        });
                        console.log(`[pinterest_light:${tabId}] Changing country to "${countryPrefix}"...`);
                        markCountryChosen(countryPrefix);
                    }
                } else if (changeInfo.status === 'complete') {
                    console.log(tabInfo);
                    console.log("[pinterest_light] Country change doesn't needed.");
                    markCountryChosen(defaultCountryPrefix);
                }
            } else {
                let countryPrefix = new URL(tabInfo.url).hostname.split('.')[0];
                if (countryPrefix !== countryChosen) {
                    console.log(`[pinterest_light:${tabId}] Changing country to ALREADY SELECTED "${countryChosen}"...`);
                    browser.tabs.update(tabId, {
                        'url': pinterestProto + countryChosen + '.' + pinterestTabsIDs[tabId]
                    });
                    markCountryChosen(countryChosen);
                }
            }
        }
    }

    function pinterestTabCreated(tab) {
        console.log('foo:');
        console.log(tab);
        pinterestTabsIDs[tab.id] = tab.title;
        if (!browser.tabs.onUpdated.hasListener(handlePinterestTabUpdated)) {
            console.log('ADD LISTENER');
            browser.tabs.onUpdated.addListener(handlePinterestTabUpdated);
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

    chrome.browserAction.onClicked.addListener(function(aTab) {
        browser.tabs.query({currentWindow: true, active: true}).then(foundActiveTabs, onError);
    });

}());
