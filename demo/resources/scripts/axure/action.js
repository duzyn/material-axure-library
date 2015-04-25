$axure.internal(function($ax) {
    var _actionHandlers = {};
    var _action = $ax.action = {};

    var animationQueue = {};
    var getAnimation = function(id) {
        return animationQueue[id] && animationQueue[id][0];
    };

    var _addAnimation = _action.addAnimation = function(id, func) {
        var wasEmpty = !getAnimation(id);

        // Add the func to the queue. Create the queue if necessary.
        var queue = animationQueue[id];
        if(!queue) {
            animationQueue[id] = queue = [];
        }
        queue[queue.length] = func;

        // If it was empty, there isn't a callback waiting to be called on this. You have to fire it manually.
        if(wasEmpty) func();
    };

    var _fireAnimationFromQueue = _action.fireAnimationFromQueue = function(id) {
        // Remove the function that was just fired
        if(animationQueue[id]) $ax.splice(animationQueue[id], 0, 1);

        // Fire the next func if there is one
        var func = getAnimation(id);
        if(func) func();
    };

    var _refreshing = [];
    _action.refreshStart = function(repeaterId) { _refreshing.push(repeaterId); };
    _action.refreshEnd = function() { _refreshing.pop(); };

    // TODO: [ben] Consider moving this to repeater.js
    var _repeatersToRefresh = _action.repeatersToRefresh = [];
    var _ignoreAction = function(repeaterId) {
        for(var i = 0; i < _refreshing.length; i++) if(_refreshing[i] == repeaterId) return true;
        return false;
    };

    var _addRefresh = function(repeaterId) {
        if(_repeatersToRefresh.indexOf(repeaterId) == -1) _repeatersToRefresh.push(repeaterId);
    };

    var _dispatchAction = $ax.action.dispatchAction = function(eventInfo, actions, currentIndex) {
        currentIndex = currentIndex || 0;
        //If no actions, you can bubble
        if(currentIndex >= actions.length) return;
        //actions are responsible for doing their own dispatching
        _actionHandlers[actions[currentIndex].action](eventInfo, actions, currentIndex);
    };

    _actionHandlers.wait = function(eventInfo, actions, index) {
        var action = actions[index];
        var infoCopy = $ax.eventCopy(eventInfo);
        window.setTimeout(function() {
            infoCopy.now = new Date();
            _dispatchAction(infoCopy, actions, index + 1);
        }, action.waitTime);
    };

    _actionHandlers.expr = function(eventInfo, actions, index) {
        var action = actions[index];

        $ax.expr.evaluateExpr(action.expr, eventInfo); //this should be a block

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.setFunction = _actionHandlers.expr;

    _actionHandlers.linkWindow = function(eventInfo, actions, index) {
        linkActionHelper(eventInfo, actions, index);
    };

    _actionHandlers.closeCurrent = function(eventInfo, actions, index) {
        $ax.closeWindow();
        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.linkFrame = function(eventInfo, actions, index) {
        linkActionHelper(eventInfo, actions, index);
    };

    var linkActionHelper = function(eventInfo, actions, index) {
        var action = actions[index];
        eventInfo.link = true;

        if(action.linkType != 'frame') {
            var includeVars = _includeVars(action.target, eventInfo);
            if(action.target.targetType == "reloadPage") {
                $ax.reload(action.target.includeVariables);
            } else if(action.target.targetType == "backUrl") {
                $ax.back();
            }

            var url = action.target.url;
            if(!url && action.target.urlLiteral) {
                url = $ax.expr.evaluateExpr(action.target.urlLiteral, eventInfo, true);
            }

            if(url) {
                if(action.linkType == "popup") {
                    $ax.navigate({
                        url: url,
                        target: action.linkType,
                        includeVariables: includeVars,
                        popupOptions: action.popup
                    });
                } else {
                    $ax.navigate({
                        url: url,
                        target: action.linkType,
                        includeVariables: includeVars
                    });
                }
            }
        } else linkFrame(eventInfo, action);
        eventInfo.link = false;

        _dispatchAction(eventInfo, actions, index + 1);
    };

    var _includeVars = function(target, eventInfo) {
        if(target.includeVariables) return true;
        // If it is a url literal, that is a string literal, that has only 1 sto, that is an item that is a page, include vars.
        if(target.urlLiteral) {
            var literal = target.urlLiteral;
            var sto = literal.stos[0];
            if(literal.exprType == 'stringLiteral' && literal.value.indexOf('[[') == 0 && literal.value.indexOf(']]' == literal.value.length - 2) && literal.stos.length == 1 && sto.sto == 'item' && eventInfo.item) {
                var data = $ax.repeater.getData(eventInfo.item.repeater.elementId, eventInfo.item.index, sto.name, 'data');
                if(data && data.type == 'page') return true;
            }
        }
        return false;
    };

    var linkFrame = function(eventInfo, action) {
        for(var i = 0; i < action.framesToTargets.length; i++) {
            var framePath = action.framesToTargets[i].framePath;
            var target = action.framesToTargets[i].target;
            var includeVars = _includeVars(target, eventInfo);

            var url = target.url;
            if(!url && target.urlLiteral) {
                url = $ax.expr.evaluateExpr(target.urlLiteral, eventInfo, true);
            }

            $ax('#' + $ax.INPUT($ax.getElementIdsFromPath(framePath, eventInfo)[0])).openLink(url, includeVars);
        }
    };

    var _repeatPanelMap = {};

    _actionHandlers.setPanelState = function(eventInfo, actions, index) {
        var action = actions[index];

        for(var i = 0; i < action.panelsToStates.length; i++) {
            var panelToState = action.panelsToStates[i];
            var stateInfo = panelToState.stateInfo;
            var elementIds = $ax.getElementIdsFromPath(panelToState.panelPath, eventInfo);

            for(var j = 0; j < elementIds.length; j++) {
                var elementId = elementIds[j];
                // Need new scope for elementId and info
                (function(elementId, stateInfo) {
                    _addAnimation(elementId, function() {
                        var stateNumber = stateInfo.stateNumber;
                        if(stateInfo.setStateType == "value") {
                            var oldTarget = eventInfo.targetElement;
                            eventInfo.targetElement = elementId;
                            var stateName = $ax.expr.evaluateExpr(stateInfo.stateValue, eventInfo);
                            eventInfo.targetElement = oldTarget;

                            // Try for state name first
                            var states = $ax.getObjectFromElementId(elementId).diagrams;
                            var stateNameFound = false;
                            for(var k = 0; k < states.length; k++) {
                                if(states[k].label == stateName) {
                                    stateNumber = k + 1;
                                    stateNameFound = true;
                                }
                            }

                            // Now check for index
                            if(!stateNameFound) {
                                stateNumber = Number(stateName);
                                var panelCount = $('#' + elementId).children().length;

                                // Make sure number is not NaN, is in range, and is a whole number.
                                // Wasn't a state name or number, so return
                                if(isNaN(stateNumber) || stateNumber <= 0 || stateNumber > panelCount || Math.round(stateNumber) != stateNumber) return $ax.action.fireAnimationFromQueue(elementId);
                            }
                        } else if(stateInfo.setStateType == 'next' || stateInfo.setStateType == 'previous') {
                            var info = $ax.deepCopy(stateInfo);
                            var repeat = info.repeat;

                            // Only map it, if repeat exists.
                            if(typeof (repeat) == 'number') _repeatPanelMap[elementId] = info;
                            return _progessPanelState(elementId, info);
                        }
                        delete _repeatPanelMap[elementId];

                        // If setting to current (to stop repeat) break here
                        if(stateInfo.setStateType == 'current') return $ax.action.fireAnimationFromQueue(elementId);

                        $ax('#' + elementId).SetPanelState(stateNumber, stateInfo.options, stateInfo.showWhenSet);
                    });
                })(elementId, stateInfo);
            }
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    var _progessPanelState = function(id, info) {
        var direction = info.setStateType;
        var loop = info.loop;
        var repeat = info.repeat;
        var options = info.options;

        var hasRepeat = typeof (repeat) == 'number';
        var currentStateId = $ax.visibility.GetPanelState(id);
        var stateNumber = '';
        if(currentStateId != '') {
            currentStateId = $ax.repeater.getScriptIdFromElementId(currentStateId);
            var currentStateNumber = Number(currentStateId.substr(currentStateId.indexOf('state') + 5));
            if(direction == "next") {
                stateNumber = currentStateNumber + 2;
                if(stateNumber > $('#' + id).children().length) {
                    if(loop) stateNumber = 1;
                    else {
                        delete _repeatPanelMap[id];
                        return $ax.action.fireAnimationFromQueue(id);
                    }
                }
            } else if(direction == "previous") {
                stateNumber = currentStateNumber;
                if(stateNumber <= 0) {
                    if(loop) stateNumber = $('#' + id).children().length;
                    else {
                        delete _repeatPanelMap[id];
                        return $ax.action.fireAnimationFromQueue(id);
                    }
                }
            }

            $ax('#' + id).SetPanelState(stateNumber, options, info.showWhenSet);

            if(hasRepeat) {
                var animate = options && options.animateIn;
                if(animate && animate.easing && animate.easing != 'none' && animate.duration > repeat) repeat = animate.duration;
                animate = options && options.animateOut;
                if(animate && animate.easing && animate.easing != 'none' && animate.duration > repeat) repeat = animate.duration;

                window.setTimeout(function() {
                    // Either new repeat, or no repeat anymore.
                    if(_repeatPanelMap[id] != info) return;
                    _addAnimation(id, function() {
                        _progessPanelState(id, info);
                    });
                }, repeat);
            } else delete _repeatPanelMap[id];
        }
    };

    _actionHandlers.fadeWidget = function(eventInfo, actions, index) {
        var action = actions[index];

        for(var i = 0; i < action.objectsToFades.length; i++) {
            var fadeInfo = action.objectsToFades[i].fadeInfo;
            var elementIds = $ax.getElementIdsFromPath(action.objectsToFades[i].objectPath, eventInfo);

            for(var j = 0; j < elementIds.length; j++) {
                var elementId = elementIds[j];
                // Need new scope for elementId and info
                (function(elementId, fadeInfo) {
                    _addAnimation(elementId, function() {
                        if(fadeInfo.fadeType == "hide") {
                            $ax('#' + elementId).hide(fadeInfo.options);
                        } else if(fadeInfo.fadeType == "show") {
                            $ax('#' + elementId).show(fadeInfo.options, eventInfo);
                        } else if(fadeInfo.fadeType == "toggle") {
                            $ax('#' + elementId).toggleVisibility(fadeInfo.options);
                        }
                    });
                })(elementId, fadeInfo);
            }
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.moveWidget = function(eventInfo, actions, index) {
        var action = actions[index];
        for(var i = 0; i < action.objectsToMoves.length; i++) {
            var moveInfo = action.objectsToMoves[i].moveInfo;
            var elementIds = $ax.getElementIdsFromPath(action.objectsToMoves[i].objectPath, eventInfo);

            for(var j = 0; j < elementIds.length; j++) {
                var elementId = elementIds[j];
                // Need new scope for elementId and info
                (function(elementId, moveInfo) {
                    var oldTarget = eventInfo.targetElement;
                    eventInfo.targetElement = elementId;
                    var xValue = $ax.expr.evaluateExpr(moveInfo.xValue, eventInfo);
                    var yValue = $ax.expr.evaluateExpr(moveInfo.yValue, eventInfo);
                    eventInfo.targetElement = oldTarget;

                    var widgetDragInfo = eventInfo.dragInfo;
                    _addAnimation(elementId, function() {
                        if(moveInfo.moveType == "location") {
                            $ax('#' + elementId).moveTo(xValue, yValue, moveInfo.options);
                        } else if(moveInfo.moveType == "delta") {
                            $ax('#' + elementId).moveBy(xValue, yValue, moveInfo.options);
                        } else if(moveInfo.moveType == "drag") {
                            $ax('#' + elementId).moveBy(widgetDragInfo.xDelta, widgetDragInfo.yDelta, moveInfo.options);
                        } else if(moveInfo.moveType == "dragX") {
                            $ax('#' + elementId).moveBy(widgetDragInfo.xDelta, 0, moveInfo.options);
                        } else if(moveInfo.moveType == "dragY") {
                            $ax('#' + elementId).moveBy(0, widgetDragInfo.yDelta, moveInfo.options);
                        } else if(moveInfo.moveType == "locationBeforeDrag") {
                            var loc = widgetDragInfo.movedWidgets[elementId];
                            if(loc) $ax('#' + elementId).moveTo(loc.x, loc.y, moveInfo.options);
                            else _fireAnimationFromQueue(elementId);
                        } else if(moveInfo.moveType == "withThis") {
                            var widgetMoveInfo = $ax.move.GetWidgetMoveInfo();
                            var srcElementId = $ax.getElementIdsFromEventAndScriptId(eventInfo, eventInfo.srcElement)[0];
                            var delta = widgetMoveInfo[srcElementId];
                            $ax('#' + elementId).moveBy(delta.x, delta.y, delta.options);
                        }
                    });
                })(elementId, moveInfo);
            }
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.setWidgetSize = function(eventInfo, actions, index) {
        var action = actions[index];
        for(var i = 0; i < action.objectsToResize.length; i++) {
            var resizeInfo = action.objectsToResize[i].sizeInfo;
            var elementIds = $ax.getElementIdsFromPath(action.objectsToResize[i].objectPath, eventInfo);

            for(var j = 0; j < elementIds.length; j++) {
                var elementId = elementIds[j];

                // Need new scope for elementId and info
                (function(elementId, resizeInfo) {
                    var oldTarget = eventInfo.targetElement;
                    eventInfo.targetElement = elementId;
                    var width = $ax.expr.evaluateExpr(resizeInfo.width, eventInfo);
                    var height = $ax.expr.evaluateExpr(resizeInfo.height, eventInfo);
                    eventInfo.targetElement = oldTarget;
                    // TODO:[bf] Does this merit it's own file? Is there another file it should be refactored out to? Just refactored out to another function?
                    _addAnimation(elementId, function() {
                        var query = $jobj(elementId);

                        // Get the current width and height
                        var oldWidth = query.css('width');
                        oldWidth = Number(oldWidth && oldWidth.substring(0, oldWidth.length - 2));
                        var oldHeight = query.css('height');
                        oldHeight = Number(oldHeight && oldHeight.substring(0, oldHeight.length - 2));

                        // If either one is not a number, use the old value
                        width = width != "" ? Number(width) : oldWidth;
                        height = height != "" ? Number(height) : oldHeight;

                        width = isNaN(width) ? oldWidth : width;
                        height = isNaN(height) ? oldHeight : height;

                        // can't be negative
                        width = Math.max(width, 0);
                        height = Math.max(height, 0);
                        if(height == oldHeight && width == oldWidth) {
                            _fireAnimationFromQueue(elementId);
                            return;
                        }

                        var css = { width: width, height: height };
                        var obj = $obj(elementId);
                        if(obj.percentWidth) css = { height: height };

                        // No longer fitToContent, calculate additional styling that needs to be done.
                        $ax.dynamicPanelManager.setFitToContentCss(elementId, false, oldWidth, oldHeight);

                        var easing = resizeInfo.easing || 'none';
                        var duration = resizeInfo.duration || 0;

                        var stateCss = $ax.deepCopy(css);
                        // This will move panel if fixed. The callback will make sure resizing ends there.
                        if((obj.fixedHorizontal && obj.fixedHorizontal == 'center') || (obj.fixedVertical && obj.fixedVertical == 'middle')) {
                            var loc = $ax.dynamicPanelManager.getFixedPosition(elementId, oldWidth, oldHeight, width, height);
                            if(loc) {
                                if(loc[0] != 0 && !$ax.dynamicPanelManager.isPercentWidthPanel(obj)) css['margin-left'] = '+=' + loc[0];
                                if(loc[1] != 0) css['margin-top'] = '+=' + loc[1];
                            }
                        }

                        var onComplete = function() {
                            $ax.flyoutManager.updateFlyout(elementId);
                            $ax.dynamicPanelManager.fitParentPanel(elementId);
                            $ax.dynamicPanelManager.updatePanelPercentWidth(elementId);
                            $ax.dynamicPanelManager.updatePanelContentPercentWidth(elementId);
                            $ax.event.raiseSyntheticEvent(elementId, 'onResize');
                            _fireAnimationFromQueue(elementId);
                        };

                        // This does the resize animation. Moving is handled elsewhere.
                        if(easing == 'none') {
                            query.animate(css, 0);
                            query.children().animate(stateCss, 0);
                            onComplete();
                        } else {
                            query.children().animate(stateCss, duration, easing);
                            query.animate(css, duration, easing, onComplete);
                        }
                    });
                })(elementId, resizeInfo);
            }
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.setPanelOrder = function(eventInfo, actions, index) {
        var action = actions[index];
        for(var i = 0; i < action.panelPaths.length; i++) {
            var func = action.panelPaths[i].setOrderInfo.bringToFront ? 'bringToFront' : 'sendToBack';
            var elementIds = $ax.getElementIdsFromPath(action.panelPaths[i].panelPath, eventInfo);
            for(var j = 0; j < elementIds.length; j++) $ax('#' + elementIds[j])[func]();
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.modifyDataSetEditItems = function(eventInfo, actions, index) {
        var action = actions[index];
        var add = action.repeatersToAddTo;
        var repeaters = add || action.repeatersToRemoveFrom;
        var itemId;
        for(var i = 0; i < repeaters.length; i++) {
            var data = repeaters[i];
            // Grab the first one because repeaters must have only element id, as they cannot be inside repeaters
            var id = $ax.getElementIdsFromPath(data.path, eventInfo)[0];

            if(data.addType == 'this') {
                var scriptId = $ax.repeater.getScriptIdFromElementId(eventInfo.srcElement);
                itemId = $ax.repeater.getItemIdFromElementId(eventInfo.srcElement);
                var repeaterId = $ax.getParentRepeaterFromScriptId(scriptId);
                if(add) $ax.repeater.addEditItems(repeaterId, [itemId]);
                else $ax.repeater.removeEditItems(repeaterId, [itemId]);
            } else if(data.addType == 'all') {
                var allItems = $ax.repeater.getAllItemIds(id);
                if(add) $ax.repeater.addEditItems(id, allItems);
                else $ax.repeater.removeEditItems(id, allItems);
            } else {
                var oldTarget = eventInfo.targetElement;
                var itemIds = $ax.repeater.getAllItemIds(id);
                var itemIdsToAdd = [];
                for(var j = 0; j < itemIds.length; j++) {
                    itemId = itemIds[j];
                    eventInfo.targetElement = $ax.repeater.createElementId(id, itemId);
                    if($ax.expr.evaluateExpr(data.query, eventInfo) == "true") {
                        itemIdsToAdd[itemIdsToAdd.length] = String(itemId);
                    }
                    eventInfo.targetElement = oldTarget;
                }
                if(add) $ax.repeater.addEditItems(id, itemIdsToAdd);
                else $ax.repeater.removeEditItems(id, itemIdsToAdd);
            }
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _action.repeaterInfoNames = { addItemsToDataSet: 'dataSetsToAddTo', deleteItemsFromDataSet: 'dataSetItemsToRemove', updateItemsInDataSet: 'dataSetsToUpdate',
        addFilterToRepeater: 'repeatersToAddFilter', removeFilterFromRepeater: 'repeatersToRemoveFilter',
        addSortToRepeater: 'repeaterToAddSort', removeSortFromRepeater: 'repeaterToRemoveSort',
        setRepeaterToPage: 'repeatersToSetPage', setItemsPerRepeaterPage: 'repeatersToSetItemCount'
    };

    _actionHandlers.addItemsToDataSet = function(eventInfo, actions, index) {
        var action = actions[index];
        for(var i = 0; i < action.dataSetsToAddTo.length; i++) {
            var datasetInfo = action.dataSetsToAddTo[i];
            // Grab the first one because repeaters must have only element id, as they cannot be inside repeaters
            var id = $ax.getElementIdsFromPath(datasetInfo.path, eventInfo)[0];
            if(_ignoreAction(id)) continue;
            var dataset = datasetInfo.data;

            for(var j = 0; j < dataset.length; j++) $ax.repeater.addItem(id, $ax.deepCopy(dataset[j]), eventInfo);
            if(dataset.length) _addRefresh(id);
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.deleteItemsFromDataSet = function(eventInfo, actions, index) {
        var action = actions[index];
        for(var i = 0; i < action.dataSetItemsToRemove.length; i++) {
            // Grab the first one because repeaters must have only element id, as they cannot be inside repeaters
            var deleteInfo = action.dataSetItemsToRemove[i];
            var id = $ax.getElementIdsFromPath(deleteInfo.path, eventInfo)[0];
            if(_ignoreAction(id)) continue;
            $ax.repeater.deleteItems(id, eventInfo, deleteInfo.type, deleteInfo.rule);
            _addRefresh(id);
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.updateItemsInDataSet = function(eventInfo, actions, index) {
        var action = actions[index];
        for(var i = 0; i < action.dataSetsToUpdate.length; i++) {
            var dataSet = action.dataSetsToUpdate[i];
            // Grab the first one because repeaters must have only element id, as they cannot be inside repeaters
            var id = $ax.getElementIdsFromPath(dataSet.path, eventInfo)[0];
            if(_ignoreAction(id)) continue;

            $ax.repeater.updateEditItems(id, dataSet.props, eventInfo, dataSet.type, dataSet.rule);
            _addRefresh(id);
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.setRepeaterToDataSet = function(eventInfo, actions, index) {
        var action = actions[index];

        for(var i = 0; i < action.repeatersToSet.length; i++) {
            var setRepeaterInfo = action.repeatersToSet[i];
            // Grab the first one because repeaters must have only element id, as they cannot be inside repeaters
            var id = $ax.getElementIdsFromPath(setRepeaterInfo.path, eventInfo)[0];
            $ax.repeater.setDataSet(id, setRepeaterInfo.localDataSetId);
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.addFilterToRepeater = function(eventInfo, actions, index) {
        var action = actions[index];

        for(var i = 0; i < action.repeatersToAddFilter.length; i++) {
            var addFilterInfo = action.repeatersToAddFilter[i];
            // Grab the first one because repeaters must have only element id, as they cannot be inside repeaters
            var id = $ax.getElementIdsFromPath(addFilterInfo.path, eventInfo)[0];
            if(_ignoreAction(id)) continue;

            $ax.repeater.addFilter(id, addFilterInfo.label, addFilterInfo.filter, eventInfo.srcElement);
            _addRefresh(id);
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.removeFilterFromRepeater = function(eventInfo, actions, index) {
        var action = actions[index];

        for(var i = 0; i < action.repeatersToRemoveFilter.length; i++) {
            var removeFilterInfo = action.repeatersToRemoveFilter[i];
            // Grab the first one because repeaters must have only element id, as they cannot be inside repeaters
            var id = $ax.getElementIdsFromPath(removeFilterInfo.path, eventInfo)[0];
            if(_ignoreAction(id)) continue;

            if(removeFilterInfo.removeAll) $ax.repeater.removeFilter(id);
            else if(removeFilterInfo.filterName != '') {
                $ax.repeater.removeFilter(id, removeFilterInfo.filterName);
            }
            _addRefresh(id);
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.addSortToRepeater = function(eventInfo, actions, index) {
        var action = actions[index];

        for(var i = 0; i < action.repeatersToAddSort.length; i++) {
            var addSortInfo = action.repeatersToAddSort[i];
            // Grab the first one because repeaters must have only element id, as they cannot be inside repeaters
            var id = $ax.getElementIdsFromPath(addSortInfo.path, eventInfo)[0];
            if(_ignoreAction(id)) continue;

            $ax.repeater.addSort(id, addSortInfo.label, addSortInfo.columnName, addSortInfo.ascending, addSortInfo.toggle, addSortInfo.sortType);
            _addRefresh(id);
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.removeSortFromRepeater = function(eventInfo, actions, index) {
        var action = actions[index];

        for(var i = 0; i < action.repeatersToRemoveSort.length; i++) {
            var removeSortInfo = action.repeatersToRemoveSort[i];
            // Grab the first one because repeaters must have only element id, as they cannot be inside repeaters
            var id = $ax.getElementIdsFromPath(removeSortInfo.path, eventInfo)[0];
            if(_ignoreAction(id)) continue;

            if(removeSortInfo.removeAll) $ax.repeater.removeSort(id);
            else if(removeSortInfo.sortName != '') $ax.repeater.removeSort(id, removeSortInfo.sortName);
            _addRefresh(id);
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.setRepeaterToPage = function(eventInfo, actions, index) {
        var action = actions[index];

        for(var i = 0; i < action.repeatersToSetPage.length; i++) {
            var setPageInfo = action.repeatersToSetPage[i];
            // Grab the first one because repeaters must have only element id, as they cannot be inside repeaters
            var id = $ax.getElementIdsFromPath(setPageInfo.path, eventInfo)[0];
            if(_ignoreAction(id)) continue;

            var oldTarget = eventInfo.targetElement;
            eventInfo.targetElement = id;
            $ax.repeater.setRepeaterToPage(id, setPageInfo.pageType, setPageInfo.pageValue, eventInfo);
            eventInfo.targetElement = oldTarget;
            _addRefresh(id);
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.setItemsPerRepeaterPage = function(eventInfo, actions, index) {
        var action = actions[index];

        for(var i = 0; i < action.repeatersToSetItemCount.length; i++) {
            var setItemCountInfo = action.repeatersToSetItemCount[i];
            // Grab the first one because repeaters must have only element id, as they cannot be inside repeaters
            var id = $ax.getElementIdsFromPath(setItemCountInfo.path, eventInfo)[0];
            if(_ignoreAction(id)) continue;

            if(setItemCountInfo.noLimit) $ax.repeater.setNoItemLimit(id);
            else $ax.repeater.setItemLimit(id, setItemCountInfo.itemCountValue, eventInfo);
            _addRefresh(id);
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.refreshRepeater = function(eventInfo, actions, index) {
        // We use this as a psudo action now.
        var action = actions[index];
        for(var i = 0; i < action.repeatersToRefresh.length; i++) {
            _tryRefreshRepeater($ax.getElementIdsFromPath(action.repeatersToRefresh[i], eventInfo)[i], eventInfo);
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    var _tryRefreshRepeater = function(id, eventInfo) {
        var idIndex = _repeatersToRefresh.indexOf(id);
        if(idIndex == -1) return;

        $ax.splice(_repeatersToRefresh, idIndex, 1);
        $ax.repeater.refreshRepeater(id, eventInfo);
    };

    _action.tryRefreshRepeaters = function(ids, eventInfo) {
        for(var i = 0; i < ids.length; i++) _tryRefreshRepeater(ids[i], eventInfo);
    };

    _actionHandlers.scrollToWidget = function(eventInfo, actions, index) {
        var action = actions[index];
        var elementIds = $ax.getElementIdsFromPath(action.objectPath, eventInfo);
        if(elementIds.length > 0) $ax('#' + elementIds[0]).scroll(action.options);

        _dispatchAction(eventInfo, actions, index + 1);
    };


    _actionHandlers.enableDisableWidgets = function(eventInfo, actions, index) {
        var action = actions[index];
        for(var i = 0; i < action.pathToInfo.length; i++) {
            var elementIds = $ax.getElementIdsFromPath(action.pathToInfo[i].objectPath, eventInfo);
            var enable = action.pathToInfo[i].enableDisableInfo.enable;
            for(var j = 0; j < elementIds.length; j++) $ax('#' + elementIds[j]).enabled(enable);
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.setImage = function(eventInfo, actions, index) {
        var oldTarget = eventInfo.targetElement;
        var action = actions[index];
        var view = $ax.adaptive.currentViewId;

        eventInfo.image = true;
        for(var i = 0; i < action.imagesToSet.length; i++) {
            var imgInfo = action.imagesToSet[i];
            imgInfo = view ? imgInfo.adaptive[view] : imgInfo.base;
            var elementIds = $ax.getElementIdsFromPath(action.imagesToSet[i].objectPath, eventInfo);

            for(var j = 0; j < elementIds.length; j++) {
                var elementId = elementIds[j];

                eventInfo.targetElement = elementId;
                var evaluatedImgs = _evaluateImages(imgInfo, eventInfo);

                var img = evaluatedImgs.normal;
                if($ax.style.IsWidgetDisabled(elementId)) {
                    if(imgInfo.disabled) img = evaluatedImgs.disabled;
                } else if($ax.style.IsWidgetSelected(elementId)) {
                    if(imgInfo.selected) img = evaluatedImgs.selected;
                } else if($ax.event.mouseDownObjectId == elementId && imgInfo.mouseDown) img = evaluatedImgs.mouseDown;
                else if($ax.event.mouseOverIds.indexOf(elementId) != -1 && imgInfo.mouseOver) {
                    img = evaluatedImgs.mouseOver;
                    //Update mouseOverObjectId
                    var currIndex = $ax.event.mouseOverIds.indexOf($ax.event.mouseOverObjectId);
                    var imgIndex = $ax.event.mouseOverIds.indexOf(elementId);
                    if(currIndex < imgIndex) $ax.event.mouseOverObjectId = elementId;
                }

                //            $('#' + $ax.repeater.applySuffixToElementId(elementId, '_img')).attr('src', img);
                $jobj($ax.style.GetImageIdFromShape(elementId)).attr('src', img);

                //Set up overrides
                $ax.style.mapElementIdToImageOverrides(elementId, evaluatedImgs);
                $ax.style.updateElementIdImageStyle(elementId);
            }
        }
        eventInfo.targetElement = oldTarget;
        eventInfo.image = false;

        _dispatchAction(eventInfo, actions, index + 1);
    };

    var _evaluateImages = function(imgInfo, eventInfo) {
        var retVal = {};
        for(var state in imgInfo) {
            if(!imgInfo.hasOwnProperty(state)) continue;
            var img = imgInfo[state].path || $ax.expr.evaluateExpr(imgInfo[state].literal, eventInfo);
            if(!img) img = $axure.utils.getTransparentGifPath();
            retVal[state] = img;
        }
        return retVal;
    };

    $ax.clearRepeaterImageOverrides = function(repeaterId) {
        var childIds = $ax.getChildElementIdsForRepeater(repeaterId);
        for(var i = childIds; i < childIds.length; i++) $ax.style.deleteElementIdToImageOverride(childIds[i]);
    };

    _actionHandlers.setFocusOnWidget = function(eventInfo, actions, index) {
        var action = actions[index];
        if(action.objectPaths.length > 0) {
            var elementIds = $ax.getElementIdsFromPath(action.objectPaths[0], eventInfo);
            if(elementIds.length > 0) {
                $ax('#' + elementIds[0]).focus();
            }
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.expandCollapseTree = function(eventInfo, actions, index) {
        var action = actions[index];
        for(var i = 0; i < action.pathToInfo.length; i++) {
            var pair = action.pathToInfo[i];
            var elementIds = $ax.getElementIdsFromPath(pair.treeNodePath, eventInfo);
            for(var j = 0; j < elementIds.length; j++) $ax('#' + elementIds[j]).expanded(pair.expandCollapseInfo.expand);
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.other = function(eventInfo, actions, index) {
        var action = actions[index];
        $ax.navigate({
            url: $axure.utils.getOtherPath() + "#other=" + encodeURI(action.otherDescription),
            target: "popup",
            includeVariables: false,
            popupOptions: action.popup
        });

        _dispatchAction(eventInfo, actions, index + 1);
    };

    _actionHandlers.raiseEvent = function(eventInfo, actions, index) {
        var action = actions[index];
        //look for the nearest element id

        if(eventInfo.srcElement) {
            var objId = eventInfo.srcElement;
            var obj = $ax.getObjectFromElementId(objId);
            var rdoId = $ax.getRdoParentFromElementId(objId);
            var rdo = $ax.getObjectFromElementId(rdoId);

            // Check if rdo should be this
            var oldIsMasterEvent = eventInfo.isMasterEvent;
            if(obj.type == 'referenceDiagramObject' && eventInfo.isMasterEvent) {
                rdoId = objId;
                rdo = obj;
                // It is now an rdo event
                eventInfo.isMasterEvent = false;
            }

            for(var i = 0; i < action.raisedEvents.length; i++) {
                var raisedEvent = action.raisedEvents[i];
                var oldRaisedId = eventInfo.raisedId;
                var event = rdo.interactionMap && rdo.interactionMap && rdo.interactionMap.raised[raisedEvent];

                // raised event will optimize away if it doesn't do anything. Whole interaction map may be optimized away as well.
                if(event) {
                    var oldSrc = eventInfo.srcElement;
                    eventInfo.srcElement = rdoId;
                    eventInfo.raisedId = rdoId;
                    $ax.event.handleEvent(rdoId, eventInfo, event, false, true);
                    eventInfo.raisedId = oldRaisedId;
                    eventInfo.srcElement = oldSrc;
                }
            }
            eventInfo.isMasterEvent = oldIsMasterEvent;
        }

        _dispatchAction(eventInfo, actions, index + 1);
    };
});
