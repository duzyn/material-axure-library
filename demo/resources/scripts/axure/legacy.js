//stored on each browser event
var windowEvent;

$axure.internal(function($ax) {
    var _legacy = {};
    $ax.legacy = _legacy;


    // ************************** GLOBAL VARS *********************************//

    // ************************************************************************//
    //Check if IE
    //var bIE = false;
    //if ((index = navigator.userAgent.indexOf("MSIE")) >= 0) {
    //    bIE = true;
    //}

    var Forms = window.document.getElementsByTagName("FORM");
    for(var i = 0; i < Forms.length; i++) {
        var Form = Forms[i];
        Form.onclick = $ax.legacy.SuppressBubble;
    }

    $ax.legacy.SuppressBubble = function(event) {
        if(IE) {
            window.event.cancelBubble = true;
            window.event.returnValue = false;
        } else {
            if(event) {
                event.stopPropagation();
            }
        }
    };

    //    function InsertAfterBegin(dom, html) {
    //        if(!IE) {
    //            var phtml;
    //            var range = dom.ownerDocument.createRange();
    //            range.selectNodeContents(dom);
    //            range.collapse(true);
    //            phtml = range.createContextualFragment(html);
    //            dom.insertBefore(phtml, dom.firstChild);
    //        } else {
    //            dom.insertAdjacentHTML("afterBegin", html);
    //        }
    //    }

    //    function InsertBeforeEnd(dom, html) {
    //        if(!IE) {
    //            var phtml;
    //            var range = dom.ownerDocument.createRange();
    //            range.selectNodeContents(dom);
    //            range.collapse(dom);
    //            phtml = range.createContextualFragment(html);
    //            dom.appendChild(phtml);
    //        } else {
    //            dom.insertAdjacentHTML("beforeEnd", html);
    //        }
    //    }

    //Get the id of the Workflow Dialog belonging to element with id = id

    //    function Workflow(id) {
    //        return id + 'WF';
    //    }

    $ax.legacy.BringToFront = function(id, skipFixed) {
        _bringToFrontHelper(id);
        if(!skipFixed) $ax.legacy.BringFixedToFront();
    };

    var _bringToFrontHelper = function(id) {
        var target = window.document.getElementById(id);
        if(target == null) return;
        $ax.globals.MaxZIndex = $ax.globals.MaxZIndex + 1;
        target.style.zIndex = $ax.globals.MaxZIndex;
    };

    $ax.legacy.BringFixedToFront = function() {
        $ax(function(diagramObject) { return diagramObject.fixedKeepInFront; }).each(function(diagramObject, scriptId) {
            _bringToFrontHelper(scriptId);
        });
    };

    $ax.legacy.SendToBack = function(id) {
        var target = window.document.getElementById(id);
        if(target == null) return;
        target.style.zIndex = $ax.globals.MinZIndex = $ax.globals.MinZIndex - 1;
    };

    $ax.legacy.RefreshScreen = function() {
        var oldColor = window.document.body.style.backgroundColor;
        var setColor = (oldColor == "rgb(0,0,0)") ? "#FFFFFF" : "#000000";
        window.document.body.style.backgroundColor = setColor;
        window.document.body.style.backgroundColor = oldColor;
    };

    $ax.legacy.getAbsoluteLeft = function(currentNode) {
        var oldDisplay = currentNode.css('display');
        var displaySet = false;
        if(oldDisplay == 'none') {
            currentNode.css('display', '');
            displaySet = true;
        }
        var left = currentNode.offset().left;
        if(displaySet) currentNode.css('display', oldDisplay);
        var body = $('body');
        if(body.css('position') == 'relative') left -= (Number(body.css('left').replace('px', '')) + Math.max(0, ($(window).width() - body.width()) / 2));
        return left;
    };

    $ax.legacy.getAbsoluteTop = function(currentNode) {
        var oldDisplay = currentNode.css('display');
        var displaySet = false;
        if(oldDisplay == 'none') {
            currentNode.css('display', '');
            displaySet = true;
        }
        var top = currentNode.offset().top;
        if(displaySet) currentNode.css('display', oldDisplay);
        return top;
    };

    // ******************  Annotation and Link Functions ****************** //

    $ax.legacy.GetAnnotationHtml = function(annJson) {
        var retVal = "";
        for(var noteName in annJson) {
            if(noteName != "label") {
                retVal += "<div class='annotationName'>" + noteName + "</div>";
                retVal += "<div class='annotation'>" + annJson[noteName] + "</div>";
            }
        }
        return retVal;
    };


    $ax.legacy.GetScrollable = function(target) {
        var $target = $(target);
        var current = $target;
        var last = $target;

        while(!current.is('body') && !current.is('html')) {
            var elementId = current.attr('id');
            var diagramObject = elementId && $ax.getObjectFromElementId(elementId);
            if(diagramObject && diagramObject.type == 'dynamicPanel' && diagramObject.scrollbars != 'none') {
                //returns the panel diagram div which handles scrolling
                return window.document.getElementById(last.attr('id'));
            }
            last = current;
            current = current.parent();
        }
        // Need to do this because of ie
        if(IE) return window.document.documentElement;
        else return window.document.body;
    };



});