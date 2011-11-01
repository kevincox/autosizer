var autosizerPref = {
  intP: ['minwidth','maxwidth','autocompletePopupMinWidth', 'offset', 'labelOffset'],
  boolP: ['cleanOnSubmit','revertOnSubmit','shrinkToButton'],
  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch),
  init: function() {
	  try { if(window.arguments[0]) window.opener=window.arguments[0]; } catch(e){}
		for(p in this.intP) document.getElementById(this.intP[p]).value=this.prefs.getIntPref('extensions.autosizer.'+this.intP[p]);
		for(p in this.boolP) document.getElementById(this.boolP[p]).checked=this.prefs.getBoolPref('extensions.autosizer.'+this.boolP[p]);

		this.setEnDis();
  },

	save: function() {
		for(p in this.intP) this.prefs.setIntPref('extensions.autosizer.'+this.intP[p],document.getElementById(this.intP[p]).value);
		for(p in this.boolP) this.prefs.setBoolPref('extensions.autosizer.'+this.boolP[p],document.getElementById(this.boolP[p]).checked);
	},

	setEnDis: function() {
		document.getElementById('addBtn2Toolbar').disabled=!document.getElementById('shrinkToButton').checked;
	}
}
