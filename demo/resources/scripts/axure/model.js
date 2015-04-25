// ******* Object Model ******** //
$axure.internal(function($ax) {
    var _implementations = {};

    var _initializeObject = function(type, obj) {
        $.extend(obj, _implementations[type]);
    };
    $ax.initializeObject = _initializeObject;

    var _model = $ax.model = {};

    _model.idsInRdo = function(rdoId, elementIds) {
        var rdoScriptId = $ax.repeater.getScriptIdFromElementId(rdoId);
        var rdoObj = $obj(rdoId);
        var path = $ax.getPathFromScriptId(rdoScriptId);
        var rdoRepeater = $ax.getParentRepeaterFromScriptId(rdoScriptId);
        var rdoItem = $ax.repeater.getItemIdFromElementId(rdoId);

        if(!elementIds) elementIds = [];
        $ax('*').each(function(obj, elementId) {
            // Make sure in same rdo
            var scriptId = $ax.repeater.getScriptIdFromElementId(elementId);
            var elementPath = $ax.getPathFromScriptId(scriptId);
            // This is because last part of path is for the obj itself.
            elementPath.pop();
            if(elementPath.length != path.length) return;
            for(var i = 0; i < path.length; i++) if(elementPath[i] != path[i]) return;

            // If object is in a panel, the panel will be hidden, so the obj doesn't have to be.
            if(obj.parentDynamicPanel) return;

            var repeater = $ax.getParentRepeaterFromScriptId(scriptId);
            var item = $ax.repeater.getItemIdFromElementId(elementId);
            if(repeater != rdoRepeater || item != rdoItem) return;

            if(obj.type == 'referenceDiagramObject') _model.idsInRdo(elementId, elementIds);
            // Kind of complicated, but returning for isContained objects, hyperlinks, tabel cell, non-root tree nodes, and images in the tree.
            else if(obj.isContained || obj.type == 'hyperlink' || obj.type == 'tableCell' ||
                (obj.type == 'treeNodeObject' && !$jobj(elementId).hasClass('treeroot')) ||
                (obj.type == 'imageBox' && obj.parent.type == 'treeNodeObject')) return;
            else elementIds.push(elementId);
        });
        return elementIds;
    };

});