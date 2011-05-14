#! /bin/bash

### Settings ###

# Files to include in the archive are selected by using $include and $ignore.
# $include and $ignore are colon seperated list of regular expressions.
# Files will be packed if they match any regular expression in $include and
# do not match any expression in $ignore.  All matching is done using the
# BASH shell regular expression pattern matching.
include='.*'
exclude='^.*\.xpi$:^.*\~$:^.*\.bak$:^\..*$:package.sh'

# The way to name the package.  This will be parsed as a shell string (in double
# quotes) so you can use shell expansion.  ".xpi" is appended to this name
#
# Defined variables are:
# 	• $name - the long name of the package.  This is taken from the
#		<em:name> element in install.rdf
# 	• $name - the code or short name of the package.  This is the name used
#		in chrome urls.  This is taken from the <em:code> element in
#		install.rdf.  NOTE: this is not a standard element and will need to
#		added to install.rdf to be used.
# 	• $ver - the version of the package.  This is taken from the <em:name>
#		element in install.rdf
xpiname='$code-$ver' # The name of the .xpi package (".xpi" is appended)

# The root directory of the extention.  This is where the program will look for
# the sources.
extdir="$(pwd)"





########## START INTERNAL WORK ##########

### Convience Functions ###
die ()
{
	echo $2
	exit $1
}

### Go to the source dir ###
origdir=$(pwd) # We will need this later when we make the package
cd "$extdir"

### Check Dependancies ###
which 'zip' &> /dev/null || die 1 'Dependicies not satisfied: Could not find zip.'
[ -f 'install.rdf' ]     || die 3 'Could not find source files: install.rdf'

### The Info To Use ###

needname='^(.*[^\\]){,1}(\\\\)*(\$\{[^A-Za-z_]{,1}name([^A-Za-z_][^}]*){0,1}\}|\$name([^A-Za-z_]|$))' # If we need a name
getname='<em:name>([^<]*)</em:name>'      # Get application name from install.rdf
needcode='^(.*[^\\]){,1}(\\\\)*(\$\{[^A-Za-z_]{,1}code([^A-Za-z_][^}]*){0,1}\}|\$code([^A-Za-z_]|$))' # If we need a code
getcode='<em:code>([^<]*)</em:code>'      # Get short name from install.rdf
needver='^(.*[^\\]){,1}(\\\\)*(\$\{[^A-Za-z_]{,1}ver([^A-Za-z_][^}]*){0,1}\}|\$ver([^A-Za-z_]|$))'    # If we need a version
getver='<em:version>([^<]*)</em:version>' # Get application version from install.rdf

insrdf="$(cat install.rdf)"
if [[ "$xpiname" =~ $needname ]]; then
	if [[ "$insrdf" =~ $getname ]]; then
		name="${BASH_REMATCH[1]}"
	else
		die 2 'Could not get info: name'
	fi
fi
if [[ "$xpiname" =~ $needcode ]]; then
	if [[ "$insrdf" =~ $getcode ]]; then
		code="${BASH_REMATCH[1]}"
	else
		die 2 'Could not get info: code'
	fi
fi
if [[ "$xpiname" =~ $needver ]]; then
	if [[ "$insrdf" =~ $getver ]]; then
		ver="${BASH_REMATCH[1]}"
	else
		die 2 'Could not get info: version'
	fi
fi

xpiname=$(eval "echo \"$xpiname\"") # Handle all the variables

### Find a Good Temp Directory ###
tempdir="$extdir/.package.shTEMPDIR"
while [ -e "$tempdir" ]; do
	tempdir="$tempdir-"
done
mkdir -p "$tempdir"

recursiveadd ()
{
	for file in $(ls -A1)
	do		
		file="$(pwd)/$file"

		filename="${file##$(dirname "$file")/}"
		
		if [ -d "$file" ]; then
			filename="$filename/"
		fi
		
		if [[ "$file" == "$tempdir" ]]; then
			continue
		fi
		
		for req in $include
		do
			if [[ "$filename" =~ $req ]]; then
				isinignore='false'
				for ign in $exclude
				do
					if [[ "$filename" =~ $ign ]]; then
						isinignore='true'
						break
					fi
				done
				
				if [ $isinignore == 'false' ]; then
					if [ -d "$file" ]; then
						mkdir "$tempdir${file##$origdir}"
						cd "$file"
						recursiveadd
						cd ..
					else
						ln "$file" "$tempdir${file##$origdir}"
					fi
				fi
				
				break
			fi				
		done		
	done
}

oldIFS="$IFS"
IFS=':
'
set -f

recursiveadd

IFS="$oldIFS"
set +f

rm "$xpiname.xpi" &> /dev/null
cd "$tempdir"
zip -r1 "$origdir/$xpiname.xpi" .

rm -r "$tempdir"
