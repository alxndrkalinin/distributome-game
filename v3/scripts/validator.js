var Validator = (function() {

    var indent = 5; // how much &nbsp; between dots

    var DistributomeXML_Objects = null;

    var getDistributomeXml = function() {
        xmlhttp = new XMLHttpRequest();
        xmlhttp.open("GET", "./data/Distributome.xml", false);
        xmlhttp.send();
        xmlDoc = xmlhttp.responseXML;

        DistributomeXML_Objects = xmlDoc.documentElement.childNodes;
    }

    var hasEmptyValue = function(textNode) {
        return textNode.nodeValue.replace(/\n/g, '').replace(/\t/g, '').replace(/ /g, '') == '';
    }

    // Generate HTML content with indents depending on depth
    var getHtmlIndent = function(string, depth) {
        return  '<div class="item">' +
                    '&nbsp;'.repeat(indent) +
                    ('&sdot;' + '&nbsp;'.repeat(indent)).repeat(depth) +
                    '<span class="level' + (depth) + '" style="display: inline-block;">' +
                    string +
                '</span></div>';
    }

    // Generate HTML content for citations with indents depending on depth
    var getCiteHtmlIndent = function(string, depth) {
        return  '<div class="item citation">' + string + '</div>';
    }

    // Recursive parser
    var parseNodeRecursive = function(node, depth) {

        var content = '';

        // track depth of recursion
        if (typeof depth == 'number')
            depth++;
        else
            depth = 1;

        // get HTML for text nodes
        if (node.nodeType == 3 && !hasEmptyValue(node)) {

            // check if citation
            if(node.parentNode.nodeName == 'cite')
                content += '<div class="citation ' + (depth - 1) + '">' + node.nodeValue + '</div>';
            else
                content += getHtmlIndent(node.parentNode.nodeName + ': ' +  node.nodeValue, depth - 1);
        }
        else if(node.nodeType == 1) {

            // get HTML for parent nodes
            if(node.getAttribute('id') != null)
                content += getHtmlIndent(node.nodeName + ': ' +  node.getAttribute('id'), depth);
            else if(depth == 1)
                content +=  getHtmlIndent(node.nodeName.toUpperCase(), depth);

            // process children recursively
            for(var i = 0; i < node.childNodes.length; i++)
                content += parseNodeRecursive(node.childNodes[i], depth);
        }

        return content;
    }

    var parseDistributomeXml = function() {

        var content = '';
        var depth;

        if(DistributomeXML_Objects) {

            for (i = 0; i < DistributomeXML_Objects.length; i++) {
                depth = 0;
                content += parseNodeRecursive(DistributomeXML_Objects[i], depth);
            }

            return content;

        } else {
            alert("Can't load Distributome.xml");
            return false;
        }
    }

    var pasteDistributomData = function(content) {
        var divContent = document.getElementById('wrapper-content');
        // Add content to the page
        divContent.innerHTML = content;

        pasteCitations(divContent);
    }

    var pasteCitations = function(divContent) {
        // Replace citations with info from Distributome.bib
        var depth = 0;
        var cites = document.getElementsByClassName('citation');

//        try {

        for(i = 0; i < cites.length; i++) {

                depth = parseInt(cites[i].className.replace(/(?:^|\s)citation(?!\S)/g , ''));

                BibtexManager.pasteCitationByCiteTag(cites[i].innerHTML
                    , function(citation) {
                        cites[i].innerHTML = getHtmlIndent('<div style="float:left; margin-top: 5px;" class="clearfix">citation:</div>' + citation, depth);
                    }
                );
            }
//        } catch(e) {
//            alert('Cannot show citations');
//        }
        renderTexFormulas(divContent);
    }

    var renderTexFormulas = function(divContent) {
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, divContent]);
    }

    var init = function() {

        try {

            String.prototype.repeat = function( num ) {
                return new Array( num + 1 ).join( this );
            }

            getDistributomeXml();

            $(document).ready(function() {
                var content = parseDistributomeXml();
                if(content)
                    pasteDistributomData(content);
                else
                    alert('Cannot parse Distributome.xml');
            });

        } catch(e) {
            alert('Something goes wrong: ' + e.msg)
        }
    }

    return {
        init: init()
    }
})();

var BibtexManager = (function() {

    var citationsBibtex = '';
    var citations = null;

    var getCitations = function() {
        $.ajax({
            url: './data/Distributome.bib',
            async: false,
            dataType: 'text',
            success: function(data) {
                citations = (new BibtexDisplay()).parseBibtex(data);
            }
        });
    }

    var pasteCitationByCiteTag = function(cite, callback) {
        if(citations) {
            $(".bibtex_template").hide();
            var out = (new BibtexDisplay()).getCitationByKey(cite, citations);
            callback(out);
        }
    }

    function BibtexDisplay() {
        this.fixValue = function (value) {
            value = value.replace(/\\glqq\s?/g, "&bdquo;");
            value = value.replace(/\\grqq\s?/g, '&rdquo;');
            value = value.replace(/\\ /g, '&nbsp;');
            value = value.replace(/\\url/g, '');
            value = value.replace(/---/g, '&mdash;');
            value = value.replace(/{\\"a}/g, '&auml;');
            value = value.replace(/\{\\"o\}/g, '&ouml;');
            value = value.replace(/{\\"u}/g, '&uuml;');
            value = value.replace(/{\\"A}/g, '&Auml;');
            value = value.replace(/{\\"O}/g, '&Ouml;');
            value = value.replace(/{\\"U}/g, '&Uuml;');
            value = value.replace(/\\ss/g, '&szlig;');
            value = value.replace(/\{(.*?)\}/g, '$1');
            return value;
        }

        this.parseBibtex = function(input) {
            // parse bibtex input
            var b = new BibtexParser();
            b.setInput(input);
            b.bibtex();

            return b.getEntries();
        }

        this.getCitationByKey = function(cite, entries) {

            for (var entryKey in entries) {
                if(entryKey == cite.toUpperCase()) {
                    var entry = entries[entryKey];

                    if ($(".bibtex_template").size() == 0) {
                        $("body").append("<div class=\"bibtex_template\"><div class=\"if author\" style=\"font-weight: bold; margin-left: 80px; margin-top: 5px;\">\t <span class=\"if year\">\t    <span class=\"year\"></span>,  </span>\t  <span class=\"author\"></span>\t  <span class=\"if url\" style=\"margin-left: 0\">\n    <a class=\"url\" style=\"color:black; font-size:10px\">(view online)</a>\n  </span>\n</div>\n<div style=\"margin-left: 10;\">\n  <span class=\"title\"></span>");
                    }

                    var tpl = $(".bibtex_template").clone().removeClass('bibtex_template');

                    // find all keys in the entry
                    var keys = [];
                    for (var key in entry) {
                        keys.push(key.toUpperCase());
                    }

                    // find all ifs and check them
                    var removed = false;
                    do {
                        // find next if
                        var conds = tpl.find(".if");
                        if (conds.size() == 0) {
                            break;
                        }

                        // check if
                        var cond = conds.first();
                        cond.removeClass("if");
                        var ifTrue = true;
                        var classList = cond.attr('class').split(' ');
                        $.each( classList, function(index, cls){
                            if(keys.indexOf(cls.toUpperCase()) < 0) {
                                ifTrue = false;
                            }
                            cond.removeClass(cls);
                        });

                        // remove false ifs
                        if (!ifTrue) {
                            cond.remove();
                        }
                    } while (true);

                    // fill in remaining fields
                    for (var index in keys) {
                        var key = keys[index];
                        var value = entry[key] || "";
                        tpl.find("span:not(a)." + key.toLowerCase()).html(this.fixValue(value));
                        tpl.find("a." + key.toLowerCase()).attr('href', this.fixValue(value));
                    }

                    return tpl.html();
                }
            }
        }

    }

    function BibtexParser() {
        this.pos = 0;
        this.input = "";

        this.entries = {};
        this.strings = {
            JAN: "January",
            FEB: "February",
            MAR: "March",
            APR: "April",
            MAY: "May",
            JUN: "June",
            JUL: "July",
            AUG: "August",
            SEP: "September",
            OCT: "October",
            NOV: "November",
            DEC: "December"
        };
        this.currentKey = "";
        this.currentEntry = "";


        this.setInput = function(t) {
            this.input = t;
        }

        this.getEntries = function() {
            return this.entries;
        }

        this.isWhitespace = function(s) {
            return (s == ' ' || s == '\r' || s == '\t' || s == '\n');
        }

        this.match = function(s) {
            this.skipWhitespace();
            if (this.input.substring(this.pos, this.pos+s.length) == s) {
                this.pos += s.length;
            } else {
                throw "Token mismatch, expected " + s + ", found " + this.input.substring(this.pos);
            }
            this.skipWhitespace();
        }

        this.tryMatch = function(s) {
            this.skipWhitespace();
            if (this.input.substring(this.pos, this.pos+s.length) == s) {
                return true;
            } else {
                return false;
            }
            this.skipWhitespace();
        }

        this.skipWhitespace = function() {
            while (this.isWhitespace(this.input[this.pos])) {
                this.pos++;
            }
            if (this.input[this.pos] == "%") {
                while(this.input[this.pos] != "\n") {
                    this.pos++;
                }
                this.skipWhitespace();
            }
        }

        this.value_braces = function() {
            var bracecount = 0;
            this.match("{");
            var start = this.pos;
            while(true) {
                if (this.input[this.pos] == '}' && this.input[this.pos-1] != '\\') {
                    if (bracecount > 0) {
                        bracecount--;
                    } else {
                        var end = this.pos;
                        this.match("}");
                        return this.input.substring(start, end);
                    }
                } else if (this.input[this.pos] == '{') {
                    bracecount++;
                } else if (this.pos == this.input.length-1) {
                    throw "Unterminated value";
                }
                this.pos++;
            }
        }

        this.value_quotes = function() {
            this.match('"');
            var start = this.pos;
            while(true) {
                if (this.input[this.pos] == '"' && this.input[this.pos-1] != '\\') {
                    var end = this.pos;
                    this.match('"');
                    return this.input.substring(start, end);
                } else if (this.pos == this.input.length-1) {
                    throw "Unterminated value:" + this.input.substring(start);
                }
                this.pos++;
            }
        }

        this.single_value = function() {
            var start = this.pos;
            if (this.tryMatch("{")) {
                return this.value_braces();
            } else if (this.tryMatch('"')) {
                return this.value_quotes();
            } else {
                var k = this.key();
                if (this.strings[k.toUpperCase()]) {
                    return this.strings[k];
                } else if (k.match("^[0-9]+$")) {
                    return k;
                } else {
                    throw "Value expected:" + this.input.substring(start);
                }
            }
        }

        this.value = function() {
            var values = [];
            values.push(this.single_value());
            while (this.tryMatch("#")) {
                this.match("#");
                values.push(this.single_value());
            }
            return values.join("");
        }

        this.key = function() {
            var start = this.pos;
            while(true) {
                if (this.pos == this.input.length) {
                    throw "Runaway key";
                }

                if (this.input[this.pos].match("[a-zA-Z0-9_:\\./-]")) {
                    this.pos++
                } else {
                    return this.input.substring(start, this.pos).toUpperCase();
                }
            }
        }

        this.key_equals_value = function() {
            var key = this.key();
            if (this.tryMatch("=")) {
                this.match("=");
                var val = this.value();
                return [ key, val ];
            } else {
                throw "... = value expected, equals sign missing:" + this.input.substring(this.pos);
            }
        }

        this.key_value_list = function() {
            var kv = this.key_equals_value();
            this.entries[this.currentEntry][kv[0]] = kv[1];
            while (this.tryMatch(",")) {
                this.match(",");
                // fixes problems with commas at the end of a list
                if (this.tryMatch("}")) {
                    break;
                }
                kv = this.key_equals_value();
                this.entries[this.currentEntry][kv[0]] = kv[1];
            }
        }

        this.entry_body = function() {
            this.currentEntry = this.key();
            this.entries[this.currentEntry] = new Object();
            this.match(",");
            this.key_value_list();
        }

        this.directive = function () {
            this.match("@");
            return "@"+this.key();
        }

        this.string = function () {
            var kv = this.key_equals_value();
            this.strings[kv[0].toUpperCase()] = kv[1];
        }

        this.preamble = function() {
            this.value();
        }

        this.comment = function() {
            this.value(); // this is wrong
        }

        this.entry = function() {
            this.entry_body();
        }

        this.bibtex = function() {
            while(this.tryMatch("@")) {
                var d = this.directive().toUpperCase();
                this.match("{");
                if (d == "@STRING") {
                    this.string();
                } else if (d == "@PREAMBLE") {
                    this.preamble();
                } else if (d == "@COMMENT") {
                    this.comment();
                } else {
                    this.entry();
                }
                this.match("}");
            }
        }
    }

    return {
        getCitations: getCitations(),
        pasteCitationByCiteTag: pasteCitationByCiteTag
    };
})();