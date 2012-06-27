#! /usr/bin/env python

### SETTINGS ###

locales = "chrome/locale/" # The location of the locales.

baseLocale = "en-US" # The locale to match other locales to.

addFiles = True # Wether to add new files.
addKeys = True # Wether to add new keys or not.

removeFiles = True # Wether to remove extra files or not.
removeKeys = True # Wether to remove extra keys or not.











########## START INTERNAL WORK ##########

import os, sys
import tempfile
import shutil
import string, re

class Parser:
	"""Able to parse a line into a k/v pair"""
	name    = re.compile(r"a^")
	comment = re.compile(r"a^"), # Won't match anything.
	get     = re.compile(r"([^=])*=.*")
	def parse ( self, file ):
		r = []
		for l in file:
			if self.isComment(l):
				r.append((False, l))
			else:
				m = re.match(l)
				r.append(m.group(1, 0))

		return r

	def applies ( self, name ):
		return not not self.name.match(name);

	def isComment ( self, chunk ):
		key, _ = chunk

		return not key


class ParserProperties(Parser):
	"""Able to parse a properties file."""
	name    = re.compile(r".*\.properties")
	comment = re.compile(r"#.*|^$")
	get     = re.compile(r"([^=]*)=.*")

	def parse ( self, file ):
		r = []
		for l in file:
			if self.comment.match(l):
				r.append((False, l))
			else:
				m = self.get.match(l)
				if not m: raise Exception("Input not valid")
				k, v = m.group(1, 0)
				v = v+'\n'

				r.append((k, v))

		return r

class ParserDtd(Parser):
	"""Able to parse a dtd file."""
	name    = re.compile(r".*\.dtd")
	comment = re.compile(r"a^"), # Won't match anything.
	get     = re.compile(r'(<!ENTITY[\s]*([\S]*)[\s]*"[^"]*">)')
	def parse ( self, file ):
		c = self.get.split(file.read()) # The whole match comes first.

		return [ (k, j+v) for k, j, v in zip(c[2::3], c[0::3], c[1::3]) ]

parsers = [ParserProperties(), ParserDtd()]

def findParser ( name ):
	global parsers
	for p in parsers:
		if p.applies(name): return p

	return None

locales = os.path.join(sys.path[0], locales)

### Get base locale values.

os.chdir(os.path.join(locales, baseLocale))
baseFiles = frozenset(os.listdir())
baseContent = dict()

for f in baseFiles:
	p = findParser(f)
	c = open(f)

	try: chunks = p.parse(c)
	except: raise Exception("File '{file}' is invalid.".format(file=os.path.join(baseLocale, f)))

	baseContent[f] = dict(c for c in chunks if not p.isComment(c))

### Make other locales match.

os.chdir(locales)

for locale in os.listdir():
	if locale == baseLocale: continue

	os.chdir(os.path.join(locales, locale))
	files = frozenset(os.listdir())

	missing = baseFiles.difference(files)
	for f in missing:
		if addFiles:
			print("{locale} is missing '{file}', coppying over.".format(locale=locale, file=f))
			shutil.copyfile(os.path.join(locales, baseLocale, f), os.path.join(locales, locale, f))
		else:
			print("{locale} is missing '{file}', ingoring.".format(locale=locale, file=f))


	for f in files:
		try: bc = baseContent[f]
		except:
			if removeFiles:
				print("{locale} has unessary file '{file}', removing.".format(locale=locale, file=f))
				os.remove(f)
				continue
			else:
				print("{locale} has unessary file '{file}', ignoring.".format(locale=locale, file=f))
				continue

		p = findParser(f)
		try: chunks = p.parse(open(f))
		except: raise Exception("File '{file}' is invalid.".format(file=os.path.join(locale, f)))

		changed = False

		i = -1

		keys = set()

		for c in chunks[:]:
			if p.isComment(c): continue

			i = i+1
			k, v = c

			try: v = bc[k]
			except:
				if removeKeys:
					print("{locale} has unessary key '{key}', removing.".format(locale=locale, key=k))
					del chunks[i]
					i = i-1
					changed = True
					continue
				else:
					print("{locale} has unessary key '{key}', ignoring.".format(locale=locale, key=k))
					continue

			keys.add(k)

		missing = frozenset(baseContent[f].keys()).difference(keys)
		for k in missing:
				if addKeys:
					print("{locale} is missing key '{key}', adding.".format(locale=locale, key=k))
					chunks.append((k, baseContent[f][k]))
					i = i-1
					changed = True
					continue
				else:
					print("{locale} is missing key '{key}', ignoring.".format(locale=locale, key=k))
					continue

		if changed:
			n = tempfile.NamedTemporaryFile(dir=".", mode="w", delete=False)
			n.write("".join(c for _, c in chunks))
			os.rename(n.name, f)







