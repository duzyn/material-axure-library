$axure.internal(function($ax) {
    var document = window.document;
    var _visibility = {};
    $ax.visibility = _visibility;

    var _defaultHidden = {};
    var _defaultLimbo = {};

    // ******************  Visibility and State Functions ****************** //

    var _isIdVisible = $ax.visibility.IsIdVisible = function(id) {
        return $ax.visibility.IsVisible(window.document.getElementById(id));
    };

    $ax.visibility.IsVisible = function(element) {
        //cannot use css('visibility') because that gets the effective visiblity
        //e.g. won't be able to set visibility on panels inside hidden panels
        return element.style.visibility != 'hidden';
    };

    $ax.visibility.SetIdVisible = function(id, visible) {
        $ax.visibility.SetVisible(window.document.getElementById(id), visible);
        // Hide lightbox if necessary
        if(!visible) {
            $jobj($ax.repeater.applySuffixToElementId(id, '_lightbox')).remove();
            $ax.flyoutManager.unregisterPanel(id, true);
        }
    };

    $ax.visibility.SetVisible = function(element, visible) {
        //todo -- ahhhh! I really don't want to add this, I don't know why it is necessary (right now sliding panel state out then in then out breaks
        //and doesn't go hidden on the second out if we do not set display here.
        element.style.display = visible ? '' : 'none';
        element.style.visibility = visible ? 'visible' : 'hidden';
    };

    var _setWidgetVisibility = $ax.visibility.SetWidgetVisibility = function(elementId, options) {
        // If limboed, just fire the next action then leave.
        if(_limboIds[elementId]) {
            $ax.action.fireAnimationFromQueue(elementId);
            return;
        }

        var parentId = $jobj(elementId).parent().attr('id');
        _setVisibility(parentId, elementId, options);

        //set the visibility of the annotation box as well if it exists
        var ann = document.getElementById(elementId + "_ann");
        if(ann) _visibility.SetVisible(ann, options.value);

        //set ref visibility for ref of flow shape, if that exists
        var ref = document.getElementById(elementId + '_ref');
        if(ref) _visibility.SetVisible(ref, options.value);
    };

    var _setVisibility = function(parentId, childId, options) {
        var widget = $jobj(childId);

        var visible = $ax.visibility.IsIdVisible(childId);

        if(visible == options.value) {
            $ax.action.fireAnimationFromQueue(childId);
            return;
        }

        var child = $jobj(childId);
        var parent = parentId ? $jobj(parentId) : child.parent();

        var needContainer = options.easing && options.easing != 'none';
        var cullPosition = options.cull ? options.cull.css('position') : '';

        if(needContainer) {
            var fixedInfo = $ax.dynamicPanelManager.getFixedInfo(childId);
            var containerId = childId + '_container';
            var container = _makeContainer(containerId, options.cull || child, fixedInfo);
            container.insertBefore(child);
            child.appendTo(container);

            if(!options.settingChild) {
                child.css({
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    'margin-left': 0,
                    'margin-top': 0
                });
            }
        }

        var onComplete = function() {
            if(needContainer) {
                var css = {};
                if(fixedInfo.fixed) {
                    css.position = 'fixed';

                    if(fixedInfo.horizontal == 'left') css.left = fixedInfo.x;
                    else if(fixedInfo.horizontal == 'center') {
                        css.left = '50%';
                        css['margin-left'] = fixedInfo.x;
                    } else if(fixedInfo.horizontal == 'right') {
                        css.left = 'auto';
                        css.right = fixedInfo.x;
                    }

                    if(fixedInfo.vertical == 'top') css.top = fixedInfo.y;
                    else if(fixedInfo.vertical == 'middle') {
                        css.top = '50%';
                        css['margin-top'] = fixedInfo.y;
                    } else if(fixedInfo.vertical == 'bottom') {
                        css.top = 'auto';
                        css.bottom = fixedInfo.y;
                    }
                } else {
                    css.top = Number(container.css('top').replace('px', '')) || 0;
                    css.left = Number(container.css('left').replace('px', '')) || 0;
                }

                child.insertBefore(container);
                container.remove();
                child.css(css);

                if(options.cull) options.cull.css('position', cullPosition);
            }
            options.onComplete && options.onComplete();
            if(options.fire) {
                $ax.event.raiseSyntheticEvent(childId, options.value ? 'onShow' : 'onHide');
                $ax.action.fireAnimationFromQueue(childId);
            }
        };

        var size = options.size || (needContainer ? child : parent);
        if(!options.easing || options.easing == 'none') {
            $ax.visibility.SetIdVisible(childId, options.value);
            onComplete();
        } else if(options.easing == 'fade') {
            if(options.value) {
                // Can't use $ax.visibility.SetIdVisible, because we only want to set visible, we don't want to display, fadeIn will handle that.
                widget.css('visibility', 'visible');
                widget.fadeIn(options.duration, onComplete);
            } else {
                // Fading here is being retarded...
                widget.animate({ opacity: 0 }, options.duration, 'swing', function() {
                    $ax.visibility.SetIdVisible(childId, false);
                    widget.css('opacity', '');

                    onComplete();
                });
            }
        } else {
            if(options.value) {
                _slideStateIn(childId, childId, options.easing, options.direction, options.duration, size, false, onComplete);
            } else {
                var top = child.css('top');
                var left = child.css('left');

                var onOutComplete = function() {
                    $ax.visibility.SetIdVisible(childId, false);
                    child.css('top', top);
                    child.css('left', left);

                    onComplete();
                };
                _slideStateOut(size, childId, options.easing, options.direction, options.duration, onOutComplete);
            }
        }



        // If showing, go through all rich text objects inside you, and try to redo alignment of them
        if(options.value) {
            var descendants = $jobj(childId).find('*');
            for(var i = 0; i < descendants.length; i++) {
                var decendantId = descendants[i].id;
                // This check is probably redundant? UpdateTextAlignment should ignore any text objects that haven't set the vAlign yet.
                if($ax.getTypeFromElementId(decendantId) != 'richTextPanel') continue;
                $ax.style.updateTextAlignmentForVisibility(decendantId);
            }
        }
    };

    $ax.visibility.GetPanelState = function(id) {
        var children = $jobj(id).children();
        for(var i = 0; i < children.length; i++) {
            if(children[i].style && $ax.visibility.IsVisible(children[i])) return children[i].id;
        }
        return '';
    };


    $ax.visibility.SetPanelState = function(id, stateId, easingOut, directionOut, durationOut, easingIn, directionIn, durationIn, showWhenSet) {
        var show = !$ax.visibility.IsIdVisible(id) && showWhenSet;
        if(show) $ax.visibility.SetIdVisible(id, true);

        // Exit here if already at desired state.
        if($ax.visibility.IsIdVisible(stateId)) {
            if(show) $ax.event.raiseSyntheticEvent(id, 'onShow');
            $ax.action.fireAnimationFromQueue(id);
            return;
        }

        var state = $jobj(stateId);
        var oldStateId = $ax.visibility.GetPanelState(id);
        var oldState = $jobj(oldStateId);
        $ax.dynamicPanelManager.adjustFixed(id, oldState.width(), oldState.height(), state.width(), state.height());

        _bringPanelStateToFront(id, oldStateId);

        var fitToContent = $ax.dynamicPanelManager.isIdFitToContent(id);
        var resized = false;
        if(fitToContent) {
            // Set resized
            resized = state.width() != oldState.width() || state.height() != oldState.height();
        }

        var movement = (directionOut == 'left' || directionOut == 'up' || state.children().length == 0) && oldState.children().length != 0 ? oldState : state;
        var onCompleteCount = 0;

        var onComplete = function() {
            $ax.dynamicPanelManager.fitParentPanel(id);
            $ax.dynamicPanelManager.updatePanelPercentWidth(id);
            $ax.dynamicPanelManager.updatePanelContentPercentWidth(id);
            $ax.action.fireAnimationFromQueue(id);
            $ax.event.raiseSyntheticEvent(id, "onPanelStateChange");
            $ax.event.leavingState(oldStateId);
        };
        // Must do state out first, so if we cull by new state, location is correct
        _setVisibility(id, oldStateId, {
            value: false,
            easing: easingOut,
            direction: directionOut,
            duration: durationOut,
            onComplete: function() { _bringPanelStateToFront(id, stateId); if(++onCompleteCount == 2) onComplete(); },
            settingChild: true,
            size: movement,
            cull: easingOut == 'none' || state.children().length == 0 ? oldState : state
        });

        _setVisibility(id, stateId, {
            value: true,
            easing: easingIn,
            direction: directionIn,
            duration: durationIn,
            onComplete: function() { if(++onCompleteCount == 2) onComplete(); },
            settingChild: true,
            size: movement
        });

        if(show) $ax.event.raiseSyntheticEvent(id, 'onShow');
        if(resized) $ax.event.raiseSyntheticEvent(id, 'onResize');
    };

    var _makeContainer = function(containerId, rect, fixedInfo) {
        var container = $('<div></div>');
        container.attr('id', containerId);
        var css = {
            position: 'absolute',
            width: rect.width(),
            height: rect.height(),
            overflow: 'hidden'
        };

        // todo: **mas** make sure tihs is ok
        if(fixedInfo.fixed) {
            css.position = 'fixed';

            if(fixedInfo.horizontal == 'left') css.left = fixedInfo.x;
            else if(fixedInfo.horizontal == 'center') {
                css.left = '50%';
                css['margin-left'] = fixedInfo.x;
            } else if(fixedInfo.horizontal = 'right') {
                css.left = 'auto';
                css.right = fixedInfo.x;
            }

            if(fixedInfo.vertical == 'top') css.top = fixedInfo.y;
            else if(fixedInfo.vertical == 'middle') {
                css.top = '50%';
                css['margin-top'] = fixedInfo.y;
            } else if(fixedInfo.vertical == 'bottom') {
                css.top = 'auto';
                css.bottom = fixedInfo.y;
            }
        } else {
            css.left = Number(rect.css('left').replace('px', '')) || 0;
            css.top = Number(rect.css('top').replace('px', '')) || 0;
        }

        container.css(css);
        return container;
    };

    var _slideStateOut = function(container, stateId, easingOut, directionOut, durationOut, onComplete) {
        var width = container.width();
        var height = container.height();

        if(directionOut == "right") {
            $ax.move.MoveWidget(stateId, width, 0, easingOut, durationOut, false, onComplete);
        } else if(directionOut == "left") {
            $ax.move.MoveWidget(stateId, -width, 0, easingOut, durationOut, false, onComplete);
        } else if(directionOut == "up") {
            $ax.move.MoveWidget(stateId, 0, -height, easingOut, durationOut, false, onComplete);
        } else if(directionOut == "down") {
            $ax.move.MoveWidget(stateId, 0, height, easingOut, durationOut, false, onComplete);
        }
    };

    var _slideStateIn = function(id, stateId, easingIn, directionIn, durationIn, container, makePanelVisible, onComplete) {
        var width = container.width();
        var height = container.height();

        var state = $jobj(stateId);

        var oldTop = 0;
        var oldLeft = 0;

        if(directionIn == "right") {
            state.css('left', oldLeft - width + 'px');
        } else if(directionIn == "left") {
            state.css('left', oldLeft + width + 'px');
        } else if(directionIn == "up") {
            state.css('top', oldTop + height + 'px');
        } else if(directionIn == "down") {
            state.css('top', oldTop - height + 'px');
        }

        if(makePanelVisible) $ax.visibility.SetIdVisible(id, true);
        $ax.visibility.SetIdVisible(stateId, true);

        if(directionIn == "right") {
            $ax.move.MoveWidget(stateId, width, 0, easingIn, durationIn, false, onComplete);
        } else if(directionIn == "left") {
            $ax.move.MoveWidget(stateId, -width, 0, easingIn, durationIn, false, onComplete);
        } else if(directionIn == "up") {
            $ax.move.MoveWidget(stateId, 0, -height, easingIn, durationIn, false, onComplete);
        } else if(directionIn == "down") {
            $ax.move.MoveWidget(stateId, 0, height, easingIn, durationIn, false, onComplete);
        }
    };

    $ax.visibility.GetPanelStateId = function(dpId, index) {
        var itemNum = $ax.repeater.getItemIdFromElementId(dpId);
        var panelStateId = $ax.repeater.getScriptIdFromElementId(dpId) + '_state' + index;
        return $ax.repeater.createElementId(panelStateId, itemNum);
    };

    var _bringPanelStateToFront = function(dpId, stateid) {
        $('#' + stateid).appendTo($('#' + dpId));
    };

    var _limboIds = _visibility.limboIds = {};
    // limboId's is a dictionary of id->true, essentially a set.
    var _addLimboAndHiddenIds = $ax.visibility.addLimboAndHiddenIds = function(newLimboIds, newHiddenIds, query) {
        var limboedByMaster = {};
        for(var key in newLimboIds) {
            if($ax.getObjectFromElementId(key).type != 'referenceDiagramObject') continue;
            var ids = $ax.model.idsInRdo(key);
            for(var i = 0; i < ids.length; i++) limboedByMaster[ids[i]] = true;
        }

        var hiddenByMaster = {};
        for(key in newHiddenIds) {
            if($ax.getObjectFromElementId(key).type != 'referenceDiagramObject') continue;
            ids = $ax.model.idsInRdo(key);
            for(i = 0; i < ids.length; i++) hiddenByMaster[ids[i]] = true;
        }

        // Extend with children of rdos
        newLimboIds = $.extend(newLimboIds, limboedByMaster);
        newHiddenIds = $.extend(newHiddenIds, hiddenByMaster);

        // something is only visible if it's not hidden and limboed

        //if(!skipSetting) {
        query.each(function(diagramObject, elementId) {
            // Rdos already handled, contained widgets are limboed by the parent, and sub menus should be ignored
            if(diagramObject.type == 'referenceDiagramObject' || diagramObject.type == 'tableCell' || diagramObject.isContained || $jobj(elementId).hasClass('sub_menu')) return;
            if(diagramObject.type == 'table' && $jobj(elementId).parent().hasClass('ax_menu')) return;
            var shouldBeVisible = Boolean(!newLimboIds[elementId] && !newHiddenIds[elementId]);
            var isVisible = Boolean(_isIdVisible(elementId));
            if(shouldBeVisible != isVisible) {
                _setWidgetVisibility(elementId, { value: shouldBeVisible });
            }
        });
        //}

        _limboIds = _visibility.limboIds = $.extend(_limboIds, newLimboIds);

    };

    var _clearLimboAndHidden = $ax.visibility.clearLimboAndHidden = function(ids) {
        _limboIds = _visibility.limboIds = {};
    };

    $ax.visibility.clearLimboAndHiddenIds = function(ids) {
        for(var i = 0; i < ids.length; i++) delete _limboIds[ids[i]];
    };

    $ax.visibility.resetLimboAndHiddenToDefaults = function() {
        _clearLimboAndHidden();
        _addLimboAndHiddenIds(_defaultLimbo, _defaultHidden, $ax('*'));
    };

    $ax.visibility.initialize = function() {
        // initialize initial visible states
        $axure('*').each(function(diagramObject, elementId) {
            // sigh, javascript. we need the === here because undefined means not overriden
            if(diagramObject.style.visible === false) _defaultHidden[elementId] = true;
            //todo: **mas** check if the limboed widgets are hidden by default by the generator
            if(diagramObject.style.limbo) _defaultLimbo[elementId] = true;
        });
        $ax.visibility.addLimboAndHiddenIds(_defaultLimbo, _defaultHidden, $ax('*'));

    };

});