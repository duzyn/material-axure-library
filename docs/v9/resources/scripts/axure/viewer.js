// ******* SITEMAP TOOLBAR VIEWER ACTIONS ******** //
$axure.internal(function ($ax) {
    var userTriggeredEventNames = ['onClick', 'onDoubleClick', 'onMouseOver', 'onMouseMove', 'onMouseOut', 'onMouseDown', 'onMouseUp',
        'onKeyDown', 'onKeyUp', 'onFocus', 'onLostFocus', 'onTextChange', 'onSelectionChange', 'onSelectedChange', 'onSelect', 'onUnselect',
        'onSwipeLeft', 'onSwipeRight', 'onSwipeUp', 'onSwipeDown', 'onDragStart', 'onDrag', 'onDragDrop', 'onScroll', 'onContextMenu', 'onMouseHover', 'onLongClick'];
    
    //var _toggleSelectWidgetNoteForRepeater = function (repeaterId, scriptId, select) {
    //    var itemIds = $ax.getItemIdsForRepeater(repeaterId);

    //    for(var i = 0; i < itemIds.length; i++) {
    //        var itemId = itemIds[i];
    //        var elementId = $ax.repeater.createElementId(scriptId, itemId);
    //        if(select) $('#' + elementId).addClass('widgetNoteSelected');
    //        else $('#' + elementId).removeClass('widgetNoteSelected');
    //    }
    //}

    //var lastSelectedWidgetNote;
    $ax.messageCenter.addMessageListener(function (message, data) {
        //If annotation toggle message received from sitemap, toggle footnotes
        if(message == 'toggleSelectWidgetNote') {

            $('.widgetNoteSelected').removeClass('widgetNoteSelected');

            if(!data.value) return;

            //if(lastSelectedWidgetNote == data.id) {
            //    lastSelectedWidgetNote = null;
            //    return;
            //}

            $ax('*').each(function(obj, elementId) {
                if (obj.id == data.id) {
                    $('#' + elementId).addClass('widgetNoteSelected');

                    _scrollToSelectedNote($('#' + elementId), data.view);
                }
            });

            //lastSelectedWidgetNote = data.id;

            //var dataSplit = data.split('@');

            //if(lastSelectedWidgetNote == data) {
            //    if(dataSplit.length === 2) {
            //        _toggleSelectWidgetNoteForRepeater(dataSplit[0], dataSplit[1], false);
            //    } else {
            //        if (lastSelectedWidgetNote.length > 0) $('#' + lastSelectedWidgetNote).removeClass('widgetNoteSelected');
            //    }
            //    lastSelectedWidgetNote = null;
            //    return;
            //}

            //if(lastSelectedWidgetNote) {
            //    var lastDataSplit = lastSelectedWidgetNote.split('@');
            //    if(lastDataSplit.length === 2) {
            //        _toggleSelectWidgetNoteForRepeater(lastDataSplit[0], lastDataSplit[1], false);
            //    } else {
            //       $('#' + lastSelectedWidgetNote).removeClass('widgetNoteSelected');
            //    }
            //}

            //if(dataSplit.length > 1) {
            //    _toggleSelectWidgetNoteForRepeater(dataSplit[0], dataSplit[1], true);
            //} else {
            //    if(data.length > 0) $('#' + data).addClass('widgetNoteSelected');
            //}

            //lastSelectedWidgetNote = data;
        }
    });

    var _scrollToSelectedNote = function ($elmt, view) {
        var isLandscape = IOS ? window.orientation != 0 && window.orientation != 180 : false;
        var winWidth = !IOS ? $(window).width() : (isLandscape ? window.screen.height : window.screen.width) - view.panelWidthOffset;
        var winHeight = !IOS ? $(window).height() : view.height;
        var docLeft = !IOS ? $(document).scrollLeft() : view.scrollLeft;
        var docTop = !IOS ? $(document).scrollTop() : view.scrollTop;
        var docRight = docLeft + winWidth;
        var docBottom = docTop + winHeight;

        var scale = $('#base').css('transform');;
        scale = (scale == "none") ? 1 : Number(scale.substring(scale.indexOf('(') + 1, scale.indexOf(',')));

        var bodyLeft = $('body').css('left') !== undefined ? Number($('body').css('left').replace('px','')) : 0;
        var top = scale * Number($elmt.css('top').replace('px', ''));
        var bottom = top + scale * $elmt.height();
        var left = scale * Number($elmt.css('left').replace('px', '')) + bodyLeft;
        var right = left + scale * $elmt.width();

        var doHorizontalMove = left < docLeft || right > docRight;
        var doVerticalMove = top < docTop || bottom > docBottom;
        var padding = scale * 50;

        var newScrollLeft = 0
        if (left < docLeft) {
            newScrollLeft = left - padding;
        } else if (right > docRight) {
            newScrollLeft = right + padding - winWidth;
        }

        var newScrollTop = 0
        if (top < docTop) {
            newScrollTop = top - padding;
        } else if (bottom > docBottom) {
            newScrollTop = bottom + padding - winHeight;
        }

        // Device Frame or Scale to width or Scale to fit (situations where there is no horizontal scroll)
        if (view.h || view.scaleVal == 1 || view.scaleVal == 2) {
            doHorizontalMove = false;
        }

        // Has Device Frame or Scale to Width and widget with note is outside of viewable panel right bounds
        if ((view.scaleVal == 1 || view.h) && (left > docRight)) {
            doVerticalMove = false;
        }

        // TODO: need to do something for dynamic panel with scroll
        if (IOS) {
            var scrollProps = {
                doHorizontalMove: doHorizontalMove,
                doVerticalMove: doVerticalMove,
                newScrollLeft: newScrollLeft,
                newScrollTop: newScrollTop
            };
            $axure.messageCenter.postMessage('doWidgetNoteScroll', scrollProps);
        } else {
            if (doHorizontalMove && doVerticalMove) {
                $("html, body").animate({ scrollLeft: newScrollLeft + "px", scrollTop: newScrollTop + "px" }, 300);
            } else if (doHorizontalMove) {
                $("html, body").animate({ scrollLeft: newScrollLeft + "px" }, 300);
            } else if (doVerticalMove) {
                $("html, body").animate({ scrollTop: newScrollTop + "px" }, 300);
            }
        }
    }

    var highlightEnabled = false;
    $ax.messageCenter.addMessageListener(function(message, data) {
        if(message == 'highlightInteractive') {
            highlightEnabled = data == true;
            _applyHighlight($ax('*'));
        }
    });

    var _applyHighlight = $ax.applyHighlight = function(query, ignoreUnset) {
        if(ignoreUnset && !highlightEnabled) return;

        var pulsateClassName = 'legacyPulsateBorder';
        //Determine if the widget has a defined userTriggeredEventName specified in the array above
        var _isInteractive = function(diagramObject) {
            if(diagramObject && diagramObject.interactionMap) {
                for(var index in userTriggeredEventNames) {
                    if(diagramObject.interactionMap[userTriggeredEventNames[index]]) return true;
                }
            }
            return false;
        };

        //Traverse through parent layers (if any) of an element and see if any have a defined userTriggeredEventName
        var _findMatchInParent = function(id) {
            var parents = $ax('#' + id).getParents(true, ['layer'])[0];
            for(var i in parents) {
                var parentId = parents[i];
                var parentObj = $ax.getObjectFromScriptId(parentId);
                if(_isInteractive(parentObj)) return true;
            }
            return false;
        };

        //Find all widgets with a defined userTriggeredEventName specified in the array above
        var $matchingElements = query.filter(function (obj, id) {

            //This prevents the top left corner of the page from highlighting with everything else
            if($ax.public.fn.IsLayer(obj.type)) return false;

            if(_isInteractive(obj)) return true;
            else if($ax.public.fn.IsVector(obj.type) && obj.referencePageUrl) return true;

            //Last check on the object's parent layer(s), if a layer has a defined userTriggeredEventName
            //then we shall highlight each member of that layer TODO This is a design decision and is subject to change
            return _findMatchInParent(id);
        }).$();

        var isHighlighted = $matchingElements.is('.' + pulsateClassName);

        //Toggle the pulsate class on the matched elements
        if(highlightEnabled && !isHighlighted) {
            $matchingElements.addClass(pulsateClassName);
        } else if(!highlightEnabled && isHighlighted) {
            $matchingElements.removeClass(pulsateClassName);
        }
    };
    
    $axure.getIdAndRectAtLoc = function (data) {
        var element = document.elementFromPoint(data.x, data.y);
        if (!element) return undefined;

        var jObj = _getElementIdFromTarget(element);
        if (jObj.length > 0) {
          var id = jObj.attr('id');
          var axObj = $ax('#' + id);
          var rect = axObj.pageBoundingRect();
          return { 'id': id, 'rect': rect };
        }
        return undefined;
    }

    $axure.getIdRectAndStyleAtLoc = function(data) {
        var element = document.elementFromPoint(data.x, data.y);
        if (!element) return undefined;

        var jObj = _getElementIdFromTarget(element);
        if (jObj.length > 0) {
          var id = jObj.attr('id');
          var axObj = $ax('#' + id);
          var rect = axObj.pageBoundingRect();
          var style = $ax.style.computeFullStyle(id, $ax.style.generateState(id), $ax.adaptive.currentViewId);

          return { 'id': id, 'rect': rect, 'style': style };
        }
        return undefined;
    }

    var _getElementIdFromTarget = function (target) {
        var targetId = target.id;
        var jTarget = $(target);
        while((!targetId || targetId.indexOf('cache') > -1) && jTarget[0].tagName != 'HTML') {
            jTarget = jTarget.parent();
            targetId = jTarget.attr('id');
        }
        if(targetId && targetId != 'base') {
            var sections = targetId.split('_');
            return $('#' + sections[0]);
        }
        return '';
    }

});