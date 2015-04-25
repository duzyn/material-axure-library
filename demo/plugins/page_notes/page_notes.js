// use this to isolate the scope
(function () {

    if (!$axure.document.configuration.showPageNotes) { return; }

    $(window.document).ready(function () {
        $axure.player.createPluginHost({
            id: 'pageNotesHost',
            context: 'interface',
            title: 'Page Notes'
        });

        generatePageNotes();

        // bind to the page load
        $axure.page.bind('load.page_notes', function () {

            $('#pageNameHeader').html("");
            $('#pageNotesContent').html("");

            //populate the notes
            var notes = $axure.page.notes;
            if (notes) {
                var pageName = $axure.page.pageName;
                $('#pageNameHeader').html(pageName);
                var showNames = $axure.document.configuration.showPageNoteNames;

                for (var noteName in notes) {
                    if (showNames) {
                        $('#pageNotesContent').append("<div class='pageNoteName'>" + noteName + "</div>");
                    }
                    $('#pageNotesContent').append("<div class='pageNote'>" + notes[noteName] + "</div>");
                }
            }

            return false;
        });


    });

    function generatePageNotes() {
        var pageNotesUi = "<div id='pageNotesScrollContainer'>";
        pageNotesUi += "<div id='pageNotesContainer'>";
        pageNotesUi += "<div id='pageNameHeader'></div>";
        pageNotesUi += "<span id='pageNotesContent'></span>";
        pageNotesUi += "</div></div>";

        $('#pageNotesHost').html(pageNotesUi);
    }

})();   