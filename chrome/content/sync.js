var {classes: Cc, interfaces: Ci, utils: Cu} = Components

Cu.import("chrome://autosizer/content/autosizer.jsm");

function d ( msg, seroius )
{
	seroius = true // For debugging.
	if (!seroius) return;

	dump('autosizer: '+msg+'\n');
	Components.classes["@mozilla.org/consoleservice;1"]
		.getService(Components.interfaces.nsIConsoleService)
		.logStringMessage('autosizer: '+msg);
}

var autosizer = new Autosizer();
var strings   = autosizer.strings;
var pref      = autosizer.pref;
var prefo     = autosizer.prefo;
var prefs     = autosizer.prefs;

var sync = {
	init: function () {
		var list = document.getElementById("prefs");
		
		var names = Object.keys(prefo).sort();
		for ( i in names )
		{
			let p = prefo[names[i]];

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
			prefo[e.value].sync(e.firstChild.checked);
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
