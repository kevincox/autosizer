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

const {classes:Cc, interfaces:Ci, results:Cr, utils:Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("chrome://autosizer/content/Autosizer.jsm");

function d ( msg, important )
{
	if (Autosizer.prefs.pref.debug.get())
	{
		important = true;
	}
	
	if (!important) return; // Comment for debugging.
	
	dump("autosizer-pref: "+msg+"\n");
	if (window.console) console.log(msg);
	else                Services.console.logStringMessage("autosizer-pref: "+msg);
}

let strings = Autosizer.strings;
let prefs   = Autosizer.prefs;

function updatePrefElement(item, value)
{
	let type = item.tagName;
	
	if      ( type == "textbox"   ||
	          type == "radiogroup" ) item.value   = value;
	else if ( type == "checkbox"   ) item.checked = value;
	else d("WRN: Don't know how to load '"+type+"' for pref '"+ele+"'.", true);
}

function updatePrefValue(e)
{
	let item = e.target;
	
	while (item.mozMatchesSelector(".pref *"))
	{
		item = item.parentElement;
	}
	
	let type = item.tagName;
	
	let pref = prefs.pref[item.id];
	let val;
	
	if (!pref) return;
	
	if      ( type == "textbox"   ||
	          type == "radiogroup" ) val = item.value;
	else if ( type == "checkbox"   ) val = item.checked;
	else d("WRN: Don't know how to store '"+type+"' for pref '"+item.id+"'.");
	
	pref.set(val);
	d("Changed '"+item.id+"' to '"+val+"'.");
}

var asp = {
	toremove: [],
	
	init: function () {
		///// Update UI when prefs change.
		let eles = document.querySelectorAll(".pref");
		for (let i = 0; i < eles.length; ++i)
		{
			let item = eles[i];
			let pref = prefs.pref[item.id];
			
			if (!pref)
			{
				d("WRN: Pref '"+item.id+"' does not exist.", true);
				continue;
			}
			
			let updatefunc = updatePrefElement.bind(null, item);
			
			updatefunc(pref.get());
			pref.addOnChange(updatefunc);
			
			asp.toremove.push([pref, updatefunc]);
		}
		
		///// Update pref when UI changes.
		document.addEventListener("command", updatePrefValue);
		
		asp.updateMinWidthCheck();
		asp.updateMaxWidthList();
	},
	exit: function () {
		asp.toremove.forEach(function(v){
			[pref, fun] = v;
			
			console.log(pref);
			console.log(pref._onchange.length);
			
			pref.removeOnChange(fun);
		});
	},
	
	updateMinWidthCheck: function () {
		var b = document.getElementById("minwidth");
		var l = document.getElementById("minwidthcheck");
		
		var v = parseInt(b.value);
		
		l.checked = ( v == -1 );
	},
	updateMinWidthBox: function () {
		var b = document.getElementById("minwidth");
		var l = document.getElementById("minwidthcheck");
		
		if (l.checked) prefs.pref.minwidth.set(-1);
		else           prefs.pref.minwidth.set(100);
	},
	
	updateMaxWidthList: function () {
		var b = document.getElementById("maxwidth");
		var l = document.getElementById("maxwidthlist");
		
		var v = parseInt(b.value);
		
		if      ( v ==  0 ) l.value = "full";
		else if ( v == -1 ) l.value = "max";
		else                l.value = "none";
	},
	updateMaxWidthBox: function () {
		var b = document.getElementById("maxwidth");
		var l = document.getElementById("maxwidthlist");
		
		if ( l.value == "full" ) prefs.pref.maxwidth.set(0);
		if ( l.value == "max"  ) prefs.pref.maxwidth.set(-1);
	},
	
	launchWizard: function () {
		Autosizer.launchWizard();
		window.close();
	},
}

// vi:ft=javascript
