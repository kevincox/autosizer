var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

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
	
	dump("autosizer-pref: "+msg+"\n");
	Services.console.logStringMessage("autosizer-pref: "+msg);
}

var autosizer = new Autosizer();
var strings   = autosizer.strings;
var prefs     = autosizer.prefs;
var pref      = prefs.pref;

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
			var type = item.tagName;
			
			if ( type == "textbox"  )        item.value = pref[item.id].get();
			else if ( type == "checkbox" )   item.checked = pref[item.id].get();
			else if ( type == "radiogroup" ) item.value = pref[item.id].get();
			else d("Don't know how to load '"+type+"' for pref '"+item+"'.");
		}
		
		asp.updateMinWidthCheck();
		asp.updateMaxWidthList();
	},
	save: function () {
		var prefElements = document.querySelectorAll(".pref");
		for (var i = 0; i < prefElements.length; ++i)
		{
			var item = prefElements[i];
			var type = item.tagName;
			
			if      ( type == "textbox" )     pref[item.id].set(item.value);
			else if ( type == "checkbox" )   pref[item.id].set(item.checked);
			else if ( type == "radiogroup" ) pref[item.id].set(item.value);
			else d("Don't know how to store '"+type+"' for pref '"+item+"'.");
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
		autosizer.launchWizard();
		window.close();
	},
}

/* vi:set filetype=javascript: */
