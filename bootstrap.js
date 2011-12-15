Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");

Ci = Components.interfaces;

function d ( msg, important )
{
	important = true; // Uncomment for debuging.
	
	if (!important) return;

	dump('autosizer: '+msg+'\n');
	Components.classes["@mozilla.org/consoleservice;1"]
		.getService(Components.interfaces.nsIConsoleService)
		.logStringMessage('autosizer: '+msg);
}

d("bootstrap.js loaded.");

constants = {
	prefBranch: "extensions.autosizer.",
}

/*** Our "Class" ***/
function Autosizer ( window )
{
	d("new Autosizer() called.");
	
	var self = this;
	
	var document = window.document;
	this.window = window;
	this.document = document;

	var prefs = Services.prefs.getBranch(constants.prefBranch);
	this.prefs = prefs;
	
	var e = { // Element refrences
		searchbox: document.getElementById("searchbar"),
		searcharea: document.getElementById("search-container"),
		
		input: null,
		
		label: null,
		labelItem: null,
	};
	
	/*** Initialization and Shutdown ***/
	function init ( ) {
		d("init() called.");
		
		addAfterSubmitCheck();
		addMeasuringLabel();
		
		e.searchbox.addEventListener("input", inputReciever, true);
		e.searcharea.flex = 0; // Go to _exactly_ the size I tell you
		                       // to be.
		
		e.input = e.searchbox._textbox.inputField;
		
		e.searchbox.autosizer = self; // Just incase other addons want
		                              // to get a hold of us.
		
		window.setTimeout(autosize(), 0);
		
		d("init() returning.");
	}

	this.shutdown = function ( ) {
		d(".shutdown() called.");
		
		e.searchbox.removeEventListener("input", inputReciever, true);
		
		removeSubmitBlock();
		removeMeasuringLabel();
		
		d(".shutdown() returning.");
	};

	var origSearchHandler = null;
	var ourSearchHandler  = {handler: null}; // Refrence.
	var searchHandlerWrapper = null;
	function addAfterSubmitCheck () {
		d("addAfterSubmitCheck() called.")
		
		if (origSearchHandler) return; // We already did this.

		origSearchHandler = e.searchbox.handleSearchCommand;

		if (!ourSearchHandler.handler)
		{
			ourSearchHandler.handler = function ( )
			{
				origSearchHandler.apply(this, arguments);
				
				afterSubmit();
			};
		}

		if (!searchHandlerWrapper)
		{
			searchHandlerWrapper = function ()
			{
				ourSearchHandler.handler.apply(this, arguments);
			};
		}

		e.searchbox.handleSearchCommand = searchHandlerWrapper;
		
		d("addAfterSubmitCheck() returning.")
	}
	
	function removeSubmitBlock ( )
	{
		d("removeSubmitBlock() called.")
		
		if (!origSearchHandler) return; // We haven't blocked it.

		if ( searchHandlerWrapper === e.searchbox.handleSearchCommand ) // Nobody modified it after us.
		{
			e.searchbox.handleSearchCommand = origSearchHandler;
		}
		else // We have to descretly remove our functionality
		{
			ourSearchHandler.handler = function ( ) { // Change our function to remove our check.
				origSearchHandler.apply(this, arguments);
			};
		}
		
		d("removeSubmitBlock() returning.")
	}
	
	function addMeasuringLabel ( )
	{
		d("removeSremoveLabelubmitBlock() called.")
		
		e.labelItem = document.createElement("toolbaritem")
		e.labelItem.setAttribute("style","width:0px;height:0px;overflow:hidden;");
		
		document.getElementById("search-container").appendChild(e.labelItem);
		
		e.label = document.createElement("label");
		e.labelItem.appendChild(e.label);
		
		d("removeLabel() returning.")
	}
	
	function removeMeasuringLabel ( )
	{
		d("removeMeasuringLabel() called.")
		
		if (!e.labelItem) return;
		
		document.getElementById("search-container").removeChild(e.labelItem);
		
		d("removeMeasuringLabel() returning.")
	}
	
	/*** Information Functions ***/
	
	function getRequiredWidth ( ) // Returns the length of the searchbox's
	{                            // content in pixels
		d("getRequiredWidth() called.");
		
		var tc = e.searchbox.value+'W' || e.searchbox.currentEngine.name;
		// The 'W' is to/ prepare for the next letter.

		var w = getOverheadWidth();
		w += measureText(tc); 
		
		var minwidth = prefs.getIntPref("minwidth");
		var maxwidth = prefs.getIntPref("maxwidth");
		
		if     ( maxwidth == 0 ) maxwidth = getAvailableWidth();
		else if ( maxwidth < 0 ) maxwidth = getAllAvailableWidth();
		
		if      ( w < minwidth ) w = minwidth;
		else if ( w > maxwidth ) w = maxwidth;
		
		d("getRequiredWidth() returned '"+w+"'.");
		return w;
	}
	
	function getAvailableWidth ( ) // Returns the length of the searchbox's
	{                              // content in pixels
		d("getAvailableWidth() called.");
		
		var w = window.outerWidth; // The size of the window.
		
		var toolbaritems = e.searcharea.parentNode.childNodes;
		for( var i = 0; i < toolbaritems.length; i++)
		{
			var ele = toolbaritems[i];
			if( ele.id      == 'search-container' || // Our area.
			    ele.tagName == 'toolbarspring'       // Changes size.
			  ) continue;
			if( ele.id == "urlbar-container" ) ele.removeAttribute("width"); // inserted by splitter
			let f = ele.getAttribute('flex');
			ele.setAttribute('flex', 0);
			w -= ele.boxObject.width+1; // minus the used width.
			ele.setAttribute('flex', f);
		}
		
		d("getAvailableWidth() returned '"+w+"'.");
		return w;
	}
	
	function getAllAvailableWidth ( ) // Returns the length of the searchbox's
	{                              // content in pixels
		d("getAllAvailableWidth() called.");
		
		var w = window.outerWidth; // The size of the window.
		
		/*** Measure everything to the left of us. ***/
		var toolbaritems = e.searcharea.parentNode.childNodes;
		for( var i = 0; i < toolbaritems.length; i++)
		{
			var ele = toolbaritems[i];
			if ( ele.id      == 'search-container' ) break; // Our area.
			if ( ele.tagName == 'toolbarspring' )    continue; // Changes size.
			
			if( ele.id == "urlbar-container" ) ele.removeAttribute("width"); // inserted by splitter
			let f = ele.getAttribute('flex');
			ele.setAttribute('flex', 0);
			w -= ele.boxObject.width+1; // minus the used width.
			ele.setAttribute('flex', f);
		}
		
		
		d("getAllAvailableWidth() returned '"+w+"'.");
		return w;
	}
	
	function getOverheadWidth ( ) // Returns with of the stuff that will
	{                             // always be in the searchbox.
		d("getOverheadWidth() called.");

		var w = e.searcharea.width;
		e.searcharea.width = 0;
		var t = e.searchbox.value;
		//e.searchbox.value = '';

		var width = e.searchbox.boxObject.width;
		
		width -= e.input.offsetWidth; // Get the minimum size of the
		                              // input element.
		
		e.searcharea.width = w;
		e.searchbox.value = t;
		
		d("getOverheadWidth() returned '"+width+"'.");
		return width;
	}
	this.getOverheadWidth = getOverheadWidth;
	
	function measureText ( txt ) // Returns the size the text will be
	{                            // when rendered.
		d("measureText() called.");

		e.label.value = txt; // We will use the label to "test render".
		                     // Then measure that to get the size.
		
		var width = e.label.boxObject.width;

		d("measureText() returned '"+width+"'.");
		return width;
	}
	this.measureText = measureText;
	
	/*** Callbacks ***/
	
	function afterSubmit ( ) // Called after a search is submitted.
	{
		d("afterSubmit() called.");
		
		if(prefs.getBoolPref("cleanOnSubmit")) {
			e.searchbox.value='';
			window.setTimeout(autosize, 0);
		}
		if(prefs.getBoolPref("revertOnSubmit")) {
			searchBar.currentEngine = searchBar.engines[0];
		}
		
		d("afterSubmit() returned.");
	}
	
	function autosize ( ) // Make the searchbar the correct size.
	{
		d("autosize() called.");

		var width = getRequiredWidth();
		
		e.searcharea.width = width;
		
		d("autosize() returned.");
	}
	this.autosize = autosize;
	
	function inputReciever ( ) // Called after a search is submitted.
	{
		d("inputReciever() called.");

		autosize();
		
		d("inputReciever() returned.");
	}
	
	/*** Cleanup ***/
	init();
	d("new Autosizer() returning.");
	return this;
	
	/**/ // So that the last section can be commented.
}

var instances = [];

defaultPrefrences = {
//	strings: "chrome://autosizer/locale/autosizer.properties",
	minwidth: 0,
	maxwidth: 400,
//	autocompletePopupMinWidth: 200,
//	offset: 0,
//	labelOffset: 3,

	cleanOnSubmit: false,
	revertOnSubmit: false,
	
//	shrinkToButton: false,
//	addSBtoToolbar: true,
	
//	manualResize: "",
}

function setDefaultPrefs ( )
{
	var prefs = Services.prefs.getDefaultBranch(constants.prefBranch);

	for (let [key, val] in Iterator(defaultPrefrences))
	{
		switch (typeof val)
		{
			case "boolean":
				prefs.setBoolPref(key, val);
				break;
			case "number":
				prefs.setIntPref(key, val);
				break;
			case "string":
				prefs.setCharPref(key, val);
				break;
		}
	}
}

function runOnLoad(window) {
	// Listen for one load event before checking the window type
	if (window.document.readyState == "complete")
	{
		if (window.document.documentElement.getAttribute("windowtype") == "navigator:browser")
		{
			instances.push(new Autosizer(window));
		}
	}
	else
	{
		window.addEventListener("load", function() {
			window.removeEventListener("load", arguments.callee, false);

			runOnLoad(window);
		}, false);
	}
}

/*** Bootstrap Functions ***/
function startup(data, reason)
{
	Components.manager.addBootstrappedManifestLocation(data.installPath);

	setDefaultPrefs();

	/*** Add to new windows when they are opened ***/
	function windowWatcher(subject, topic)
	{
		if (topic == "domwindowopened")
			runOnLoad(subject);
	}
	Services.ww.registerNotification(windowWatcher);

	/*** Add to currently open windows ***/
	let browserWindows = Services.wm.getEnumerator("navigator:browser");
	while (browserWindows.hasMoreElements()) {
		let browserWindow = browserWindows.getNext();

		windowWatcher(browserWindow, "domwindowopened");
	}
}

function shutdown(data, reason)
{
	if ( reason == APP_SHUTDOWN ) return;

	while ( instances.length )
		instances.pop().shutdown(); // Get rid of the refrence

	Components.manager.removeBootstrappedManifestLocation(data.installPath);
}

function uninstall ( data, reason )
{
}