// Copyright 2011-2014 Kevin Cox

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

"use strict";

var EXPORTED_SYMBOLS = ["Autosizer"];

const {classes:Cc, interfaces:Ci, results:Cr, utils:Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("chrome://autosizer/content/CPref.jsm");

function d ( msg, important )
{
	if (prefs && prefs.debug.value)
		important = true;
	
	if (!important) return; // Comment for debugging.
	
	dump("autosizer: "+msg+'\n');
	Services.console.logStringMessage("autosizer: "+msg);
}
function dj ( msg, important )
{
	return d(JSON.stringify(msg, undefined, 4), important);
}

///// Preferences.
let prefroot = new CPrefRoot("extensions.autosizer");
let prefs = prefroot.children;
function pref(name, def)
{
	let p = prefroot.pref(name);
	p.default = def;
	
	let s = p.sync;
	s.default = true;
}

/// The minimum width of the searchbar.
/**
 * The minimum width of the searchbar in pixels.
 * 
 * Special values:
 * -1:
 *   A value of `-1` means fit the search engines name.
 */
pref("minwidth", -1);

/// The maximum width of the searchbar.
/**
 * The maximum width the searchbar will grow to in pixels.
 * 
 * Special values:
 * 0:
 *   A value of `0` means to grow as large as possible.
 * -1:
 *   A value of `-1` means to grow as large a possible but also allow pushing
 *   other items off the screen.
 */
pref("maxwidth", 0);

pref("padding.query",   0); // Padding from search text.
pref("padding.engine", 5); // Padding from search engine title.

/// The width of the autocomplete popup.
/**
 * Sets the size of the autocomplete popup in pixels.
 * 
 * Special values:
 * 0:
 *   Don't change the size, keep the default.
 * -1:
 *   The popup will be the size of the window.
 * <= -100:
 *   The popup will be the size of the searchbar plus the amount this value is
 *   less than -100 by.
 *   
 *   The following formula is used:
 *   
 *       width = widthOfSearchBar + (-100) - popupwidth
 */
pref("popupwidth", 0);

/// Size searchbar when focused.
/**
 * If set, the searchbar will be enlarged when it has focus.
 */
pref("sizeon.focus",   true);

/// Size searchbar when it has content.
/**
 * If set, the searchbar will be enlarged when there is text in it.
 */
pref("sizeon.content", false);

/// How to size the searchbar.
/**
 * Valid values are:
 *   none: Don't size the searchbar.
 *   inc:  Size the searchbar character by character.
 *   once: Size the seachbar all at once.
 *
 * Unknown values will be treated like 'inc'.
 */
pref("sizestyle", "inc");

/// Clean the searchbar after a query is submitted.
/**
 * If set, the text in the searchbar will be cleared after a search is
 * committed.
 */
pref("aftersearch.clean", false);

/// Reset engine after a search.
/**
 * If set, the engine will be reset to the first one after a search query is
 * submitted.
 */
pref("aftersearch.resetengine", false);

/// Shrink to button.
/**
 * If set, the search bar will be replaced with a button when collapsed.
 */
pref("buttonify", false);

/// First run.
/**
 * Not really a preference.  If set the wizard will be launched then it will be
 * cleared.
 */
pref("firstrun", true);

/// Debug mode.
/**
 * If set, print out debugging info.  If you find a problem with autosizer
 * please turn this on and capture the output log when the problem occurs.
 */
pref("debug", false);

/// Put a pref dialog link in the search engine menu.
/**
 * If set, an item will be added to the searchbar search engine dropdown that
 * opens searchbar autosizer's preference dialog.
 */
pref("preflink.enginemenu", true);

var strings = {
	stringbundle: Services.strings.createBundle("chrome://autosizer/locale/autosizer.properties"),
	get: function(n){return strings.stringbundle.GetStringFromName(n);},
	getf: function(n,a){return strings.stringbundle.formatStringFromName(n,a,a.length);},
};

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
	var newf;
	
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
	
	d("Modified "+index+".");
	return function ( )
	{
		d("Restored "+index+".");
		if ( wrapper === parent[index] ) // Nobody modified it after us.
		{
			parent[index] = orig;
		}
		else // We have to discreetly remove our functionality
		{
			d("But we couldn't do a perfect job.");
			newf = orig; // Change our function to remove our check.
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

function getPriv(self)
{
	return self._AutosizerPrivate;
}

Object.defineProperties(Autosizer, {
	launchSettingsDialog: {value: launchPrefs},
	launchWizard: {value: launchWizard},
	prefs: {value: prefs},
	prefroot: {value: prefroot},
	instances: {value: []},
	strings: {value: strings},
	
	destroy: {
		value: function Autosizer_destroy(){
			d("::destory() called.");
			///// Shutdown all running instances.
			while ( Autosizer.instances.length )
			{
				let ref = Autosizer.instances.pop().get();
				if (ref) // Make sure the refrence still exists.
				{
					ref.destroy();
				}
			}
			
			Autosizer.prefroot.destroy();
			CPref.destroy();
			Components.utils.unload("chrome://autosizer/content/CPref.jsm");
		},
		enumerable: true,
	},
});

/*** Our Class ***/
function Autosizer ( window )
{
	d("new Autosizer() called.");
	
	if (!window) throw Components.Exception("window must be a window object.",
	                                         Cr.NS_ERROR_INVALID_ARG,
	                                         Components.stack.caller);
	
	let priv = this._AutosizerPrivate = {};
	
	this.window   = window;
	this.document = window.document;
	
	if ( this.document.readyState != "complete" )
		throw Components.Exception("window.document.readyState must be complete.",
		                           Cr.NS_ERROR_INVALID_ARG,
		                           Components.stack.caller);
	
	this.init();
	Autosizer.instances.push(Components.utils.getWeakReference(this));
	this.window.setTimeout(priv.bound.autosize, 0);
	
	if (prefs.firstrun.value)
	{
		launchWizard();
		prefs.firstrun.value = false;
	}
}
Object.defineProperties(Autosizer.prototype, {
	log: {
		value: function log(obj){
			window.gBrowser.getBrowserForTab(window.gBrowser.selectedTab)
			               .contentWindow.wrappedJSObject.console.log(obj);
		},
		enumerable: true,
	},
	init: {
		value: function init(){
			d("#init() called.");
			
			let priv = getPriv(this);
			priv.bound = {
				autosize: this.autosize.bind(this),
				destroy: this.destroy.bind(this),
				
				expandButton: this.expandButton.bind(this),
				
				_leftGripDragCallback:  this._leftGripDragCallback.bind(this),
				_rightGripDragCallback: this._rightGripDragCallback.bind(this),
				
				_addPrefLink: this._addPrefLink.bind(this),
				_inputReciever: this._inputReciever.bind(this),
			};
			
			this.searchbox  = this.document.getElementById("searchbar");
			this.searchcont = this.document.getElementById("search-container");
			
			priv.input = this.searchbox._textbox.inputField;
			priv.popup = this.document.getElementById("PopupAutoComplete");
			
			priv.manualResize = false;
			
			this.searchbox.autosizer = this; // So that other addons can get a hold of us.
			
			this._addAfterSubmitCheck();
			this._addSearchbarJumpHelper();
			this._addMeasuringLabel();
			this._addButton();
				dump(typeof d);
			this._addStyleSheet();
			
			this._addPrefLink();
			prefs.preflink.addListener(priv.bound._addPrefLink);
			
			this.window.addEventListener("unload",   priv.bound.destroy);
			this.searchbox.addEventListener("input", priv.bound._inputReciever);
			this.searchbox.addEventListener("focus", priv.bound._inputReciever);
			this.searchbox.addEventListener("blur",  priv.bound._inputReciever);
			
			///// For SearchWP.
			this.searchbox._textbox.addEventListener("tokenized",   priv.bound._inputReciever);
			this.searchbox._textbox.addEventListener("untokenized", priv.bound._inputReciever);
			
			addFocusWatch(this.searchbox);
			
			priv.originalflex = this.searchcont.flex;
			this.searchcont.flex = 0; // Go to _exactly_ the size I tell you to be.
			
			prefroot.addListener(priv.bound.autosize);
			
			d("#init() returning.");
		},
	},
	destroy: {
		value: function destroy() {
			d("#destroy() called.");
			
			let priv = getPriv(this);
			
			delete this.searchbox.autosizer;
			
			this._removeAfterSubmitCheck();
			this._removeSearchbarJumpHelper();
			this._removeMeasuringLabel();
			this._removeButton();
			this._removeStyleSheet();
			
			this._removePrefLink();
			prefs.preflink.removeListener(priv.bound._addPrefLink);
			
			this.window.removeEventListener("unload",   priv.bound.destroy);
			this.searchbox.removeEventListener("input", priv.bound._inputReciever);
			this.searchbox.removeEventListener("focus", priv.bound._inputReciever);
			this.searchbox.removeEventListener("blur",  priv.bound._inputReciever);
			
			///// For SearchWP.
			this.searchbox._textbox.removeEventListener("tokenized",   priv.bound._inputReciever);
			this.searchbox._textbox.removeEventListener("untokenized", priv.bound._inputReciever);
			
			removeFocusWatch(this.searchbox);
			
			this.searchcont.flex = priv.originalflex;
			
			prefroot.removeListener(priv.bound.autosize);
			
			/*** Clean up our instances ***/
			for ( var i = Autosizer.instances.length-1; i >= 0; i-- ) // Go backwards so removing
			{                                               // doesn't affect us.
				var ref = Autosizer.instances[i].get();
				if ( !ref || ref == this )
					Autosizer.instances.splice(i, 1); // Remove it.
			}
			
			d("#destroy() returning.");
		},
		enumerable: true,
	},
	
	_addAfterSubmitCheck: {
		value: function addAfterSubmitCheck() {
			let priv = getPriv(this);
			
			priv.removeAfterSubmitCheck = modifyFunction(
				this.searchbox, "handleSearchCommand",
				this.afterSubmit.bind(this),
				"after"
			);
		},
	},
	_removeAfterSubmitCheck: {
		value: function removeAfterSubmitCheck() {
			let asc = getPriv(this).removeAfterSubmitCheck;
			if (asc) asc();
		},
	},
	
	_addSearchbarJumpHelper: {
		value: function addSeacrhbarJumpHelper() {
			let priv = getPriv(this);
			
			priv.removeSearchbarJumpHelper = modifyFunction(
				this.window.BrowserSearch, "webSearch",
				this.fromButton.bind(this),
				"before"
			);
		},
	},
	_removeSearchbarJumpHelper: {
		value: function removeSearchbarJumpHelper() {
			let sbjh = getPriv(this).removeSearchbarJumpHelper;
			if (sbjh) sbjh();
		},
	},
	
	_addMeasuringLabel: {
		value: function addMeasuringLabel() {
			d("addMeasuringLabel() called.");
			let priv = getPriv(this);
			
			priv.labelItem = this.document.createElement("toolbaritem");
			priv.labelItem.setAttribute("style","width:0px;height:0px;overflow:hidden;");
			
			this.document.getElementById("search-container").appendChild(priv.labelItem);
			
			priv.label = this.document.createElement("label");
			priv.labelItem.appendChild(priv.label);
			
			d("addMeasuringLabel() returning.");
		},
	},
	_removeMeasuringLabel: {
		value: function removeMeasuringLabel() {
			d("removeMeasuringLabel() called.");
			let priv = getPriv(this);
			
			if (!priv.labelItem) return;
			
			this.document.getElementById("search-container").removeChild(priv.labelItem);
			
			priv.labelItem = null;
			
			d("removeMeasuringLabel() returning.");
		},
	},
	
	_addButton: {
		value: function addButton() {
			d("#_addButton() called.");
			let priv = getPriv(this);
			
			priv.button = this.document.createElement("toolbarbutton")
			priv.button.setAttribute("id", "autosizer-button");
			priv.button.setAttribute("label", strings.get("buttonLabel"));
			priv.button.setAttribute("tooltiptext", strings.get("buttonTooltip"));
			
			priv.button.addEventListener("command", priv.bound.expandButton);
			
			this.searchcont.parentNode.insertBefore(priv.button, this.searchcont);
			
			d("#_addButton() returning.");
		},
	},
	_removeButton: {
		value: function removeButton() {
			d("removeButton() called.");
			let priv = getPriv(this);
			
			if (!priv.button) return;
			
			this.fromButton();
			
			priv.button.removeEventListener("command", priv.bound.expandButton);
			priv.button.parentNode.removeChild(priv.button);
			
			priv.button = undefined;
			
			d("removeButton() returning.");
		},
	},
	
	_addStyleSheet: { //@TODO: Do we need to do this in each instance?
		value: function addStyleSheet() {
			d("#_addStyleSheet() called.");
			
			var sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
			                    .getService(Components.interfaces.nsIStyleSheetService);
			var ios = Components.classes["@mozilla.org/network/io-service;1"]
			                    .getService(Components.interfaces.nsIIOService);
			var uri = ios.newURI("chrome://autosizer/skin/autosizer.css", null, null);
			sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
			
			d("#_addStyleSheet() returning.");
		},
	},
	_removeStyleSheet: {
		value: function removeStyleSheet() {
			d("#_removeStyleSheet() called.");
			
			var sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
			                    .getService(Components.interfaces.nsIStyleSheetService);
			var ios = Components.classes["@mozilla.org/network/io-service;1"]
			                    .getService(Components.interfaces.nsIIOService);
			var uri = ios.newURI("chrome://autosizer/skin/autosizer.css", null, null);
			if(sss.sheetRegistered(uri, sss.USER_SHEET))
				sss.unregisterSheet(uri, sss.USER_SHEET);
			
			d("#_removeStyleSheet() returning.");
		},
	},
	
	_addPrefLink: {
		value: function _addPrefLink() {
			d("#_addPrefLink() called.");
			let priv = getPriv(this);
			
			this._removePrefLink();
			
			let lprefs = prefs.preflink.children;
			
			if (lprefs.enginemenu.value)
			{
				priv.preflinkitem = this.document.createElement("menuitem");
				priv.preflinkitem.setAttribute("label", strings.get("prefLinkText"));
				priv.preflinkitem.addEventListener("command", launchPrefs);
				this.searchbox._popup.appendChild(priv.preflinkitem);
			}
			
			d("#_addPrefLink() returning.");
		},
	},
	_removePrefLink: {
		value: function removePrefLink() {
			d("removePrefLink() called.");
			let priv = getPriv(this);
			
			if (!priv.preflinkitem) return;
			
			priv.preflinkitem.parentNode.removeChild(priv.preflinkitem);
			priv.preflinkitem.removeEventListener("command", launchPrefs);
			priv.preflinkitem = undefined;
			
			d("removePrefLink() returning.");
		},
	},
	
	/*** Information Functions ***/
	
	searchWPRequiredWidth: {
		get: function searchWPRequiredWidth() {
			d("#searchWPRequiredWidth called.");
			let priv = getPriv(this);
			
			let pf = this.searchbox._textbox._tokensContainer.getAttribute('flex');
			this.searchbox._textbox._tokensContainer.setAttribute('flex', 0);
			
			var w = this.searchbox._textbox._tokensContainer.boxObject.width;
			
			this.searchbox._textbox._tokensContainer.setAttribute('flex', pf);
			
			d("#searchWPRequiredWidth returned '"+w+"'.");
			return w;
		},
	},
	
	/// Returns the length of the searchbox's content.
	/**
	 * Returns the length required to show the content including any relevant
	 * padding and in-searchbar overhead.
	 */
	requiredWidth: {
		get: function getRequiredWidth() {
			d("#contentWidth called.");
			let priv = getPriv(this);
			
			var w = 0;
			
			if (this.searchbox._textbox.getAttribute("tokenized")) // SearchWP has it's
			{                                                      // buttons up.
				w += this.searchWPRequiredWidth;
			}
			else
			{
				let padprefs = prefs.padding.children;
				
				var tc = this.searchbox.value+'W'; // The 'W' is to prepare for the next letter.
				var pad = padprefs.query.value;
				
				if ( this.searchbox.value == "" && prefs.minwidth.value == -1 )
				{
					tc = this.searchbox.currentEngine.name;
					pad = padprefs.engine.value;
				}
				
				w += this.measureText(tc);
				w += pad;
			}
			
			w += this.overheadWidth;
			
			var minwidth = prefs.minwidth.value;
			var maxwidth = this.maxWidth;
			
			if      ( w < minwidth ) w = minwidth;
			else if ( w > maxwidth ) w = maxwidth;
			
			d("#contentWidth returned '"+w+"'.");
			return w;
		},
		enumerable: true,
	},
	
	/// Return the maximum size the searchbar is allowed to be.
	/**
	 * This returns the maximum allowable size, taking into consideration the
	 * relevant settings.
	 */
	maxWidth: {
		get: function getMaxWidth() {
			var maxwidth = prefs.maxwidth.value;
			
			if      ( maxwidth == 0 ) maxwidth = this.availableWidth;
			else if ( maxwidth <  0 ) maxwidth = this.allAvailableWidth;
			
			return maxwidth;
		},
		enumerable: true,
	},
	
	/// Returns the maximum width the searchbar can expand to.
	availableWidth: {
		get: function getAvailableWidth() {
			d("#availableWidth called.");
			let priv = getPriv(this);
			
			var w = this.window.outerWidth; // The size of the window.
			
			var toolbaritems = this.searchcont.parentNode.childNodes;
			for( var i = 0; i < toolbaritems.length; i++)
			{
				var ele = toolbaritems[i];
				if( ele.id      == 'search-container' || // Our area.
				    ele.tagName == 'toolbarspring'       // Changes size.
				  ) continue;
				if ( ele.id == "urlbar-container" ) ele.removeAttribute("width"); // inserted by splitter
				let f = ele.getAttribute('flex');
				ele.setAttribute('flex', 0);
				w -= ele.boxObject.width+1; // minus the used width.
				ele.setAttribute('flex', f);
			}
			
			d("#availableWidth returned '"+w+"'.");
			return w;
		},
		enumerable: true,
	},
	
	/// Returns the maximum width the searchbar can expand to if allowing items
	/// to be pushed out of the window.
	allAvailableWidth: {
		get: function getAllAvailableWidth() {
			d("#allAvailableWidth() called.");
			let priv = getPriv(this);
			
			var w = this.window.outerWidth; // The size of the window.
			
			///// Measure everything to the left of us.
			var toolbaritems = this.searchcont.parentNode.childNodes;
			for( var i = 0; i < toolbaritems.length; i++)
			{
				var ele = toolbaritems[i];
				if ( ele.id      == 'search-container' ) break; // Our area.
				if ( ele.tagName == 'toolbarspring' )    continue; // Changes size.
				
				//ele.style.border = '2px solid red';
				
				if( ele.id == "urlbar-container" ) ele.removeAttribute("width"); // inserted by splitter
				let f = ele.getAttribute('flex');
				ele.setAttribute('flex', 0);
				w -= ele.boxObject.width+1; // minus the used width.
				ele.setAttribute('flex', f);
			}
			
			d("#allAvailableWidth() returned '"+w+"'.");
			return w;
		},
		enumerable: true,
	},
	
	/// Return the width of the stuff that will always be in the searchbar.
	overheadWidth: {
		get: function getOverheadWidth() {
			d("#overheadWidth called.");
			let priv = getPriv(this);
			
			var w = this.searchcont.width;
			this.searchcont.width = 0;
			
			var width = this.searchcont.boxObject.width;
			width -= priv.input.offsetWidth; // Get the minimum size of the
			                                 // input element.
			
			this.searchcont.width = w;
			
			d("#overheadWidth returned '"+width+"'.");
			return width;
		},
		enumerable: true,
	},
	
	/// Return the size the text will be when rendered.
	measureText: {
		value: function measureText(txt) {
			d("measureText() called.");
			let priv = getPriv(this);
			
			priv.label.value = txt; // We will use the label to "test render".
			                     // Then measure that to get the size.
			
			var width = priv.label.boxObject.width;
			
			d("measureText() returned '"+width+"'.");
			return width;
		},
		enumerable: true,
	},
	
	/*** Manual Resizing ***/
	
	startManualResize: {
		value: function startManualResize() {
			d("startManualResize() called.");
			let priv = getPriv(this);
			
			if (priv.manualResize) return; // We are already manually resizing.
			
			this.expandButton();
			
			var mr = {
				leftGrip:  this.document.createElement("toolbaritem"),
				rightGrip: this.document.createElement("toolbaritem"),
			}
			priv.manualResize = mr;
			
			var sb = this.searchbox;
			var height = this.window.getComputedStyle(sb).getPropertyValue("height");
			
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
			
			mr.leftGrip .addEventListener("mousedown", priv.bound._leftGripDragCallback);
			mr.rightGrip.addEventListener("mousedown", priv.bound._rightGripDragCallback);
			
			sb.parentNode.insertBefore(mr.leftGrip,  sb);
			sb.parentNode.insertBefore(mr.rightGrip, sb.nextSibling);
			
			d("startManualResize() returned.");
		},
		enumerable: true,
	},
	
	stopManualResize: {
		value: function stopManualResize() {
			d("stopManualResize() called.");
			let priv = getPriv(this);
			
			if (!priv.manualResize) return; // We are not currently manually resizing.
			
			let mr = priv.manualResize;
			let sb = this.searchbox;
			
			sb.parentNode.removeChild(mr.leftGrip);
			sb.parentNode.removeChild(mr.rightGrip);
			
			priv.manualResize = false;
			
			d("stopManualResize() returned.");
		},
	},
	
	expandButton: {
		value: function expandButton() {
			d("expandButton() called.");
			let priv = getPriv(this);
			
			this.fromButton();
			this.searchbox.focus();
			
			d("expandButton() returned.");
		},
	},
	
	fromButton: {
		value: function fromButton() {
			d("#fromButton() called.");
			let priv = getPriv(this);
			
			let changing = priv.button.style.display != "none";
			
			priv.button.style.display = "none";
			this.searchcont.style.display = ""; // For some reason "block" prevents the
			                                    // search box from filling the search
			                                    // area.
			
			if (changing) this.searchbox.select();
			
			d("#fromButton() returned.");
		},
	},
	
	toButton: {
		value: function toButton() {
			d("toButton() called.");
			let priv = getPriv(this);
			
			priv.button.style.display = "block";
			this.searchcont.style.display = "none";
			
			d("toButton() returned.");
		},
	},
	
	doShrinkToButton: {
		value: function doShrinkToButton() {
			d("#doShrinkToButton() called.");
			
			if (this.shouldSize) this.fromButton();
			else                 this.toButton();
			
			d("#doShrinkToButton() returned.");
			return shrunk;
		},
	},
	
	shouldSize: {
		get: function shouldSize() {
			d("#shouldSize called.");
			let priv = getPriv(this);
			
			let soprefs = prefs.sizeon.children;
			
			let grow = (
				(
					soprefs.focus.value &&
					this.searchbox.hasFocus || this.searchbox._popup.state == "showing"
				) || (
					soprefs.content.value &&
					this.searchbox.value != ""
				) || (
					// When incrementally sizing always expand.
					prefs.sizestyle.value == "inc" &&
					// Unless we are going to a button.
					!prefs.buttonify.value
				)
			);
			
			d("#shouldSize returned "+grow+".");
			return grow;
		},
	},
	
	///// Callbacks
	
	// Called after a search is submitted.
	afterSubmit: {
		value: function afterSubmit() {
			d("afterSubmit() called.");
			let priv = getPriv(this);
			
			let asprefs = prefs.aftersearch.children;
			
			if (asprefs.clean.value)
			{
				this.searchbox.value='';
			}
			d("Resetval: "+asprefs.resetengine.value);
			if (asprefs.resetengine.value)
			{
				this.searchbox.currentEngine = this.searchbox.engines[0];
			}
			
			this.autosize();
			
			d("afterSubmit() returned.");
		},
	},
	
	/// Make the searchbar the correct size.
	autosize: {
		value: function autosize() {
			d("autosize() called.");
			let priv = getPriv(this);
			
			if (priv.manualResize) return; // Don't mess around when we are doing manual resize.
			if ( prefs.sizestyle.value == "none" ) return; // They don't want us to size it.
			
			if (this.shouldSize) this.expand();
			else                 this.shrink();
			
			d("autosize() returned.");
		},
		enumerable: true,
	},
	
	expand: {
		value: function expand() {
			d("expand() called.");
			let priv = getPriv(this);
			
			let width = this.desiredWidth;
			
			this.searchcont.width = width;
			
			this.fromButton();
			
			let puw = this.desiredPopupWidth(width);
			
			if ( puw != 0 ) priv.popup.width = puw;
		},
		enumerable: true,
	},
	
	shrink: {
		value: function shrink() {
			let priv = getPriv(this);
			
			if (prefs.buttonify.value) this.toButton();
			else                       this.searchcont.width = this.requiredWidth;
		},
		enumerable: true,
	},
	
	desiredWidth: {
		get: function desiredWidth() {
			if ( prefs.sizestyle.value == "once" ) return this.maxWidth;
			else                                   return this.requiredWidth;
			
			return width;
		},
		enumerable: true,
	},
	
	desiredPopupWidth: {
		value: function desiredPopupWidth(width) {
			let puw = prefs.popupwidth.value;
			if      ( puw <= -100 ) width += -(100 + puw);
			else if ( puw == -1   ) width = this.window.outerWidth;
			else                    width = puw;
			
			return puw;
		},
	},
	
	_inputReciever: {
		value: function _inputReciever() {
			d("_inputReciever() called.");
			
			this.autosize();
			
			d("_inputReciever() returned.");
		},
	},
	
	_leftGripDragCallback: {
		value: function _leftGripDragCallback(e) {
			return this._resizeDrag(e, "left");
		},
	},
	_rightGripDragCallback: {
		value: function _rightGripDragCallback(e) {
			return this._resizeDrag(e, "right");
		},
	},
	
	_resizeDrag: {
		value: function _resizeDrag(ev, side) {
			d("_resizeDrag() called.");
			let priv = getPriv(this);
			
			let drag = {
				startWidth: parseInt(this.searchcont.width),
				startx: ev.clientX,
				starty: ev.clientY,
			};
			
			let self = this;
			function move ( ev )
			{
				d("_resizeDrag.move() called.");
				
				var dx = ev.clientX - drag.startx;
				
				if ( side == "left" ) dx *= -1;
				
				d(dx);
				d(drag.startWidth);
				d(drag.startWidth + dx)
				
				self.searchcont.width = drag.startWidth + dx;
				
				var event = self.document.createEvent("Event");
				event.initEvent("autosizer-manualresize", true, false);
				self.searchbox.dispatchEvent(event);
				
				d("_resizeDrag.move() returned.");
			}
			function end ( ev )
			{
				d("_resizeDrag.end() called.");
				
				self.window.removeEventListener("mousemove", move, true);
				self.window.removeEventListener("mouseup", end, true);
				
				d("_resizeDrag.end() returned.");
			}
			
			this.window.addEventListener("mousemove", move, true);
			this.window.addEventListener("mouseup", end, true);
			
			d("_resizeDrag() returned.");
		},
	},
});
Object.preventExtensions(Autosizer);
Object.preventExtensions(Autosizer.prototype);

// vi:ft=javascript
