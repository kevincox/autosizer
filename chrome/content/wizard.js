var Ci = Components.interfaces;
var Cc = Components.classes;

function d ( msg, seroius )
{
	seroius = true // For debugging.
	if (!seroius) return;

	dump('autosizer: '+msg+'\n');
	Components.classes["@mozilla.org/consoleservice;1"]
		.getService(Components.interfaces.nsIConsoleService)
		.logStringMessage('autosizer: '+msg);
}

var w = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                  .getService(Components.interfaces.nsIWindowMediator)
                  .getMostRecentWindow("navigator:browser");

if (!w.document.getElementById("searchbar"))
{
	var wi = Components.classes["@mozilla.org/appshell/window-mediator;1"]
	                   .getService(Components.interfaces.nsIWindowMediator)
	                   .getEnumerator("navigator:browser");

	while (wi.hasMoreElements())
	{
		w = wi.getNext()
		var sb = w.document.getElementById("searchbar");
		if (sb)
		{
			break;
		}
	}
}
var doc = w.document

var e = {
	searchbox: doc.getElementById("searchbar"),
	searcharea: doc.getElementById("search-container"),
};
if ((!e.searchbox) || (!e.searcharea))
{
	alert("Error, no searchbar found.");
	window.close();
}

var autosizer = e.searchbox.autosizer;
var strings   = autosizer.strings;
var pref      = autosizer.pref;
var prefs     = autosizer.prefs;

var asw = {
	init: function ( ) {
		d("asw.init() called.");

		d("asw.init() returned.");
	},

	end: function ( ) {
		autosizer.autosize();
	},

	/*** First Page - When to size ***/
	initSize: function()
	{
		d("asw.initSize() called.");

		var rbuttons = document.getElementById("sizemode");

		var mode = pref.sizeOn;

		if      ( mode == "none"   ) rbuttons.selectedIndex = 2;
		else if ( mode == "atonce" ) rbuttons.selectedIndex = 1;
		else                         rbuttons.selectedIndex = 0;

		d("asw.initSize() returned.");
	},
	size: function ( mode )
	{
		d("asw.size() called.");

		pref.sizeOn = mode;

		d("asw.size() returned.");
	},

	/*** Seccond Page - Minimum width ***/
	initMinWidth: function ( mode )
	{
		d("asw.initMinWidth() called.");

		e.searchbox.addEventListener("autosizer-manualresize", this.minwidthSizeChange, true);
		autosizer.startManualResize();

		d("asw.initMinWidth() returned.");
	},
	endMinWidth: function ( mode )
	{
		d("asw.initMinWidth() called.");

		autosizer.stopManualResize();
		e.searchbox.removeEventListener("autosizer-manualresize", this.minwidthSizeChange, true);

		prefs.setIntPref("minwidth", asw.minWidthSolve());

		d("asw.initMinWidth() returned.");
	},

	minWidthSolve: function ( )
	{
		d("asw.minWidthSolve() called.");

		var w = e.searcharea.width;

		var v = e.searchbox.value;
		e.searchbox.value = '';

		var smallSize = autosizer.getRequiredWidth();

		e.searchbox.value = v;

		if ( Math.abs(w-smallSize) < 50 )
			w = -1;

		d("asw.minWidthSolve() returned "+w+".");
		return w;
	},

	minwidthSizeChange: function ( ev )
	{
		d("asw.minwidthSizeChange() called.");

		var l = document.getElementById("minwidthouput");

		var g = asw.minWidthSolve();

		if ( g == -1 ) g = strings.get("minWidthTitle");
		else           g = strings.getf("minWidthPx", [g]);

		l.value = g;

		window.focus(); // So that they can see our dialog.

		d("asw.minwidthSizeChange() returned.");
	},

	/*** Third Page - Maximum width ***/
	initMaxWidth: function ( mode )
	{
		d("asw.initMaxWidth() called.");

		e.searchbox.addEventListener("autosizer-manualresize", this.maxwidthSizeChange, true);
		autosizer.startManualResize();

		d("asw.initMaxWidth() returned.");
	},
	endMaxWidth: function ( mode )
	{
		d("asw.endMaxWidth() called.");

		autosizer.stopManualResize();
		e.searchbox.removeEventListener("autosizer-manualresize", this.maxwidthSizeChange, true);

		prefs.setIntPref("maxwidth", asw.maxWidthSolve());

		d("asw.endMaxWidth() returned.");
	},

	maxwidthSizeChange: function ( ev )
	{
		d("asw.maxwidthSizeChange() called.");

		var l = document.getElementById("maxwidthouput");

		var g = asw.maxWidthSolve();
		d(g)

		if      ( g == 0 ) g = strings.get("maxWidthFull");
		else if ( g <  0 ) g = strings.get("maxWidthMax");
		else               g = strings.getf("maxWidthPx", [g]);

		l.value = g;

		window.focus(); // So that they can see our dialog.

		d("asw.maxwidthSizeChange() returned.");
	},

	maxWidthSolve: function ( )
	{
		d("asw.maxWidthSolve() called.");

		var w = e.searcharea.width;

		if ( Math.abs(w-autosizer.getAllAvailableWidth()) < 100 )
			w = -1;
		else if ( Math.abs(w-autosizer.getAvailableWidth()) < 100 )
			w = 0;

		d("asw.maxWidthSolve() returned "+w+".");
		return w;
	},

	/*** Fourth Page - Settings ***/
	initAfterSearch: function ( mode )
	{
		d("asw.initAfterSearch() called.");

		document.getElementById("cleanOnSubmit").checked = pref.cleanOnSubmit;
		document.getElementById("revertOnSubmit").checked = pref.revertOnSubmit;
		document.getElementById("shrinkToButton").checked = pref.shrinkToButton;

		d("asw.initAfterSearch() returned.");
	},

	cleanOnSubmitChange: function ( )
	{
		d("asw.cleanOnSubmitChange() called.");

		prefs.setBoolPref("cleanOnSubmit", document.getElementById("cleanOnSubmit").checked);

		d("asw.cleanOnSubmitChange() returned.");
	},
	revertOnSubmitChange: function ( )
	{
		d("asw.revertOnSubmitChange() called.");

		prefs.setBoolPref("revertOnSubmit", document.getElementById("revertOnSubmit").checked);

		d("asw.revertOnSubmitChange() returned.");
	},
	shrinkToButtonChange: function ( )
	{
		d("asw.shrinkToButtonChange() called.");

		prefs.setBoolPref("shrinkToButton", document.getElementById("shrinkToButton").checked);

		d("asw.shrinkToButtonChange() returned.");
	},


}
