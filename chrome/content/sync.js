var {classes: Cc, interfaces: Ci, utils: Cu} = Components

Cu.import("chrome://autosizer/content/autosizer.jsm");

function d ( msg, important )
{
	//important = true; // Uncomment for debuging.

	if ( !important && Autosizer )
	{
		if (Autosizer(null).prefs.pref.debug.get())
			important = true;
	}

	if (!important) return;

	dump("autosizer-sync: "+msg+"\n");
	Services.console.logStringMessage("autosizer-sync: "+msg);
}

var autosizer = new Autosizer();
var strings   = autosizer.strings;
var prefs     = autosizer.prefs;
var pref      = prefs.pref;

var sync = {
	init: function () {
		var list = document.getElementById("prefs");

		var names = Object.keys(pref).sort();
		for ( i in names )
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
