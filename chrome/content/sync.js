// Copyright 2012-2014 Kevin Cox

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

var {classes: Cc, interfaces: Ci, utils: Cu} = Components

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("chrome://autosizer/content/Autosizer.jsm");

function d ( msg, important )
{
	if ( !important && typeof Autosizer != "undefined" )
	{
		if (Autosizer.prefs.pref.debug.get())
			important = true;
	}
	
	if (!important) return; // Comment for debugging.
	
	dump("autosizer-sync: "+msg+"\n");
	Services.console.logStringMessage("autosizer-sync: "+msg);
}

var strings   = Autosizer.strings;
var prefs     = Autosizer.prefs;
var pref      = prefs.pref;

var sync = {
	init: function () {
		var list = document.getElementById("prefs");
		
		var names = Object.keys(pref).sort();
		for (let i in names)
		{
			let p = pref[names[i]];
			
			d(p.name);
			var item = list.appendItem(p.name, p.name);
			var cb = document.createElement("checkbox");
			item.insertBefore(cb, item.firstChild);
			cb.checked = p.isSynced();
		}
	},
	exit: function () {
		sync.save();
	},
	save: function () {
		var list = document.getElementById("prefs");
		var i = list.itemCount;
		while ( i-- > 0 )
		{
			let e = list.getItemAtIndex(i);
			d(e.value);
			pref[e.value].sync(e.firstChild.checked);
		}
	},
	
	setAll: function () {
		var state = document.getElementById("checkall").checked;
		
		var list = document.getElementById("prefs");
		var i = list.itemCount;
		while ( i-- > 0 )
		{
			let e = list.getItemAtIndex(i);
			e.firstChild.checked = state;
		}
	},
}
