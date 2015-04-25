// use this to isolate the scope
(function() {

    var SHOW_HIDE_ANIMATION_DURATION = 0;

    var HIGHLIGHT_INTERACTIVE_VAR_NAME = 'hi';
    var FOOTNOTES_VAR_NAME = 'fn';
    var SITEMAP_COLLAPSE_VAR_NAME = 'c';
    var ADAPTIVE_VIEW_VAR_NAME = 'view';

    var currentPageLoc = '';
    var currentPlayerLoc = '';
    var currentPageHashString = '';

    $(window.document).ready(function() {
        $axure.player.createPluginHost({
            id: 'sitemapHost',
            context: 'interface',
            title: 'Sitemap'
        });

        generateSitemap();

        $('.sitemapPlusMinusLink').toggle(collapse_click, expand_click);
        $('.sitemapPageLink').click(node_click);

        $('#sitemapLinksAndOptionsContainer').hide();
        $('#searchDiv').hide();
        $('#linksButton').click(links_click);
        $('#adaptiveButton').click(adaptive_click);
        $('#footnotesButton').click(footnotes_click).addClass('sitemapToolbarButtonSelected');
        $('#highlightInteractiveButton').click(highlight_interactive);
        $('#variablesButton').click(showvars_click);
        $('#variablesClearLink').click(clearvars_click);
        $('#searchButton').click(search_click);
        $('#searchBox').keyup(search_input_keyup);
        $('.sitemapLinkField').click(function() { this.select(); });
        $('input[value="withoutmap"]').click(withoutSitemapRadio_click);
        $('input[value="withmap"]').click(withSitemapRadio_click);
        $('#minimizeBox, #footnotesBox, #highlightBox').change(sitemapUrlOptions_change);
        $('#viewSelect').change(sitemapUrlViewSelect_change);

        //        $('#sitemapHost').parent().resize(function () {
        //            $('#sitemapHost').height($(this).height());
        //        });

        // bind to the page load
        $axure.page.bind('load.sitemap', function() {
            currentPageLoc = $axure.page.location.split("#")[0];
            var decodedPageLoc = decodeURI(currentPageLoc);
            var nodeUrl = decodedPageLoc.substr(decodedPageLoc.lastIndexOf('/') ? decodedPageLoc.lastIndexOf('/') + 1 : 0);
            currentPlayerLoc = $(location).attr('href').split("#")[0].split("?")[0];
            currentPageHashString = '#p=' + nodeUrl.substr(0, nodeUrl.lastIndexOf('.'));

            setVarInCurrentUrlHash('p', nodeUrl.substring(0, nodeUrl.lastIndexOf('.html')));

            $('.sitemapPageLink').parent().parent().removeClass('sitemapHighlight');
            $('.sitemapPageLink[nodeUrl="' + nodeUrl + '"]').parent().parent().addClass('sitemapHighlight');

            $('#sitemapLinksPageName').html($('.sitemapHighlight > .sitemapPageLinkContainer > .sitemapPageLink > .sitemapPageName').html());

            //Click the "With sitemap" radio button so that it's selected by default
            $('input[value="withmap"]').click();

            //Update variable div with latest global variable values after page has loaded
            $axure.messageCenter.postMessage('getGlobalVariables', '');

            //If footnotes enabled for this prototype...
            if($axure.document.configuration.showAnnotations == true) {
                //If the fn var is defined and set to 0, hide footnotes
                //else if hide-footnotes button selected, hide them
                var fnVal = getHashStringVar(FOOTNOTES_VAR_NAME);
                if(fnVal.length > 0 && fnVal == 0) {
                    $('#footnotesButton').removeClass('sitemapToolbarButtonSelected');
                    $axure.messageCenter.postMessage('annotationToggle', false);
                } else if(!$('#footnotesButton').is('.sitemapToolbarButtonSelected')) {
                    //If the footnotes button isn't selected, hide them on this loaded page
                    $axure.messageCenter.postMessage('annotationToggle', false);
                }
            }

            //If highlight var is present and set to 1 or else if
            //sitemap highlight button is selected then highlight interactive elements
            var hiVal = getHashStringVar(HIGHLIGHT_INTERACTIVE_VAR_NAME);
            if(hiVal.length > 0 && hiVal == 1) {
                $('#highlightInteractiveButton').addClass('sitemapToolbarButtonSelected');
                $axure.messageCenter.postMessage('highlightInteractive', true);
            } else if($('#highlightInteractiveButton').is('.sitemapToolbarButtonSelected')) {
                $axure.messageCenter.postMessage('highlightInteractive', true);
            }

            //Set the current view if it is defined in the hash string
            //If the view is invalid, set it to 'auto' in the string
            //ELSE set the view based on the currently selected view in the toolbar menu
            var viewStr = getHashStringVar(ADAPTIVE_VIEW_VAR_NAME);
            if(viewStr.length > 0) {
                var $view = $('.adaptiveViewOption[val="' + viewStr + '"]');
                if($view.length > 0) $view.click();
                else $('.adaptiveViewOption[val="auto"]').click();
            } else if($('.checkedAdaptive').length > 0) {
                var $viewOption = $('.checkedAdaptive').parents('.adaptiveViewOption');
                if($viewOption.attr('val') != 'auto') $viewOption.click();
            }

            $axure.messageCenter.postMessage('finishInit');

            return false;
        });

        var $adaptiveViewsContainer = $('#adaptiveViewsContainer');
        var $viewSelect = $('#viewSelect');

        //Fill out adaptive view container with prototype's defined adaptive views, as well as the default, and Auto
        $adaptiveViewsContainer.append('<div class="adaptiveViewOption" val="auto"><div class="adaptiveCheckboxDiv checkedAdaptive"></div>Auto</div>');
        $viewSelect.append('<option value="auto">Auto</option>');
        if(typeof $axure.document.defaultAdaptiveView.name != 'undefined') {
            //If the name is a blank string, make the view name the width if non-zero, else 'any'
            var defaultViewName = $axure.document.defaultAdaptiveView.name;
            if(defaultViewName == '') {
                defaultViewName = $axure.document.defaultAdaptiveView.size.width != 0 ? $axure.document.defaultAdaptiveView.size.width : 'Base';
            }

            $adaptiveViewsContainer.append('<div class="adaptiveViewOption currentAdaptiveView" val="default"><div class="adaptiveCheckboxDiv"></div>' + defaultViewName + '</div>');
            $viewSelect.append('<option value="default">' + defaultViewName + '</option>');
        }

        var enabledViewIds = $axure.document.configuration.enabledViewIds;
        for(var viewIndex = 0; viewIndex < $axure.document.adaptiveViews.length; viewIndex++) {
            var currView = $axure.document.adaptiveViews[viewIndex];
            if(enabledViewIds.indexOf(currView.id) < 0) continue;

            var widthString = currView.size.width == 0 ? 'any' : currView.size.width;
            var heightString = currView.size.height == 0 ? 'any' : currView.size.height;
            var conditionString = '';
            if(currView.condition == '>' || currView.condition == '>=') {
                conditionString = ' and above';
            } else if(currView.condition == '<' || currView.condition == '<=') {
                conditionString = ' and below';
            }

            var viewString = currView.name + ' (' + widthString + ' x ' + heightString + conditionString + ')';
            $adaptiveViewsContainer.append('<div class="adaptiveViewOption" val="' + currView.id + '"><div class="adaptiveCheckboxDiv"></div>' + viewString + '</div>');
            $viewSelect.append('<option value="' + currView.id + '">' + viewString + '</option>');
        }

        $('.adaptiveViewOption').click(adaptiveViewOption_click);

        $('#leftPanel').mouseup(function() {
            $('.sitemapPopupContainer').hide();
            $('#variablesButton').removeClass('sitemapToolbarButtonSelected');
            $('#adaptiveButton').removeClass('sitemapToolbarButtonSelected');
            $('#linksButton').removeClass('sitemapToolbarButtonSelected');
        });

        $('#variablesContainer,#sitemapLinksContainer').mouseup(function(event) {
            event.stopPropagation();
        });
        $('#variablesButton').mouseup(function(event) {
            hideAllContainersExcept(2);
            event.stopPropagation();
        });
        $('#adaptiveButton').mouseup(function(event) {
            hideAllContainersExcept(1);
            event.stopPropagation();
        });
        $('.adaptiveViewOption').mouseup(function(event) {
            event.stopPropagation();
        });
        $('#linksButton').mouseup(function(event) {
            hideAllContainersExcept(3);
            event.stopPropagation();
        });

        $('#searchBox').focusin(function() {
            if($(this).is('.searchBoxHint')) {
                $(this).val('');
                $(this).removeClass('searchBoxHint');
            }
        }).focusout(function() {
            if($(this).val() == '') {
                $(this).addClass('searchBoxHint');
                $(this).val('Search');
            }
        });

        var $varContainer = $('#variablesContainer');
        $(window).resize(function() {
            if($varContainer.is(":visible")) {
                var newHeight = $(this).height() - 120;
                if(newHeight < 100) newHeight = 100;
                $varContainer.css('max-height', newHeight);
            }
        });
    });

    function hideAllContainersExcept(exceptContainer) {
        //1 - adaptive container, 2 - vars container, 3 - links container
        if(exceptContainer != 1) {
            $('#adaptiveViewsContainer').hide();
            $('#adaptiveButton').removeClass('sitemapToolbarButtonSelected');
        }
        if(exceptContainer != 2) {
            $('#variablesContainer').hide();
            $('#variablesButton').removeClass('sitemapToolbarButtonSelected');
        }
        if(exceptContainer != 3) {
            $('#sitemapLinksContainer').hide();
            $('#linksButton').removeClass('sitemapToolbarButtonSelected');
        }
    }

    function collapse_click(event) {
        $(this)
            .children('.sitemapMinus').removeClass('sitemapMinus').addClass('sitemapPlus').end()
            .closest('li').children('ul').hide(SHOW_HIDE_ANIMATION_DURATION);

        $(this).next('.sitemapFolderOpenIcon').removeClass('sitemapFolderOpenIcon').addClass('sitemapFolderIcon');
    }

    function expand_click(event) {
        $(this)
            .children('.sitemapPlus').removeClass('sitemapPlus').addClass('sitemapMinus').end()
            .closest('li').children('ul').show(SHOW_HIDE_ANIMATION_DURATION);

        $(this).next('.sitemapFolderIcon').removeClass('sitemapFolderIcon').addClass('sitemapFolderOpenIcon');
    }

    function node_click(event) {
        $axure.page.navigate(this.getAttribute('nodeUrl'), true);
    }

    function links_click(event) {
        $('#sitemapLinksContainer').toggle();
        if($('#sitemapLinksContainer').is(":visible")) {

            $('#linksButton').addClass('sitemapToolbarButtonSelected');

            var linksButtonBottom = $('#linksButton').position().top + $('#linksButton').height();
            $('#sitemapLinksContainer').css('top', linksButtonBottom + 'px');
        } else {
            $('#linksButton').removeClass('sitemapToolbarButtonSelected');
        }
    }

    $axure.messageCenter.addMessageListener(function(message, data) {
        if(message == 'globalVariableValues') {
            //If variables container isn't visible, then ignore
            if(!$('#variablesContainer').is(":visible")) {
                return;
            }

            $('#variablesDiv').empty();
            for(var key in data) {
                var value = data[key] == '' ? '(blank)' : data[key];
                $('#variablesDiv').append('<div class="variableDiv"><span class="variableName">' + key + '</span><br/>' + value + '</div>');
            }
        } else if(message == 'adaptiveViewChange') {
            $('.adaptiveViewOption').removeClass('currentAdaptiveView');
            if(data) $('div[val="' + data + '"]').addClass('currentAdaptiveView');
            else $('div[val="default"]').addClass('currentAdaptiveView');
        }
    });

    function showvars_click(event) {
        $('#variablesContainer').toggle();
        if(!$('#variablesContainer').is(":visible")) {
            $('#variablesButton').removeClass('sitemapToolbarButtonSelected');
        } else {
            $(window).resize();
            $('#variablesButton').addClass('sitemapToolbarButtonSelected');

            var variablesButtonBottom = $('#variablesButton').position().top + $('#variablesButton').height();
            $('#variablesContainer').css('top', variablesButtonBottom + 'px');
            $('#variablesContainer').css('left', '30px');
            $('#variablesContainer').css('right', '30px');

            $axure.messageCenter.postMessage('getGlobalVariables', '');
        }
    }

    function clearvars_click(event) {
        $axure.messageCenter.postMessage('resetGlobalVariables', '');
    }

    function footnotes_click(event) {
        if($('#footnotesButton').is('.sitemapToolbarButtonSelected')) {
            $('#footnotesButton').removeClass('sitemapToolbarButtonSelected');
            $axure.messageCenter.postMessage('annotationToggle', false);
            //Add 'fn' hash string var so that footnotes stay hidden across reloads
            setVarInCurrentUrlHash(FOOTNOTES_VAR_NAME, 0);
        } else {
            $('#footnotesButton').addClass('sitemapToolbarButtonSelected');
            $axure.messageCenter.postMessage('annotationToggle', true);
            //Delete 'fn' hash string var if it exists since default is visible
            deleteVarFromCurrentUrlHash(FOOTNOTES_VAR_NAME);
        }
    }

    function highlight_interactive(event) {
        if($('#highlightInteractiveButton').is('.sitemapToolbarButtonSelected')) {
            $('#highlightInteractiveButton').removeClass('sitemapToolbarButtonSelected');
            $axure.messageCenter.postMessage('highlightInteractive', false);
            //Delete 'hi' hash string var if it exists since default is unselected
            deleteVarFromCurrentUrlHash(HIGHLIGHT_INTERACTIVE_VAR_NAME);
        } else {
            $('#highlightInteractiveButton').addClass('sitemapToolbarButtonSelected');
            $axure.messageCenter.postMessage('highlightInteractive', true);
            //Add 'hi' hash string var so that stay highlighted across reloads
            setVarInCurrentUrlHash(HIGHLIGHT_INTERACTIVE_VAR_NAME, 1);
        }
    }

    function adaptive_click(event) {
        $('#adaptiveViewsContainer').toggle();
        if(!$('#adaptiveViewsContainer').is(":visible")) {
            $('#adaptiveButton').removeClass('sitemapToolbarButtonSelected');
        } else {
            $('#adaptiveButton').addClass('sitemapToolbarButtonSelected');

            var adaptiveButtonBottom = $('#adaptiveButton').position().top + $('#adaptiveButton').height();
            $('#adaptiveViewsContainer').css('top', adaptiveButtonBottom + 'px');
            $('#adaptiveViewsContainer').css('left', $('#adaptiveButton').position().left);
        }
    }

    function adaptiveViewOption_click(event) {
        var currVal = $(this).attr('val');

        $('.checkedAdaptive').removeClass('checkedAdaptive');
        $(this).find('.adaptiveCheckboxDiv').addClass('checkedAdaptive');

        currentPageLoc = $axure.page.location.split("#")[0];
        var decodedPageLoc = decodeURI(currentPageLoc);
        var nodeUrl = decodedPageLoc.substr(decodedPageLoc.lastIndexOf('/') ? decodedPageLoc.lastIndexOf('/') + 1 : 0);
        var adaptiveData = {
            src: nodeUrl
        };

        adaptiveData.view = currVal;
        $axure.messageCenter.postMessage('switchAdaptiveView', adaptiveData);

        if(currVal == 'auto') {
            //Remove view in hash string if one is set
            deleteVarFromCurrentUrlHash(ADAPTIVE_VIEW_VAR_NAME);
        } else {
            //Set current view in hash string so that it can be maintained across reloads
            setVarInCurrentUrlHash(ADAPTIVE_VIEW_VAR_NAME, currVal);
        }
    }

    function search_click(event) {
        $('#searchDiv').toggle();
        if(!$('#searchDiv').is(":visible")) {
            $('#searchButton').removeClass('sitemapToolbarButtonSelected');
            $('#searchBox').val('');
            $('#searchBox').keyup();
            $('#sitemapToolbar').css('height', '22px');
            $('#sitemapTreeContainer').css('top', '31px');
        } else {
            $('#searchButton').addClass('sitemapToolbarButtonSelected');
            $('#searchBox').focus();
            $('#sitemapToolbar').css('height', '50px');
            $('#sitemapTreeContainer').css('top', '63px');
        }
    }

    function search_input_keyup(event) {
        var searchVal = $(this).val().toLowerCase();
        //If empty search field, show all nodes, else grey+hide all nodes and
        //ungrey+unhide all matching nodes, as well as unhide their parent nodes
        if(searchVal == '') {
            $('.sitemapPageName').removeClass('sitemapGreyedName');
            $('.sitemapNode').show();
        } else {
            $('.sitemapNode').hide();

            $('.sitemapPageName').addClass('sitemapGreyedName').each(function() {
                var nodeName = $(this).text().toLowerCase();
                if(nodeName.indexOf(searchVal) != -1) {
                    $(this).removeClass('sitemapGreyedName').parents('.sitemapNode:first').show().parents('.sitemapExpandableNode').show();
                }
            });
        }
    }

    function withoutSitemapRadio_click() {
        $('#sitemapLinkWithPlayer').val(currentPageLoc);
        $('#minimizeBox').attr('disabled', 'disabled');
        $('#footnotesBox').attr('disabled', 'disabled');
        $('#highlightBox').attr('disabled', 'disabled');
        $('#viewSelect').attr('disabled', 'disabled');
    }

    function withSitemapRadio_click() {
        $('#sitemapLinkWithPlayer').val(currentPlayerLoc + currentPageHashString);
        $('#minimizeBox').removeAttr('disabled').change();
        $('#footnotesBox').removeAttr('disabled').change();
        $('#highlightBox').removeAttr('disabled').change();
        $('#viewSelect').removeAttr('disabled').change();
    }

    function sitemapUrlOptions_change() {
        var currLinkHash = '#' + $('#sitemapLinkWithPlayer').val().split("#")[1];
        var newHash = null;
        var varName = '';
        var defVal = 1;
        if($(this).is('#minimizeBox')) {
            varName = SITEMAP_COLLAPSE_VAR_NAME;
        } else if($(this).is('#footnotesBox')) {
            varName = FOOTNOTES_VAR_NAME;
            defVal = 0;
        } else if($(this).is('#highlightBox')) {
            varName = HIGHLIGHT_INTERACTIVE_VAR_NAME;
        }

        newHash = $(this).is(':checked') ? setHashStringVar(currLinkHash, varName, defVal) : deleteHashStringVar(currLinkHash, varName);

        if(newHash != null) {
            $('#sitemapLinkWithPlayer').val(currentPlayerLoc + newHash);
        }
    }

    function sitemapUrlViewSelect_change() {
        var currLinkHash = '#' + $('#sitemapLinkWithPlayer').val().split("#")[1];
        var newHash = null;
        var $selectedOption = $(this).find('option:selected');
        if($selectedOption.length == 0) return;
        var selectedVal = $selectedOption.attr('value');

        newHash = selectedVal == 'auto' ? deleteHashStringVar(currLinkHash, ADAPTIVE_VIEW_VAR_NAME) : setHashStringVar(currLinkHash, ADAPTIVE_VIEW_VAR_NAME, selectedVal);

        if(newHash != null) {
            $('#sitemapLinkWithPlayer').val(currentPlayerLoc + newHash);
        }
    }

    function generateSitemap() {
        var treeUl = "<div id='sitemapToolbar'>";

        treeUl += "<div style='height:30px;'>";

        if($axure.document.configuration.enabledViewIds.length > 0) {
            treeUl += "<a id='adaptiveButton' title='Select Adaptive View' class='sitemapToolbarButton'></a>";
        }

        if($axure.document.configuration.showAnnotations == true) {
            treeUl += "<a id='footnotesButton' title='Toggle Footnotes' class='sitemapToolbarButton'></a>";
        }

        treeUl += "<a id='highlightInteractiveButton' title='Highlight interactive elements' class='sitemapToolbarButton'></a>";
        treeUl += "<a id='variablesButton' title='View Variables' class='sitemapToolbarButton'></a>";
        treeUl += "<a id='linksButton' title='Get Links' class='sitemapToolbarButton'></a>";
        treeUl += "<a id='searchButton' title='Search Pages' class='sitemapToolbarButton'></a>";
        treeUl += "</div>";

        treeUl += '<div id="searchDiv" style="width:98%; clear:both;"><input id="searchBox" style="width: 100%;" type="text"/></div>';

        treeUl += "<div id='sitemapLinksContainer' class='sitemapPopupContainer'><span id='sitemapLinksPageName'>Page Name</span>";
        treeUl += "<div class='sitemapLinkContainer'><input id='sitemapLinkWithPlayer' type='text' class='sitemapLinkField'/></div>";
        treeUl += "<div class='sitemapOptionContainer'>";
        treeUl += "<div><label><input type='radio' name='sitemapToggle' value='withoutmap'/>without sitemap</label></div>";
        treeUl += "<div><label><input type='radio' name='sitemapToggle' value='withmap'/>with sitemap</label>";

        treeUl += "<div id='sitemapOptionsDiv'>";
        treeUl += "<div class='sitemapUrlOption'><label><input type='checkbox' id='minimizeBox' />minimize sitemap</label></div>";
        if($axure.document.configuration.showAnnotations == true) {
            treeUl += "<div class='sitemapUrlOption'><label><input type='checkbox' id='footnotesBox' />hide footnotes</label></div>";
        }

        treeUl += "<div class='sitemapUrlOption'><label><input type='checkbox' id='highlightBox' />highlight interactive elements</label></div>";

        if($axure.document.configuration.enabledViewIds.length > 0) {
            treeUl += "<div id='viewSelectDiv' class='sitemapUrlOption'><label>View: <select id='viewSelect'></select></label></div>";
        }

        treeUl += "</div></div></div></div>";

        treeUl += "<div id='variablesContainer' class='sitemapPopupContainer'><a id='variablesClearLink'>Reset Variables</a><br/><br/><div id='variablesDiv'></div></div>";

        if($axure.document.adaptiveViews.length > 0) {
            treeUl += "<div id='adaptiveViewsContainer' class='sitemapPopupContainer'></div>";
        }
        treeUl += "</div>";

        treeUl += "<div id='sitemapTreeContainer'>";

        treeUl += "<ul class='sitemapTree' style='clear:both;'>";
        var rootNodes = $axure.document.sitemap.rootNodes;
        for(var i = 0; i < rootNodes.length; i++) {
            treeUl += generateNode(rootNodes[i], 0);
        }
        treeUl += "</ul></div>";

        $('#sitemapHost').html(treeUl);
    }

    function generateNode(node, level) {
        var hasChildren = (node.children && node.children.length > 0);
        if(hasChildren) {
            var returnVal = "<li class='sitemapNode sitemapExpandableNode'><div><div class='sitemapPageLinkContainer' style='margin-left:" + (15 + level * 17) + "px'><a class='sitemapPlusMinusLink'><span class='sitemapMinus'></span></a>";
        } else {
            var returnVal = "<li class='sitemapNode sitemapLeafNode'><div><div class='sitemapPageLinkContainer' style='margin-left:" + (27 + level * 17) + "px'>";
        }

        var isFolder = node.type == "Folder";
        if(!isFolder) returnVal += "<a class='sitemapPageLink' nodeUrl='" + node.url + "'>";
        returnVal += "<span class='sitemapPageIcon";
        if(node.type == "Flow") { returnVal += " sitemapFlowIcon"; }
        if(isFolder) {
            if(hasChildren) returnVal += " sitemapFolderOpenIcon";
            else returnVal += " sitemapFolderIcon";
        }

        returnVal += "'></span><span class='sitemapPageName'>";
        returnVal += $('<div/>').text(node.pageName).html();
        returnVal += "</span>";
        if(!isFolder) returnVal += "</a>";
        returnVal += "</div></div>";

        if(hasChildren) {
            returnVal += "<ul>";
            for(var i = 0; i < node.children.length; i++) {
                var child = node.children[i];
                returnVal += generateNode(child, level + 1);
            }
            returnVal += "</ul>";
        }
        returnVal += "</li>";
        return returnVal;
    }

    function getHashStringVar(query) {
        var qstring = window.location.href.split("#");
        if(qstring.length < 2) return "";

        var prms = qstring[1].split("&");
        var frmelements = new Array();
        var currprmeter, querystr = "";

        for(var i = 0; i < prms.length; i++) {
            currprmeter = prms[i].split("=");
            frmelements[i] = new Array();
            frmelements[i][0] = currprmeter[0];
            frmelements[i][1] = currprmeter[1];
        }

        for(var j = 0; j < frmelements.length; j++) {
            if(frmelements[j][0] == query) {
                querystr = frmelements[j][1];
                break;
            }
        }
        return querystr;
    }

    function replaceHash(newHash) {
        var currentLocWithoutHash = window.location.toString().split('#')[0];

        //We use replace so that every hash change doesn't get appended to the history stack.
        //We use replaceState in browsers that support it, else replace the location
        if(typeof window.history.replaceState != 'undefined') {
            window.history.replaceState(null, null, currentLocWithoutHash + newHash);
        } else {
            window.location.replace(currentLocWithoutHash + newHash);
        }
    }

    function setHashStringVar(currentHash, varName, varVal) {
        var varWithEqual = varName + '=';
        var hashToSet = '';

        var pageIndex = currentHash.indexOf('#' + varWithEqual);
        if(pageIndex == -1) pageIndex = currentHash.indexOf('&' + varWithEqual);
        if(pageIndex != -1) {
            var newHash = currentHash.substring(0, pageIndex);

            newHash = newHash == '' ? '#' + varWithEqual + varVal : newHash + '&' + varWithEqual + varVal;

            var ampIndex = currentHash.indexOf('&', pageIndex + 1);
            if(ampIndex != -1) {
                newHash = newHash + currentHash.substring(ampIndex);
            }
            hashToSet = newHash;
        } else if(currentHash.indexOf('#') != -1) {
            hashToSet = currentHash + '&' + varWithEqual + varVal;
        } else {
            hashToSet = '#' + varWithEqual + varVal;
        }

        if(hashToSet != '') {
            return hashToSet;
        }

        return null;
    }

    function setVarInCurrentUrlHash(varName, varVal) {
        var newHash = setHashStringVar(window.location.hash, varName, varVal);

        if(newHash != null) {
            replaceHash(newHash);
        }
    }

    function deleteHashStringVar(currentHash, varName) {
        var varWithEqual = varName + '=';

        var pageIndex = currentHash.indexOf('#' + varWithEqual);
        if(pageIndex == -1) pageIndex = currentHash.indexOf('&' + varWithEqual);
        if(pageIndex != -1) {
            var newHash = currentHash.substring(0, pageIndex);

            var ampIndex = currentHash.indexOf('&', pageIndex + 1);

            //IF begin of string....if none blank, ELSE # instead of & and rest
            //IF in string....prefix + if none blank, ELSE &-rest
            if(newHash == '') { //beginning of string
                newHash = ampIndex != -1 ? '#' + currentHash.substring(ampIndex + 1) : '';
            } else { //somewhere in the middle
                newHash = newHash + (ampIndex != -1 ? currentHash.substring(ampIndex) : '');
            }

            return newHash;
        }

        return null;
    }

    function deleteVarFromCurrentUrlHash(varName) {
        var newHash = deleteHashStringVar(window.location.hash, varName);

        if(newHash != null) {
            replaceHash(newHash);
        }
    }
})();
