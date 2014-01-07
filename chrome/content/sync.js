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
		if (Autosizer.prefs.debug.value)
			important = true;
	}
	
	if (!important) return; // Comment for debugging.
	
	dump("autosizer-sync: "+msg+"\n");
	Services.console.logStringMessage("autosizer-sync: "+msg);
}

let strings  = Autosizer.strings;
let prefs    = Autosizer.prefs;
let prefroot = Autosizer.prefroot;

var sync = {
	init: function () {
		let list = document.getElementById("prefs");
		
		let prefixlen = prefroot.path.length + 1; // 1 for trailing dot.
		
		function createList(pref)
		{
			let haschildren = false;
			
			for (let pn in pref.children)
			{
				haschildren = true;
				createList(pref.children[pn]);
			}
			
			if (haschildren) return; // Just a branch.
			
			d(pref.path);
			
			let name = pref.path.substr(prefixlen);
			
			var item = list.appendItem(name, name);
			var cb = document.createElement("checkbox");
			item.insertBefore(cb, item.firstChild);
			cb.checked = pref.sync.value;
		}
		
		createList(prefroot);
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
			prefroot.pref(e.value).sync.value = e.firstChild.checked;
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
