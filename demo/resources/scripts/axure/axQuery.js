$axure = function(query) {
    return $axure.query(query);
};
 
// ******* AxQuery and Page metadata ******** //
(function() {
    var $ax = function() {
        var returnVal = $axure.apply(this, arguments);
        var axFn = $ax.fn;
        for (var key in axFn) {
            returnVal[key] = axFn[key];
        }

        return returnVal;
    };

    $ax.public = $axure;
    $ax.fn = {};

    $axure.internal = function(initFunction) {
        //Attach messagecenter to $ax object so that it can be used in viewer.js, etc in internal scope
        if(!$ax.messageCenter) $ax.messageCenter = $axure.messageCenter;

        return initFunction($ax);
    };
    
   var _lastFiredResize = 0; 
   var _resizeFunctions = []; 
   var _lastTimeout;
   var _fireResize = function() {
       if (_lastTimeout) window.clearTimeout(_lastTimeout);       
       _lastTimeout = undefined;
       _lastFiredResize = new Date().getTime(); 
       for(var i = 0; i < _resizeFunctions.length; i++) _resizeFunctions[i](); 
   };
    
   $axure.resize = function(fn) { 
       if(fn) _resizeFunctions[_resizeFunctions.length] = fn; 
       else $(window).resize(); 
   };

    $(window).resize(function() {
        var THRESHOLD = 50;
        var now = new Date().getTime();
        if(now - _lastFiredResize > THRESHOLD) {
            _fireResize();
        } else if(!_lastTimeout) {
            _lastTimeout = window.setTimeout(_fireResize, THRESHOLD);
        }
    });
    
    window.$obj = function(id) {
        return $ax.getObjectFromElementId(id);
    };

    window.$id = function(obj) {
        return obj.scriptIds[0];
    };

    window.$jobj = function(id) {
        return $(document.getElementById(id));
    };

    $ax.INPUT = function(id) { return id + "_input"; };
    $ax.IsImageFocusable = function(type) { return type == 'imageBox' || type == 'buttonShape' || type == 'flowShape' || type == 'treeNodeObject' || type == 'tableCell'; };
    $ax.IsTreeNodeObject = function(type) { return type == 'treeNodeObject'; };
    $ax.IsSelectionButton = function(type) { return type == 'checkbox' || type == 'radioButton'; };

    var _fn = {};
    $axure.fn = _fn;
    $axure.fn.jQuery = function() {
        var elements = this.getElements();
        return $(elements);
    };
    $axure.fn.$ = $axure.fn.jQuery;

    var _query = function(query, queryArg) {
        var returnVal = {};
        var _axQueryObject = returnVal.query = { };
        _axQueryObject.filterFunctions = [];

        if (query == '*') {
            _axQueryObject.filterFunctions[0] = function() { return true; };
        } else if (typeof(query) === 'function') {
            _axQueryObject.filterFunctions[0] = query;
        } else {
            var firstString = $.trim(query.toString());
            if (firstString.charAt(0) == '@') {
                _axQueryObject.filterFunctions[0] = function(diagramObject) {
                    return diagramObject.label == firstString.substring(1);
                };
            } else if (firstString.charAt(0) == '#') {
                _axQueryObject.elementId = firstString.substring(1);
            } else {
                if (firstString == 'label') {
                    _axQueryObject.filterFunctions[0] = function(diagramObject) {
                        return queryArg instanceof Array && queryArg.indexOf(diagramObject.label) > 0 ||
                            queryArg instanceof RegExp && queryArg.test(diagramObject.label) ||
                            diagramObject.label == queryArg;
                    };
                } else if(firstString == 'elementId') {
                    _axQueryObject.filterFunctions[0] = function(diagramObject, elementId) {
                        return queryArg instanceof Array && queryArg.indexOf(elementId) > 0 ||
                            elementId == queryArg;
                    };
                }
            }
        }

        var axureFn = $axure.fn;
        for (var key in axureFn) {
            returnVal[key] = axureFn[key];
        }
        return returnVal;
    };
    $axure.query = _query;

    var _getFilterFnFromQuery = function(query) {
        var filter = function(diagramObject, elementId) {
            // Non diagram objects are allowed to be queryed, such as text inputs.
            if(diagramObject && diagramObject.type != 'referenceDiagramObject' && !document.getElementById(elementId)) return false;
            var retVal = true;
            for(var i = 0; i < query.filterFunctions.length && retVal; i++) {
                retVal = query.filterFunctions[i](diagramObject, elementId);
            }
            return retVal;
        };
        return filter;
    };

    $ax.public.fn.filter = function(query, queryArg) {
        var returnVal = _query(query, queryArg);
        
        if(this.query.elementId) returnVal.query.elementId = this.query.elementId;
        
        //If there is already a function, offset by 1 when copying other functions over.
        var offset = returnVal.query.filterFunctions[0] ? 1 : 0;
        
        //Copy all functions over to new array.
        for(var i = 0; i < this.query.filterFunctions.length; i++) returnVal.query.filterFunctions[i+offset] = this.query.filterFunctions[i];
        
        //Functions are in reverse order now
        returnVal.query.filterFunctions.reverse();

        return returnVal;
    };

    $ax.public.fn.each = function(fn) {
        var filter = _getFilterFnFromQuery(this.query);
        var elementIds = this.query.elementId ? [this.query.elementId] : $ax.getAllElementIds();
        for (var i = 0; i < elementIds.length; i++) {
            var elementId = elementIds[i];
            var diagramObject = $ax.getObjectFromElementId(elementId);
            if (filter(diagramObject, elementId)) {
                fn.apply(diagramObject, [diagramObject, elementId]);
            }
        }
    };

    $ax.public.fn.getElements = function() {
        var elements = [];
        this.each(function(dObj, elementId) {
            var elementById = document.getElementById(elementId);
            if(elementById) elements[elements.length] = elementById;
        });
        return elements;
    };
    
    $ax.public.fn.getElementIds = function() {
        var elementIds = [];
        this.each(function(dObj, elementId) { elementIds[elementIds.length] = elementId; });
        return elementIds;
    };

    // Deep means to keep getting parents parent until at the root parent. Parent is then an array instead of an id.
    $ax.public.fn.getParents = function(deep) {
        var elementIds = this.getElementIds();
        var parentIds = [];

        var getParent = function(elementId) {
            var parent = undefined;
            var scriptId = $ax.repeater.getScriptIdFromElementId(elementId);
            var itemNum = $ax.repeater.getItemIdFromElementId(elementId);
            var parentRepeater = $ax.getParentRepeaterFromScriptId(scriptId);
            // Repeater references self, constantly if it is treated as its own parent in this case infinite recursion occurs.
            if(parentRepeater == scriptId) {
                parentRepeater = undefined;
                itemNum = '';
            }
            
            if(parentRepeater) {
                parentRepeater = $ax.repeater.createElementId(parentRepeater, itemNum);
                parent = parentRepeater;
            }

            var masterPath = $ax.getPathFromScriptId($ax.repeater.getScriptIdFromElementId(elementId));
            masterPath.pop();
            if(masterPath.length > 0) {
                var masterId = $ax.getElementIdFromPath(masterPath, {itemNum: itemNum});
                var masterRepeater = $ax.getParentRepeaterFromScriptId($ax.repeater.getScriptIdFromElementId(masterId));
                if(!parentRepeater || masterRepeater) parent = masterId;
            }

            var obj = $obj(elementId);
            var parentDynamicPanel = obj.parentDynamicPanel;
            if(parentDynamicPanel) {
                // Make sure the parent if not parentRepeater, or dynamic panel is also in that repeater
                // If there is a parent master, the dynamic panel must be in it, otherwise parentDynamicPanel would be undefined.
                var panelPath = masterPath;
                panelPath[panelPath.length] = parentDynamicPanel;
                var panelId = $ax.getElementIdFromPath(panelPath, {itemNum: itemNum});
                var panelRepeater = $ax.getParentRepeaterFromScriptId($ax.repeater.getScriptIdFromElementId(panelId));
                if(!parentRepeater || panelRepeater) return panelId + '_state' + obj.panelIndex;
            }

            return parent;
        };

        for(var i = 0; i < elementIds.length; i++) {
            var parent = getParent(elementIds[i]);
            if(deep) {
                var parents = [];
                while(parent) {
                    parents[parents.length] = parent;
                    // If id is not a valid object, you are either repeater item
                    if(!$obj(parent)) parent = $jobj(parent).parent().attr('id');
                    // or dynamic panel state.
                    if(!$obj(parent)) parent = $jobj(parent).parent().attr('id');
                    parent = getParent(parent);
                }
                parent = parents;
            }
            parentIds[parentIds.length] = parent;
        }
        return parentIds;
    };

    // Get the path to the child, where non leaf nodes can be masters, dynamic panels, and repeaters.
    $ax.public.fn.getChildren = function(deep) {
        var elementIds = this.getElementIds();
        var children = [];

        var getChildren = function(elementId) {
            var obj = $obj(elementId);
            if(!obj) return undefined;

            var isRepeater = obj.type == 'repeater';
            var isDynamicPanel = obj.type == 'dynamicPanel';
            var isMaster = obj.type == 'master';
            
            var isMenu = obj.type == 'menuObject';
            var isTreeNode = obj.type == 'treeNodeObject';
            var isTable = obj.type == 'table';

            if(isRepeater || isDynamicPanel || isMaster || isMenu || isTreeNode || isTable) {
                // Find parent that children should be pulled from. Default is just the elementId query (used by table and master)
                var parent = $jobj(elementId);
                if(isRepeater) {
                    parent = $();
                    var itemIds = $ax.getItemIdsForRepeater(elementId);
                    for(var itemIndex = 0; itemIndex < itemIds.length; itemIndex++) parent = parent.add($jobj($ax.repeater.createElementId(elementId, itemIds[itemIndex])));
                } else if(isDynamicPanel) {
                    // Really only need to do active state probably...
                    parent = $jobj(elementId).children().children();
                } else if(isTreeNode) parent = $jobj($ax.repeater.applySuffixToElementId(elementId, '_children'));

                // Menu doesn't want all children, only tables and menus, so it must be handled specially
                var children = isMenu ? parent.children('.ax_table').add(parent.children('.ax_menu')) : parent.children();
                
                // For tree nodes you want the the button shape contained by the elementQuery too
                if(isTreeNode) {
                    var treeNodeChildren = $jobj(elementId).children();
                    for(var treeNodeIndex = 0; treeNodeIndex < treeNodeChildren.length; treeNodeIndex++) {
                        var treeNodeChild = $(treeNodeChildren[treeNodeIndex]);
                        var childObj = $obj(treeNodeChild.attr('id'));
                        if(childObj && childObj.type == 'buttonShape') children = children.add(treeNodeChild);
                    }
                }
                

                var childrenIds = [];
                for(var childIndex = 0; childIndex < children.length; childIndex++) {
                    var childObj = $(children[childIndex]);
                    var id = childObj.attr('id');
                    if(typeof(id) == 'undefined' && childObj.is('a')) id = $(childObj.children()[0]).attr('id');
                        
                    childrenIds.push(id);
                }
                
                if(deep) {
                    var childObjs = [];
                    for(var i = 0; i < childrenIds.length; i++) {
                        var childId = childrenIds[i];
                        childObjs[i] = { id: childId, children: getChildren(childId) };
                    }
                    childrenIds = childObjs;
                }
                
                return childrenIds;
            }

            return undefined;
        };

        for(var i = 0; i < elementIds.length; i++) {
            children[children.length] = { id : elementIds[i], children : getChildren(elementIds[i])};
        }
        return children;
    };

})();