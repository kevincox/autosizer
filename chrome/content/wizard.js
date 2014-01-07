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

const {interfaces:Ci, classes:Cc, utils:Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("chrome://autosizer/content/Autosizer.jsm");

function d ( msg, important )
{
	if ( !important && typeof Autosizer != "undefined" )
	{
		if (Autosizer.prefs.debug.value)
			important = true;
	}
	
	if (!important) return; // Comment for debugging.
	
	dump("autosizer-wiz: "+msg+"\n");
	Services.console.logStringMessage("autosizer-wiz: "+msg);
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

let autosizer = e.searchbox.autosizer;
let strings   = Autosizer.strings;
let prefs     = Autosizer.prefs;
let prefroot  = Autosizer.prefroot;

var asw = {
	init: function ( ) {
		d("asw.init() called.");
		
		d("asw.init() returned.");
	},
	
	end: function ( ) {
		autosizer.stopManualResize();
		autosizer.autosize();
	},
	
	/*** First Page - When to size ***/
	initSize: function()
	{
		d("asw.initSize() called.");
		
		var rbuttons = document.getElementById("sizemode");
		
		var mode = prefs.sizestyle.value;
		
		if      ( mode == "none" ) rbuttons.selectedIndex = 2;
		else if ( mode == "once" ) rbuttons.selectedIndex = 1;
		else                       rbuttons.selectedIndex = 0;
		
		d("asw.initSize() returned.");
	},
	endSize: function ( )
	{
		d("asw.endSize() called.");
		
		prefs.sizestyle.value = document.getElementById("sizemode").value;
		
		d("asw.endSize() returned.");
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
		
		prefs.minwidth.value = asw.minWidthSolve();
		
		d("asw.initMinWidth() returned.");
	},
	
	minWidthSolve: function ( )
	{
		d("asw.minWidthSolve() called.");
		
		var w = e.searcharea.width;
		
		var v = e.searchbox.value;
		e.searchbox.value = '';
		
		var smallSize = autosizer.requiredWidth;
		
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
		
		prefs.maxwidth.value = asw.maxWidthSolve();
		
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
		
		if ( Math.abs(w-autosizer.allAvailableWidth) < 100 )
			w = -1;
		else if ( Math.abs(w-autosizer.availableWidth) < 100 )
			w = 0;
		
		d("asw.maxWidthSolve() returned "+w+".");
		return w;
	},
	
	/*** Fourth Page - Settings ***/
	initAfterSearch: function ( mode )
	{
		d("asw.initAfterSearch() called.");
		
		let asprefs = prefs.aftersearch.children;
		
		document.getElementById("cleanOnSubmit").checked  = asprefs.clean.value;
		document.getElementById("revertOnSubmit").checked = asprefs.resetengine.value;
		document.getElementById("shrinkToButton").checked = prefs.buttonify.value;
		
		d("asw.initAfterSearch() returned.");
	},
	
	cleanOnSubmitChange: function ( )
	{
		d("asw.cleanOnSubmitChange() called.");
		
		prefroot.pref("aftersearch.clean").value = document.getElementById("cleanOnSubmit").checked;
		
		d("asw.cleanOnSubmitChange() returned.");
	},
	revertOnSubmitChange: function ( )
	{
		d("asw.revertOnSubmitChange() called.");
		
		prefroot.pref("aftersearch.resetengine").value = document.getElementById("revertOnSubmit").checked;
		
		d("asw.revertOnSubmitChange() returned.");
	},
	shrinkToButtonChange: function ( )
	{
		d("asw.shrinkToButtonChange() called.");
		
		prefs.buttonify.value = document.getElementById("shrinkToButton").checked;
		
		d("asw.shrinkToButtonChange() returned.");
	},
}
