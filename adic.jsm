var EXPORTED_SYMBOLS = ["ADIC_info"]; // Don't change this or ADIC won't be able
                                      // to read this file.

var ADIC_info = {
	/// Include preferences from here down.
	prefs: ["extensions.autosizer."],
	
	/// true for system info.
	system: true,
	
	/// Should we include a list of installed extensions?
	/** If this is true they will all be included.  If it
	 *  is a list only those specified will be included.
	 */
	extensions: true, //["{6fbe1729-f5da-f7fe-cbba-f2d84e943979}"],
	
	///A list of file names to include.
	/* Relitive paths will be relitive from the profile directory.
	 */
	files: [],
	
	/* A list of things to include in the output */
	constants: {
	},
};

// vi:ft=javascript
