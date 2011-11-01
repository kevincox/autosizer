function Autosizer ( )
{
	// URL change observer
	var autosizerProgressListener = {
		QueryInterface: function(aIID) {
			if (aIID.equals(Ci.nsIWebProgressListener) || aIID.equals(Ci.nsISupportsWeakReference) || aIID.equals(Ci.nsISupports))
				return this;
			throw Components.results.NS_NOINTERFACE;
		},
		onProgressChange: function (aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
		onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {},
		onSecurityChange: function(aWebProgress, aRequest, aState) {},
		onLinkIconAvailable: function(a) {},
		onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {},
		onLocationChange: function(aProgress, aRequest, aLocation) { if (aLocation) setTimeout(function(){autosizer.genWidthCheck('onLocChange')}, 40); }
	}

	var autosizer = {
		booted: false,
		////////////////////////////////////////////////////////
		// Service Functions (init, elem "observer", prefserv)
		init: function() {
			this.prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch).getBranch('extensions.autosizer.');

			this.updateElementRefs();
			this.setupPrefObsrv();
			this.copyStylesToLabel();

			addEventListener("resize",function() { autosizer.onResize(); }, false);
			getBrowser().addProgressListener(autosizerProgressListener, Ci.nsIWebProgress.STATE_STOP);

			var self = this;
			setTimeout(function () {
				self.booted = true;
				self.genWidthCheck('startup');
			}, 0);
		},

		originalHandleSearchCommand: null,
		addAfterSubmitCheck: function() {
			if (this.originalHandleSearchCommand) return; // Already did it.

			this.originalHandleSearchCommand = this.txt.handleSearchCommand;

			var self = this;
			this.txt.handleSearchCommand = function () {
				self.originalHandleSearchCommand.apply(this, arguments);

				self.afterSubmit();
			};
		},

		copyStylesToLabel: function() {
			var s=['font-Size','font-Size-Adjust','font-Stretch','font-Style','font-Variant','font-Weight','letter-Spacing','word-Spacing'];
			for(let a in s)
				this.label.style[s[a].replace(/-/g, "")]=document.defaultView.getComputedStyle(this.input, '').getPropertyValue(s[a]);
		},

		updateElementRefs: function() {
			this.txt=this.byId("searchbar");
			this.sBox = this.byId("search-container");
			this.label=this.byId('autosizer-label');
			var tb=this.txt._textbox;
			this.button=this.byId("autosizer-button");

			var splitter = this.byId("urlbar-search-splitter");
			if(splitter) splitter.parentNode.removeChild(splitter);

			this.sBox.flex=0;

			// Only needed when interface is rebuilt
			if(!tb.hasAttribute('popMinWidth')) {
				tb.setAttribute("popMinWidth", this.prefs.getIntPref('autocompletePopupMinWidth'));
				/*if(tb && "openPopup" in tb)
					eval("tb.openPopup ="+tb.openPopup.toString().replace(
						'width > 100 ? width : 100',
						'Math.max(this.getAttribute("popMinWidth"), width)'
						));*/

				this.getNeededWidth();
				this.showHideGrippys();

				// Detect SearchWP
				this.searchwp=false;
				if(document.getAnonymousElementByAttribute(tb, "anonid", "tokens-container")) {
					this.searchwp=document.getAnonymousElementByAttribute(
										document.getAnonymousElementByAttribute(tb, "anonid", "tokens-container"),
										"class", "box-inherit scrollbox-innerbox");
				}
			}

			this.input=tb.inputField;
			this.diffWidth=(1+this.sBox.boxObject.width)-this.input.offsetWidth;
			if(this.tooltipDiffWidth!=this.diffWidth) {
				this.getTooltipWidth();
				this.genWidth();
			}
		},

		setupPrefObsrv: function() {
			this.prefs.QueryInterface(Ci.nsIPrefBranch2);
			this.prefs.addObserver("", this, false);
			this.checkPrefs();
			window.addEventListener("unload", function() { autosizer.prefs = null; }, false);
		},

		observe: function (subject, topic, data) {
			if (topic == "nsPref:changed") {
				this.checkPrefs();
			}
		},

		checkPrefs: function() {
			if(!this.booted) {
				var self = this;
				setTimeout(function(){self.checkPrefs();}, 30); // Wait while Firefox still opens a browser window
				return;
			}

			if(this.prefs.getBoolPref('addSBtoToolbar')) this.addSBtoToolbar();

			this.shrinkToButton=this.prefs.getBoolPref('shrinkToButton');
			this.offset=this.prefs.getIntPref('offset');
			this.labelOffset=this.prefs.getIntPref('labelOffset');
			this.minwidth=this.prefs.getIntPref('minwidth');
			this.maxwidth=this.prefs.getIntPref('maxwidth');
			this.cleanOnSubmit=this.prefs.getBoolPref('cleanOnSubmit');
			this.revertOnSubmit=this.prefs.getBoolPref('revertOnSubmit');

			if(!this.txt._textbox) this.updateElementRefs();
			this.txt._textbox.setAttribute("popMinWidth", this.prefs.getIntPref('autocompletePopupMinWidth'));
			this.txt._popup.setAttribute("onclick", "autosizer.skipOnce=true;"); // Prevents shrinking to button if engine selected

			setTimeout(function(){
				autosizer.getTooltipWidth();
				autosizer.genWidth();
				autosizer.genWidthCheck('checkPrefs');
			},0);

			// For the wizard only
			this.manualResize=this.prefs.getCharPref('manualResize');
			this.showHideGrippys();

			if(!this.manualResize.length || this.dragging) return;

			if(this.manualResize=='max') this.sBox.width=(window.outerWidth-this.neededWidth);
			else if(this.manualResize=='label') this.sBox.width=this.tooltipwidth;
			else if(this.manualResize=='nosize') {}
			else this.sBox.width=this.manualResize;

			this.txt.value='';
			setTimeout(function(){
				autosizer.moveGrippys();
				autosizer.flashGrippys(10);
			}, 0);
		},

		////////////////////////////////////////////////////////
		// Autosize "Core" Functions
		genWidthCheck: function(type,evt) {
			if(this.manualResize.length) return;
			//this.d("Caller: "+type);
			this.updateElementRefs();

			// Otherwise the searchbar won't shrink when tokenized
			var tokenCheck=(this.isTokenized() && type=="onLocChange") || (this.isTokenized()!=this.lastState);
			if(tokenCheck) this.sBox.width=this.minwidth;

			if(this.label.value!=this.txt.value || tokenCheck) this.genWidth();

			// Prevents uneeded calls in "event chains" (e.g. onBlur, onFocus and checkPrefs when selecting engine)
			clearTimeout(this.hideTimeout);
			this.hideTimeout=setTimeout(function(){
				autosizer.hideSB(type)
			}, 10);
		},

		genWidth: function() {
			// When sizing manually, we don't want any events to break this. If search bar is hidden, results are useless
			if(this.manualResize.length || this.sBox.hidden) return;
			this.lastState=this.isTokenized();

			var availableWidth=window.outerWidth-this.neededWidth-this.diffWidth;
			this.label.value=this.txt.value;

			if(this.lastState)
				var width=this.searchwp.boxObject.width+this.diffWidth+this.offset+12; // +12 explanation: This is the amout of additional space SearchWP needs in order not to display "..."
			else
				var width=this.label.boxObject.width+this.diffWidth+this.offset+9; // +9 explanation: When the user hits a letter and the searchbox is too small, Gecko realigns the text before Autosizer can expand the box. Expanding doesn't realign automatically though, and there is no way to force it. Instead, the searchbox is sized in advance. The widest letter is W and it's 9 pixels in width for most fonts, hence the number.

			if((this.isEmpty() || width<this.tooltipwidth) && this.tooltipwidth>0 && this.minwidth==0) // Set size for search engine title
				width=this.tooltipwidth+this.labelOffset; // set tooltip width (grey text)

			if(width>this.maxwidth && this.maxwidth>0) width=this.maxwidth; // set max width
			if(width<this.minwidth && this.minwidth>0) width=this.minwidth; // set min width
			if(width>availableWidth && availableWidth>0) width=availableWidth; // available width
			if(width<this.diffWidth) width=this.diffWidth; // needed width

			this.sBox.width=width;
		},

		////////////////////////////////////////////////////////
		// Clean & Revert after Submit Feature
		afterSubmit: function() {
			if(this.cleanOnSubmit) {
				this.txt.value='';
				this.txt.empty=true;
				window.setTimeout(function(){
					autosizer.genWidthCheck('afterSubmit');
				});
			}
			if(this.revertOnSubmit) {
				if(!this.txt.engines) this.txt.rebuildPopup()
				this.txt.currentEngine=this.txt.engines[0];
			}
		},

		////////////////////////////////////////////////////////
		// Shrink To Button Feature
		showSB: function(btn) {
			if(!btn) btn=this.button;
			this.skipOnce=true;
			this.sBox.hidden=false;
			if(btn) this.button.hidden=true;
			this.txt.focus();
		},

		hideSB: function(type) {
			if(this.skipOnce) {
				setTimeout(function(){
					autosizer.skipOnce=false;
				}, 0);
			}
			var prevState=this.sBox.hidden;
			// Don't shrink when: Wizard opened, focus event, the engine menu is opened, skipOnce is true or feature disabled
			if(!this.manualResize.length && type!="onFocus" && this.txt._popup.state=='closed' && !this.skipOnce && this.shrinkToButton) {
				this.sBox.hidden=this.isEmpty();
				if(this.button) this.button.hidden=!this.isEmpty();
			}	else {
				this.sBox.hidden=false;
				if(this.button) this.button.hidden=true;
			}
			if(prevState!=this.sBox.hidden && prevState) autosizer.genWidthCheck('unhideSB');
		},

		addSBtoToolbar: function() {
			this.prefs.setBoolPref('addSBtoToolbar', false); // Add it only once. If this fails, we're doomed.
			try {
				// Try to insert to the right of search bar. If search bar no present, insert rightmost on nav-bar
				var tb = this.sBox.parentNode;
				if(!tb) tb = document.getElementById('nav-bar');
				var curSet = tb.currentSet;
				if (curSet.indexOf("autosizer-button") != -1) return;
				if(curSet.indexOf("search-container") != -1)
					var set = curSet.replace(/search-container/, "search-container,autosizer-button");
				else
					var set = curSet + ",autosizer-button";

				tb.setAttribute("currentset", set);
				tb.currentSet = set;
				document.persist(tb.getAttribute("id"), "currentset");
				try {
					BrowserToolboxCustomizeDone(true);
				} catch (e) { this.d("Failed to call CustomizeDone(). Funny things are about to happen now! "+e); }

				setTimeout(function(){
					autosizer.genWidthCheck("buttonAdd")
				}, 0);
			} catch(e) { this.d("Failed to add toolbar button, please add it yourself if you wish so "+e); }
		},

		// For dropping text on the	button
		getSupportedFlavours : function () {
		var flavours = new FlavourSet();
		flavours.appendFlavour("text/unicode");
		return flavours;
	  },

	  onDragOver: function (event, flavour, session) {},

	  onDrop: function (event, dropdata, session) {
		if (dropdata.data == "") return;
			autosizer.txt.value=dropdata.data;
			autosizer.showSB();
			autosizer.txt.handleSearchCommand();
	  },

		////////////////////////////////////////////////////////
		// Helper & convenience functions
		getTooltipWidth: function() {
			if(!this.txt.currentEngine) return;
			this.tooltipDiffWidth=(1+this.sBox.boxObject.width)-this.input.offsetWidth;
			let temp=this.label.value;
			this.label.value=this.txt.currentEngine.name;
			this.tooltipwidth=this.label.boxObject.width+this.tooltipDiffWidth;

			this.label.value=temp;
		},

		getNeededWidth: function() {
			var toolbaritems=this.sBox.parentNode.childNodes,i,x;
			this.neededWidth=0;
			for(i=0;x=toolbaritems[i];i++) {
				if(x.id=='search-container' || x.tagName=='toolbarspring') continue;
				if(x.id=="urlbar-container") x.removeAttribute("width"); // inserted by splitter
				let flextemp=x.getAttribute('flex');
				x.setAttribute('flex', 0);
				this.neededWidth+=x.boxObject.width+1;
				x.setAttribute('flex',flextemp);
			}
			this.neededWidth++;
		},

		onResize: function() {
			var old=this.sBox.width;
			this.genWidth();
			if(this.sBox.width <= old) return;
			// Re-Align the text when enlarging
			let x=this.txt._textbox;
			let selStart=x.selectionStart;
			let selEnd=x.selectionEnd;
			[this.txt.value, this.txt.value] = ['', this.txt.value];
			x.selectionStart=selStart;
			x.selectionEnd=selEnd;
		},

		d: function(t) {
			dump('autosizer: '+t);
			Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService).logStringMessage('autosizer: '+t);
		},

		isEmpty: function() {
			return (this.txt.value.length==0);
		},

		isTokenized: function() {
			return (this.searchwp && this.txt._textbox.hasAttribute("tokenized"));
		},

		byId: function(i) {
			return window.document.getElementById(i);
		},

		fixPopup: function() {
			// onfocus: Work around autocomplete bug 414134
			var p=this.txt._textbox.popup;
			if(p.popupOpen) return;
			p.hidden=true;
		},

		////////////////////////////////////////////////////////
		// MANUAL RESIZING FUNCTION, thanks to resize search box
		startDrag: function(aEvent, ltr) {
			const a=autosizer;
			if(aEvent.button == 0) {
				a.startX = aEvent.clientX;
				a.startY = aEvent.clientY;
				a.dragging = true;
				a.ltr = ltr;

				a.sLen = a.sBox.width;	//store original width for calculations

				window.addEventListener("mousemove", a.whileDrag, true);
				window.addEventListener("mouseup", a.endDrag, true);
			}
		},

		whileDrag: function(aEvent) {
			const a=autosizer;
			if(a.dragging) {
				var dX = aEvent.clientX - a.startX;
				var dY = aEvent.clientY - a.startY;

				//If the pointer wanders too far while dragging we will assume it was an accidental drag and abort.
				if(Math.abs(dY) > 140) {
					a.clearDrag(true);
					return;
				}

				if(!a.ltr) dX *= -1;

				if(a.sLen - dX > a.diffWidth && a.sLen - dX < window.outerWidth-a.neededWidth) {
					a.sBox.width = a.sLen - dX;
					if(a.sBox.boxObject.width!=autosizer.sBox.width) {
						a.sBox.width=a.sBox.boxObject.width;
						a.diffWidth=a.sBox.width;
					}
					a.moveGrippys();
					a.saveDrag('false');
				}
			} else a.clearDrag(true);
		},

		endDrag: function(aEvent) {
			autosizer.saveDrag('true');
			autosizer.clearDrag(false);
		},

		clearDrag: function(revert) {
			const a=autosizer;
			a.dragging = false;
			window.removeEventListener("mousemove", a.whileDrag, true);
			window.removeEventListener("mouseup", a.endDrag, true);

			if(revert) {
				a.sBox.width = a.sLen;
				this.moveGrippys();
			}
		},

		saveDrag: function(f) {
			const a=autosizer;
			// Send info back to wizard. Contains current width+comparison values in order to make useful suggestions
			a.prefs.setCharPref("autosizerwizard", a.sBox.width+'|'+a.diffWidth+'|'+a.tooltipwidth+'|'+(window.outerWidth-a.neededWidth)+'|'+f);
		},

		showHideGrippys: function() {
			if(!this.manualResize) this.manualResize='';
			var show=this.manualResize.length?true:false;
			if(this.shrinkToButton && show) this.showSB();
			var display = show?"block":"none";

			var r=this.byId('autosizer-size-right');
			var l=this.byId('autosizer-size-left');

			l.style.display = display;
			r.style.display = display;
		},

		moveGrippys: function() {
			const a=autosizer.sBox.boxObject;
			const t=autosizer.txt.boxObject;
			var r=autosizer.byId('autosizer-size-right');
			var l=autosizer.byId('autosizer-size-left');

			l.style.left=a.x+'px';
			l.style.height=(t.height-4)+'px';
			l.style.top=t.y+'px';

			r.style.left=(a.x+a.width-(2+r.boxObject.width))+'px';
			r.style.height=(t.height-4)+'px';
			r.style.top=(t.y)+'px';
		},

		flashGrippys: function( num ) {
			var r=this.byId('autosizer-size-right');
			var l=this.byId('autosizer-size-left');

			var vis = ( num % 2 )?"hidden":"visible"; // None is first so we end on "visible"

			l.style.visibility = vis;
			r.style.visibility = vis;

			if ( num > 0 ) {
				window.setTimeout(function(){
					autosizer.flashGrippys(num-1);
				}, 200);
			}
		},
	}

	autosizer.init();
	return autosizer;
}

window.addEventListener("load",function() {
	window.removeEventListener("load",function() { arguments.callee ; }, false);
	autosizer = new Autosizer();
}, false);

