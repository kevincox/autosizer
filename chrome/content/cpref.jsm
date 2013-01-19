// Copyright 2013 Kevin Cox

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

var EXPORTED_SYMBOLS = ["CPref"];

Components.utils.import("resource://gre/modules/Services.jsm");

function d ( msg, important )
{
	important = true; // Uncomment for debuging.

	if (!important) return;

	dump("CPref: "+msg+'\n');
	Services.console.logStringMessage("CPref: "+msg);
}

var SYNC_PREFIX = "services.sync.prefs.sync.";

var rbranch = Services.prefs.getBranch("");
rbranch.QueryInterface(Components.interfaces.nsIPrefBranch2);
var dbranch = Services.prefs.getDefaultBranch("");

values = {};

function setPref ( key, val, def )
{
	var b = def?dbranch:rbranch;

	//d(key+"("+fpref[key].type+"): "+val);

	var type = null;
	if ( values[key] == undefined ) type = typeof val;
	else                            type = typeof values[key];

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
	}
}

TYPE_MAP = {};
TYPE_MAP[Services.prefs.PREF_BOOL]   = "boolean";
TYPE_MAP[Services.prefs.PREF_INT]    = "number";
TYPE_MAP[Services.prefs.PREF_STRING] = "string";

function getPref ( key )
{
	var type = null;
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

var cache = {};
function Prefs (path, options)
{
	options = options || {};
	options.syncByDefault = !!options.syncByDefault;

	var self = {
		pref: {},
	};

	var prefObserver = {
		observe: function (aSubject, aTopic, aData)
		{
			if( aTopic != "nsPref:changed" ) return;

			getPref(aData);
			var prefo = self.pref[aData.substr(path.length)];
			if (prefo) prefo._triggerChange();
		}
	};
	rbranch.addObserver(path, prefObserver, false);

	self.addPref = function ( name, dflt )
	{
		var r = {
			name:         name,
			absname: path+name,

			type: typeof dflt,
			value: dflt,
		};

		r.syncname = SYNC_PREFIX+r.absname;

		var onchange = [];

		///// Set up defaults.
		setPref(r.syncname, options.syncByDefault, true);
		setPref(r.absname, dflt, true);

		///// The API.
		r.set = function ( v ) {
			setPref(r.absname, v);
		};
		r.get = function ( ) {
			return values[r.absname];
		};

		r.sync = function ( sync ) {
			setPref(r.syncname, sync);
		};
		r.isSynced = function () {
			return getPref(r.syncname);
		};

		r.addOnChange = function (callback) {
			onchange.push(callback);
		};
		r.removeOnChange = function (callback) {
			onchange.splice(onchange.indexOf(callback), 1);
		};

		r._triggerChange = function () {
			for ( i in onchange )
			{
				onchange[i](r);
			}
		};

		r.destroy = function () {
			rbranch.removeObserver(path, prefObserver, false);
		};

		values[r.absname] = dflt; // Prime the cache.
		getPref(r.absname);       //

		d("Adding pref: "+name);
		self.pref[name] = r;
		return r;
	};

	return self;
}

var CPref = {
	setPref: setPref,
	getPref: getPref,

	Prefs: Prefs,
}
