/*jshint esversion: 6 */
(function () {
    'use strict';

    /*global chrome:false */
    //chrome.browserAction.setBadgeText({text: '(ツ)'});
    //chrome.browserAction.setBadgeBackgroundColor({color: '#eae'});

    const pinterestProto = "https://";
    const defaultCountryPrefix = "www";
    const pinterestURLTemplate = ".pinterest.com/pin/find/?url=";
    var baseURL = pinterestProto + defaultCountryPrefix + pinterestURLTemplate;
    var pinterestTabsIDs = {};
    var countryChosen = false;


    function onError(error) {
        console.log(`Error: ${error}`);
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
                console.log('REMOVE LISTENER');
                chrome.tabs.onUpdated.removeListener(handlePinterestTabUpdated);
                chrome.tabs.onRemoved.removeListener(handlePinterestTabRemoved);
            }
        }

        if (pinterestTabsIDs[tabId]) {
            if (!countryChosen) {
                if (changeInfo.url) {
                    let countryPrefix = new URL(changeInfo.url).hostname.split('.')[0];
                    if (countryPrefix !== defaultCountryPrefix) {
                        baseURL = pinterestProto + countryPrefix + pinterestURLTemplate;
                        chrome.tabs.update(tabId, {
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
                    chrome.tabs.update(tabId, {
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
        if (!chrome.tabs.onUpdated.hasListener(handlePinterestTabUpdated)) {
            console.log('ADD LISTENER');
            chrome.tabs.onUpdated.addListener(handlePinterestTabUpdated);
            chrome.tabs.onRemoved.addListener(handlePinterestTabRemoved);
        }
    }

    function foundActiveTabs(tabs) {
        let tab = tabs[0]; // Safe to assume there will only be one result
        let encodedURL = encodeURIComponent(tab.url);
        let resultURL = baseURL + encodedURL;
        let newTabCallback;
        if (!countryChosen) {
            newTabCallback = pinterestTabCreated;
        }
        chrome.tabs.create({'url': resultURL, 'active': true}, newTabCallback);
    }

    //chrome.browserAction.onClicked.addListener(function(aTab) {
        //browser.tabs.query({currentWindow: true, active: true}).then(foundActiveTabs, onError);
    //});
    chrome.pageAction.onClicked.addListener(function(aTab) {
        chrome.tabs.query({currentWindow: true, active: true}, foundActiveTabs);
    });


    // if we're running on Google Chrome / Chromium:
    if (chrome.declarativeContent) {
        // When the extension is installed or upgraded ...
        chrome.runtime.onInstalled.addListener(function() {
          // Replace all rules ...
          chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
            // With a new rule ...
            chrome.declarativeContent.onPageChanged.addRules([
              {
                conditions: [
                  new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: { schemes: ['http', 'https'] },
                  })
                ],
                // And shows the extension's page action.
                actions: [ new chrome.declarativeContent.ShowPageAction() ]
              }
            ]);
          });
        });
    }

}());
