var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

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
var prefs     = autosizer.prefs;

var asp = {
	init: function () {
		asp.load();
	},
	exit: function () {
		asp.save();
		window.close();
	},

	load: function () {
		var prefs = document.querySelectorAll(".pref");
		for (var i = 0; i < prefs.length; ++i)
		{
			var item = prefs[i];
			var type = item.getAttribute("data-pref");
			if      ( type == "int"  ) item.value   = pref[item.id];
			else if ( type == "char" ) item.value   = pref[item.id];
			else if ( type == "bool" ) item.checked = pref[item.id];
		}

		asp.updateMinWidthCheck();
		asp.updateMaxWidthList();
	},
	save: function () {
		var prefElements = document.querySelectorAll(".pref");
		for (var i = 0; i < prefElements.length; ++i)
		{
			var item = prefElements[i];
			var type = item.getAttribute("data-pref");
			if      ( type == "int"  ) prefs.setIntPref(item.id, item.value);
			else if ( type == "char" ) prefs.setCharPref(item.id, item.value);
			else if ( type == "bool" ) prefs.setBoolPref(item.id, item.checked);
		}
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

		if (l.checked) b.value = -1;
	},

	updateMaxWidthList: function () {
		var b = document.getElementById("maxwidth");
		var l = document.getElementById("maxwidthlist");

		var v = parseInt(b.value);
		d(v)

		if      ( v ==  0 ) l.value = "full";
		else if ( v == -1 ) l.value = "max";
		else                l.value = "none";
	},
	updateMaxWidthBox: function () {
		var b = document.getElementById("maxwidth");
		var l = document.getElementById("maxwidthlist");

		if ( l.value == "full" ) b.value = 0;
		if ( l.value == "max"  ) b.value = -1;
	},

	launchWizard: function () {
		var wi = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		                   .getService(Components.interfaces.nsIWindowMediator)
		                   .getEnumerator("navigator:browser");

		while (wi.hasMoreElements())
		{
			var w = wi.getNext()
			var sb = w.document.getElementById("searchbar");
			if (sb)
			{
				w.gBrowser.selectedTab = w.gBrowser.addTab("chrome://autosizer/content/wizard.xul");
				w.focus();
				window.close();
				return;
			}
		}

		var win = window.open("chrome://autosizer/content/wizard.xul",
                              "Searchbar Autosizer Setup Wizard", "resizable=yes,scrollbars=yes,status=yes,chrome=no");
		window.close();
	},
}
