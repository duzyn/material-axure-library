$axure.internal(function($ax) {
    var _move = {};
    $ax.move = _move;

    var widgetMoveInfo = {};

    $ax.move.GetWidgetMoveInfo = function() {
        return $.extend({}, widgetMoveInfo);
    };

    $ax.move.MoveWidget = function(id, x, y, easing, duration, to, animationCompleteCallback, shouldFire) {
        $ax.drag.LogMovedWidgetForDrag(id);

        var widget = $('#' + id);
        var jobj = $jobj(id);

        var horzProp = 'left';
        var vertProp = 'top';
        var horzX = to ? x - Number(jobj.css('left').replace('px', '')) : x;
        var vertY = to ? y - Number(jobj.css('top').replace('px', '')) : y;

        var fixedInfo = $ax.dynamicPanelManager.getFixedInfo(id);

        if(fixedInfo.horizontal == 'right') {
            horzProp = 'right';
            horzX = to ? $(window).width() - x - Number(jobj.css('right').replace('px', '')) - widget.width() : -x;
        } else if(fixedInfo.horizontal == 'center') {
            horzProp = 'margin-left';
            if(to) horzX = x - $(window).width() / 2;
        }

        if(fixedInfo.vertical == 'bottom') {
            vertProp = 'bottom';
            vertY = to ? $(window).height() - y - Number(jobj.css('bottom').replace('px', '')) - widget.height() : -y;
        } else if(fixedInfo.vertical == 'middle') {
            vertProp = 'margin-top';
            if(to) vertY = y - $(window).height() / 2;
        }
        var cssStyles = {};

        if(!$ax.dynamicPanelManager.isPercentWidthPanel($obj(id))) cssStyles[horzProp] = '+=' + horzX;
        cssStyles[vertProp] = '+=' + vertY;

        var query = $jobj(id).add($jobj(id + '_ann')).add($jobj(id + '_ref'));
        if(easing == 'none') {
            query.animate(cssStyles, 0);
            if(animationCompleteCallback) animationCompleteCallback();
            if(shouldFire) $ax.action.fireAnimationFromQueue(id);
        } else {
            query.animate(cssStyles, duration, easing, function() {
                if(animationCompleteCallback) animationCompleteCallback();
                if(shouldFire) $ax.action.fireAnimationFromQueue(id);
            });
        }

        var moveInfo = new Object();
        moveInfo.x = horzX;
        moveInfo.y = vertY;
        moveInfo.options = {};
        moveInfo.options.easing = easing;
        moveInfo.options.duration = duration;
        widgetMoveInfo[id] = moveInfo;

        $ax.event.raiseSyntheticEvent(id, "onMove");
    };

    _move.nopMove = function(id) {
        var moveInfo = new Object();
        moveInfo.x = 0;
        moveInfo.y = 0;
        moveInfo.options = {};
        moveInfo.options.easing = 'none';
        moveInfo.options.duration = 0;
        widgetMoveInfo[id] = moveInfo;
    };
});