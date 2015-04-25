if (typeof console == 'undefined') console = {
    log: function () { }
};

// sniff chrome
var CHROME_5_LOCAL = false;
var CHROME = false;
var SAFARI = false;
var WEBKIT = false;
var OS_MAC = false;
var IOS = false;

var IE = false;
var BROWSER_VERSION = 5000;
(function () {
    var chromeRegex = /Chrome\/([0-9]+).([0-9]+)/g ;
    var chromeMatch = chromeRegex.exec(window.navigator.userAgent);
    CHROME = Boolean(chromeMatch);
    CHROME_5_LOCAL = chromeMatch &&
                Number(chromeMatch[1]) >= 5 &&
                location.href.indexOf('file://') >= 0;

    var safariRegex = /Safari\/([0-9]+)/g;
    var safariMatch = safariRegex.exec(window.navigator.userAgent);
    SAFARI = Boolean(safariMatch) && !CHROME; //because chrome also inserts safari string into user agent

    var webkitRegex = /WebKit\//g ;
    WEBKIT = Boolean(webkitRegex.exec(window.navigator.userAgent));

    var macRegex = /Mac/g ;
    OS_MAC = Boolean(macRegex.exec(window.navigator.platform));

    IOS = navigator.userAgent.match( /iPhone/i ) || navigator.userAgent.match( /iPad/i ) || navigator.userAgent.match( /iPod/i );

    if($.browser) {
        IE = $.browser.msie;
        BROWSER_VERSION = $.browser.version;
    }

    if (!window.$axure) window.$axure = function() {};
    //Used by sitemap and variables.js getLinkUrl functions so that they know
    //whether to embed global variables in URL as query string or hash string
    //_shouldSendVars persists the value for sitemap instead of re-checking every time
    var _shouldSendVars;
    var _shouldSendVarsToServer = function(url) {
        if(typeof _shouldSendVars != 'undefined') {
            return _shouldSendVars;
        }

        if(SAFARI || (IE && BROWSER_VERSION < 10)) {
            var urlToCheck = typeof url != 'undefined' ? url : window.location.href;
            var serverRegex = /http:\/\/127\.0\.0\.1:[0-9]{5}/g;
            var serverMatch = serverRegex.exec(urlToCheck);
            var previewRegex = /[0-9]{2}\.[0-9]{2}\.[0-9]{2}/g;
            var previewMatch = previewRegex.exec(urlToCheck);
            if(Boolean(serverMatch) && Boolean(previewMatch)) {
                _shouldSendVars = true;
                return _shouldSendVars;
            }
        }

        _shouldSendVars = false;
        return _shouldSendVars;
    };
    $axure.shouldSendVarsToServer = _shouldSendVarsToServer;
})();

(function() {
    var _topMessageCenter;
    var _messageCenter = {};
    var _listeners = [];
    var _stateListeners = [];
    var _state = {};
    var _eventObject = null;

    var _queuedMessages = [];
    var _initialized = false;

    // this is for the non Chrome 5 local scenarios. The "top" message center will dispatch to all the bottom ones
    var _childrenMessageCenters = [];

    // create $axure if it hasn't been created
    if (!window.$axure) window.$axure = function() {};
    $axure.messageCenter = _messageCenter;

    // isolate scope, and initialize _topMessageCenter.
    (function() {
        if (!CHROME_5_LOCAL) {
            var topAxureWindow = window;
            try {
                while(topAxureWindow.parent && topAxureWindow.parent !== topAxureWindow
                    && topAxureWindow.parent.$axure) topAxureWindow = topAxureWindow.parent;
            } catch(e) {}
            _topMessageCenter = topAxureWindow.$axure.messageCenter;
        }
    })();

    $(window.document).ready(function() {
        if (CHROME_5_LOCAL) {
            $('body').append("<div id='axureEventReceiverDiv' style='display:none'></div>" +
                "<div id='axureEventSenderDiv' style='display:none'></div>");

		    _eventObject = window.document.createEvent('Event');
		    _eventObject.initEvent('axureMessageSenderEvent', true, true);            
            
            $('#axureEventReceiverDiv').bind('axureMessageReceiverEvent', function () {
                var request = JSON.parse($(this).text());
                _handleRequest(request);
            });
        } else {
            if (_topMessageCenter != _messageCenter) {
                _topMessageCenter.addChildMessageCenter(_messageCenter);
                console.log('adding from ' + window.location.toString());
            }
        }
    });

    var _handleRequest = function (request) {
        // route the request to all the listeners
        for(var i = 0; i < _listeners.length; i++) _listeners[i](request.message, request.data);

        // now handle the queued messages if we're initializing
        if (request.message == 'initialize') {
            _initialized = true;
            // send all the queued messages and return
            for (var i = 0; i < _queuedMessages.length; i++) {
                var qRequest = _queuedMessages[i];
                _messageCenter.postMessage(qRequest.message, qRequest.data);
            }
            _queuedMessages = [];
        }
                
        // and then handle the set state messages, if necessary
        if (request.message == 'setState') {
            _state[request.data.key] = request.data.value;
            for (var i = 0; i < _stateListeners.length; i++) {
                var keyListener = _stateListeners[i];
                // if thep passed a null or empty value, always post the message
                if (!keyListener.key || keyListener.key == request.data.key) {
                    keyListener.listener(request.data.key, request.data.value);
                }
            }
        }

    };

    // -----------------------------------------------------------------------------------------
    // This method allows for dispatching messages in the non-chromelocal scenario.
    // Each child calls this on _topMessageCenter
    // -----------------------------------------------------------------------------------------
    _messageCenter.addChildMessageCenter = function(messageCenter) {
        _childrenMessageCenters[_childrenMessageCenters.length] = messageCenter;
    };

    // -----------------------------------------------------------------------------------------
    // This method allows for dispatching messages in the non-chromelocal scenario.
    // Each child calls this on _topMessageCenter
    // -----------------------------------------------------------------------------------------
    _messageCenter.dispatchMessage = function(message, data) {
        _handleRequest({
            message: message,
            data: data
        });
    };

    // -----------------------------------------------------------------------------------------
    // -----------------------------------------------------------------------------------------
    _messageCenter.dispatchMessageRecursively = function(message, data) {
        console.log("dispatched to " + window.location.toString());

        // dispatch to the top center first
        _messageCenter.dispatchMessage(message, data);

        $('iframe').each(function(index, frame) {
            //try,catch to handle permissions error in FF when loading pages from another domain
            try {
                if (frame.contentWindow.$axure && frame.contentWindow.$axure.messageCenter) {
                    frame.contentWindow.$axure.messageCenter.dispatchMessageRecursively(message, data);
                }
            }catch(e) {}
        });
    };

    _messageCenter.postMessage = function(message, data) {
        if(!CHROME_5_LOCAL) {
            _topMessageCenter.dispatchMessageRecursively(message, data);
        } else {
            var request = {
                message: message,
                data: data
            };

            if(_initialized) {
                var senderDiv = window.document.getElementById('axureEventSenderDiv');
                var messageText = JSON.stringify(request);
                //                console.log('sending event: ' + messageText);
                senderDiv.innerText = messageText;
                senderDiv.dispatchEvent(_eventObject);
                //                console.log('event sent');
            } else {
                _queuedMessages[_queuedMessages.length] = request;
            }
        }
    };

    _messageCenter.setState = function(key, value) {
        var data = {
            key: key,
            value: value
        };
        _messageCenter.postMessage('setState', data);
    };

    _messageCenter.getState = function(key) {
        return _state[key];
    };

    _messageCenter.addMessageListener = function(listener) {
        _listeners[_listeners.length] = listener;
    };

    _messageCenter.addStateListener = function(key, listener) {
        _stateListeners[_stateListeners.length] = {
            key: key,
            listener: listener
        };
    };

})();