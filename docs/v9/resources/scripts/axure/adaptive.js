$axure.internal(function($ax) {
    $ax.adaptive = {};

    $axure.utils.makeBindable($ax.adaptive, ["viewChanged"]);

    var _auto = true;
    var _autoIsHandledBySidebar = false;

    var _views;
    var _idToView;
    var _enabledViews = [];

    var _initialViewToLoad;
    var _initialViewSizeToLoad;

    var _loadFinished = false;
    $ax.adaptive.loadFinished = function() {
        if(_loadFinished) return;
        _loadFinished = true;
        if($ax.adaptive.currentViewId) $ax.viewChangePageAndMasters();
        else $ax.postAdaptiveViewChanged();
    };

    var _handleResize = function(forceSwitchTo) {
        if(!_auto) return;
        if(_auto && _autoIsHandledBySidebar && !forceSwitchTo) return;

        var $window = $(window);
        var height = $window.height();
        var width = $window.width();

        var toView = _getAdaptiveView(width, height);
        var toViewId = toView && toView.id;

        _switchView(toViewId, forceSwitchTo);
    };

    var _setAuto = $ax.adaptive.setAuto = function(val) {
        if(_auto != val) {
            _auto = Boolean(val);
        }
    };

    var _setLineImage = function(id, imageUrl) {
        $jobj(id).attr('src', imageUrl);
    };

    var _switchView = function (viewId, forceSwitchTo) {
        //if(!$ax.pageData.isAdaptiveEnabled) return;

        var previousViewId = $ax.adaptive.currentViewId;
        if(typeof previousViewId == 'undefined') previousViewId = '';
        if(typeof viewId == 'undefined') viewId = '';
        if (viewId == previousViewId) {
            if(forceSwitchTo) $ax.postAdaptiveViewChanged(forceSwitchTo);
            return;
        }

        $ax('*').each(function(obj, elementId) {
            if (!$ax.public.fn.IsTreeNodeObject(obj.type)) return;
            if(!obj.hasOwnProperty('isExpanded')) return;

            var query = $ax('#' + elementId);
            var defaultExpanded = obj.isExpanded;

            query.expanded(defaultExpanded);
        });

        // reset all the inline positioning from move and rotate actions including size and transformation
        $axure('*').each(function (diagramObject, elementId) {
            if(diagramObject.isContained) return;
            if($ax.getParentRepeaterFromElementIdExcludeSelf(elementId)) return;

            var element = document.getElementById(elementId);
            if(element) {
                var resetCss = {
                    top: "", left: "", width: "", height: "", opacity: "",
                    transform: "", webkitTransform: "", MozTransform: "", msTransform: "", OTransform: ""
                };
                var query = $(element);
                query.css(resetCss);
                var isPanel = $ax.public.fn.IsDynamicPanel(diagramObject.type);
                if(!isPanel || diagramObject.fitToContent) { //keeps size on the panel states when switching adaptive views to optimize fit to panel
                    if(diagramObject.fitToContent) $ax.dynamicPanelManager.setFitToContentCss(elementId, true);
                    var children = query.children();
                    if(children.length) children.css(resetCss);
                }

                $ax.dynamicPanelManager.resetFixedPanel(diagramObject, element);
                $ax.dynamicPanelManager.resetAdaptivePercentPanel(diagramObject, element);
            }
        });

        $ax.adaptive.currentViewId = viewId; // we need to set this so the enabled and selected styles will apply properly
        if(previousViewId) {
            $ax.style.clearAdaptiveStyles();
            $('*').removeClass(previousViewId);
        } else {
            $ax.style.reselectElements();
        }

        $axure('*').each(function (obj, elementId) {
            if($ax.getParentRepeaterFromElementIdExcludeSelf(elementId)) return;

            $ax.style.updateElementIdImageStyle(elementId); // When image override exists, fix styling/borders
        });

        //$ax.style.startSuspendTextAlignment();

        // reset all the images only if we're going back to the default view
        if(!viewId) {
            $axure('*').each(function (diagramObject, elementId) {
                if($ax.getParentRepeaterFromElementIdExcludeSelf(elementId)) return;

                $ax.placeholderManager.refreshPlaceholder(elementId);

                var images = diagramObject.images;
                if(diagramObject.type == 'horizontalLine' || diagramObject.type == 'verticalLine') {
                    var startImg = images['start~'];
                    _setLineImage(elementId + "_start", startImg);
                    var endImg = images['end~'];
                    _setLineImage(elementId + "_end", endImg);
                    var lineImg = images['line~'];
                    _setLineImage(elementId + "_line", lineImg);
                } else if(diagramObject.type == $ax.constants.CONNECTOR_TYPE) {
                    _setAdaptiveConnectorImages(elementId, images, '');
                } else if(images) {
                    if (diagramObject.generateCompound) {

                        if($ax.style.IsWidgetDisabled(elementId)) {
                            disabledImage = _getImageWithTag(images, 'disabled~');
                            if(disabledImage) $ax.style.applyImage(elementId, disabledImage, 'disabled');
                            return;
                        }
                        if($ax.style.IsWidgetSelected(elementId)) {
                            selectedImage = _getImageWithTag(images, 'selected~');
                            if(selectedImage) $ax.style.applyImage(elementId, selectedImage, 'selected');
                            return;
                        }
                        $ax.style.applyImage(elementId, _getImageWithTag(images, 'normal~'), 'normal');
                    } else {
                        if ($ax.style.IsWidgetDisabled(elementId)) {
                            var disabledImage = _matchImage(elementId, images, [], 'disabled', true);                            
                            if (disabledImage) $ax.style.applyImage(elementId, disabledImage, 'disabled');
                            return;
                        }
                        if ($ax.style.IsWidgetSelected(elementId)) {
                            var selectedImage = _matchImage(elementId, images, [], 'selected', true);  
                            if (selectedImage) $ax.style.applyImage(elementId, selectedImage, 'selected');
                            return;
                        }
                        var normalImage = _matchImage(elementId, images, [], 'normal', true);  
                        $ax.style.applyImage(elementId, normalImage, 'normal');
                    }
                }

                //align all text
                var child = $jobj(elementId).children('.text');
                if(child.length) $ax.style.transformTextWithVerticalAlignment(child[0].id, function() { });
            });
            // we have to reset visibility if we aren't applying a new view
            $ax.visibility.resetLimboAndHiddenToDefaults();
            $ax.visibility.clearMovedAndResized();
            $ax.repeater.refreshAllRepeaters();
            $ax.dynamicPanelManager.updateParentsOfNonDefaultFitPanels();
            $ax.dynamicPanelManager.updatePercentPanelCache($ax('*'));
        } else {
            $ax.visibility.clearLimboAndHidden();
            $ax.visibility.clearMovedAndResized();
            _applyView(viewId);
            $ax.repeater.refreshAllRepeaters();
            $ax.dynamicPanelManager.updateAllLayerSizeCaches();
            $ax.dynamicPanelManager.updateParentsOfNonDefaultFitPanels();
        }

        $ax.annotation.updateAllFootnotes();
        //$ax.style.resumeSuspendTextAlignment();

        $ax.adaptive.triggerEvent('viewChanged', {});
        if(_loadFinished) $ax.viewChangePageAndMasters(forceSwitchTo);
    };

    var _getImageWithTag  = function(image, tag) {
        var flattened = {};
        for (var component in image) {
            var componentImage = image[component][tag];
            if(componentImage) flattened[component] = componentImage;
        }
        return flattened;
    }

    // gets the inheritance chain of a particular view.
    var _getAdaptiveIdChain = $ax.adaptive.getAdaptiveIdChain = function(viewId) {
        if(!viewId) return [];
        var view = _idToView[viewId];
        var chain = [];
        var current = view;
        while(current) {
            chain[chain.length] = current.id;
            current = _idToView[current.baseViewId];
        }
        return chain.reverse();
    };

    var _getMasterAdaptiveIdChain = $ax.adaptive.getMasterAdaptiveIdChain = function (masterId, viewId) {
        if (!viewId) return [];

        var master = $ax.pageData.masters[masterId];
        var masterViews = master.adaptiveViews;
        var idToMasterView = {};
        if (masterViews && masterViews.length > 0) {
            for (var i = 0; i < masterViews.length; i++) {
                var view = masterViews[i];
                idToMasterView[view.id] = view;
            }
        }

        if (!idToMasterView) return [];

        var view = idToMasterView[viewId];
        var chain = [];
        var current = view;
        while (current) {
            chain[chain.length] = current.id;
            current = idToMasterView[current.baseViewId];
        }
        return chain.reverse();
    };

    var _getPageStyle = $ax.adaptive.getPageStyle = function() {
        var currentViewId = $ax.adaptive.currentViewId;
        var adaptiveChain = _getAdaptiveIdChain(currentViewId);

        var currentStyle = $.extend({}, $ax.pageData.page.style);
        for(var i = 0; i < adaptiveChain.length; i++) {
            var viewId = adaptiveChain[i];
            $.extend(currentStyle, $ax.pageData.page.adaptiveStyles[viewId]);
        }

        return currentStyle;
    };

    var _setAdaptiveLineImages = function(elementId, images, viewIdChain) {
        for(var i = viewIdChain.length - 1; i >= 0; i--) {
            var viewId = viewIdChain[i];
            var startImg = images['start~' + viewId];
            if(startImg) {
                _setLineImage(elementId + "_start", startImg);
                var endImg = images['end~' + viewId];
                _setLineImage(elementId + "_end", endImg);
                var lineImg = images['line~' + viewId];
                _setLineImage(elementId + "_line", lineImg);
                break;
            }
        }
    };

    var _setAdaptiveConnectorImages = function (elementId, images, view) {
        var conn = $jobj(elementId);
        var count = conn.children().length-1; // -1 for rich text panel
        for(var i = 0; i < count; i++) {
            var img = images['' + i + '~' + view];
            $jobj(elementId + '_seg' + i).attr('src', img);
        }
    };

    var _applyView = $ax.adaptive.applyView = function(viewId, query) {
        var limboIds = {};
        var hiddenIds = {};

        var jquery;
        if(query) {
            jquery = query.jQuery();
            jquery = jquery.add(jquery.find('*'));
            var jqueryAnn = $ax.annotation.jQueryAnn(query);
            jquery = jquery.add(jqueryAnn);
        } else {
            jquery = $('*');
            query = $ax('*');
        }
        jquery.addClass(viewId);
        var viewIdChain = _getAdaptiveIdChain(viewId);
        // this could be made more efficient by computing it only once per object
        query.each(function(diagramObject, elementId) {
            _applyAdaptiveViewOnObject(diagramObject, elementId, viewIdChain, viewId, limboIds, hiddenIds);
        });

        $ax.visibility.addLimboAndHiddenIds(limboIds, hiddenIds, query);
        //$ax.dynamicPanelManager.updateAllFitPanelsAndLayerSizeCaches();
        $ax.dynamicPanelManager.updatePercentPanelCache(query);
    };

    var _applyAdaptiveViewOnObject = function(diagramObject, elementId, viewIdChain, viewId, limboIds, hiddenIds) {
        var adaptiveChain = [];
        for(var i = 0; i < viewIdChain.length; i++) {
            var viewId = viewIdChain[i];
            var viewStyle = diagramObject.adaptiveStyles[viewId];
            if(viewStyle) {
                adaptiveChain[adaptiveChain.length] = viewStyle;
                if (viewStyle.size) $ax.public.fn.convertToSingleImage($jobj(elementId));
            }
        }

        var state = $ax.style.generateState(elementId);

        // set the image
        var images = diagramObject.images;
        if(images) {
            if(diagramObject.type == 'horizontalLine' || diagramObject.type == 'verticalLine') {
                _setAdaptiveLineImages(elementId, images, viewIdChain);
            } else if (diagramObject.type == $ax.constants.CONNECTOR_TYPE) {
                _setAdaptiveConnectorImages(elementId, images, viewId);
            } else if (diagramObject.generateCompound) {
                var compoundUrl = _matchImageCompound(diagramObject, elementId, viewIdChain, state);
                if (compoundUrl) $ax.style.applyImage(elementId, compoundUrl, state);
            }else {
                var imgUrl = _matchImage(elementId, images, viewIdChain, state);
                if(imgUrl) $ax.style.applyImage(elementId, imgUrl, state);
            }
        }
        // addaptive override style (not including default style props)
        var adaptiveStyle = $ax.style.computeAllOverrides(elementId, undefined, state, viewId);

        // this style INCLUDES the object's my style
        var compoundStyle = $.extend({}, diagramObject.style, adaptiveStyle);

        if(!diagramObject.isContained) {
            $ax.style.setAdaptiveStyle(elementId, adaptiveStyle);
        }

        var scriptId = $ax.repeater.getScriptIdFromElementId(elementId);
        if(compoundStyle.limbo && !diagramObject.isContained) limboIds[scriptId] = true;
        // sigh, javascript. we need the === here because undefined means not overriden
        if(compoundStyle.visible === false) hiddenIds[scriptId] = true;
    };

    var _matchImage = function(id, images, viewIdChain, state, doNotProgress) {
        var override = $ax.style.getElementImageOverride(id, state);
        if(override) return override;

        if(!images) return undefined;

        // first check all the images for this state
        for(var i = viewIdChain.length - 1; i >= 0; i--) {
            var viewId = viewIdChain[i];
            var img = images[id + "~" + state + "~" + viewId];
            if(!img) img = images[state + "~" + viewId];
            if(img) return img;
        }
        // check for the default state style
        var defaultStateImage = images[id + "~" + state + "~"];
        if(!defaultStateImage) defaultStateImage = images[state + "~"];
        if(defaultStateImage) return defaultStateImage;

        if(doNotProgress) return undefined;

        state = $ax.style.progessState(state);
        if(state) return _matchImage(id, images, viewIdChain, state);

        // SHOULD NOT REACH HERE! NORMAL SHOULD ALWAYS CATCH AT THE DEFAULT!
        return images['normal~']; // this is the default
    };

    var _matchImageCompound = function(diagramObject, id, viewIdChain, state) {
        var images = [];
        for(var i = 0; i < diagramObject.compoundChildren.length; i++) {
            var component = diagramObject.compoundChildren[i];
            images[component] = _matchImage(id, diagramObject.images[component], viewIdChain, state);
        }
        return images;
    };



    $ax.adaptive.getImageForStateAndView = function(id, state) {
        var viewIdChain = _getAdaptiveIdChain($ax.adaptive.currentViewId);
        var diagramObject = $ax.getObjectFromElementId(id);
        if (diagramObject.generateCompound) return _matchImageCompound(diagramObject, id, viewIdChain, state);
        else return _matchImage(id, diagramObject.images, viewIdChain, state);
    };

    var _getAdaptiveView = function(winWidth, winHeight) {
        var _isViewOneGreaterThanTwo = function(view1, view2) {
            return view1.size.width > view2.size.width || (view1.size.width == view2.size.width && view1.size.height > view2.size.height);
        };

        var _isViewOneLessThanTwo = function(view1, view2) {
            var width2 = view2.size.width || 1000000; // artificially large number
            var height2 = view2.size.height || 1000000;

            var width1 = view1.size.width || 1000000;
            var height1 = view1.size.height || 1000000;

            return width1 < width2 || (width1 == width2 && height1 < height2);
        };

        var _isWindowWidthGreaterThanViewWidth = function(view, width) {
            return width >= view.size.width;
        };

        var _isWindowWidthLessThanViewWidth = function(view1, width) {
            var viewWidth = view1.size.width || 1000000;

            return width <= viewWidth;
        };

        var greater = undefined;
        var less = undefined;

        var defaultView = $ax.pageData.defaultAdaptiveView;
        if (_isWindowWidthGreaterThanViewWidth(defaultView, winWidth, winHeight)) greater = defaultView;
        less = defaultView;
        for(var i = 0; i < _enabledViews.length; i++) {
            var view = _enabledViews[i];
            if(_isWindowWidthGreaterThanViewWidth(view, winWidth, winHeight)) {
                if(!greater || _isViewOneGreaterThanTwo(view, greater)) greater = view;
            }
            if(_isWindowWidthLessThanViewWidth(view, winWidth, winHeight)) {
                if(!less || _isViewOneLessThanTwo(view, less)) less = view;
            }
        }
        return greater || less;

        //return less || greater;
    };

    var _isAdaptiveInitialized = function() {
        return typeof _idToView != 'undefined';
    };


    $ax.messageCenter.addMessageListener(function(message, data) {
        //If the adaptive plugin hasn't been initialized yet then 
        //save the view to load so that it can get set when initialize occurs
        if(message == 'switchAdaptiveView') {
            var href = window.location.href.split('#')[0];
            var lastSlash = href.lastIndexOf('/');
            href = href.substring(lastSlash + 1);
            if(href != data.src) return;

            var view = data.view == 'auto' ? undefined : (data.view == 'default' ? '' : data.view);

            if(!_isAdaptiveInitialized()) {
                _initialViewToLoad = view;
            } else _handleLoadViewId(view);
        } else if(message == 'setAdaptiveViewForSize') {
            _autoIsHandledBySidebar = true;
            if(!_isAdaptiveInitialized()) {
                _initialViewSizeToLoad = data;
            } else _handleSetViewForSize(data.width, data.height);
        } else if(message == 'setScale') {
            var prevScaleN = $('#base').css('transform');
            (prevScaleN === "none") ? prevScaleN = 1 : prevScaleN = Number(prevScaleN.substring(prevScaleN.indexOf('(') + 1, prevScaleN.indexOf(',')));
            var newScaleN = 1;
            var contentOriginOffset = 0;

            //1 Scale to Width
            //2 Scale to Fit
            $('#base').css({
                'transform': '',
                'transform-origin': ''
            });
            $('body').css('left', '');
            $('body').css('background-size', '');
            // IOS hack to get rid of tap highlight on blank pages
            //if (IOS && !($('body').css('position') == 'relative')) $('body').css('width', window.screen.width + 'px');
            //else $('body').css('width', '');
            $('body').css('width', '');
            $('body').css('height', '');
            $('body').css('overflow', '');
            $('body').css('overflow-x', '');

            if(data.scale == 1 || data.scale == 2) {
                var $body = $('body');
                var bodyWidth = $body.width();
                if (MOBILE_DEVICE) {
                    bodyWidth = data.viewportWidth > 0 ? data.viewportWidth : $(document).width(); 
                }
                var isCentered = $body.css('position') == 'relative';
                var origin = newOrigin = isCentered ? -Number($body.css('left').replace('px', '')) + bodyWidth / 2 + 'px top' : 'left top';
                $(window).scrollLeft(0);
                $body.css('overflow-x', 'hidden');

                // screen width does not adjust on screen rotation for iOS (width is always shorter screen measurement)
                var isLandscape = window.orientation != 0 && window.orientation != 180;
                var mobileWidth = (IOS ? (isLandscape ? window.screen.height : window.screen.width) : window.screen.width) - data.panelWidthOffset;
                var scaleN = newScaleN = (MOBILE_DEVICE ? mobileWidth : $(window).width()) / bodyWidth;
                if (data.scale == 2) {
                    $(window).scrollTop(0);
                    $body.css('overflow', 'hidden');
                    var pageSize = $ax.public.fn.getPageSize();
                    var hScaleN = (MOBILE_DEVICE ? data.viewportHeight : $(window).height()) / Math.max(1, pageSize.bottom);
                    if (hScaleN < scaleN) {
                        scaleN = newScaleN = hScaleN;
                        //$body.css('height', $body.height() * scaleN + 'px');
                    }
                    if (isCentered) contentOriginOffset = scaleN * (bodyWidth / 2);
                }
                // Setting body height all the time instead of just when scaling to height for scale to fit, since IE won't scale properly without it
                $body.css('height', $body.height() * scaleN + 'px');

                var scale = 'scale(' + scaleN + ')';

                $('#base').css({
                    'transform': scale,
                    'transform-origin': origin
                });

                var bodyBg = $('body').css('background-image');
                if(bodyBg && bodyBg != 'none') {
                    $('body').css('background-size', '');
                    var bodyBgSize = $('body').css('background-size');
                    var bodyBgDim = bodyBgSize.split(' ');
                    var bodyBgWidth = Number(bodyBgDim[0].replace('px', '')) * scaleN + 'px';
                    var bodyBgHeight = Number(bodyBgDim[1].replace('px', '')) * scaleN + 'px';
                    $('body').css('background-size', bodyBgWidth + ' ' + bodyBgHeight);
                }

                if(isCentered && scaleN < 1) {
                    var oldLeft = -Number($body.css('left').replace('px', ''));
                    var newLeft = bodyWidth / 2 * (1 - scaleN) + oldLeft;
                    // IOS hack to get rid of tap highlight on centered pages that are scaled
                    if (IOS) newLeft = newLeft - 1;
                    $body.css('left', '-' + (newLeft) + 'px');

                    $body.css('width', bodyWidth * scaleN + 'px');
                } else if (!isCentered) {
                    // TODO: may want this back
                    $body.css('width', bodyWidth * scaleN + 'px');
                }
            } else if (IOS && !($('body').css('position') == 'relative')) {
                // IOS hack to get rid of tap highlight on blank pages
                $('body').css('width', (window.screen.width - data.panelWidthOffset) + 'px');
            }

            var contentScale = {
                scaleN: newScaleN,
                prevScaleN: prevScaleN,
                contentOriginOffset: contentOriginOffset,
            };
            $axure.messageCenter.postMessage('setContentScale', contentScale);

        } else if(message == 'setDeviceMode') {
            if (data.device) {
                // FIXES firefox cursor not staying outside initial device frame border
                // SAFARI needs entire content height so that trackpad can be disabled
                if (FIREFOX || SAFARI) {
                    var pageSize = $ax.public.fn.getPageSize();
                    $('html').css('height', pageSize.bottom + 'px');
                }

                if (SAFARI) _setTrackpadHorizontalScroll(false);

                if ($('html').getNiceScroll().length == 0 && !MOBILE_DEVICE) {// || !$axure.player.isMobileMode())) {
                //if ($('html').getNiceScroll().length == 0) {
                    $('html').scrollLeft(0);

                    $('html').niceScroll({ emulatetouch: true, horizrailenabled: false });
                    $('html').addClass('mobileFrameCursor');
                    $('html').css('cursor', 'url(resources/css/images/touch.cur), auto');
                    $('html').css('cursor', 'url(resources/css/images/touch.svg) 32 32, auto');
                    $('html').css('overflow-x', 'hidden');
                    //$('html').getNiceScroll().locked = true;
                    if (IE) {
                        document.addEventListener("click", function () {
                            // IE still sometimes wants an argument here
                            this.activeElement.releasePointerCapture();
                        }, false);
                    }

                    if ($axure.browser.isEdge) {
                        document.addEventListener("pointerdown", function (e) {
                            this.activeElement.releasePointerCapture(e.pointerId);
                        }, false);
                    }

                    $ax.dynamicPanelManager.initMobileScroll();
                } else {
                    // Gives horizontal scroll to android in 100% (handled outside of iframe)
                    $('html').css('overflow-x', 'hidden');
                    $('body').css('margin', '0px');
                    $(function () { _setHorizontalScroll(false); });
                }
            } else {
                if (SAFARI) _setTrackpadHorizontalScroll(true);

                $('html').getNiceScroll().remove();
                $('html').css('overflow-x', '');
                $('html').css('cursor', '');
                $('html').removeAttr('style');
                //$('html').scrollLeft(0);
                $('body').css('margin', '');
                $('html').removeClass('mobileFrameCursor');
                $(function () { _setHorizontalScroll(!data.scaleToWidth); });
            }
        }
    });

    var _setTrackpadHorizontalScroll = function (active) {
        var preventScroll = function (e) {
            if (Math.abs(e.wheelDeltaX) != 0) {
                e.preventDefault();
            }
        }

        if (!active) {
            document.body.addEventListener("mousewheel", preventScroll, { passive: false });
            document.getElementById('html').addEventListener("mousewheel", preventScroll, { passive: false });
        } else {
            document.body.removeEventListener("mousewheel", preventScroll, { passive: false });
            document.getElementById('html').removeEventListener("mousewheel", preventScroll, { passive: false });
        }
    }

    var _setHorizontalScroll = function (active) {
        var $body = $(document);
        if (!active) {
            $body.bind('scroll', function () {
                if ($body.scrollLeft() !== 0) {
                    $body.scrollLeft(0);
                }
            });
        } else {
            $body.unbind('scroll');
        }
    }

    $ax.adaptive.setAdaptiveView = function(view) {
        var viewIdForSitemapToUnderstand = view == 'auto' ? undefined : (view == 'default' ? '' : view);

        if(!_isAdaptiveInitialized()) {
            _initialViewToLoad = viewIdForSitemapToUnderstand;
        } else _handleLoadViewId(viewIdForSitemapToUnderstand);
    };

    $ax.adaptive.initialize = function() {
        _views = $ax.pageData.adaptiveViews;
        _idToView = {};

        var useViews = $ax.document.configuration.useViews;

        if(_views && _views.length > 0) {
            for(var i = 0; i < _views.length; i++) {
                var view = _views[i];
                _idToView[view.id] = view;
                if(useViews) _enabledViews[_enabledViews.length] = view;
            }

            if(_autoIsHandledBySidebar && _initialViewSizeToLoad) _handleSetViewForSize(_initialViewSizeToLoad.width, _initialViewSizeToLoad.height);
            else _handleLoadViewId(_initialViewToLoad);
        }

        $axure.resize(function(e) {
            _handleResize();
            $ax.postResize(e); //window resize fires after view changed
        });
    };

    var _handleLoadViewId = function (loadViewId, forceSwitchTo) {
        if(typeof loadViewId != 'undefined') {
            _setAuto(false);
            _switchView(loadViewId != 'default' ? loadViewId : '', forceSwitchTo);
        } else {
            _setAuto(true);
            _handleResize(forceSwitchTo);
        }
    };

    var _handleSetViewForSize = function (width, height) {
        var toView = _getAdaptiveView(width, height);
        var toViewId = toView && toView.id;
        _switchView(toViewId);
    };

    $ax.adaptive.getSketchKey = function() {
        return $ax.pageData.sketchKeys[$ax.adaptive.currentViewId || ''];
    }
});