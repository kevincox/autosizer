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
var doc = w.document

var e = {
	searchbox: doc.getElementById("searchbar"),
	searcharea: doc.getElementById("search-container"),
};

var autosizer = e.searchbox.autosizer;

var prefs = Cc["@mozilla.org/preferences-service;1"]
              .getService(Ci.nsIPrefService)
              .getBranch("extensions.autosizer.");

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
		
		var mode = prefs.getCharPref("sizeOn");
		
		if      ( mode == "none"  ) rbuttons.selectedIndex = 2;
		else if ( mode == "focus" ) rbuttons.selectedIndex = 1;
		else                        rbuttons.selectedIndex = 0;
		
		d("asw.initSize() returned.");
	},
	size: function ( mode )
	{
		d("asw.size() called.");
		
		prefs.setCharPref("sizeOn", mode);
		
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
		
		prefs.setIntPref("minwidth", asw.minWidthSolve())
		
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
			return 0;
		
		d("asw.minWidthSolve() returned "+w+".");
		return w;
	},
	
	minwidthSizeChange: function ( ev )
	{
		d("asw.minwidthSizeChange() called.");
		
		var l = document.getElementById("minwidthouput");
		
		var g = asw.minWidthSolve();
		
		if ( g == 0 ) g = "as large as the search engine's title.";
		else          g = g+" pixels long";
		
		d("The searchbar will be at least "+g);
		l.value = "The searchbar will be at least "+g;
		
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
		
		prefs.setIntPref("maxwidth", asw.maxWidthSolve())
		
		d("asw.endMaxWidth() returned.");
	},
	
	maxwidthSizeChange: function ( ev )
	{
		d("asw.maxwidthSizeChange() called.");
		
		var l = document.getElementById("maxwidthouput");
		
		var g = asw.maxWidthSolve();
		
		if      ( g == 0 ) g = "as large as the space available.";
		else if ( g <  0 ) g = "the maximum visible size.";
		else               g = "at most "+g+" pixels long.";
		
		d("The searchbar will be at least "+g);
		l.value = "The searchbar will be at least "+g;
		
		window.focus(); // So that they can see our dialog.
		
		d("asw.maxwidthSizeChange() returned.");
	},
	
	maxWidthSolve: function ( )
	{
		d("asw.maxWidthSolve() returned.");
		
		var w = e.searcharea.width;
		
		if ( Math.abs(w-autosizer.getAllAvailableWidth()) < 100 )
			w = -1;
		else if ( Math.abs(w-autosizer.getAvailableWidth()) < 100 )
			w = 0;
		
		return w;
		
		d("asw.maxWidthSolve() returned "+w+".");
	},

	/*** Third Page - Maximum width ***/
	initAfterSearch: function ( mode )
	{
		d("asw.initAfterSearch() called.");
		
		document.getElementById("cleanOnSubmit").checked = prefs.getBoolPref("cleanOnSubmit");
		document.getElementById("revertOnSubmit").checked = prefs.getBoolPref("revertOnSubmit");
		document.getElementById("shrinkToButton").checked = prefs.getBoolPref("shrinkToButton");
		
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
