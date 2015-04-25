// ******* Features MANAGER ******** //

$axure.internal(function($ax) {
    var _features = $ax.features = {};
    var _supports = _features.supports = {};
    _supports.touchstart = typeof window.ontouchstart !== 'undefined';
    _supports.touchmove = typeof window.ontouchmove !== 'undefined';
    _supports.touchend = typeof window.ontouchend !== 'undefined';

    _supports.mobile = _supports.touchstart && _supports.touchend && _supports.touchmove;
    // Got this from http://stackoverflow.com/questions/11381673/javascript-solution-to-detect-mobile-browser
    var check = navigator.userAgent.match(/Android/i)
        || navigator.userAgent.match(/webOS/i)
        || navigator.userAgent.match(/iPhone/i)
        || navigator.userAgent.match(/iPad/i)
        || navigator.userAgent.match(/iPod/i)
        || navigator.userAgent.match(/BlackBerry/i)
        || navigator.userAgent.match(/Tablet PC/i)
        || navigator.userAgent.match(/Windows Phone/i);

    _supports.windowsMobile = navigator.userAgent.match(/Tablet PC/i) || navigator.userAgent.match(/Windows Phone/i);

    if(!check && _supports.mobile) {
        _supports.touchstart = false;
        _supports.touchmove = false;
        _supports.touchend = false;
        _supports.mobile = false;
    }

    var _eventNames = _features.eventNames = {};
    _eventNames.mouseDownName = _supports.touchstart ? 'touchstart' : 'mousedown';
    _eventNames.mouseUpName = _supports.touchend ? 'touchend' : 'mouseup';
    _eventNames.mouseMoveName = _supports.touchmove ? 'touchmove' : 'mousemove';
});

// ******* EVENT MANAGER ******** //
$axure.internal(function($ax) {
    var _objectIdToEventHandlers = {};

    var _jBrowserEvent = undefined;
    $ax.setjBrowserEvent = function(event) {
        _jBrowserEvent = event;
    };

    $ax.getjBrowserEvent = function() {
        return _jBrowserEvent;
    };

    var _event = {};
    $ax.event = _event;

    //initilize state
    _event.mouseOverObjectId = '';
    _event.mouseDownObjectId = '';
    _event.mouseOverIds = [];

    var EVENT_NAMES = ['mouseenter', 'mouseleave', 'contextmenu', 'change', 'focus', 'blur'];


    // Tap, double tap, and touch move, or synthetic.
    if(!$ax.features.supports.mobile) {
        EVENT_NAMES[EVENT_NAMES.length] = 'click';
        EVENT_NAMES[EVENT_NAMES.length] = 'dblclick';
        EVENT_NAMES[EVENT_NAMES.length] = 'mousemove';
    }

    // add the event names for the touch events
    EVENT_NAMES[EVENT_NAMES.length] = $ax.features.eventNames.mouseDownName;
    EVENT_NAMES[EVENT_NAMES.length] = $ax.features.eventNames.mouseUpName;

    for(var i = 0; i < EVENT_NAMES.length; i++) {
        var eventName = EVENT_NAMES[i];
        //we need the function here to circumvent closure modifying eventName
        _event[eventName] = (function(event_Name) {
            return function(elementId, fn) {
                var elementIdQuery = $jobj(elementId);
                var type = $ax.getTypeFromElementId(elementId);

                //we need specially track link events so we can enable and disable them along with
                //their parent widgets
                if(elementIdQuery.is('a')) _attachCustomObjectEvent(elementId, event_Name, fn);
                //see notes below
                else if($ax.IsTreeNodeObject(type)) _attachTreeNodeEvent(elementId, event_Name, fn);
                else if($ax.IsImageFocusable(type) && (event_Name == 'focus' || event_Name == 'blur')) {
                    _attachDefaultObjectEvent($jobj($ax.repeater.applySuffixToElementId(elementId, '_img')), elementId, event_Name, fn);
                } else {
                    var inputId = $ax.INPUT(elementId);
                    var isInput = $jobj(inputId).length != 0;
                    var id = isInput && (event_Name == 'focus' || event_Name == 'blur') ? inputId : elementId;
                    _attachDefaultObjectEvent($jobj(id), elementId, event_Name, fn);
                }
            };
        })(eventName);
    }

    var AXURE_TO_JQUERY_EVENT_NAMES = {
        'onMouseOver': 'mouseenter',
        'onMouseOut': 'mouseleave',
        'onContextMenu': 'contextmenu',
        'onChange': 'change',
        'onFocus': 'focus',
        'onLostFocus': 'blur'
    };

    // Tap, double tap, and touch move, or synthetic.
    if(!$ax.features.supports.mobile) {
        AXURE_TO_JQUERY_EVENT_NAMES.onClick = 'click';
        AXURE_TO_JQUERY_EVENT_NAMES.onDoubleClick = 'dblclick';
        AXURE_TO_JQUERY_EVENT_NAMES.onMouseMove = 'mousemove';
    }

    AXURE_TO_JQUERY_EVENT_NAMES.onMouseDown = $ax.features.eventNames.mouseDownName;
    AXURE_TO_JQUERY_EVENT_NAMES.onMouseUp = $ax.features.eventNames.mouseUpName;

    var _attachEvents = function(diagramObject, elementId) {
        var inputId = $ax.repeater.applySuffixToElementId(elementId, '_input');
        var id = $jobj(inputId).length ? inputId : elementId;

        for(var eventName in diagramObject.interactionMap) {
            var jQueryEventName = AXURE_TO_JQUERY_EVENT_NAMES[eventName];
            if(!jQueryEventName) continue;

            _event[jQueryEventName](id,
            //this is needed to escape closure
                (function(axEventObject) {
                    return function(e) {
                        $ax.setjBrowserEvent(e);
                        _handleEvent(elementId, $ax.getEventInfoFromEvent($ax.getjBrowserEvent(), false, elementId), axEventObject);
                    };
                })(diagramObject.interactionMap[eventName])
            );
        }

    };

    var preventDefaultEvents = ['OnContextMenu', 'OnKeyUp', 'OnKeyDown'];
    var allowBubble = ['OnFocus', 'OnResize', 'OnMouseOut', 'OnMouseOver'];

    var _canClick = true;
    var _startScroll = [];
    var _setCanClick = function(canClick) {
        _canClick = canClick;
        if(_canClick) _startScroll = [$(window).scrollLeft(), $(window).scrollTop()];
    };

    var _getCanClick = function() {
        if(!$ax.features.supports.mobile) return true;
        var endScroll = [$(window).scrollLeft(), $(window).scrollTop()];
        return _canClick && _startScroll[0] == endScroll[0] && _startScroll[1] == endScroll[1];
    };

    var _handleEvent = $ax.event.handleEvent = function(elementId, eventInfo, axEventObject, skipShowDescriptions, synthetic) {
        var eventDescription = axEventObject.description;
        if(!_getCanClick() && eventDescription == 'OnClick') return;
        // If you are supposed to suppress, do that right away.
        if(suppressedEventStatus[eventDescription]) {
            return;
        }

        var currentEvent = $ax.getjBrowserEvent();

        if(!synthetic && currentEvent && currentEvent.originalEvent && currentEvent.originalEvent.handled && !eventInfo.isMasterEvent) return;
        if(!synthetic && elementId && !$ax.style.getObjVisible(elementId) && $ax.getTypeFromElementId(elementId) != 'referenceDiagramObject') return;

        var bubble = true;
        if(skipShowDescriptions || !_shouldShowCaseDescriptions(axEventObject)) {
            //handle case descriptions
            var caseGroups = [];
            var currentCaseGroup = [];
            caseGroups[0] = currentCaseGroup;

            // Those refreshes not after a wait
            var guaranteedRefreshes = {};

            var caseGroupIndex = 0;
            for(var i = 0; i < axEventObject.cases.length; i++) {
                var currentCase = axEventObject.cases[i];
                if(currentCase.isNewIfGroup && i != 0) {
                    caseGroupIndex++;
                    currentCaseGroup = [];
                    caseGroups[caseGroups.length] = currentCaseGroup;
                }
                currentCaseGroup[currentCaseGroup.length] = currentCase;

                for(var j = 0; j < currentCase.actions.length; j++) {
                    var action = currentCase.actions[j];
                    if(action.action == 'wait') break;
                    if(action.action != 'refreshRepeater') continue;
                    for(var k = 0; k < action.repeatersToRefresh.length; k++) {
                        var id = $ax.getElementIdsFromPath(action.repeatersToRefresh[k], eventInfo)[0];
                        guaranteedRefreshes[id] = caseGroupIndex;
                    }
                }
            }

            for(var i = 0; i < caseGroups.length; i++) {
                var groupRefreshes = [];
                for(var key in guaranteedRefreshes) {
                    if(guaranteedRefreshes[key] == i) groupRefreshes[groupRefreshes.length] = key;
                }
                bubble = _handleCaseGroup(eventInfo, caseGroups[i], groupRefreshes) && bubble;
            }
        } else {
            _showCaseDescriptions(elementId, eventInfo, axEventObject, synthetic);
            bubble = false;
        }

        // Only trigger a supression if it handled this event
        if(!bubble && suppressingEvents[eventDescription]) {
            suppressedEventStatus[suppressingEvents[eventDescription]] = true;
        }

        // This should not be needed anymore. All refreshes should be inserted, or handled earlier.
        var repeaters = $ax.deepCopy($ax.action.repeatersToRefresh);
        while($ax.action.repeatersToRefresh.length) $ax.action.repeatersToRefresh.pop();
        for(i = 0; i < repeaters.length; i++) $ax.repeater.refreshRepeater(repeaters[i], eventInfo);

        if(currentEvent && currentEvent.originalEvent) {
            currentEvent.originalEvent.handled = !synthetic && !bubble && allowBubble.indexOf(eventDescription) == -1;
            //currentEvent.originalEvent.donotdrag = currentEvent.donotdrag || (!bubble && eventDescription == 'OnMouseDown');

            // Prevent default if necessary
            if(currentEvent.originalEvent.handled && preventDefaultEvents.indexOf(eventDescription) != -1) {
                currentEvent.preventDefault();
            }
        }
    };

    var _showCaseDescriptions = function(elementId, eventInfo, axEventObject, synthetic) {

        if(axEventObject.cases.length == 0) return true;

        var linksId = elementId + "linkBox";
        $('#' + linksId).remove();

        var $container = $("<div class='intcases' id='" + linksId + "'></div>");

        if(!_isEventSimulating(axEventObject)) {
            var copy = $ax.eventCopy(eventInfo);
            for(var i = 0; i < axEventObject.cases.length; i++) {
                var $link = $("<div class='intcaselink'>" + axEventObject.cases[i].description + "</div>");
                $link.click(function(j) {
                    return function() {
                        var bubble = $ax.action.dispatchAction(copy, axEventObject.cases[j].actions);
                        $('#' + linksId).remove();
                        return bubble;
                    };
                } (i)
                );

                $container.append($link);
            }
        } else {
            var fullDescription = axEventObject.description + ":<br>";
            for(var i = 0; i < axEventObject.cases.length; i++) {
                var currentCase = axEventObject.cases[i];
                fullDescription += "&nbsp;&nbsp;" + currentCase.description.replace(/<br>/g, '<br>&nbsp;&nbsp;') + ":<br>";
                for(var j = 0; j < currentCase.actions.length; j++) {
                    fullDescription += "&nbsp;&nbsp;&nbsp;&nbsp;" + currentCase.actions[j].description.replace(/<br>/g, '<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;') + "<br>";
                }
            }
            fullDescription = fullDescription.substring(0, fullDescription.length - 4);

            var $link = $("<div class='intcaselink'>" + fullDescription + "</div>");
            $link.click(function() {
                _handleEvent(elementId, eventInfo, axEventObject, true, synthetic);
                $('#' + linksId).remove();
                return;
            });
            $container.append($link);
        }
        $container.mouseleave(function(e) { $ax.legacy.SuppressBubble(e); });
        $('body').append($container);
        _showCaseLinks(eventInfo, linksId);
    };

    var _showCaseLinks = function(eventInfo, linksId) {
        var links = window.document.getElementById(linksId);

        links.style.top = eventInfo.pageY;

        var left = eventInfo.pageX;
        links.style.left = left;
        $ax.visibility.SetVisible(links, true);
        $ax.legacy.BringToFront(linksId, true);
        $ax.legacy.RefreshScreen();
    };


    var _shouldShowCaseDescriptions = function(axEventObject) {
        if($ax.document.configuration.linkStyle == "alwaysDisplayTargets") return true;
        if($ax.document.configuration.linkStyle == "neverDisplayTargets") return false;
        if(axEventObject.cases.length == 0) return false;
        if(_isEventSimulating(axEventObject)) return false;
        if(axEventObject.cases.length >= 2) return true;
        return false;
    };

    var _isEventSimulating = function(axEventObject) {
        for(var i = 0; i < axEventObject.cases.length; i++) {
            if(axEventObject.cases[i].condition) return true;
        }
        return false;
    };

    var _handleCaseGroup = function(eventInfo, caseGroup, groupRefreshes) {
        for(var i = 0; i < caseGroup.length; i++) {
            var currentCase = caseGroup[i];
            if(!currentCase.condition || _processCondition(currentCase.condition, eventInfo)) {
                for(var j = 0; j < currentCase.actions.length; j++) {
                    var action = currentCase.actions[j];
                    if(action.action == 'wait') break;
                    if(action.action != 'refreshRepeater') continue;
                    for(var k = 0; k < action.repeatersToRefresh.length; k++) {
                        var id = $ax.getElementIdsFromPath(action.repeatersToRefresh[i], eventInfo)[i];
                        var index = groupRefreshes.indexOf(id);
                        if(index != -1) $ax.splice(groupRefreshes, index);
                    }
                }

                // Any guaranteed refreshes that aren't accounted for must be run still.
                $ax.action.tryRefreshRepeaters(groupRefreshes, eventInfo);

                $ax.action.dispatchAction(eventInfo, currentCase.actions);
                return false;
            }
        }

        // Any guaranteed refreshes that aren't accounted for must be run still.
        $ax.action.tryRefreshRepeaters(groupRefreshes, eventInfo);
        return true;
    };

    var _processCondition = function(expr, eventInfo) {
        return $ax.expr.evaluateExpr(expr, eventInfo);
    };

    var _attachTreeNodeEvent = function(elementId, eventName, fn) {
        //we need to set the cursor here because we want to make sure that every tree node has the default
        //cursor set and then it's overridden if it has a click
        if(eventName == 'click') window.document.getElementById(elementId).style.cursor = 'pointer';

        _attachCustomObjectEvent(elementId, eventName, fn);
    };

    var _attachDefaultObjectEvent = function(elementIdQuery, elementId, eventName, fn) {
        var func = function() {
            if(!$ax.style.IsWidgetDisabled(elementId)) return fn.apply(this, arguments);
            return true;
        };

        var bind = !elementIdQuery[eventName];
        if(bind) elementIdQuery.bind(eventName, func);
        else elementIdQuery[eventName](func);
    };

    var _attachCustomObjectEvent = function(elementId, eventName, fn) {
        var handlers = _objectIdToEventHandlers[elementId];
        if(!handlers) _objectIdToEventHandlers[elementId] = handlers = {};

        var fnList = handlers[eventName];
        if(!fnList) handlers[eventName] = fnList = [];

        fnList[fnList.length] = fn;
    };

    var _fireObjectEvent = function(elementId, event, originalArgs) {
        var element = window.document.getElementById(elementId);

        var handlerList = _objectIdToEventHandlers[elementId] && _objectIdToEventHandlers[elementId][event];
        if(handlerList) {
            for(var i = 0; i < handlerList.length; i++) handlerList[i].apply(element, originalArgs);
        }
    };

    //for button shapes and images the img is focusable instead of the div to get better outlines

    $ax.event.getFocusableWidgetOrChildId = function(elementId) {
        var imgId = $ax.repeater.applySuffixToElementId(elementId, '_img');
        var imgQuery = $jobj(imgId);

        var inputId = $ax.repeater.applySuffixToElementId(elementId, '_input');
        var inputQuery = $jobj(inputId);

        return inputQuery.length > 0 ? inputId : imgQuery.length > 0 ? imgId : elementId;
    };

    // key is the suppressing event, and the value is the event that is supressed
    var suppressingEvents = {};
    // key is the event that will cancel the suppression, and value is the event that was being suppressed
    var cancelSuppressions = {};
    // suppressed event maps to true if it is supressed
    var suppressedEventStatus = {};

    // Attempt at a generic way to supress events
    var initSuppressingEvents = function(query) {
        suppressingEvents['OnLongClick'] = 'OnClick';
        cancelSuppressions['onMouseDown'] = 'OnClick';

        // Have to cancel suppressed event here. Only works for non-synthetic events currently
        for(var key in cancelSuppressions) {
            var eventName = AXURE_TO_JQUERY_EVENT_NAMES[key];
            if(!eventName) continue;
            (function(eventName, suppressed) {
                query.bind(eventName, function() {
                    suppressedEventStatus[suppressed] = false;
                });
            })(eventName, cancelSuppressions[key]);
        }

        // Otherwise see if you have the chance to cancel a supression
        //        if(cancelSuppressions[eventDescription]) {
        //            suppressedEventStatus[cancelSuppressions[eventDescription]] = false;
        //        }
    };

    // TODO: It may be a good idea to split this into multiple functions, or at least pull out more similar functions into private methods
    var _initializeObjectEvents = function (query) {
        // Must init the supressing eventing before the handlers, so that it has the ability to supress those events.
        initSuppressingEvents(query);
        
        query.each(function(dObj, elementId) {
            var $element = $jobj(elementId);

            // Focus has to be done before on focus fires
            // Set up focus
            if(dObj.type == 'textArea' || dObj.type == 'textBox' || dObj.type == 'checkBox' || dObj.type == 'radioButton' ||
                dObj.type == 'listBox' || dObj.type == 'comboBox' || dObj.type == 'button' || dObj.type == 'imageBox' ||
                dObj.type == 'buttonShape' || dObj.type == 'flowShape' || dObj.type == 'treeNodeObject' || dObj.type == 'tableCell') {
                var focusObj = $jobj($ax.event.getFocusableWidgetOrChildId(elementId));
                focusObj.focus(function() {
                    window.lastFocusedControl = elementId;
                });
            }


            // [MAS: Supressing events were here]
            if(dObj.interactionMap) {
                _attachEvents(dObj, elementId);
            };


            //attach button shape alternate styles
            var needsMouseFilter = dObj.type != 'hyperlink' && dObj.type != 'dynamicPanel' && dObj.type != 'richTextPanel' &&
                dObj.type != 'repeater' && dObj.type != 'checkbox' && dObj.type != 'radioButton' && dObj.type != 'treeNodeObject';
            if(needsMouseFilter) {
                $element.mouseenter(function() {
                    var elementId = this.id;
                    var parent = $ax.dynamicPanelManager.parentHandlesStyles(elementId);
                    if(parent && parent.direct) return;
                    if($.inArray(elementId, _event.mouseOverIds) != -1) return;
                    _event.mouseOverIds[_event.mouseOverIds.length] = elementId;

                    if(elementId == _event.mouseOverObjectId) return;
                    _event.mouseOverObjectId = elementId;
                    $ax.style.SetWidgetHover(elementId, true);
                    var textId = $ax.style.GetTextIdFromShape(elementId);
                    if(textId) $ax.annotation.updateLinkLocations(textId);
                }).mouseleave(function() {
                    var elementId = this.id;
                    var parent = $ax.dynamicPanelManager.parentHandlesStyles(elementId);
                    if(parent && parent.direct) return;
                    $ax.splice(_event.mouseOverIds, $.inArray(elementId, _event.mouseOverIds), 1);

                    if(elementId == _event.mouseOverObjectId) {
                        _event.mouseOverObjectId = '';
                    }
                    $ax.style.SetWidgetHover(elementId, false);
                    var textId = $ax.style.GetTextIdFromShape(elementId);
                    if(textId) $ax.annotation.updateLinkLocations(textId);
                });

                $element.bind($ax.features.eventNames.mouseDownName, function() {
                    var elementId = this.id;
                    var parent = $ax.dynamicPanelManager.parentHandlesStyles(elementId);
                    if(parent) {
                        dynamicPanelMouseDown(parent.id);
                        if(parent.direct) return;
                    }
                    _event.mouseDownObjectId = elementId;

                    $ax.style.SetWidgetMouseDown(this.id, true);
                    $ax.annotation.updateLinkLocations($ax.style.GetTextIdFromShape(elementId));
                }).bind($ax.features.eventNames.mouseUpName, function() {
                    var elementId = this.id;
                    var parent = $ax.dynamicPanelManager.parentHandlesStyles(elementId);
                    if(parent) {
                        dynamicPanelMouseUp(parent.id);
                        if(parent.direct) return;
                    }
                    var mouseDownId = _event.mouseDownObjectId;
                    _event.mouseDownObjectId = '';
                    if(!$ax.style.ObjHasMouseDown(elementId)) return;

                    $ax.style.SetWidgetMouseDown(elementId, false);
                    $ax.annotation.updateLinkLocations($ax.style.GetTextIdFromShape(elementId));

                    //there used to be something we needed to make images click, because swapping out the images prevents the click
                    // this is a note that we can eventually delete.
                });

            }

            var $axElement = undefined;
            // Initialize selected elements
            if((dObj.type == 'flowShape' || dObj.type == 'buttonShape' || dObj.type == 'imageBox' || dObj.type == 'dynamicPanel') && dObj.selected) {
                if(!$axElement) $axElement = $ax('#' + elementId);
                $axElement.selected(true);
            }

            //initialize disabled elements
            if((dObj.type == 'flowShape' || dObj.type == 'buttonShape' || dObj.type == 'imageBox' || dObj.type == 'dynamicPanel') && dObj.disabled) {
                if(!$axElement) $axElement = $ax('#' + elementId);
                $axElement.enabled(false);
            }

            if(OS_MAC && WEBKIT) {
                if(dObj.type == 'comboBox' && dObj.disabled) {
                    $jobj($ax.INPUT(elementId)).css('color', 'grayText');
                }
            };

            // Initialize Placeholders. Right now this is text boxes and text areas.
            // Also, the assuption is being made that these widgets with the placeholder, have no other styles (this may change...)
            var hasPlaceholder = dObj.placeholderText == '' ? true : Boolean(dObj.placeholderText);
            if((dObj.type == 'textArea' || dObj.type == 'textBox') && hasPlaceholder) {
                // This is needed to initialize the placeholder state
                $jobj($ax.INPUT(elementId)).bind('keydown', function() {
                    var id = this.id;
                    var inputIndex = id.indexOf('_input');
                    if(inputIndex == -1) return;
                    var inputId = id.substring(0, inputIndex);

                    if(!$ax.placeholderManager.isActive(inputId)) return;
                    $ax.placeholderManager.updatePlaceholder(inputId, false, true);
                }).bind('keyup', function() {
                    var id = this.id;
                    var inputIndex = id.indexOf('_input');
                    if(inputIndex == -1) return;
                    var inputId = id.substring(0, inputIndex);

                    if($ax.placeholderManager.isActive(inputId)) return;
                    if(!$jobj(id).val()) {
                        $ax.placeholderManager.updatePlaceholder(inputId, true);
                        $ax.placeholderManager.moveCaret(id, 0);
                    }
                }).bind('focus', function() {
                    $ax.placeholderManager.moveCaret(this.id);
                }).bind('mousedown', function() {
                    $ax.placeholderManager.moveCaret(this.id);
                }).bind('mouseup', function() {
                    $ax.placeholderManager.moveCaret(this.id);
                }).bind('blur', function() {
                    var id = this.id;
                    var inputIndex = id.indexOf('_input');
                    if(inputIndex == -1) return;
                    var inputId = id.substring(0, inputIndex);

                    if($jobj(id).val()) return;
                    $ax.placeholderManager.updatePlaceholder(inputId, true);
                });

                $ax.placeholderManager.registerPlaceholder(elementId, dObj.placeholderText, $jobj($ax.INPUT(elementId)).attr('type') == 'password');
                $ax.placeholderManager.updatePlaceholder(elementId, !($jobj($ax.repeater.applySuffixToElementId(elementId, '_input')).val()));
            }

            // Initialize assigned submit buttons
            if(dObj.submitButton) {
                $element.keyup(function(e) {
                    if(e.keyCode == '13') {
                        var scriptId = $ax.repeater.getScriptIdFromElementId(elementId);
                        var path = $ax.deepCopy(dObj.submitButton.path);
                        path[path.length] = dObj.submitButton.id;
                        var itemNum = $ax.repeater.getItemIdFromElementId(elementId);
                        var submitId = $ax.getScriptIdFromPath(path, scriptId);

                        if(itemNum && $ax.getParentRepeaterFromScriptId(submitId) == $ax.getParentRepeaterFromScriptId(scriptId)) {
                            submitId = $ax.repeater.createElementId(submitId, itemNum);
                        }
                        var inputId = $ax.INPUT(submitId);
                        if($jobj(inputId).length) submitId = inputId;

                        $ax.setjBrowserEvent(e);
                        $ax.event.fireClick(submitId);
                    }
                }).keydown(function(e) {
                    if(e.keyCode == '13') {
                        e.preventDefault();
                    }
                });
            }

            // Don't drag after mousing down on a plain text object
            if(dObj.type == 'textArea' || dObj.type == 'textBox' || dObj.type == 'listBox' || dObj.type == 'comboBox' || dObj.type == 'checkBox' || dObj.type == 'radioButton') {
                $element.bind($ax.features.eventNames.mouseDownName, function(event) {
                    event.originalEvent.donotdrag = true;
                });
            }

            if($ax.features.supports.mobile) {
                $element.bind($ax.features.eventNames.mouseDownName, function() { _setCanClick(true); });

                if(dObj.type == 'dynamicPanel') {
                    $element.scroll(function() { _setCanClick(false); });
                }
            }

            //initialize tree node cursors to default so they will override their parent
            if(dObj.type == 'treeNodeObject' && !(dObj.interactionMap && dObj.interactionMap.onClick)) {
                $element.css('cursor', 'default');
            }

            //initialize widgets that are clickable to have the pointer over them when hovering
            if(dObj.interactionMap && dObj.interactionMap.onClick) {
                if($element) $element.css('cursor', 'pointer');
            }

            // TODO: not sure if we need this. It appears to be working without
            //initialize panels for DynamicPanels
            if(dObj.type == 'dynamicPanel') {
                $element.children().each(function() {
                    var parts = this.id.split('_');
                    var state = parts[parts.length - 1].substring(5);
                    if(state != 0) $ax.visibility.SetVisible(this, false);
                });
            }

            //initialize TreeNodes
            if(dObj.type == 'treeNodeObject') {
                if($element.hasClass('treeroot')) return;

                var childrenId = elementId + '_children';
                var children = $element.children('[id="' + childrenId + '"]:first');
                if(children.length > 0) {
                    var plusMinusId = 'u' + (parseInt($ax.repeater.getScriptIdFromElementId(elementId).substring(1)) + 1);
                    var itemId = $ax.repeater.getItemIdFromElementId(elementId);
                    if(itemId) plusMinusId = $ax.repeater.createElementId(plusMinusId, itemId);
                    if(!$jobj(plusMinusId).hasClass('ax_image')) plusMinusId = '';
                    $ax.tree.InitializeTreeNode(elementId, plusMinusId, childrenId);
                }
                $element.click(function() { $ax.tree.SelectTreeNode(elementId, true); });
            }

            //initialize submenus
            if(dObj.type == 'menuObject') {
                if($element.hasClass('sub_menu')) {
                    var tableCellElementId = $ax.getElementIdFromPath([dObj.parentCellId], { relativeTo: elementId });
                    $ax.menu.InitializeSubmenu(elementId, tableCellElementId);
                }
            }

            // Attach handles for dynamic panels that propagate styles to inner items.
            if(dObj.type == 'dynamicPanel' && dObj.propagate) {
                $element.mouseenter(function() {
                    var elementId = this.id;
                    dynamicPanelMouseOver(elementId);
                }).mouseleave(function() {
                    var elementId = this.id;
                    dynamicPanelMouseLeave(elementId);
                }).bind($ax.features.eventNames.mouseDownName, function() {
                    var elementId = this.id;
                    dynamicPanelMouseDown(elementId);
                }).bind($ax.features.eventNames.mouseUpName, function() {
                    var elementId = this.id;
                    dynamicPanelMouseUp(elementId);
                });
            }

            // These are the dynamic panel functions for propagating rollover styles and mouse down styles to inner objects
            var dynamicPanelMouseOver = function(elementId, fromChild) {
                var parent = $ax.dynamicPanelManager.parentHandlesStyles(elementId);
                if(parent) {
                    dynamicPanelMouseOver(parent.id, true);
                    if(parent.direct) return;
                }
                if($.inArray(elementId, _event.mouseOverIds) != -1) return;
                // If this event is coming from a child, don't mark that it's actually entered.
                // Only mark that this has been entered if this event has naturally been triggered. (For reason see mouseleave)
                if(!fromChild) _event.mouseOverIds[_event.mouseOverIds.length] = elementId;
                if(elementId == _event.mouseOverObjectId) return;
                _event.mouseOverObjectId = elementId;
                $ax.dynamicPanelManager.propagateMouseOver(elementId, true);
            };
            var dynamicPanelMouseLeave = function(elementId, fromChild) {
                var parent = $ax.dynamicPanelManager.parentHandlesStyles(elementId);
                if(parent) {
                    dynamicPanelMouseLeave(parent.id, true);
                    if(parent.direct) return;
                }
                var index = $.inArray(elementId, _event.mouseOverIds);
                // If index != -1, this has been natuarally entered. If naturally entered, then leaving child should not trigger leaving,
                //  but instead wait for natural mouse leave. If natural mouse enter never triggered, natural mouse leave won't so do this now.
                if((index != -1) && fromChild) return;
                $ax.splice(_event.mouseOverIds, index, 1);

                if(elementId == _event.mouseOverObjectId) {
                    _event.mouseOverObjectId = '';
                }
                $ax.dynamicPanelManager.propagateMouseOver(elementId, false);
            };
            var dynamicPanelMouseDown = function(elementId) {
                var parent = $ax.dynamicPanelManager.parentHandlesStyles(elementId);
                if(parent) {
                    dynamicPanelMouseDown(parent.id);
                    if(parent.direct) return;
                }
                _event.mouseDownObjectId = elementId;
                $ax.dynamicPanelManager.propagateMouseDown(elementId, true);
            };
            var dynamicPanelMouseUp = function(elementId) {
                var parent = $ax.dynamicPanelManager.parentHandlesStyles(elementId);
                if(parent) {
                    dynamicPanelMouseUp(parent.id);
                    if(parent.direct) return;
                }
                _event.mouseDownObjectId = '';
                $ax.dynamicPanelManager.propagateMouseDown(elementId, false);
            };

            //attach handlers for button shape and tree node mouse over styles
            // TODO: Can this really be removed? Trees seem to work with out (the generic hover case works for it).
            //        query.filter(function(obj) {
            //            return obj.type == 'buttonShape' && obj.parent.type == 'treeNodeObject' &&
            //                    obj.parent.style && obj.parent.style.stateStyles &&
            //                        obj.parent.style.stateStyles.mouseOver;
            //        }).mouseenter(function() {
            //            $ax.style.SetWidgetHover(this.id, true);
            //        }).mouseleave(function() {
            //            $ax.style.SetWidgetHover(this.id, false);
            //        });

            //handle treeNodeObject events and prevent them from bubbling up. this is necessary because otherwise
            //both a sub menu and it's parent would get a click
            if(dObj.type == 'treeNodeObject') {
                $element.click(function() {
                    //todo -- this was bubbling, but then selecting a child tree node would bubble and select the parent (don't know if there is a better way)
                    _fireObjectEvent(this.id, 'click', arguments);
                    return false;
                }).each(function() {
                    if(!this.style.cursor) {
                        this.style.cursor = 'default';
                    }
                });
            }

            // Synthetic events

            var map = dObj.interactionMap;
            // Attach dynamic panel synthetic drag and swipe events
            if(dObj.type == "dynamicPanel" && map && (
                map.onDragStart || map.onDrag ||
                    map.onDragDrop || map.onSwipeLeft || map.onSwipeRight || map.onSwipeUp || map.onSwipeDown)) {

                $element.bind($ax.features.eventNames.mouseDownName, function(e) { $ax.drag.StartDragWidget(e.originalEvent, elementId); });
            }

            // Attach dynamic panel synthetic scroll event
            if(dObj.type == 'dynamicPanel' && map && map.onScroll) {
                var diagrams = dObj.diagrams;
                for(var i = 0; i < diagrams.length; i++) {
                    var panelId = $ax.repeater.applySuffixToElementId(elementId, '_state' + i);
                    (function(id) {
                        _attachDefaultObjectEvent($('#' + id), elementId, 'scroll', function(e) {
                            $ax.setjBrowserEvent(e);
                            _handleEvent(elementId, $ax.getEventInfoFromEvent($ax.getjBrowserEvent(), false, elementId), map.onScroll);
                        });
                    })(panelId);
                }
            }

            // Attach synthetic hover event
            if (map && map.onMouseHover) {
                var MIN_HOVER_HOLD_TIME = 1000;

                // So when the timeout fires, you know whether it is the same mouseenter that is active or not.
                var hoverMouseCount = 0;
                // Update eventInfo regularly, so position is accurate.
                var hoverEventInfo;

                $element.mouseenter(function(e) {
                    $ax.setjBrowserEvent(e);
                    hoverEventInfo = $ax.getEventInfoFromEvent($ax.getjBrowserEvent(), false, elementId);
                    (function(currCount) {
                        window.setTimeout(function() {
                            if(currCount == hoverMouseCount) _raiseSyntheticEvent(elementId, 'onMouseHover', false, hoverEventInfo, true);
                        }, MIN_HOVER_HOLD_TIME);
                    })(hoverMouseCount);
                }).mouseleave(function(e) {
                    $ax.setjBrowserEvent(e);
                    hoverMouseCount++;
                }).mousemove(function(e) {
                    $ax.setjBrowserEvent(e);
                    hoverEventInfo = $ax.getEventInfoFromEvent($ax.getjBrowserEvent(), false, elementId);
                });
            }

            // Attach synthetic tap and hold event.
            if (map && map.onLongClick) {
                var MIN_LONG_CLICK_HOLD_TIME = 750;

                // So when the timeout fires, you know whether it is the same mousedown that is active or not.
                var longClickMouseCount = 0;

                $element.bind($ax.features.eventNames.mouseDownName, function(e) {
                    (function(currCount) {
                        $ax.setjBrowserEvent(e);
                        var eventInfo = $ax.getEventInfoFromEvent($ax.getjBrowserEvent(), false, elementId);
                        window.setTimeout(function() {
                            if(currCount == longClickMouseCount) _raiseSyntheticEvent(elementId, 'onLongClick', false, eventInfo, true);
                        }, MIN_LONG_CLICK_HOLD_TIME);
                        if(e.preventDefault) e.preventDefault();
                    })(longClickMouseCount);
                }).bind($ax.features.eventNames.mouseUpName, function(e) {
                    $ax.setjBrowserEvent(e);
                    longClickMouseCount++;
                });
            };


            // Attach synthetic onSelectionChange event to droplist and listbox elements
            if ($ax.event.HasSelectionChanged(dObj)) {
                $element.bind('change', function(e) {
                    $ax.setjBrowserEvent(e);
                    _raiseSyntheticEvent(elementId, 'onSelectionChange');
                });
            };

            // Highjack key up and key down to keep track of state of keyboard.
            _event.initKeyEvents($element);

            // Attach synthetic onTextChange event to textbox and textarea elements
            if ($ax.event.HasTextChanged(dObj)) {
                var element = $jobj($ax.INPUT(elementId));
                $ax.updateElementText(elementId, element.val());
                //Key down needed because when holding a key down, key up only fires once, but keydown fires repeatedly.
                //Key up because last mouse down will only show the state before the last character.
                element.bind('keydown', function(e) {
                    $ax.setjBrowserEvent(e);
                    $ax.event.TryFireTextChanged(elementId);
                }).bind('keyup', function(e) {
                    $ax.setjBrowserEvent(e);
                    $ax.event.TryFireTextChanged(elementId);
                });
            };

            // Attach synthetic onCheckedChange event to radiobutton and checkbox elements
            if (dObj.type == 'checkbox' || dObj.type == 'radioButton') {
                var input = $jobj($ax.INPUT(elementId));
                if(dObj.type == 'radioButton' && input.prop('checked')) {
                    $ax.updateRadioButtonSelected(input.attr('name'), elementId);
                }

                $element.bind('change', function(e) {
                    $ax.setjBrowserEvent(e);
                    _tryFireCheckedChanged(elementId, true);
                });
            };

            var hasTap = map && (map.onClick || map.onDoubleClick);
            var hasMove = map && map.onMouseMove;
            _event.initMobileEvents(hasTap ? $element : $(),
                hasMove ? $element : $(), elementId);


            //attach link alternate styles
            if(dObj.type == 'hyperlink') {
                $element.mouseenter(function() {
                    var elementId = this.id;
                    if(_event.mouseOverIds.indexOf(elementId) != -1) return true;
                    _event.mouseOverIds[_event.mouseOverIds.length] = elementId;
                    var mouseOverObjectId = _event.mouseOverObjectId;
                    if(mouseOverObjectId && $ax.style.IsWidgetDisabled(mouseOverObjectId)) return true;

                    $ax.style.SetLinkHover(elementId);

                    var bubble = _fireObjectEvent(elementId, 'mouseenter', arguments);

                    $ax.annotation.updateLinkLocations($ax.style.GetTextIdFromLink(elementId));
                    return bubble;
                }).mouseleave(function() {
                    var elementId = this.id;
                    $ax.splice(_event.mouseOverIds, _event.mouseOverIds.indexOf(elementId), 1);
                    var mouseOverObjectId = _event.mouseOverObjectId;
                    if(mouseOverObjectId && $ax.style.IsWidgetDisabled(mouseOverObjectId)) return true;

                    $ax.style.SetLinkNotHover(elementId);

                    var bubble = _fireObjectEvent(elementId, 'mouseleave', arguments);

                    $ax.annotation.updateLinkLocations($ax.style.GetTextIdFromLink(elementId));
                    return bubble;
                }).bind($ax.features.eventNames.mouseDownName, function() {
                    var elementId = this.id;
                    var mouseOverObjectId = _event.mouseOverObjectId;
                    if($ax.style.IsWidgetDisabled(mouseOverObjectId)) return undefined;

                    if(mouseOverObjectId) $ax.style.SetWidgetMouseDown(mouseOverObjectId, true);
                    $ax.style.SetLinkMouseDown(elementId);

                    $ax.annotation.updateLinkLocations($ax.style.GetTextIdFromLink(elementId));

                    return false;
                }).bind($ax.features.eventNames.mouseUpName, function() {
                    var elementId = this.id;
                    var mouseOverObjectId = _event.mouseOverObjectId;
                    if(mouseOverObjectId && $ax.style.IsWidgetDisabled(mouseOverObjectId)) return;

                    if(mouseOverObjectId) $ax.style.SetWidgetMouseDown(mouseOverObjectId, false);
                    $ax.style.SetLinkNotMouseDown(elementId);

                    $ax.annotation.updateLinkLocations($ax.style.GetTextIdFromLink(elementId));

                }).click(function() {
                    var elementId = this.id;
                    var mouseOverObjectId = _event.mouseOverObjectId;
                    if(mouseOverObjectId && $ax.style.IsWidgetDisabled(mouseOverObjectId)) return undefined;

                    return _fireObjectEvent(elementId, 'click', arguments);
                });
            }

            // Init inline frames
            if (dObj.type == 'inlineFrame') {
                var target = dObj.target;
                var url = '';
                if(target.includeVariables && target.url) {
                    var origSrc = target.url;
                    url = origSrc.toLowerCase().indexOf('http://') == -1 ? $ax.globalVariableProvider.getLinkUrl(origSrc) : origSrc;

                } else if(target.urlLiteral) {
                    url = $ax.expr.evaluateExpr(target.urlLiteral, $ax.getEventInfoFromEvent(undefined, true, elementId), true);
                }
                if(url) $jobj($ax.INPUT(elementId)).attr('src', url);
            };
        });
    }
    $ax.initializeObjectEvents = _initializeObjectEvents;

    // Handle key up and key down events
    (function() {
        var _keyState = {};
        _keyState.ctrl = false;
        _keyState.alt = false;
        _keyState.shift = false;
        _keyState.keyCode = 0;
        $ax.event.keyState = function() {
            return $ax.deepCopy(_keyState);
        };

        var modifierCodes = [16, 17, 18];
        $ax.event.initKeyEvents = function($query) {
            $query.keydown(function(e) {
                var elementId = this.id;

                _keyState.ctrl = e.ctrlKey;

                _keyState.alt = e.altKey;

                _keyState.shift = e.shiftKey;

                // If a modifier was pressed, then don't set the keyCode;
                if(modifierCodes.indexOf(e.keyCode) == -1) _keyState.keyCode = e.keyCode;

                $ax.setjBrowserEvent(e);
                if(!elementId) fireEventThroughContainers('onKeyDown', undefined, false, ['page', 'referenceDiagramObject', 'dynamicPanel', 'repeater'], ['page', 'referenceDiagramObject']);
                else _raiseSyntheticEvent(elementId, 'onKeyDown', false, undefined, true);
            });
            $query.keyup(function(e) {
                var elementId = this.id;

                $ax.setjBrowserEvent(e);
                // Fire event before updating modifiers.
                if(!elementId) fireEventThroughContainers('onKeyUp', undefined, false, ['page', 'referenceDiagramObject', 'dynamicPanel', 'repeater'], ['page', 'referenceDiagramObject']);
                else _raiseSyntheticEvent(elementId, 'onKeyUp', false, undefined, true);

                _keyState.ctrl = e.ctrlKey;

                _keyState.alt = e.altKey;

                _keyState.shift = e.shiftKey;

                // If a non-modifier was lifted, clear the keycode
                if(modifierCodes.indexOf(e.keyCode) == -1) _keyState.keyCode = 0;
            });
        };
    })();

    // Handle adding mobile events
    (function() {
        // NOTE: Multi touch is NOT handled currently.
        var CLICK_THRESHOLD_PX = 25;
        var CLICK_THRESHOLD_PX_SQ = CLICK_THRESHOLD_PX * CLICK_THRESHOLD_PX;
        var DBLCLICK_THRESHOLD_MS = 500;

        // Location in page cooridinates
        var tapDownLoc;
        var lastClickEventTime;

        _event.initMobileEvents = function($tapQuery, $moveQuery, elementId) {
            if(!$ax.features.supports.mobile) return;

            // Handle touch start
            $tapQuery.bind('touchstart', function(e) {
                // We do NOT support multiple touches. This isn't necessarily the touch we want.
                var touch = e.originalEvent && e.originalEvent.changedTouches && e.originalEvent.changedTouches[0];
                if(!touch) return;

                tapDownLoc = [touch.pageX, touch.pageY];

                var time = (new Date()).getTime();
                if(time - lastClickEventTime < DBLCLICK_THRESHOLD_MS) {
                    var dObj = elementId === '' ? $ax.pageData.page : $ax.getObjectFromElementId(elementId);
                    var axEventObject = dObj && dObj.interactionMap && dObj.interactionMap['onDoubleClick'];
                    if(axEventObject) e.preventDefault(); //for Chrome on Android
                }
            }).bind('touchend', function(e) {
                var touch = e.originalEvent && e.originalEvent.changedTouches && e.originalEvent.changedTouches[0];
                if(!touch || !tapDownLoc) return;

                var tapUpLoc = [touch.pageX, touch.pageY];
                var xDiff = tapUpLoc[0] - tapDownLoc[0];
                var yDiff = tapUpLoc[1] - tapDownLoc[1];

                if((xDiff * xDiff + yDiff * yDiff) < CLICK_THRESHOLD_PX_SQ) {
                    $ax.setjBrowserEvent(e);
                    _raiseSyntheticEvent(elementId, 'onClick', false, undefined, true);

                    var time = (new Date()).getTime();
                    if(time - lastClickEventTime < DBLCLICK_THRESHOLD_MS) {
                        _raiseSyntheticEvent(elementId, 'onDoubleClick', false, undefined, true);
                        if(e.originalEvent && e.originalEvent.handled) e.preventDefault(); //for iOS
                    }
                    lastClickEventTime = time;
                }
            });

            // Handles touch move
            $moveQuery.bind('touchmove', function(e) {
                $ax.setjBrowserEvent(e);
                _raiseSyntheticEvent(elementId, 'onMouseMove', false, undefined, true);
                if(e.originalEvent && e.originalEvent.handled) e.preventDefault();
            });
        };
    })();

    // Handle adding device independent click events to non-widgets
    (function() {
        var CLICK_THRESHOLD_PX = 25;
        var CLICK_THRESHOLD_PX_SQ = CLICK_THRESHOLD_PX * CLICK_THRESHOLD_PX;

        // Location in page cooridinates
        var tapDownLoc;

        _event.attachClick = function(query, clickHandler) {
            if(!$ax.features.supports.mobile) {
                query.click(clickHandler);
                return;
            }

            $(query).bind('touchstart', function(e) {
                // We do NOT support multiple touches. This isn't necessarily the touch we want.
                var touch = e.originalEvent && e.originalEvent.changedTouches && e.originalEvent.changedTouches[0];
                if(!touch) return;

                tapDownLoc = [touch.pageX, touch.pageY];
            });

            $(query).bind('touchend', function(e) {
                var touch = e.originalEvent && e.originalEvent.changedTouches && e.originalEvent.changedTouches[0];
                if(!touch) return;

                var tapUpLoc = [touch.pageX, touch.pageY];
                var xDiff = tapUpLoc[0] - tapDownLoc[0];
                var yDiff = tapUpLoc[1] - tapDownLoc[1];

                if((xDiff * xDiff + yDiff * yDiff) < CLICK_THRESHOLD_PX_SQ) {
                    clickHandler();
                }
            });
        };
    })();

    // Handle firing device independent click events on widgets
    (function() {
        _event.fireClick = function(elementId) {
            if(!$ax.features.supports.mobile) {
                $('#' + elementId).click();
                return;
            }
            _raiseSyntheticEvent(elementId, 'onClick', false, undefined, true);
        };
    })();

    var _mouseLocation = $ax.mouseLocation = { x: 0, y: 0 };
    var _lastmouseLocation = $ax.lastMouseLocation = { x: 0, y: 0 };

    var _updateMouseLocation = function(e, end) {
        if(!e) return;

        if(IE && typeof (e.type) == 'unknown') return;
        if(e.type != 'mousemove' && e.type != 'touchstart' && e.type != 'touchmove' && e.type != 'touchend') return;

        var newX;
        var newY;
        if(IE) {
            newX = e.clientX + $('html').scrollLeft();
            newY = e.clientY + $('html').scrollTop();
        } else {
            newX = e.pageX;
            newY = e.pageY;
        }
        var body = $('body');
        if(body.css('position') == 'relative') newX = Math.round(newX - Number(body.css('left').replace('px', '')) - Math.max(0, ($(window).width() - body.width()) / 2));

        if(_mouseLocation.x == newX && _mouseLocation.y == newY) return;

        _lastmouseLocation.x = _mouseLocation.x;
        _lastmouseLocation.y = _mouseLocation.y;
        _mouseLocation.x = newX;
        _mouseLocation.y = newY;

        $ax.geometry.tick(_mouseLocation.x, _mouseLocation.y, end);
    };
    _event.updateMouseLocation = _updateMouseLocation;

    var _leavingState = function(stateId) {
        var mouseOverIds = _event.mouseOverIds;
        if(mouseOverIds.length == 0) return;

        var stateQuery = $jobj(stateId);
        for(var i = mouseOverIds.length - 1; i >= 0; i--) {
            var id = mouseOverIds[i];
            if(stateQuery.find('#' + id).length) {
                $ax.splice(mouseOverIds, $.inArray(id, mouseOverIds), 1);
                $ax.style.SetWidgetMouseDown(id, false);
                $ax.style.SetWidgetHover(id, false);
            }
        }
    };
    _event.leavingState = _leavingState;

    var _raiseSyntheticEvent = function(elementId, eventName, skipShowDescription, eventInfo, nonSynthetic) {
        // Empty string used when this is an event directly on the page.
        var dObj = elementId === '' ? $ax.pageData.page : $ax.getObjectFromElementId(elementId);
        var axEventObject = dObj && dObj.interactionMap && dObj.interactionMap[eventName];
        if(!axEventObject) return;

        eventInfo = eventInfo || $ax.getEventInfoFromEvent($ax.getjBrowserEvent(), skipShowDescription, elementId);
        _handleEvent(elementId, eventInfo, axEventObject, false, !nonSynthetic);
    };
    $ax.event.raiseSyntheticEvent = _raiseSyntheticEvent;

    var _hasSyntheticEvent = function(scriptId, eventName) {
        var dObj = $ax.getObjectFromScriptId(scriptId);
        var axEventObject = dObj && dObj.interactionMap && dObj.interactionMap[eventName];
        return Boolean(axEventObject);
    };
    $ax.event.hasSyntheticEvent = _hasSyntheticEvent;

    var _initialize = function() {
        $ax.repeater.load();

        // Make sure key events for page are initialized first. That way they will update the value of key pressed before any other events occur.
        _event.initKeyEvents($(window));
        _initializeObjectEvents($ax('*'));

        //finally, process the pageload
        _pageLoad();
        //        _loadDynamicPanelsAndMasters();
        //        $ax.repeater.init();

        // and wipe out the basic links.
        $('.basiclink').click(function() {
            return false;
        });
    };
    _event.initialize = _initialize;

    $ax.event.HasTextChanged = function(diagramObject) {
        if(diagramObject.type != 'textBox' && diagramObject.type != 'textArea') return false;
        var map = diagramObject.interactionMap;
        return map && map.onTextChange;
    };

    $ax.event.TryFireTextChanged = function(elementId) {
        var query = $jobj($ax.repeater.applySuffixToElementId(elementId, '_input'));
        if(!$ax.hasElementTextChanged(elementId, query.val())) return;
        $ax.updateElementText(elementId, query.val());

        $ax.event.raiseSyntheticEvent(elementId, 'onTextChange');
    };

    $ax.event.HasSelectionChanged = function(diagramObject) {
        if(diagramObject.type != 'listBox' && diagramObject.type != 'comboBox') return false;
        var map = diagramObject.interactionMap;
        return map && map.onSelectionChange;
    };

    $ax.event.HasCheckedChanged = function(diagramObject) {
        if(diagramObject.type != 'checkbox' && diagramObject.type != 'radioButton') return false;
        var map = diagramObject.interactionMap;
        return map && map.onCheckedChange;
    };

    var _tryFireCheckedChanged = $ax.event.TryFireCheckChanged = function(elementId, value) {
        var isRadio = $obj(elementId).type == 'radioButton';
        if(isRadio) {
            if(!value) {
                $ax.updateRadioButtonSelected($jobj($ax.INPUT(elementId)).attr('name'), undefined);
            } else {
                var last = $ax.updateRadioButtonSelected($jobj($ax.INPUT(elementId)).attr('name'), elementId);

                // If no change, this should not fire
                if(last == elementId) return;

                // Initially selecting one, last may be undefined
                if(last) $ax.event.raiseSyntheticEvent(last, 'onCheckedChange');
            }
        }

        $ax.event.raiseSyntheticEvent(elementId, 'onCheckedChange');
    };

    var _loadDynamicPanelsAndMasters = function(objects, path, itemId) {
        fireEventThroughContainers('onLoad', objects, true, ['page', 'referenceDiagramObject', 'dynamicPanel'], ['page', 'referenceDiagramObject', 'dynamicPanel', 'repeater'], path, itemId);
    };
    $ax.loadDynamicPanelsAndMasters = _loadDynamicPanelsAndMasters;

    var _viewChangePageAndMasters = function() {
        fireEventThroughContainers('onAdaptiveViewChange', undefined, true, ['page', 'referenceDiagramObject', 'dynamicPanel'], ['page', 'referenceDiagramObject']);
        _postAdaptiveViewChanged();
    };
    $ax.viewChangePageAndMasters = _viewChangePageAndMasters;

    var _postAdaptiveViewChanged = function() {
        //only trigger adaptive view changed if the window is on the mainframe. Also triggered on init, even if default.
        try {
            if(window.name == 'mainFrame' ||
            (!CHROME_5_LOCAL && window.parent.$ && window.parent.$('#mainFrame').length > 0)) {
                $axure.messageCenter.postMessage('adaptiveViewChange', $ax.adaptive.currentViewId);
            }
        } catch(e) { }
    };
    $ax.postAdaptiveViewChanged = _postAdaptiveViewChanged;

    var _postResize = $ax.postResize = function(e) {
        $ax.setjBrowserEvent(e);
        return fireEventThroughContainers('onResize', undefined, false, ['page', 'referenceDiagramObject', 'dynamicPanel', 'repeater'], ['page', 'referenceDiagramObject']);
    };

    // Filters include page, referenceDiagramObject, dynamicPanel, and repeater.
    var fireEventThroughContainers = function(eventName, objects, synthetic, searchFilter, callFilter, path, itemId) {
        // TODO: may want to pass in this as a parameter. At that point, may want to convert some of them to an option parameter. For now this is the only case
        var skipShowDescription = eventName == 'onLoad';

        // If objects undefined, load page
        if(!objects) {
            if(callFilter.indexOf('page') != -1) {
                var map = $ax.pageData.page.interactionMap;
                var pageEventInfo = $ax.getEventInfoFromEvent($ax.getjBrowserEvent(), skipShowDescription, '');
                var pageEvent = map && map[eventName];
                if(pageEvent) _handleEvent('', pageEventInfo, pageEvent, skipShowDescription, synthetic);
            }
            if(searchFilter.indexOf('page') != -1) fireEventThroughContainers(eventName, $ax.pageData.page.diagram.objects, synthetic, searchFilter, callFilter);
            return;
        }

        if(!path) path = [];

        var pathCopy = [];
        for(var j = 0; j < path.length; j++) pathCopy[j] = path[j];

        for(var i = 0; i < objects.length; i++) {
            var obj = objects[i];
            if(obj.type != 'referenceDiagramObject' && obj.type != 'dynamicPanel' && obj.type != 'repeater') continue;

            pathCopy[path.length] = obj.id;
            var objId = $ax.getScriptIdFromPath(pathCopy);
            objId = $ax.repeater.createElementId(objId, itemId);

            if(obj.type == 'referenceDiagramObject') {
                if(callFilter.indexOf('referenceDiagramObject') != -1) {
                    var axEvent = $ax.pageData.masters[obj.masterId].interactionMap[eventName];
                    if(axEvent) {
                        var eventInfo = $ax.getEventInfoFromEvent($ax.getjBrowserEvent(), skipShowDescription, objId);
                        eventInfo.isMasterEvent = true;
                        _handleEvent(objId, eventInfo, axEvent, skipShowDescription, synthetic);
                    }
                }
                if(searchFilter.indexOf('referenceDiagramObject') != -1) fireEventThroughContainers(eventName, $ax.pageData.masters[obj.masterId].diagram.objects, synthetic, searchFilter, callFilter, pathCopy, itemId);
            } else if(obj.type == 'dynamicPanel') {
                if(callFilter.indexOf('dynamicPanel') != -1) $ax.event.raiseSyntheticEvent(objId, eventName, skipShowDescription, undefined, !synthetic);

                if(searchFilter.indexOf('dynamicPanel') != -1) {
                    var diagrams = obj.diagrams;
                    for(var j = 0; j < diagrams.length; j++) {
                        fireEventThroughContainers(eventName, diagrams[j].objects, synthetic, searchFilter, callFilter, path, itemId);
                    }
                }
            } else if(obj.type == 'repeater') {
                // TODO: possible an option for repeater item? Now fires overall for the repeater
                if(callFilter.indexOf('repeater') != -1) $ax.event.raiseSyntheticEvent(objId, eventName, skipShowDescription, undefined, !synthetic);
                if(searchFilter.indexOf('repeater') != -1) {
                    var itemIds = $ax.getItemIdsForRepeater(objId);
                    for(var j = 0; j < itemIds.length; j++) {
                        fireEventThroughContainers(eventName, obj.objects, synthetic, searchFilter, callFilter, path, itemIds[j]);
                    }
                }
            }
        }
    };

    // FOCUS stuff
    (function() {

    })();



    var _pageLoad = function() {
        // Map of axure event names to pair of what it should attach to, and what the jquery event name is.
        var PAGE_AXURE_TO_JQUERY_EVENT_NAMES = {
            'onScroll': [window, 'scroll'],
            //'onResize': [window, 'resize'],
            'onContextMenu': [window, 'contextmenu']
        };

        var $win = $(window);
        if(!$ax.features.supports.mobile) {
            PAGE_AXURE_TO_JQUERY_EVENT_NAMES.onClick = ['html', 'click'];
            PAGE_AXURE_TO_JQUERY_EVENT_NAMES.onDoubleClick = ['html', 'dblclick'];
            PAGE_AXURE_TO_JQUERY_EVENT_NAMES.onMouseMove = ['html', 'mousemove'];
        } else {
            _event.initMobileEvents($win, $win, '');

            $win.bind($ax.features.eventNames.mouseDownName, _updateMouseLocation);
            $win.bind($ax.features.eventNames.mouseUpName, function(e) { _updateMouseLocation(e, true); });

            $win.scroll(function() { _setCanClick(false); });
            $win.bind($ax.features.eventNames.mouseDownName, (function() {
                _setCanClick(true);
            }));
        }
        $win.bind($ax.features.eventNames.mouseMoveName, _updateMouseLocation);
        $win.scroll($ax.flyoutManager.reregisterAllFlyouts);

        for(key in PAGE_AXURE_TO_JQUERY_EVENT_NAMES) {
            if(!PAGE_AXURE_TO_JQUERY_EVENT_NAMES.hasOwnProperty(key)) continue;
            (function(axureName) {
                var jqueryEventNamePair = PAGE_AXURE_TO_JQUERY_EVENT_NAMES[axureName];
                $(jqueryEventNamePair[0])[jqueryEventNamePair[1]](function(e) {
                    $ax.setjBrowserEvent(e);
                    return fireEventThroughContainers(axureName, undefined, false, ['page', 'referenceDiagramObject', 'dynamicPanel', 'repeater'], ['page', 'referenceDiagramObject']);
                });
            })(key);
        }
    };
    _event.pageLoad = _pageLoad;


});