// Copyright 2011-2012 Kevin Cox

/*******************************************************************************
*                                                                              *
*  Permission is hereby granted, free of charge, to any person obtaining a     *
*  copy of this software and associated documentation files (the "Software"),  *
*  to deal in the Software without restriction, including without limitation   *
*  the rights to use, copy, modify, merge, publish, distribute, sublicense,    *
*  and/or sell copies of the Software, and to permit persons to whom the       *
*  Software is furnished to do so, subject to the following conditions:        *
*                                                                              *
*  The above copyright notice and this permission notice shall be included in  *
*  all copies or substantial portions of the Software.                         *
*                                                                              *
*  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR  *
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,    *
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL     *
*  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER  *
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING     *
*  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER         *
*  DEALINGS IN THE SOFTWARE.                                                   *
*                                                                              *
*******************************************************************************/

var EXPORTED_SYMBOLS = ["Autosizer"];

Components.utils.import("resource://gre/modules/Services.jsm");

function d ( msg, important )
{
	//important = true; // Uncomment for debuging.

	if (pref && pref.debug)
		important = true;

	if (!important) return;

	dump("autosizer: "+msg+'\n');
	Services.console.logStringMessage("autosizer", '+msg);
}

constants = {
	prefBranch: "extensions.autosizer.",
}

pref = {
//	strings: "chrome://autosizer/locale/autosizer.properties",
	minwidth: 0,
	maxwidth: 0,

	padding: 0,

	popupwidth: 0,
//	offset: 0,
//	labelOffset: 3,

	sizeOn: "key",

	cleanOnSubmit: false,
	revertOnSubmit: false,
	shrinkToButton: false,

	debug: false,

//	addSBtoToolbar: true,

//	manualResize: "",
}

var prefs = Services.prefs.getBranch(constants.prefBranch);
prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);

var prefObserver = {
	observe: function (aSubject, aTopic, aData)
	{
		if( aTopic != "nsPref:changed" ) return;

		switch (typeof pref[aData])
		{
			case "boolean":
				pref[aData] = prefs.getBoolPref(aData);
				break;
			case "number":
				pref[aData] = prefs.getIntPref(aData);
				break;
			case "string":
				pref[aData] = prefs.getCharPref(aData);
				break;
		}
	}
};

/*** Set Default Prefrences and Get Prefrences ***/
{
let dprefs = Services.prefs.getDefaultBranch(constants.prefBranch);
for (let [key, val] in Iterator(pref))
{
	switch (typeof val)
	{
		case "boolean":
			dprefs.setBoolPref(key, val);
			pref[key] = prefs.getBoolPref(key);
			break;
		case "number":
			dprefs.setIntPref(key, val);
			pref[key] = prefs.getIntPref(key);
			break;
		case "string":
			dprefs.setCharPref(key, val);
			pref[key] = prefs.getCharPref(key);
			break;
	}
}
}

/*** Add Prefrence Listener ***/
prefs.addObserver("", prefObserver, false);

var instances = [];

/*** Our "Class" ***/
function Autosizer ( window )
{
	d("new Autosizer() called.");

	this.pref = pref;
	this.prefs = prefs;
	this.instances = instances;
	this.prefObserver = prefObserver;

	if (!window) return this;

	var self = this;

	var document = window.document;
	this.window = window;
	this.document = document;

	this.pref = pref;

	var e = { // Element refrences
		searchbox: document.getElementById("searchbar"),
		searcharea: document.getElementById("search-container"),
		input: null,
		popup: null,

		label: null,
		labelItem: null,

		button: null,

		stylesheet: null,
	};

	function log ( obj )
	{
		window.gBrowser.getBrowserForTab(window.gBrowser.selectedTab)
		               .contentWindow.wrappedJSObject.console.log(obj);
	}

	/*** Initialization and Shutdown ***/
	function init ( ) {
		d("init() called.");

		addAfterSubmitCheck();
		addMeasuringLabel();
		addButton();
		addStyleSheet();

		e.searchbox.addEventListener("input", inputReciever, true);
		window.addEventListener("unload", shutdown, false);

		e.searcharea.flex = 0; // Go to _exactly_ the size I tell you
		                       // to be.

		e.input = e.searchbox._textbox.inputField;

		e.searchbox.autosizer = self; // Just incase other addons want
		                              // to get a hold of us.

		e.popup = document.getElementById("PopupAutoComplete");

		if(pref.shrinkToButton) toButton();
		else                    window.setTimeout(autosize, 0);

		instances.push(Components.utils.getWeakReference(self));

		d("init() returning.");
	}

	function shutdown ( ) {
		d(".shutdown() called.");
		e.searchbox.autosizer = undefined;

		e.searchbox.removeEventListener("input", inputReciever, true);
		window.removeEventListener("unload", shutdown, false);

		e.searcharea.flex = 100; // This appears to be the default.

		removeAfterSubmitCheck();
		removeMeasuringLabel();
		removeButton();
		removeStyleSheet();

		/*** Clean up our instances ***/
		for ( var i = instances.length-1; i >= 0; i-- ) // Go backwards so removing
		{                                               // doesn't affect us.
			var ref = instances[i].get();
			if ( !ref || ref == self )
				instances.splice(i, 1); // Remove it.
		}

		d(".shutdown() returning.");
	};
	this.shutdown = shutdown;

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

	function removeAfterSubmitCheck ( )
	{
		d("removeAfterSubmitCheck() called.")

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

		d("removeAfterSubmitCheck() returning.")
	}

	function addMeasuringLabel ( )
	{
		d("addMeasuringLabel() called.")

		e.labelItem = document.createElement("toolbaritem");
		e.labelItem.setAttribute("style","width:0px;height:0px;overflow:hidden;");

		document.getElementById("search-container").appendChild(e.labelItem);

		e.label = document.createElement("label");
		e.labelItem.appendChild(e.label);

		d("addMeasuringLabel() returning.")
	}

	function removeMeasuringLabel ( )
	{
		d("removeMeasuringLabel() called.")

		if (!e.labelItem) return;

		document.getElementById("search-container").removeChild(e.labelItem);

		e.labelItem = null;

		d("removeMeasuringLabel() returning.")
	}

	function addButton ( )
	{
		d("addButton() called.")

		e.button = document.createElement("toolbarbutton")
		e.button.setAttribute("id", "autosizer-button");
		e.button.setAttribute("label", "&autosizer.button.label;");
		e.button.setAttribute("tooltiptext", "&autosizer.button.tooltip;");

		e.button.addEventListener("command", fromButton, true);

		e.searcharea.parentNode.insertBefore(e.button, e.searcharea);

		d("addButton() returning.")
	}

	function removeButton ( )
	{
		d("removeButton() called.")

		if (!e.button) return;

		e.button.removeEventListener("command", fromButton, true);
		e.button.parentNode.removeChild(e.button);

		e.button = null;

		d("removeButton() returning.")
	}

	function addStyleSheet ( )
	{
		d("addStyleSheet() called.")

		var sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
		                    .getService(Components.interfaces.nsIStyleSheetService);
		var ios = Components.classes["@mozilla.org/network/io-service;1"]
		                    .getService(Components.interfaces.nsIIOService);
		var uri = ios.newURI("chrome://autosizer/skin/autosizer.css", null, null);
		sss.loadAndRegisterSheet(uri, sss.USER_SHEET);

		d("addStyleSheet() returning.")
	}

	function removeStyleSheet ( )
	{
		d("removeStyleSheet() called.")

		var sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
		                    .getService(Components.interfaces.nsIStyleSheetService);
		var ios = Components.classes["@mozilla.org/network/io-service;1"]
		                    .getService(Components.interfaces.nsIIOService);
		var uri = ios.newURI("chrome://autosizer/skin/autosizer.css", null, null);
		if(sss.sheetRegistered(uri, sss.USER_SHEET))
			sss.unregisterSheet(uri, sss.USER_SHEET);

		d("removeStyleSheet() returning.")
	}

	/*** Information Functions ***/

	function getRequiredWidth ( ) // Returns the length of the searchbox's
	{                             // content in pixels
		d("getRequiredWidth() called.");

		var tc;
		if ( e.searchbox.value != "" ) tc = e.searchbox.value+'W';
		else                           tc = e.searchbox.currentEngine.name;
		// The 'W' is to prepare for the next letter.

		var w = getOverheadWidth();
		w += measureText(tc);

		var minwidth = pref.minwidth;
		var maxwidth = pref.maxwidth;

		if     ( maxwidth == 0 ) maxwidth = getAvailableWidth();
		else if ( maxwidth < 0 ) maxwidth = getAllAvailableWidth();

		if      ( w < minwidth ) w = minwidth;
		else if ( w > maxwidth ) w = maxwidth;

		d("getRequiredWidth() returned '"+w+"'.");
		return w;
	}
	this.getRequiredWidth = getRequiredWidth;

	function getAvailableWidth ( ) // Returns the maximum width the
	{                              // searchbar can expand to.
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
	this.getAvailableWidth = getAvailableWidth;

	function getAllAvailableWidth ( ) // Returns the maximum width the
	{                                 // searchbar can expand to if
	                                  // allowing items to be pushed out
	                                  // of the window.
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
	this.getAllAvailableWidth = getAllAvailableWidth;

	function getOverheadWidth ( ) // Returns with of the stuff that will
	{                             // always be in the searchbox.
		d("getOverheadWidth() called.");

		var w = e.searcharea.width;
		e.searcharea.width = 0;

		var width = e.searcharea.boxObject.width;
		width -= e.input.offsetWidth; // Get the minimum size of the
		                              // input element.

		e.searcharea.width = w;

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

	/*** Manual Resizing ***/

	var manualResize = false;

	function startManualResize ( )
	{
		d("startManualResize() called.");

		if (manualResize) return; // We are already manually resizing.

		var mr = {
			leftGrip:  document.createElement("toolbaritem"),
			rightGrip: document.createElement("toolbaritem"),
		}
		manualResize = mr;

		var sb = e.searchbox;
		var height = window.getComputedStyle(sb).getPropertyValue("height");

		var sharedStyle = "padding: 0px;"                +
		                  "border: 4px solid red;"       +
		                  "opacity: 0.6;"                +
		                  "background: transparent;"     +
		                  "width:  7px;"                 +
		                  "height: "+height+";"          +
		                  "margin: 0;"                   +
		                  "position: relative;"          +
		                  "left: 60px;"                   +
		                  "cursor: w-resize;"

		mr.leftGrip.setAttribute("style", sharedStyle+"border-right:0");
		mr.rightGrip.setAttribute("style", sharedStyle+"border-left:0");

		mr.leftGrip.addEventListener("mousedown", leftGripDragCallback, true);
		mr.rightGrip.addEventListener("mousedown", rightGripDragCallback, true);

		sb.parentNode.insertBefore(mr.leftGrip,  sb);
		sb.parentNode.insertBefore(mr.rightGrip, sb.nextSibling);

		d("startManualResize() returned.");
	}
	this.startManualResize = startManualResize;

	function stopManualResize ( )
	{
		d("stopManualResize() called.");

		if (!manualResize) return; // We are not currently manually resizing.

		var mr = manualResize;
		var sb = e.searchbox;

		sb.parentNode.removeChild(mr.leftGrip);
		sb.parentNode.removeChild(mr.rightGrip);

		manualResize = false;

		d("stopManualResize() returned.");
	}
	this.stopManualResize = stopManualResize;

	function fromButton ( )
	{
		d("fromButton() called.");

		e.button.style.display = "none";
		e.searcharea.style.display = ""; // For some reason "block" prevents the
		                                 // search box from filling the search
		                                 // area.

		autosize();

		e.searchbox.focus();

		d("fromButton() returned.");
	}
	this.fromButton = fromButton;

	function toButton ( )
	{
		d("toButton() called.");

		d(e.searcharea.style.display);

		e.button.style.display = "block";
		e.searcharea.style.display = "none";

		d("toButton() returned.");
	}
	this.fromButton = fromButton;

	/*** Callbacks ***/

	function afterSubmit ( ) // Called after a search is submitted.
	{
		d("afterSubmit() called.");

		if(pref.cleanOnSubmit)
		{
			e.searchbox.value='';
			window.setTimeout(autosize, 0);
		}
		if(pref.revertOnSubmit)
		{
			e.searchbox.currentEngine = e.searchbox.engines[0];
		}
		if(pref.shrinkToButton)
		{
			toButton();
		}

		autosize();

		d("afterSubmit() returned.");
	}

	function autosize ( ) // Make the searchbar the correct size.
	{
		d("autosize() called.");

		var width = 0;
		if ( pref.sizeOn == "none" ) return; // They don't want us to size it.
		else if ( pref.sizeOn == "atonce" )
		{
			var width;
			if (e.searchbox.value)
			{
				width = pref.maxwidth;
				if     ( width == 0 ) width = getAvailableWidth();
				else if ( width < 0 ) width = getAllAvailableWidth();

			}
			else width = getRequiredWidth();

		}
		else width = getRequiredWidth();

		e.searcharea.width = width + pref.padding;

		if      ( pref.popupwidth <= -100 ) width += (-100) - pref.popupwidth;
		else if ( pref.popupwidth == -1   ) width = window.outerWidth;
		else                                width = pref.popupwidth

		if ( width != 0 ) e.popup.width = width;

		d("autosize() returned.");
	}
	this.autosize = autosize;

	function inputReciever ( ) // Called after a search is submitted.
	{
		d("inputReciever() called.");

		autosize();

		d("inputReciever() returned.");
	}

	function leftGripDragCallback ( e )
	{
		return resizeDrag(e, "left");
	}
	function rightGripDragCallback ( e )
	{
		return resizeDrag(e, "right");
	}

	function resizeDrag ( ev, side )
	{
		d("resizeDrag() called.");

		drag = {
			startWidth: parseInt(e.searcharea.width),
			startx: ev.clientX,
			starty: ev.clientY,
		};


		function move ( ev )
		{
			d("resizeDrag.move() called.");

			var dx = ev.clientX - drag.startx;

			if ( side == "left" ) dx *= -1;

			d(dx);
			d(drag.startWidth);
			d(drag.startWidth + dx)

			e.searcharea.width = drag.startWidth + dx;

			var event = document.createEvent("Event");
			event.initEvent("autosizer-manualresize", true, false);
			e.searchbox.dispatchEvent(event);

			d("resizeDrag.move() returned.");
		}
		function end ( ev )
		{
			d("resizeDrag.end() called.");


			window.removeEventListener("mousemove", move, true);
			window.removeEventListener("mouseup", end, true);

			d("resizeDrag.end() returned.");
		}

		window.addEventListener("mousemove", move, true);
		window.addEventListener("mouseup", end, true);

		d("resizeDrag() returned.");
	}

	/*** Cleanup ***/
	init();
	d("new Autosizer() returning.");
	return this;

	/**/ // So that the last section can be commented.
}
