// Copyright 2013-2014 Kevin Cox

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

const EXPORTED_SYMBOLS = ["CPref"];

Components.utils.import("resource://gre/modules/Services.jsm");

function d ( msg, important )
{
	if (!important) return; // Comment for debugging.
	
	dump("CPref: "+msg+'\n');
	Services.console.logStringMessage("CPref: "+msg);
}

const SYNC_PREFIX = "services.sync.prefs.sync.";

let rbranch = Services.prefs.getBranch("");
let dbranch = Services.prefs.getDefaultBranch("");

let values = {};

function setPref ( key, val, def )
{
	let b = def?dbranch:rbranch;
	
	//d(key+"("+fpref[key].type+"): "+val);
	
	if ( typeof val == "undefined" )
	{
		b.clearUserPref(key);
		return;
	}
	
	let type;
	if ( values[key] === undefined ) type = typeof val;
	else                             type = typeof values[key];
	
	switch (type)
	{
	case "boolean":
		b.setBoolPref(key, val);
		break;
	case "number":
		b.setIntPref(key, val);
		break;
	case "string":
		b.setCharPref(key, val);
		break;
	default:
		d("Warn: unexpected preference type '"+type+"'.");
	}
}

var TYPE_MAP = {};
TYPE_MAP[Services.prefs.PREF_BOOL]   = "boolean";
TYPE_MAP[Services.prefs.PREF_INT]    = "number";
TYPE_MAP[Services.prefs.PREF_STRING] = "string";

function getPref ( key )
{
	let type;
	if ( values[key] == undefined ) type = TYPE_MAP[rbranch.getPrefType(key)];
	else                            type = typeof values[key];
	
	switch (type)
	{
		case "boolean":
			return values[key] = rbranch.getBoolPref(key);
		case "number":
			return values[key] = rbranch.getIntPref(key);
		case "string":
			return values[key] = rbranch.getCharPref(key);
	}
}

function userSetPref ( key )
{
	return rbranch.prefHasUserValue(key);
}

function Prefs (path, options)
{
	options = options || {};
	options.syncByDefault = !!options.syncByDefault;
	
	let self = {
		pref: {},
	};
	
	let prefObserver = {
		observe: function (aSubject, aTopic, aData)
		{
			if( aTopic != "nsPref:changed" ) return;
			
			let localname = aData.substr(path.length);
			let val = getPref(aData);
			
			self._triggerChange(localname, val);
			
			let prefo = self.pref[localname];
			if (prefo) prefo._triggerChange();
		}
	};
	rbranch.addObserver(path, prefObserver, false);
	
	self._onchange = [];
	self.addOnChange = function (callback) {
		self._onchange.push(callback);
	};
	self.removeOnChange = function (callback) {
		let i = self._onchange.indexOf(callback);
		if ( i >= 0 )
			self._onchange.splice(i, 1);
	};
	
	self._triggerChange = function (k, v) {
		for (let i in self._onchange)
		{
			self._onchange[i].call(self, k, v);
		}
	};
	
	self.addPref = function ( name, dflt )
	{
		let r = {
			name:         name,
			absname: path+name,
			
			type: typeof dflt,
			value: dflt,
		};
		
		r.syncname = SYNC_PREFIX+r.absname;
		
		r._onchange = [];
		
		///// Set up defaults.
		setPref(r.syncname, options.syncByDefault, true);
		setPref(r.absname, dflt, true);
		
		var ld = dump;
		var lc = Components;
		
		///// The API.
		r.set = function ( v ) {
			setPref(r.absname, v);
		};
		r.get = function ( ) {
			if (typeof values == "undefined")
			{
				var s = lc.stack;
				while (s)
				{
					ld(s+"\n");
					s = s.caller;
				}
			}
			return values[r.absname];
		};
		
		r.userSet = function ( ) {
			return userSetPref(r.absname);
		};
		
		r.sync = function ( sync ) {
			setPref(r.syncname, sync);
		};
		r.isSynced = function () {
			return getPref(r.syncname);
		};
		
		r.addOnChange = function (callback) {
			r._onchange.push(callback);
		};
		r.removeOnChange = function (callback) {
			let i = r._onchange.indexOf(callback);
			if ( i >= 0 )
				r._onchange.splice(i, 1);
		};
		
		r._triggerChange = function () {
			let v = r.get();
			
			for (let i in r._onchange)
			{
				r._onchange[i].call(r, v);
			}
		};
		
		r.destroy = function () {
			r._onchange = [];
			delete self.pref[name];
		};
		
		values[r.absname] = dflt; // Prime the cache.
		getPref(r.absname);       //
		
		d("Adding pref: "+name);
		self.pref[name] = r;
		return r;
	};
	
	self.destroy = function()
	{
		self._onchange = [];
		rbranch.removeObserver(path, prefObserver, false);
		for ( var p in self.pref )
		{
			self.pref[p].destroy();
		}
	};
	
	return self;
}

const CPref = {
	setPref: setPref,
	getPref: getPref,
	
	Prefs: Prefs,
}

// vi:ft=javascript
