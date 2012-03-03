var autosizerPref = {
	intP: ['minwidth','maxwidth','popupwidth', 'padding', 'namePadding'],
	boolP: ['cleanOnSubmit','revertOnSubmit','shrinkToButton'],
	prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch),
	init: function() {
		//try { if(window.arguments[0]) window.opener=window.arguments[0]; } catch(e){}
		for(var p in this.intP) document.getElementById(this.intP[p]).value=this.prefs.getIntPref('extensions.autosizer.'+this.intP[p]);
		for(var p in this.boolP) document.getElementById(this.boolP[p]).checked=this.prefs.getBoolPref('extensions.autosizer.'+this.boolP[p]);

		this.setEnDis();
	},

	save: function() {
		for(var p in this.intP) this.prefs.setIntPref('extensions.autosizer.'+this.intP[p],document.getElementById(this.intP[p]).value);
		for(var p in this.boolP) this.prefs.setBoolPref('extensions.autosizer.'+this.boolP[p],document.getElementById(this.boolP[p]).checked);

		/*** Update the searchbars acording to the new prefrence. ***/
		var wi = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		                   .getService(Components.interfaces.nsIWindowMediator)
		                   .getEnumerator("navigator:browser");

		while (wi.hasMoreElements())
			wi.getNext().document.getElementById("searchbar").autosizer.autosize();
	},

	setEnDis: function() {
		document.getElementById('addBtn2Toolbar').disabled=!document.getElementById('shrinkToButton').checked;
	}
}
