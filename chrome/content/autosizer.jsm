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
Components.utils.import("chrome://autosizer/content/cpref.jsm");

function d ( msg, important )
{
	//important = true; // Uncomment for debugging.
	
	if (prefs && prefs.pref.debug.get())
		important = true;
	
	if (!important) return;
	
	dump("autosizer: "+msg+'\n');
	Services.console.logStringMessage("autosizer: "+msg);
}

constants = {
	prefBranch: "extensions.autosizer.",
	syncPrefBranch: "services.sync.prefs.sync.",
}

var prefs = CPref.Prefs(constants.prefBranch, {syncByDefault:true});

prefs.addPref("minwidth", -1);
prefs.addPref("maxwidth", 0);

prefs.addPref("padding",     0); // Padding from search text.
prefs.addPref("namePadding", 5); // Padding from search engine title.

prefs.addPref("popupwidth", 0);

prefs.addPref("sizeOn", "key");

prefs.addPref("cleanOnSubmit",  false);
prefs.addPref("revertOnSubmit", false);
prefs.addPref("shrinkToButton", false);
prefs.addPref("shrinkwhenfull", false);

prefs.addPref("firstrun", true);
prefs.addPref("debug", false);

prefs.addPref("preflink", "search");

var strings = {
	stringbundle: Services.strings.createBundle("chrome://autosizer/locale/autosizer.properties"),
	get: function(n){return strings.stringbundle.GetStringFromName(n);},
	getf: function(n,a){return strings.stringbundle.formatStringFromName(n,a,a.length);},
};

var instances = [];

function focusWatch_focus ( )
{
	this.hasFocus = true;
}
function focusWatch_blur ( )
{
	this.hasFocus = false;
}
function addFocusWatch ( el )
{
	el.addEventListener("focus", focusWatch_focus, true);
	el.addEventListener("blur",  focusWatch_blur, true);
}
function removeFocusWatch ( el )
{
	el.removeEventListener("focus", focusWatch_focus, true);
	el.removeEventListener("blur",  focusWatch_blur, true);
}

function modifyFunction ( parent, index, func, where )
{
	//if ( where == undefined ) where = "before";
	
	var newf = null;
	
	var orig    = parent[index];
	var wrapper = function ()
	{
		newf.apply(this, arguments);
	};
	
	if ( where == "after" )
	{
		newf = function ( )
		{
			orig.apply(this, arguments);
			func.apply(this, arguments);
		};
	}
	else
	{
		newf = function ( )
		{
			if (func.apply(this, arguments)) return;
			orig.apply(this, arguments);
		};
	}
	
	parent[index] = wrapper;
	
	return function ( )
	{
		if ( wrapper === parent[index] ) // Nobody modified it after us.
		{
			parent[index] = orig;
		}
		else // We have to discreetly remove our functionality
		{
			newf = function ( ) { // Change our function to remove our check.
				orig.apply(this, arguments);
			};
		}
	};
}

var wizard = {open:false, win:null, tabs:null, tab:null};
function addWizardTab (dontRemove)
{
	if (!dontRemove) win.removeEventListener("load", addWizardTab, false);
	
	wizard.tabs = wizard.win.gBrowser
	wizard.tab = wizard.tabs.addTab("chrome://autosizer/content/wizard.xul");
	wizard.tabs.selectedTab = wizard.tab;
	wizard.win.focus();
	
	wizard.tabs.tabContainer.addEventListener("TabClose", wizardUnload, false);
}
function wizardUnload(event)
{
	if ( event.target != wizard.tab ) return
	
	wizard.tabs.tabContainer.removeEventListener("TabClose", wizardUnload, false);
	
	wizard.win = null;
	wizard.doc = null;
	wizard.tab = null;
	
	wizard.open = false;
}

function launchWizard ( )
{
	if (wizard.open)
	{
		wizard.win.gBrowser.selectedTab = wizard.tab;
		wizard.win.focus();
		return;
	}
	
	wizard.open = true;
	
	var wi = Services.wm.getEnumerator("navigator:browser");
	
	while (wi.hasMoreElements())
	{
		var w = wi.getNext()
		var sb = w.document.getElementById("searchbar");
		if (sb)
		{
			wizard.win = w;
			addWizardTab(true);
			return;
		}
	}
	
	var win = Services.ww.openWindow(null, "chrome://browser/content/browser.xul",
	                                 "Searchbar Autosizer Setup Wizard",
	                                 null,
	                                 null
	                                 );
	win.addEventListener("load", addWizardTab, false);
}
function launchPrefs ( )
{
	Services.ww.openWindow(null, "chrome://autosizer/content/prefs.xul",
	                       "Autosizer Prefrences",
	                       "chrome,centerscreen", null);
}

/*** Our "Class" ***/
function Autosizer ( window )
{
	d("new Autosizer() called.");
	
	this.prefs = prefs;
	this.instances = instances;
	
	this.strings = strings;
	
	this.launchWizard = launchWizard;
	
	if (!window) return this;
	
	if (prefs.pref.firstrun.get())
	{
		launchWizard();
		prefs.pref.firstrun.set(false);
	}
	
	var self = this;
	
	var document = window.document;
	this.window = window;
	this.document = document;
	
	if ( window.document.readyState != "complete" ) return this;
	
	var e = { // Element references
		searchbox: document.getElementById("searchbar"),
		searcharea: document.getElementById("search-container"),
		input: null,
		popup: null,
		
		label: null,
		labelItem: null,
		
		button: null,
		
		stylesheet: null,
		
		preflinkitem: null,
	};

	function log ( obj )
	{
		window.gBrowser.getBrowserForTab(window.gBrowser.selectedTab)
		               .contentWindow.wrappedJSObject.console.log(obj);
	}

	var originalflex;

	/*** Initialization and Shutdown ***/
	function init ( ) {
		d("init() called.");
		
		addAfterSubmitCheck();
		addSearchbarJumpHelper();
		addMeasuringLabel();
		addButton();
		addStyleSheet();
		
		addPrefLink();
		prefs.pref.preflink.addOnChange(addPrefLink);
		
		addFocusWatch(e.searchbox);
		
		window.addEventListener("unload", shutdown, false);
		e.searchbox.addEventListener("focus", inputReciever, true);
		e.searchbox.addEventListener("blur", inputReciever, true);
		e.searchbox.addEventListener("input", inputReciever, true);
		
		///// For SearchWP.
		e.searchbox._textbox.addEventListener("tokenized", inputReciever, true);
		e.searchbox._textbox.addEventListener("untokenized", inputReciever, true);
		
		originalflex = e.searcharea.flex;
		e.searcharea.flex = 0; // Go to _exactly_ the size I tell you to be.
		
		e.input = e.searchbox._textbox.inputField;
		
		e.searchbox.autosizer = self; // Just in case other addons want
		                              // to get a hold of us.
		
		e.popup = document.getElementById("PopupAutoComplete");
		
		if (prefs.pref.shrinkToButton.get()) toButton();
		else                                 window.setTimeout(autosize, 0);
		
		instances.push(Components.utils.getWeakReference(self));
		
		d("init() returning.");
	}
	
	function shutdown ( ) {
		d(".shutdown() called.");
		e.searchbox.autosizer = undefined;
		
		e.searchbox.removeEventListener("input", inputReciever, true);
		e.searchbox.removeEventListener("focus", inputReciever, true);
		e.searchbox.removeEventListener("blur", inputReciever, true);
		window.removeEventListener("unload", shutdown, false);
		
		///// For SearchWP.
		e.searchbox._textbox.removeEventListener("tokenized", inputReciever, true);
		e.searchbox._textbox.removeEventListener("untokenized", inputReciever, true);
		
		removeFocusWatch(e.searchbox);
		
		fromButton();
		e.searcharea.flex = originalflex;
		
		removeAfterSubmitCheck();
		removeSearchbarJumpHelper();
		removeMeasuringLabel();
		removeButton();
		removeStyleSheet();
		
		removePrefLink();
		prefs.pref.preflink.removeOnChange(addPrefLink);
		
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
	
	var removeAfterSubmitCheck = null;
	function addAfterSubmitCheck ()
	{
		removeAfterSubmitCheck = modifyFunction(e.searchbox, "handleSearchCommand", afterSubmit, "after");
	}
	
	var removeSearchbarJumpHelper = null;
	function addSearchbarJumpHelper ()
	{
		removeSearchbarJumpHelper = modifyFunction(window.BrowserSearch, "webSearch", fromButton, "before");
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
		e.button.setAttribute("label", strings.get("buttonLabel"));
		e.button.setAttribute("tooltiptext", strings.get("buttonTooltip"));
		
		e.button.addEventListener("command", expandButton, true);
		
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
	
	function addPrefLink ()
	{
		d("addPrefLink() called.")
		
		removePrefLink();
		
		if ( prefs.pref.preflink.get() == "none" ) return;
		
		e.preflinkitem = document.createElement("menuitem");
		e.preflinkitem.setAttribute("label", strings.get("prefLinkText"));
		e.preflinkitem.addEventListener("command", launchPrefs, false);
		
		//if ( prefs.pref.preflink.get() == "search" )
		//{
			e.searchbox._popup.appendChild(e.preflinkitem);
		//}
		//else //if ( prefs.pref.preflink.get() == "text" )
		//{
			//@TODO: Find a way to add it to the searchbar context menu.
		//}
		
		d("addPrefLink() returning.")
	}
	function removePrefLink ()
	{
		d("removePrefLink() called.")
		
		if (!e.preflinkitem) return;
		
		e.preflinkitem.parentNode.removeChild(e.preflinkitem);
		e.preflinkitem.removeEventListener("command", launchPrefs, false);
		e.preflinkitem = null;
		
		d("removePrefLink() returning.")
	}
	
	/*** Information Functions ***/
	
	function getSearchWPRequiredWidth ( )
	{
		d("getSearchWPRequiredWidth() called.");
		
		let pf = e.searchbox._textbox._tokensContainer.getAttribute('flex');
		e.searchbox._textbox._tokensContainer.setAttribute('flex', 0);
		
		var w = e.searchbox._textbox._tokensContainer.boxObject.width;
		
		e.searchbox._textbox._tokensContainer.setAttribute('flex', pf);
		
		d("getSearchWPRequiredWidth() returned '"+w+"'.");
		return w;
	}
	
	function getRequiredWidth ( ) // Returns the length of the searchbox's
	{                             // content in pixels.
		d("getRequiredWidth() called.");
		
		var w = 0;
		
		d("Tokenized ("+typeof e.searchbox._textbox.getAttribute("tokenized")+"): "+e.searchbox._textbox.getAttribute("tokenized"));
		if (e.searchbox._textbox.getAttribute("tokenized")) // SearchWP has it's
		{                                                   // buttons up.
			 w += getSearchWPRequiredWidth();
		}
		else
		{
			var tc = e.searchbox.value+'W'; // The 'W' is to prepare for the next letter.
			var pad = prefs.pref.padding.get();
			if ( e.searchbox.value == "" && prefs.pref.minwidth.get() == -1 )
			{
				tc = e.searchbox.currentEngine.name;
				pad = prefs.pref.namePadding.get();
			}
			
			w += measureText(tc);
			w += pad;
		}
		
		w += getOverheadWidth();
		
		var minwidth = prefs.pref.minwidth.get();
		var maxwidth = prefs.pref.maxwidth.get();
		
		if      ( maxwidth == 0 ) maxwidth = getAvailableWidth();
		else if ( maxwidth <  0 ) maxwidth = getAllAvailableWidth();
		
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
			
			ele.style.border = '2px solid red';
			
			if( ele.id == "urlbar-container" ) ele.removeAttribute("width"); // inserted by splitter
			let f = ele.getAttribute('flex');
			ele.setAttribute('flex', 0);
			w -= ele.boxObject.width+1; // minus the used width.
			//ele.setAttribute('flex', f);
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
		
		expandButton();
		
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
		                  "left: 60px;"                  +
		                  "cursor: w-resize;"
		
		mr.leftGrip.setAttribute("style", sharedStyle+"border-right:0;");
		mr.rightGrip.setAttribute("style", sharedStyle+"border-left:0;");
		
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
	
	function expandButton ( )
	{
		d("expandButton() called.");
		
		fromButton();
		e.searchbox.focus();
		
		d("expandButton() returned.");
	}
	this.fromButton = fromButton;
	
	function fromButton ( )
	{
		d("fromButton() called.");
		
		var changing = e.button.style.display != "none";
		
		e.button.style.display = "none";
		e.searcharea.style.display = ""; // For some reason "block" prevents the
		                                 // search box from filling the search
		                                 // area.
		
		if (changing) e.searchbox.select();
		
		d("fromButton() returned.");
	}
	this.fromButton = fromButton;
	
	function toButton ( )
	{
		d("toButton() called.");
		
		e.button.style.display = "block";
		e.searcharea.style.display = "none";
		
		d("toButton() returned.");
	}
	this.fromButton = fromButton;
	
	function doShrinkToButton ( )
	{
		if ( e.searchbox.hasFocus                  || // The searchbar is active.
		     e.searchbox._popup.state == "showing" || // Selecting search engine.
		     !prefs.pref.shrinkToButton.get()      || // Shrinking is disabled.
		     (
		       !prefs.pref.shrinkwhenfull.get() &&    // If set ignore searchbar content.
		       e.searchbox.value != ""                // Searchbar is not empty.
		     )
		   )
		{
			fromButton();
			d("doShrinkToButton() returned false.");
			return false;
		}
		
		toButton();
		d("doShrinkToButton() returned false.");
		return true;
	}
	this.doShrinkToButton = doShrinkToButton;
	
	/*** Callbacks ***/
	
	function afterSubmit ( ) // Called after a search is submitted.
	{
		d("afterSubmit() called.");
		
		if (prefs.pref.cleanOnSubmit.get())
		{
			e.searchbox.value='';
		}
		if (prefs.pref.revertOnSubmit.get())
		{
			e.searchbox.currentEngine = e.searchbox.engines[0];
		}
		
		autosize();
		doShrinkToButton();
		
		d("afterSubmit() returned.");
	}
	
	function autosize ( ) // Make the searchbar the correct size.
	{
		d("autosize() called.");
		
		if (manualResize) return; // Don't mess around when we are doing manual resize.
		if (doShrinkToButton()) return; // If we are a button we don't have to size.
		
		var width = 0;
		if ( prefs.pref.sizeOn.get() == "none" ) return; // They don't want us to size it.
		else if ( prefs.pref.sizeOn.get() == "atonce" )
		{
			var width;
			if (e.searchbox.value)
			{
				width = prefs.pref.maxwidth.get();
				if     ( width == 0 ) width = getAvailableWidth();
				else if ( width < 0 ) width = getAllAvailableWidth();
			}
			else width = getRequiredWidth();
		}
		else width = getRequiredWidth();
		
		e.searcharea.width = width;
		
		if      ( prefs.pref.popupwidth.get() <= -100 ) width += -(100 + prefs.pref.popupwidth.get());
		else if ( prefs.pref.popupwidth.get() == -1   ) width = window.outerWidth;
		else                                width = prefs.pref.popupwidth.get();
		
		if ( prefs.pref.popupwidth.get() != 0 ) e.popup.width = width;
		
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
	autosize();
	d("new Autosizer() returning.");
	return this;
	
	/**/ // So that the last section can be commented.
}

/* vi:set filetype=javascript: */
