// Copyright 2011-2012 Kevin Cox

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

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");

function d ( msg, important )
{
	//important = true; // Uncomment for debuging.

	if ( !important && Autosizer )
	{
		if (Autosizer(null).prefs.debug.get())
			important = true;
	}

	if (!important) return;

	dump('autosizer: '+msg+'\n');
	Services.console.logStringMessage('autosizer: '+msg);
}

d("bootstrap.js loaded.");

function runOnLoad(window) {
	// Listen for one load event before checking the window type
	if (window.document.readyState == "complete")
	{
		if (window.document.documentElement.getAttribute("windowtype") == "navigator:browser")
			new Autosizer(window);
	}
	else
	{
		window.addEventListener("load", function() {
			window.removeEventListener("load", arguments.callee, false);

			runOnLoad(window);
		}, false);
	}
}

function windowWatcher(subject, topic)
{
	if (topic == "domwindowopened")
		runOnLoad(subject);
}

/*** Bootstrap Functions ***/
function startup(data, reason)
{
	Components.manager.addBootstrappedManifestLocation(data.installPath);
	Components.utils.import("chrome://autosizer/content/autosizer.jsm");

	/*** Add to new windows when they are opened ***/
	Services.ww.registerNotification(windowWatcher);

	/*** Add to currently open windows ***/
	let browserWindows = Services.wm.getEnumerator("navigator:browser");
	while (browserWindows.hasMoreElements()) {
		let browserWindow = browserWindows.getNext();

		windowWatcher(browserWindow, "domwindowopened");
	}
}

function shutdown(data, reason)
{
	if ( reason == APP_SHUTDOWN ) return;

	Services.ww.unregisterNotification(windowWatcher);
	var as = new Autosizer(null);

	as.prefs.destroy();

	while ( as.instances.length )
	{
		var ref = as.instances.pop().get();
		if (ref) // Make sure the refrence still exists.
		{
			ref.shutdown();
		}
	}

	Components.utils.unload("chrome://autosizer/content/autosizer.jsm");
	Components.manager.removeBootstrappedManifestLocation(data.installPath);
}

function install (data, reason)
{
	if ( reason == ADDON_UPGRADE )
	{
		///// Don't start syncing peoples preferences for them.
		if ( Services.prefs.getPrefType("services.sync.prefs.sync.extensions.autosizer.debug") == Services.prefs.PREF_INVALID )
		{ // They don't have the sync options.
			Components.utils.import("chrome://autosizer/content/autosizer.jsm"); // Create the preferences.

			var so = Services.prefs.getChildList("services.sync.prefs.sync.extensions.autosizer.");
			for ( i in so )
			{
				Services.prefs.setBoolPref(so[i], false);
			}

			Components.utils.unload("chrome://autosizer/content/autosizer.jsm");
		}

		///// Not a first run.
		Components.utils.import("chrome://autosizer/content/autosizer.jsm");
		var as = new Autosizer();
		as.prefo.firstrun.set(false);
		Components.utils.unload("chrome://autosizer/content/autosizer.jsm");
	}
}
