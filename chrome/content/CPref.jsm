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

const EXPORTED_SYMBOLS = ["CPref", "CPrefRoot"];

const {classes:Cc, interfaces:Ci, results:Cr, utils:Cu} = Components;

Components.utils.import("resource://gre/modules/Services.jsm");

function d ( msg, important )
{
	//if (!important) return; // Comment for debugging.
	
	dump("CPref: "+msg+'\n');
	Services.console.logStringMessage("CPref: "+msg);
}
function dj(obj, i)
{
	return d(JSON.stringify(obj, undefined, 4));
}

let rbranch = Services.prefs.getBranch("");
let dbranch = Services.prefs.getDefaultBranch("");

let values = {};

/// Set a preference with type detection.
/**
 * @param  key
 *         The full preference name.
 * @param  val
 *         The new value.
 * @param  def
 *         If set, set the default value.
 */
function setPref ( key, val, def )
{
	if ( typeof val == "undefined" && !def )
	{
		rbranch.clearUserPref(key);
		return;
	}
	
	let b = def?dbranch:rbranch;
	
	let type;
	if ( values[key] === undefined ) type = typeof val;
	else                             type = typeof values[key];
	
	d(key+"("+type+"): "+val);
	
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

const TYPE_MAP = {};
TYPE_MAP[Services.prefs.PREF_BOOL]   = "boolean";
TYPE_MAP[Services.prefs.PREF_INT]    = "number";
TYPE_MAP[Services.prefs.PREF_STRING] = "string";

/// Get a preference with type detection.
/**
 * @param  key
 *         The full preference name.
 * @param  def
 *         If set, get the default value.
 * @return The value.
 */
function getPref ( key, defp )
{
	let branch = defp?dbranch:rbranch;
	
	let type;
	if ( values[key] == undefined ) type = TYPE_MAP[branch.getPrefType(key)];
	else                            type = typeof values[key];
	
	switch (type)
	{
		case "boolean":
			return values[key] = branch.getBoolPref(key);
		case "number":
			return values[key] = branch.getIntPref(key);
		case "string":
			return values[key] = branch.getCharPref(key);
	}
}

/// Preference watcher.
function observer (aSubject, aTopic, aData)
{
	if( aTopic != "nsPref:changed" ) return;
	
	let val = getPref(aData); // Update the cache.
	
	// +1 is for the dot.
	this.pref._onchange(aData.substr(this.pref.path.length+1).split("."));
}

Object.defineProperties(CPref, {
	/// Clean up the Module.
	/**
	 * This performs some cleanup of the module that allows it to be properly
	 * garbage collected.
	 */
	destroy: {
		value: function CPref_destroy(){
			d("::destory() called.");
			syncroot.destroy();
			d("::destory() called.");
			syncroot = undefined;
			
			///// Just in case someone forgot to #destroy() a CPrefRoot.
			dbranch = undefined;
			rbranch = undefined;
			d("::destory() returned.");
		},
	},
});

/// A Preference.
/**
 * Manages a preference.  The preference need not exist.  If you don't assign a
 * value to the preference it will not be created.
 * 
 * NOTE: In order to avoid creating a change listener for each pref object all
 *       change events must come from a CPrefRoot.  If implemented otherwise
 *       each pref would need to be manually destroyed.
 * 
 * @param  path
 *         The absolute path of the preference, or a prefix (without a trailing
 *         dot).
 */
function CPref(path)
{
	if ( typeof path == "undefined" ) path = "";
	if ( typeof path != "string"    )
		throw Components.Exception("path must be a string.",
		                           Cr.NS_ERROR_INVALID_ARG,
		                           Components.stack.caller);
	
	Object.defineProperties(this, {
		path: {
			value: path,
			enumerable: true,
		},
		children: {
			value: {},
			enumerable: true,
		},
		_listeners: {
			value: [],
		},
	});
	
	return this;
}
Object.defineProperties(CPref.prototype, {
	/// Get a sub-pref.
	/**
	 * Get a preference from "further down" in the tree.  While the preferences
	 * backend considers the preference names as flat this hierarchy is emulated
	 * in CPref.
	 * 
	 *     let ext = CPrefRoot("extensions"); // Points to the extensions "namespace".
	 *     let sba = ext.pref("autosizer");   // Points to autosizer's prefix.
	 *     let ss1 = ext.pref("autosizer.sizestyle");
	 *     let ss2 = sba.pref("sizestyle");
	 *     assert(ss1 == ss2); // Both get the same item.
	 * 
	 * @param  name
	 *         The name of the pref, relative to the current pref.
	 * @return A new CPref if not accessed before, otherwise the same preference.
	 */
	pref: {
		value: function CPref_pref(name) {
			if (typeof name == "string") name = name.split(".");
			if (!Array.isArray(name))
				throw Components.Exception("Name must be a string.",
				                           Cr.NS_ERROR_INVALID_ARG,
				                           Components.stack.caller);
			
			// If it us, return us.
			if ( name.length <= 0 ) return this;
			
			// Create on component at a time.
			let next = name.shift();
			
			if (!this.children[next])
				this.children[next] = new CPref(this.path+"."+next);
			
			return this.children[next].pref(name);
		},
		enumerable: true,
	},
	
	/// Retrieve and modify the preference.
	/**
	 * Assigning to will set the user branch value and reading from will return
	 * the user value if present, else the default value.  Will throw an error
	 * if the preference doesn't exist.
	 * 
	 * Setting to `undefined` will reset the pref to the default value.
	 */
	value: {
		get: function CPref_value_get(){
			if (!(this.path in values))
			{
				return getPref(this.path);
			}
			
			return values[this.path];
		},
		set: function CPref_value_set(val){
			setPref(this.path, val);
		},
		enumerable: true,
	},
	
	/// Retrieve and modify the default value.
	/**
	 * Much like `value` expect it will always read and write the default
	 * branch.
	 */
	default: {
		get: function CPref_default_get(){
			return getPref(this.path, true);
		},
		set: function CPref_default_set(val){
			setPref(this.path, val, true);
		},
		enumerable: true,
	},
	
	/// Does the preference have a user value?
	/**
	 * Either `true` if the preference has a user value, otherwise `false`.
	 */
	userset: {
		get: function CPref_userset_get(){
			return rbranch.prefHasUserValue(this.path);
		},
		enumerable: true,
	},
	
	/// Retrieve and set the locked state.
	/**
	 * Will be either `true` if the preference is locked, otherwise `false`.
	 * Setting to `true` will lock the preference and setting to `false` will
	 * unlock the preference.
	 */
	locked: {
		get: function CPref_locked_get(){
			return dbranch.prefIsLocked(this.path);
		},
		set: function CPref_locked_set(val){
			if (val) dbranch.lockPref  (this.path);
			else     dbranch.unlockPref(this.path);
		},
		enumerable: true,
	},
	
	/// Get the sync pref.
	/**
	 * Returns the preference that controls if the preference will be synced via
	 * Firefox Sync.
	 */
	sync: {
		get: function CPref_sync_get(){
			return syncroot.pref(this.path);
		},
		enumerable: true,
	},
	
	/// Add a change listener.
	/**
	 * Adds a function to be notified about changes to this function or
	 * functions further down the tree.
	 * 
	 * The callback will be called with two arguments.
	 * 
	 * The first argument will be the CPref object addListener was called on
	 * 
	 * The second argument will be a string that describes the path of the
	 * changed pref relative to this one.  If this preference changed the string
	 * will be empty.
	 * 
	 * A listener can be added multiple times and will be called once for each
	 * time it was added per change.
	 * 
	 * @param  func
	 *         A function to be called when the preference, or one further down
	 *         the tree is changed.
	 */
	addListener: {
		value: function CPref_addListener(func) {
			this._listeners.push(func);
		},
		enumerable: true,
	},
	/// Remove a change listener.
	/**
	 * Removes a listener added by `addListener`.
	 * 
	 * If a listener was added multiple times only one will be removed.
	 * 
	 * @param  func
	 *         The same function that was passed to `addListener`.
	 */
	removeListener: {
		value: function CPref_removeListener(func) {
			let i = this._listeners.indexOf(func);
			if ( i < 0 ) d("WRN: Attempt to remove listener that doesn't exist.");
			else         this._listeners.splice(i, 1);
		},
		enumerable: true,
	},
	
	_onchange: {
		value: function CPref__onchange(chunks) {
			let relpath = chunks.join(".");
			
			for (let i = this._listeners.length; i--; )
				this._listeners[i].call({}, this, relpath);
			
			if (chunks.length)
			{
				let next = chunks.shift();
				if (this.children[next])
					this.children[next]._onchange(chunks);
			}
		},
	},
});

/// A Root.
/**
 * A root is identical to a regular CPref except that it actually listens for
 * pref changes.  These changes are then propagated throughout the tree.
 * 
 * However, because it is hooked into these notifications it must be destroyed.
 * Be sure to call `destroy` before loosing reference to it.
 */
function CPrefRoot(path)
{
	CPref.apply(this, arguments);
	
	Object.defineProperties(this, {
		_observer: {
			value: {
				pref: this,
				observe: observer,
			},
		},
	});
	
	rbranch.addObserver(this.path+".", this._observer, false);
}
CPrefRoot.prototype = Object.create(CPref.prototype, {
	constructor: {value: CPref},
	
	/// Destroy this instance.
	/**
	 * Cleans itself up so that it is eligible for garbage collection.  It must
	 * not be used again after this method is called.
	 */
	destroy: {
		value: function() {
			d("CPrefRoot#destory() called.");
			//CPref.prototype.destroy.call(this);
			
			rbranch.removeObserver(this.path+".", this._observer, false);
			
			d("CPrefRoot#destory() returned.");
		},
		enumerable: true,
	},
});

///// Root for sync tree.
let syncroot = new CPrefRoot("services.sync.prefs.sync");

// vi:ft=javascript
