var Ci = Components.interfaces;
var Cc = Components.classes;

/** Stuff from helpers **/
/*var c=window.parent.gExtensionsViewController.commands;
eval("c.cmd_options ="+c.cmd_options.toString().replace(
		 'instantApply =',
		 'instantApply = (aSelectedItem.getAttribute("addonID")=="{655397ca-4766-496b-b7a8-3a5b176ee4c2}") ||'
		));
		
var wins = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator).getEnumerator(null);
var path="chrome://autosizer/content/";
open=true;
while (wins.hasMoreElements() && open)
{
	var win = wins.getNext();
	if (win.document.documentURI == path+"prefs.xul" || win.document.documentURI == path+"wizard.xul")
	{
		win.focus(); 
		open=false;
	} 
}	
if(open)
{
	var file=(Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch).getBoolPref("browser.search.skipWizard","")?"prefs":"wizard")+".xul";
	openDialog(path+file,"","chrome,titlebar,toolbar,centerscreen,dialog=no", window.opener);
}
window.close();*/
/** End Of Stuff from helpers **/


var asw = {
	init: function() {
		try { if(window.arguments[0]) window.opener=window.arguments[0]; } catch(e){}
		asw.prefs=Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
		asw.sandbox=[[],[],[]];
		asw.mayChange=false;
		
		/* Load Saved Settings */
		var min=asw.prefs.getIntPref('browser.search.minwidth');
		var max=asw.prefs.getIntPref('browser.search.maxwidth');
		var off=asw.prefs.getIntPref('browser.search.offset');	
		document.getElementById('cleanOnSubmit').checked=asw.prefs.getBoolPref('browser.search.cleanOnSubmit');
		document.getElementById('revertOnSubmit').checked=asw.prefs.getBoolPref('browser.search.revertOnSubmit');
		document.getElementById('shrinkToButton').checked=asw.prefs.getBoolPref('browser.search.shrinkToButton');
		
		if(max==off && max>0) {
			this.path=1; // Alternative
			asw.text2desc('altWidthPixels',asw.lang('altWidth',max),false);
			asw.sandbox[1][0]=0; // Needs to be ==max for shrink2button
			asw.sandbox[1][1]=max;
			asw.sandbox[1][2]=max;
			// Guessing for fixed
			asw.sandbox[2][0]=max;
			asw.sandbox[2][1]=max;
			asw.sandbox[2][2]=off;
			// Guessing for normal
			asw.sandbox[0][1]=max;
			asw.sandbox[0][0]=0;
		} else if(min==max && min!=0) {
			this.path=2; // Fixed
			asw.text2desc('fixWidthPixels',asw.lang('fixWidth',min),false);
			asw.sandbox[2][0]=min;
			asw.sandbox[2][1]=min;
			asw.sandbox[2][2]=off;
			// Guessing for alt
			asw.sandbox[1][0]=0;
			asw.sandbox[1][1]=min;
			asw.sandbox[1][2]=min;
			// Guessing for normal
			asw.sandbox[0][1]=min;
			asw.sandbox[0][0]=0;
		} else {
			this.path=0; // normal
			
			switch(min) {
				case 0:
					asw.text2desc('norMinWidthPixels',asw.lang('minWidthTitle',''),false);
					asw.sandbox[0][0]=0;
					break;
				case 1:
					asw.text2desc('norMinWidthPixels',asw.lang('minWidthSmall',''),false);
					asw.sandbox[0][0]=1;
					break;
				default:
					asw.text2desc('norMinWidthPixels',asw.lang('minWidthPx',min),false);
					asw.sandbox[0][0]=min;
			}
			asw.sandbox[0][0]+=off; // This prevents the jumping the first time
			
			if(max==0) {
				asw.text2desc('norMaxWidthPixels',asw.lang('maxWidthWide',''),false);
				asw.sandbox[0][1]=0;
			} else {
				asw.text2desc('norMaxWidthPixels',asw.lang('maxWidthPx',max),false);
				asw.sandbox[0][1]=max;
				// Guessing for alt
				asw.sandbox[1][0]=0;
				asw.sandbox[1][1]=max;
				asw.sandbox[1][2]=max;
				// Guessing for fixed
				asw.sandbox[2][0]=max;
				asw.sandbox[2][1]=max;
				asw.sandbox[2][2]=off;
			}			
			asw.sandbox[2][2]=off;
		}
		
		document.getElementById('startBehaviour').selectedIndex=this.path;
		
		// Enable extra2 button manually
		var extra2=document.getElementById('autosizer-install-wizard').getButton('extra2');
		extra2.removeAttribute('hidden');
		extra2.setAttribute('onclick',"window.openDialog('chrome://autosizer/content/prefs.xul', '_blank', 'chrome,titlebar,toolbar,centerscreen,dialog=no',window.opener);window.close();");
		extra2.label=asw.lang('buttonAdvanced','');
		extra2.setAttribute('accesskey',asw.lang('buttonAdvancedAccesskey',''));
	},
	
	lang: function(v,t) {
		return document.getElementById("locale").getFormattedString(v, [t+'']);	
	},
	
	nextPageOnFirstPage: function() {
		nextItemVal=document.getElementById('startBehaviour').selectedItem.value;
		if(nextItemVal=='normal') newPage='norMinWidth';
		if(nextItemVal=='alternative') newPage='altWidth';		
		if(nextItemVal=='fixed') newPage='fixWidth';
		document.getElementById('start').setAttribute('next',newPage);
	},

	canAdv: function(what) { 
		document.getElementById('autosizer-install-wizard').canAdvance=what;
	},

	toggleSizing: function(what) { 	 
		asw.makeOnTop(what);				 
		asw.mayChange=what;
				
		if(what) {
			// Size searchbar according to page's text
			curPage=document.getElementById('autosizer-install-wizard').currentPage.pageid;	
			var value='nosize';
			if(curPage=='altWidth' && asw.sandbox[1][1]) value=asw.sandbox[1][1]+'';
			if(curPage=='fixWidth' && asw.sandbox[2][1]) value=asw.sandbox[2][1]+'';		
			if(curPage=='norMinWidth' && typeof asw.sandbox[0][0] != "undefined") {
				if(asw.sandbox[0][0]==0) value='label';
				else value=asw.sandbox[0][0];
			}	
			if(curPage=='norMaxWidth' && asw.sandbox[0][1]) {
				if(asw.sandbox[0][1]==0) value='max';
				else value=asw.sandbox[0][1];
			}			

			asw.prefs.setCharPref('browser.search.manualResize',value);	
			
			// Focus/Open Window
			var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
			asw.win = wm.getMostRecentWindow("navigator:browser");
			if(asw.win) asw.win.focus();
			else asw.win=window.openDialog("chrome://browser/content/", "_blank", "chrome,all,dialog=no");
			setTimeout("window.focus()",10);
			
		} else asw.prefs.setCharPref('browser.search.manualResize','');
		
		asw.prefs.setCharPref('browser.search.autosizerwizard','');	
		// Displaying the grippys is handled in autosizer.js/checkPrefs function.
		setTimeout('asw.registerPrevObsrv('+what+');',0);
	},
	
	registerPrevObsrv: function(what) {
		//if(!asw.win || (asw.win && asw.win.autosizer.booted)) asw.dragDropOsrv(what);
		if (asw) asw.dragDropOsrv(what);
		else setTimeout('asw.registerPrevObsrv('+what+');',10);
	},
	
	dragDropOsrv: function(what) {
		if (!(asw.prefs instanceof Ci.nsIPrefBranchInternal)) return;		
		if (what) {
			asw.prefObserver = new AutosizerWizPrefObserver();
			asw.prefs.addObserver('', asw.prefObserver, false);
		} else if(asw.prefObserver) asw.prefs.removeObserver('',asw.prefObserver);
		asw.win=null;
	},
	
	text2desc: function(id,text,bold) {
		var d=document.getElementById(id);
		if(d.hasChildNodes())
			d.replaceChild(document.createTextNode(text),d.firstChild);
		else
			d.appendChild(document.createTextNode(text));
		d.removeAttribute("value"); // Strangely it seems to appear from nowhere?!
		if(bold) d.setAttribute("style","font-weight:bold;");
	},

	manualSizingChange: function() {
		if(!asw.mayChange) return;
		try {
			var newValue=asw.prefs.getCharPref('browser.search.autosizerwizard');
			newValue=newValue.split('|');
			if(newValue[0]==0 || newValue[0] == undefined) return;
			// width neededWidth tooltipwidth availableWidth focus?
			if(newValue[4]=='true') window.focus();
		} catch(e) { return; }
		asw.canAdv(true);
		
		var curPage=document.getElementById('autosizer-install-wizard').currentPage.pageid;	
		switch(curPage) {
			case 'altWidth':
				asw.text2desc('altWidthPixels',asw.lang('altWidthChange',newValue[0]),true);
				asw.sandbox[1][0]=0; //
				asw.sandbox[1][1]=newValue[0];
				asw.sandbox[1][2]=newValue[0];
			break;
			
			case 'fixWidth':
				asw.text2desc('fixWidthPixels',asw.lang('fixWidthChange',newValue[0]),true);
				asw.sandbox[2][0]=newValue[0];
				asw.sandbox[2][1]=newValue[0];
				asw.sandbox[2][2]=0;
			break;
				
			case 'norMinWidth':
				asw.sandbox[0][2]=0;
				if(newValue[0]<newValue[1]*1+5) {
					asw.text2desc('norMinWidthPixels',asw.lang('minWidthSmallChange',''),true);
					asw.sandbox[0][0]=1;
				} else if(newValue[0]<newValue[2]*1+15 && newValue[0]>newValue[2]*1-15) {
					asw.text2desc('norMinWidthPixels',asw.lang('minWidthTitleChange',''),true);
					asw.sandbox[0][0]=0;
				} else {
					asw.text2desc('norMinWidthPixels',asw.lang('minWidthPxChange',newValue[0]),true);
					asw.sandbox[0][0]=newValue[0];
				}
			break;
			
			case 'norMaxWidth':
				if(newValue[0]>newValue[3]*1-70) {
					asw.text2desc('norMaxWidthPixels',asw.lang('maxWidthWideChange',''),true);
					asw.sandbox[0][1]=0;
				} else {
					asw.text2desc('norMaxWidthPixels',asw.lang('maxWidthPxChange',newValue[0]),true);
					asw.sandbox[0][1]=newValue[0];
				}
			break;
		}
	},
	
	makeOnTop: function(what) {		
		if(Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS.toLowerCase()=='darwin') return;
		try { // Thanks to console2 extension :)
			var xulWin = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsIDocShellTreeItem).treeOwner.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIXULWindow);
			xulWin.zLevel = (what) ? xulWin.highestZ : xulWin.normalZ;
		} catch(e) {}
	},
	
	savePrefs: function () {
		var p=document.getElementById('startBehaviour').selectedIndex;
		var intP1=["minwidth","maxwidth","offset","labelOffset","autocompletePopupMinWidth"];
		var intP2=[asw.sandbox[p][0],asw.sandbox[p][1],asw.sandbox[p][2],1,200];
		for(p in intP1) asw.prefs.setIntPref('browser.search.'+intP1[p], intP2[p]);
		
		var boolP=["cleanOnSubmit","revertOnSubmit","shrinkToButton"]
		for(p in boolP) asw.prefs.setBoolPref('browser.search.'+boolP[p], document.getElementById(boolP[p]).checked);
		
		if(document.getElementById('shrinkToButton').checked) {
			asw.prefs.setBoolPref("browser.search.addSBtoToolbar", true);
			// In "enlarge on first strike" mode, it's useful to skip the middle step and enlarge immmediately:
			// (empty) Button, (focused but empty) small searchbar, (not empty) large searchbar
			// It behaves identical to "fixed width" in this case.
			if(this.path==1) asw.prefs.setIntPref('browser.search.'+intP1[0], intP2[1]);
		}
		asw.cleanUp();
	},
	
	d: function(t) {
		Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService).logStringMessage('autosizerwiz: '+t);
	},
	
	cleanUp: function() {
		asw.dragDropOsrv(false); // Force in case of cancel
		asw.toggleSizing(false);
		asw.prefs.setCharPref('browser.search.autosizerwizard',''); 
		asw.prefs.setCharPref('browser.search.manualResize',''); 
		try { window.opener.focus(); } catch(e) {}
	}
}

function AutosizerWizPrefObserver() {
	asw.manualSizingChange();
}

AutosizerWizPrefObserver.prototype = {
	observe: function(subject, topic, pref) {
		if (topic == 'nsPref:changed' && pref=='browser.search.autosizerwizard') {
			try { asw.manualSizingChange(); } catch(e) {}
		}
	}
};
