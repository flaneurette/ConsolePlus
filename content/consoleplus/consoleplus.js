/* ***** BEGIN LICENSE BLOCK *****
 * 
 * Copyright (C) 2011 SUN.IO, Sasha van den Heetkamp.
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version. This source may not be used in 
 * proprietary software and programs.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>
 *
 * SUN.IO - Sasha van den Heetkamp.
 * Electronic mail: sasha@sun.io
 *
 * ***** END LICENSE BLOCK ***** */
 
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/NetUtil.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

var globals = {

    browser: function () {
        var glue = Services.wm.getMostRecentWindow("navigator:browser");
        return glue.getBrowser();
    },

    watcher: function (url, name, features) {
        return Services.ww.openWindow(null, url, name, features, null);
    },

    observer: function () {
        return Services.obs;
    },

    classes: function (classID) {
        return Components.classes['@mozilla.org/' + classID];
    },

    sandbox: function (str) {
        var box = new Components.utils.Sandbox('about:blank');
        var result = Components.utils.evalInSandbox(str, box);
        return result;
    }
};

var cplus = {

    init: function (id) {
        return document.getElementById(id);
    },

    get: function (id) {
        return document.getElementById(id).value;
    },

    set: function (id, s) {
        document.getElementById(id).value = s;
    },

    append: function (id, s, lb) {
        if (lb) {
            document.getElementById(id).value += s + "\r\n";
        	} else {
            document.getElementById(id).value += s;
        }
    },

    sanitize: function (method, str) {
        switch (method) {
        case 'mozurl':
            str = str.replace(/(<|>|=|"|\s*)/g, '');
            break;
        case 'classlist':
            str = str.replace(/function|\[native\scode\]|\{|\}|\s+/gi, '');
            break;
        }
        return str;
    },

    logger: function (id, s) {
        if (s) {
            document.getElementById(id).value = s;
        }
    },

    tree: function (treeid, cells, colorscheme) {

        var items = document.createElement('treeitem');
        var row = document.createElement('treerow');
        if (colorscheme) {
            row.setAttribute('properties', 'classlistselect');
        }
        for (var i = 0; i < cells.length; i++) {
            var cell = document.createElement('treecell');
            cell.setAttribute('label', cells[i]);
            cell.setAttribute('value', true);
            cell.setAttribute('editable', true);
            row.appendChild(cell);
        }
        items.appendChild(row);
        document.getElementById(treeid).appendChild(items);
    },

    cleartree: function (tree) {
        var list = document.getElementById(tree);
        while (list.firstChild) {
            list.removeChild(list.firstChild);
        }
    },

    tohex: function (str) {
        return ("0" + str.toString(16)).slice(-2);
    },

    bin2hex: function (str) {
        var res = [];
        var blank = '';
        var clen = str.length;
        var hexchars = '0123456789abcdef';
        var hex = new Array(clen * 2);
        for (var i = 0; i < clen; ++i) {
            hex[i * 2] = hexchars.charAt((str.charCodeAt(i) >> 4) & 15);
            hex[i * 2 + 1] = hexchars.charAt(str.charCodeAt(i) & 15);
        }
        return hex.join('');
    },

    uuid: function (id) {
        var uuidGenerator = globals.classes("uuid-generator;1").getService(Components.interfaces.nsIUUIDGenerator);
        var uuid = uuidGenerator.generateUUID();
	this.tocaret(document.getElementById('CplusEvaluatorResult'),uuid.toString());
        return;
    },

    clearconsole: function (id) {
        this.set(id, '');
    },
    copy: function (copytext) {
        if (copytext) {
            var str = globals.classes("supports-string;1").createInstance(Components.interfaces.nsISupportsString);
            str.data = copytext;
            var trans = globals.classes("widget/transferable;1").createInstance(Components.interfaces.nsITransferable);
            trans.addDataFlavor("text/unicode");
            trans.setTransferData("text/unicode", str, copytext.length * 2);
            var clipid = Components.interfaces.nsIClipboard;
            var clip = globals.classes("widget/clipboard;1").getService(clipid);
            clip.setData(trans, null, clipid.kGlobalClipboard);
        }
    },

    copyconsole: function (id) {
        this.copy(this.get(id));
    },

    copytreerow: function () {
        if (this.getSelectedTreeItemName()) {
            this.copy(this.getSelectedTreeItemName());
        }
    },

    tocaret: function (element, snippet) {

        var selectionEnd = element.selectionStart + snippet.length;
        var currentValue = element.value;
        var beforeText = currentValue.substring(0, element.selectionStart);
        var afterText = currentValue.substring(element.selectionEnd, currentValue.length);
        element.value = beforeText + snippet + afterText;
        element.focus();
        element.setSelectionRange(selectionEnd, selectionEnd);
    },

    readconsole: function (i) {

        this.ConsoleListener = {
            console: this,
            observe: function (consoleMsg) {
                if (consoleMsg.message != '') {
                    var rl = document.getElementById("richlist").firstChild;
                    var items = document.createElement("richlistitem");
                    if (i % 2) {
                        items.setAttribute("class", "richlistA");
                    } else {
                        items.setAttribute("class", "richlistB");
                    }
                    var description = document.createElement("description");
                    description.appendChild(document.createTextNode(consoleMsg.message.replace(/%20/g, " ")));
                    items.appendChild(description);
                    rl.parentNode.insertBefore(items, rl);
                }
                i++;
            }
        };

        try {
            isupports = Components.classes['@mozilla.org/consoleservice;1'].getService();
            service = isupports.QueryInterface(Components.interfaces.nsIConsoleService);
            service.registerListener(this.ConsoleListener);
        	} catch (e) {
            return;
        }
    },

    enumerate: function (method) {

        switch (method) {

        case 'classes':
            var compound = new Array();
            var names = Components.classes;
            var classlist = [];
            for (i in names) {
                if (names[i].toString().indexOf("function") == -1 && names[i].toString() != '') {
                    classlist.push(names[i].toString().replace(/\@mozilla\.org\//g, ''));
                }
            }

            classlist.sort();

            for (var j = 0; j < classlist.length; j++) {
                var menu = document.getElementById("classesmenu");
                var item = document.createElement("menuitem");
                item.setAttribute("label", classlist[j]);
                item.setAttribute("value", 'Components.classes["@mozilla.org/' + classlist[j] + '"]');
                menu.appendChild(item);

                var menu_ref = document.getElementById("classesmenu_ref");
                var item = document.createElement("menuitem");
                item.setAttribute("label", classlist[j]);
                item.setAttribute("value", classlist[j]);
                menu_ref.appendChild(item);
            }

            break;

        case 'interfaces':
            var compound = new Array();
            var names = Components.interfaces;
            var interfacelist = [];
            for (i in names) {
                if (names[i].toString().indexOf("function") == -1) {
                    interfacelist.push(names[i].toString());
                }
            }

            interfacelist.sort();

            for (var j = 0; j < interfacelist.length; j++) {
                var menu = document.getElementById("interfacesmenu");
                var item = document.createElement("menuitem");
                item.setAttribute("label", interfacelist[j]);
                item.setAttribute("value", 'Components.interfaces.' + interfacelist[j]);
                menu.appendChild(item);
            }
            break;
        }
    },

    enumeratelist: function (list) {

        switch (list) {

        case 'elements':

            var elem = elementsXul.sort();
            for (var j = 0; j < elem.length; j++) {
                var rl = document.getElementById("elementsmenu").firstChild;
                var items = document.createElement("richlistitem");
                var description = document.createElement("description");
                description.appendChild(document.createTextNode('<' + elem[j] + '>'));
                items.appendChild(description);
                items.label = '<' + elem[j] + '>';
                rl.parentNode.insertBefore(items, rl);
            }
        break;

        case 'attributes':

            var elem = attributesXul.sort();
            for (var j = 0; j < elem.length; j++) {
                var rl = document.getElementById("attributesmenu").firstChild;
                var items = document.createElement("richlistitem");
                var description = document.createElement("description");
                description.appendChild(document.createTextNode('' + elem[j] + ''));
                items.appendChild(description);
                items.label = elem[j];
                rl.parentNode.insertBefore(items, rl);
            }

        break;

        case 'events':

            var elem = eventsXul.sort();
            for (var j = 0; j < elem.length; j++) {
                var rl = document.getElementById("eventsmenu").firstChild;
                var items = document.createElement("richlistitem");
                var description = document.createElement("description");
                description.appendChild(document.createTextNode('on' + elem[j] + ''));
                items.appendChild(description);
                items.label = 'on' + elem[j] + '';
                rl.parentNode.insertBefore(items, rl);
            }
        break;
      }

    },

    enumerateclass: function (id) {

        // clear trees first, if any.
        this.cleartree('tree-children-interfacelist');
        this.cleartree('tree-children-classlist');
		
        var result = '';
        var num = this.get('classesmenu_main_ref');
        var ref = globals.classes(num);
        k = 0;
        for (i in ref) {
            if (k == 0) {
                this.tree('tree-children-classlist', [i, this.sanitize('classlist', ref[i].toString())], true);
            	} else {
                this.tree('tree-children-classlist', [i, this.sanitize('classlist', ref[i].toString())]);
            }
            k++;
        }
		
        var names = Components.interfaces;
        for (n in names) {
            try {
                var test = globals.classes(num);
                var y = test.getService(Components.interfaces[names[n]]);
                if (y) {
                    k = 0;
                    for (t in y) {
                        if (k == 0) {
                            this.tree('tree-children-interfacelist', [names[n], this.sanitize('classlist', y[t].toString())], true);
                        	} else {
                            this.tree('tree-children-interfacelist', [names[n], this.sanitize('classlist', y[t].toString())]);
                        }
                        k++;
                    }
                }
            } catch (e) {}
        }
    },

    closetag: function (id) {
		if(document.getElementById(id).selectedItem.label) {
        	this.tocaret(document.getElementById('CplusXulText'),document.getElementById(id).selectedItem.label.replace(/</gi, '<\/'));
		}
    },

    populate: function (value) {
        this.tocaret(document.getElementById("CplusTextboxEval"), value);
    },

    populateXul: function (id) {
		if(id) {
			try {
				if(document.getElementById(id).selectedItem.label) {
					this.tocaret(document.getElementById('CplusXulText'), document.getElementById(id).selectedItem.label);
				}
				} catch(e) {
			}
		} 
    },
	
	
    explain: function (what) {
        var flags = '"menubar=yes,location=yes,resizable=yes,scrollbars=yes,status=yes,width=900,height=900"';
        switch (what) {
        case 'element':
            window.open('https://developer.mozilla.org/en/XUL/' + this.sanitize('mozurl', this.init('elementsmenu').selectedItem.label), "Element", flags);
            break;
        case 'attribute':
            window.open('https://developer.mozilla.org/en/XUL/Attribute/' + this.sanitize('mozurl', this.init('attributesmenu').selectedItem.label), "Attribute", flags);
            break;
        case 'events':
            window.open('https://developer.mozilla.org/en/XUL/Events', "Attribute", flags);
            break;
        }
    },

    clear: function () {

        var list = document.getElementById('richlist');
        var items = document.getElementById('richlist').childNodes;
        if (items.length >= 1) {
            for (var i = 1; i < items.length; ++i) {
                list.removeChild(items[i]);
            }
        }
    },

    clearval: function () {
        this.set('CplusEvaluatorResult', '');
    },

    run: function (custom) {

        var msg = '';
        var code = this.get('CplusTextboxEval');

        try {
            // first try the sandbox, if it fails use a iframe.
            var compiler = globals.sandbox(code); // create private function.
            try {
                if (compiler) {
                    msg = "> " + compiler.toString();
                } else {}
            } catch (e) {
                try {
                    // try iframe
                    var doc = document.getElementById("CplusEvaluator");
                    doc.contentWindow.location = "javascript: " + code.replace(/%/g, "%25");
                } catch (exf) {
                    msg = "> error compiling javascript command: " + exf.message + "\r\n";
                }
            }
        } catch (ex) {
            try {
                msg = "> " + code.toString();
                // try iframe
                var doc = document.getElementById("CplusEvaluator");
                doc.contentWindow.location = "javascript: " + code.replace(/%/g, "%25");
            } catch (exf) {
                msg = "> error compiling javascript command: " + exf.message + "\r\n";
            }
        }

        if (msg) {
            this.append("CplusEvaluatorResult", msg, true);
        }

        code = '';
    },

    loadxul: function () {
		
        var data = 'data:application/vnd.mozilla.xul+xml,';
        data += '<?xml version="1.0"?>';
        data += '<?xml-stylesheet href="chrome://global/skin/" type="text/css"?>';
        data += '<!DOCTYPE window SYSTEM "chrome://consoleplus/locale/cplus.dtd">';
        data += '<window xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"';
        data += ' title="XUL test" width="' + this.get('xulwidth') + '" height="' + this.get('xulheight') + '" persist="screenX screenY width height sizemode">';
        data += this.get('CplusXulText');
        data += '</window>';
        globals.watcher(data, "mozilla:extensions", "chrome,resizable=yes,all,width=" + this.get('xulwidth') + ",height=" + this.get('xulheight') + "");

    },

    loader: function (action) {

        switch (action) {
        case 'memory':
            var classIDCACHE = globals.classes('network/cache-service;1');
            var cacheService = classIDCACHE.getService(Components.interfaces.nsICacheService);
				cacheService.evictEntries(Components.interfaces.nsICache.STORE_IN_MEMORY);
            break;
        case 'profile':
            var directoryService = globals.classes('file/directory_service;1')
			.getService(Components.interfaces.nsIProperties);
            	var profileFolder = directoryService.get("ProfD", Components.interfaces.nsIFile);
            	var fileLocal = globals.classes('file/local;1')
				.getService(Components.interfaces.nsILocalFile);
            	fileLocal.initWithPath(profileFolder.path);
            	fileLocal.launch();
            break;
        case 'reloadchrome':
            var c = globals.classes('chrome/chrome-registry;1')
				.getService(Components.interfaces.nsIXULChromeRegistry);
            	c.reloadChrome();
            break;
        case 'boot':
            var flash = globals.classes('toolkit/app-startup;1')
				.getService(Components.interfaces.nsIAppStartup);
            	flash.quit(Components.interfaces.nsIAppStartup.eForceQuit | Components.interfaces.nsIAppStartup.eRestart);
            break;
        case 'ext':
            globals.watcher("chrome://mozapps/content/extensions/extensions.xul?type=extensions", "mozilla:extensions", "chrome,resizable=yes,all,width=600,height=400");
            break;
        case 'stopjs':
            globals.browser().docShell.allowJavascript = false;
            break;
        case 'startjs':
            globals.browser().docShell.allowJavascript = true;
            break;
        }
    },

    shutdown: function () {
		
        try {
            service.unregisterListener(this.ConsoleListener);
            service = null;
        } catch (e) {}
		
        try {
            var xulbox = document.getElementById("CplusXulText");
            xulbox.removeEventListener('keypress', tabCaptureXul, false);
			var xulbox2 = document.getElementById("CplusXulText");
            xulbox2.removeEventListener('keypress', tabCaptureEvent, false);
       		} catch (e) {
            // whatever... at least we tried to prevent leaks.
        }
    }
};

window.addEventListener("load", function () {
    function tabCaptureXul(e) {
        if (e.keyCode == 9) {
            cplus.tocaret(document.getElementById("CplusXulText"), "\t");
            document.getElementById("CplusXulText").focus();
            e.preventDefault();
        }
    }
	function tabCaptureEvent(e) {
        if (e.keyCode == 9) {
            cplus.tocaret(document.getElementById("CplusTextboxEval"), "\t");
            document.getElementById("CplusTextboxEval").focus();
            e.preventDefault();
        }
    }
    var xulbox = document.getElementById("CplusXulText");
    xulbox.addEventListener('keypress', tabCaptureXul, true);
 	var eventbox = document.getElementById("CplusTextboxEval");
    eventbox.addEventListener('keypress', tabCaptureEvent, true);
}, false);