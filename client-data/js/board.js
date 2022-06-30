/**
 *                        WHITEBOPHIR
 *********************************************************
 * @licstart  The following is the entire license notice for the
 *  JavaScript code in this page.
 *
 * Copyright (C) 2013  Ophir LOJKINE
 *
 *
 * The JavaScript code in this page is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License (GNU GPL) as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.  The code is distributed WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU GPL for more details.
 *
 * As additional permission under GNU GPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * @licend
 */

var Tools = {};

Tools.i18n = (function i18n() {
	var translations = JSON.parse(document.getElementById("translations").text);
	return {
		"t": function translate(s) {
			var key = s.toLowerCase().replace(/ /g, '_');
			return translations[key] || s;
		}
	};
})();

Tools.server_config = JSON.parse(document.getElementById("configuration").text);

Tools.board = document.getElementById("board");
Tools.svg = document.getElementById("canvas");
Tools.drawingArea = Tools.svg.getElementById("drawingArea");


//Initialization
Tools.curTool = null;
Tools.drawingEvent = true;
Tools.showMarker = true;
Tools.showOtherCursors = true;
Tools.showMyCursor = true;

Tools.isIE = /MSIE|Trident/.test(window.navigator.userAgent);

Tools.socket = null;
Tools.connect = function () {
	var self = this;

	// Destroy socket if one already exists
	if (self.socket) {
		self.socket.destroy();
		delete self.socket;
		self.socket = null;
	}


	this.socket = io.connect('', {
		"path": window.location.pathname.split("/boards/")[0] + "/socket.io",
		"reconnection": true,
		"reconnectionDelay": 100, //Make the xhr connections as fast as possible
		"timeout": 1000 * 60 * 20 // Timeout after 20 minutes
	});

	//Receive draw instructions from the server
	this.socket.on("broadcast", function (msg) {
		$('#attend').html(msg.userName);
		$('#cursor_name').html(msg.userName)
		var pointer = document.getElementById('my_cursor');
		pointer.style.left = msg.x+'px';
		pointer.style.top = (msg.y-155)+'px';
		handleMessage(msg).finally(function afterload() {
			var loadingEl = document.getElementById("loadingMessage");
			// loadingEl.classList.add("hidden");
		});
	});

	this.socket.on("reconnect", function onReconnection() {
		Tools.socket.emit('joinboard', Tools.boardName);
	});
};

Tools.connect();

Tools.boardName = (()=> {
	// var board = Tools.generateUID("doc");
	// window.myBoards = window.myBoards.push(board) 
	// return board;	
	var path = window.location.pathname.split("/");
	window.myBoards = [decodeURIComponent(path[path.length - 1])];
	return decodeURIComponent(path[path.length - 1]);
})();



Tools.positionElement = function (elem, x, y) {
	elem.style.top = y + "px";
	elem.style.left = x + "px";
};

Tools.getMarkerBoundingRect = function(el,r,m){
	var marker = el.getAttributeNS(null,"marker-end");		
	if(marker && marker.split("_")[0]=="url(#arrw"){
		
		var x = el.x1.baseVal.value;
		var x2 = el.x2.baseVal.value;
		var y = el.y1.baseVal.value;
		var y2 = el.y2.baseVal.value;

		var strokeWidth = (el.getAttributeNS(null,"stroke-width") || 0);

		var rad = Math.atan2(y2 - y, x2 - x);
	  
		var l = 6*strokeWidth;
		var h = 2*strokeWidth;

		var p1 = [[l * Math.cos(rad) + x2],[ l * Math.sin(rad) + y2],[1]];
		var p2 = [[h * Math.sin(rad) + x2],[ h * Math.cos(rad) + y2],[1]];
		var p3 = [[-h * Math.sin(rad) + x2],[ -h * Math.cos(rad) + y2],[1]];
		p1 = Tools.multiplyMatrices(m,p1);
		console.log(p1);
		p2 = Tools.multiplyMatrices(m,p2);
		p3 = Tools.multiplyMatrices(m,p3);
		r.x = Math.min(p1[0][0],p2[0][0], p3[0][0]);
		r.y = Math.min(p1[1][0],p2[1][0], p3[1][0]);
		r.width =  Math.max(p1[0][0],p2[0][0], p3[0][0]) - r.x;
		r.height = Math.max(p1[1][0],p2[1][0], p3[1][0]) - r.y;
		console.log(r);
		return true;
	}else{
		return false;
	}
};

Tools.adjustBox = function(el,r,m){
    var strokeWidth =  (el.getAttributeNS(null,"stroke-width") || 0) - 0;
    var mat = {
        a:m[0][0],
        b:m[1][0],
        c:m[0][1],
        d:m[1][1],
        e:0,
        f:0,
    }
	var result = Tools.decomposeMatrix(mat);
	var rot = result.rotation*Math.PI/180;
    var xstroke = Math.hypot(Math.cos(rot)*result.scale[0],Math.sin(rot)*result.scale[1])*strokeWidth*.6;
    var ystroke = Math.hypot(Math.cos(rot)*result.scale[1],Math.sin(rot)*result.scale[0])*strokeWidth*.6;
    r.x-=xstroke;
    r.y-=ystroke;
    r.width+=2*xstroke;
    r.height+=2*ystroke;
};

Tools.composeRects = function(r,r2){
	var x1 = Math.min(r.x,r2.x);
	var y1 = Math.min(r.y,r2.y);
	var x2 = Math.max(r.x+r.width,r2.x+r2.width);
	var y2 = Math.max(r.y+r.height,r2.y+r2.height);
	r.x = x1;
	r.y = y1;
	r.width = x2 - r.x;
	r.height = y2 - r.y
};

Tools.multiplyMatrices = function(m1, m2) {
    var result = [];
    for (var i = 0; i < m1.length; i++) {
        result[i] = [];
        for (var j = 0; j < m2[0].length; j++) {
            var sum = 0;
            for (var k = 0; k < m1[0].length; k++) {
                sum += m1[i][k] * m2[k][j];
            }
            result[i][j] = sum;
        }
    }
    return result;
};

Tools.decomposeMatrix = function(mat) {
	var a = mat.a;
	var b = mat.b;
	var c = mat.c;
	var d = mat.d;
	var e = mat.e;
	var f = mat.f;
  
	var delta = a * d - b * c;
  
	let result = {
	  translation: [e, f],
	  rotation: 0,
	  scale: [0, 0],
	  skew: [0, 0],
	};
  
	// Apply the QR-like decomposition.
	if (a != 0 || b != 0) {
	  var r = Math.sqrt(a * a + b * b);
	  result.rotation = b > 0 ? Math.acos(a / r) : -Math.acos(a / r);
	  result.scale = [r, delta / r];
	  result.skew = [Math.atan((a * c + b * d) / (r * r)), 0];
	} else if (c != 0 || d != 0) {
	  var s = Math.sqrt(c * c + d * d);
	  result.rotation =
		Math.PI / 2 - (d > 0 ? Math.acos(-c / s) : -Math.acos(c / s));
	  result.scale = [delta / s, s];
	  result.skew = [0, Math.atan((a * c + b * d) / (s * s))];
	} else {
	  // a = b = c = d = 0
	}
	result.rotation=result.rotation*180/Math.PI;
	result.skew[0]=result.skew[0]*180/Math.PI
	result.skew[1]=result.skew[1]*180/Math.PI
	return result;
  };




//Get the board as soon as the page is loaded
Tools.socket.emit("getboard", Tools.boardName);

function saveBoardNametoLocalStorage() {
  window.myBoards.forEach(function(name, index) {
    if(Tools.boardName === name) {
	  $('#board_count').text(''+(index+1)+'/'+window.myBoards.length+'');
	  if(window.myBoards.length === index+1) {
	  	$("#boardNext").css('pointer-events', 'none');
	  }else{
	  	$("#boardNext").css('pointer-events', 'visible');
	  }
	  if(index+1 == 1) {
	  	$("#boardPrev").css('pointer-events', 'none');	  	
	  }else{
	  	$("#boardPrev").css('pointer-events', 'visible');
	  }
    }
  });
}
// Refresh recent boards list on each page show

// var check = ((localStorage.getItem('myBoards') != null ) || (localStorage.getItem('myBoards').length != 0));
// alert(check)
window.myBoards = localStorage.getItem('myBoards') ? JSON.parse(localStorage.getItem('myBoards')) : [Tools.boardName]
// window.addEventListener("pageshow", saveBoardNametoLocalStorage);
saveBoardNametoLocalStorage()
window.Type = '';
window.grid = '';
window.hSize = 40;
window.tSize = 4;
window.fill = false;
function changeTool(name, event, toolName, secondary = false) {
	console.log(window.grid, name, toolName)
	window.toolName = name;
		if(toolName == 'Grid') {
			window.grid = name
		}
		if(name == 'palmEraser') {
			window.eraser = 'palmEraser'
		}else{
			window.eraser = ''
		}
	if(localStorage.getItem('tool') != name) {
		if(name == 'highliter') {
		var chooser = document.getElementById("chooseSize");
			chooser.value = '40';
			var chooseOpacity = document.getElementById("chooseOpacity");
				chooseOpacity.value = 0.4;
		}else{
		var chooser = document.getElementById("chooseSize");
			chooser.value = '4';
			var chooseOpacity = document.getElementById("chooseOpacity");
				chooseOpacity.value = 1;
		}
		document.getElementById("handwriting").innerHTML = '';
		document.getElementById("handwriting").style.display = 'none';
			window.xAxis = []
			window.yAxis = []
			window.axis = []
			window.object = [];
		if((name == 'circle_fill') || (name == 'square_fill') || (name == 'rectangle_fill') || (name == 'ellipse_fill')) {
			window.fill = true;
		}else{
			window.fill = false;
		}
		if(name === 'handwriting') {
			window.Type = 'handwrite';
		}else if(name === 'magic_pen') {
			window.Type = 'magic';
		}else{
			window.Type = '';
		}
		localStorage.setItem('tool',name)
		// console.log(name, event, toolName, secondary)
		  if(event) {
			  for (const li of document.querySelectorAll("li.curTool")) {
			   	 li.classList.remove("curTool");
			  }
			event.currentTarget.classList.add("curTool");
		  }
		  // if(toolName == 'Touch Up Eraser') {
		  // 	toolName = '"Touch Up" Eraser'
		  // }
		Tools.change(toolName);
		if(toolName == 'Zoom') {
		    window.clicks = 0;
            var origin = {
                "scrollX": 0,
                "scrollY": 0,
                "x": 667,
                "y": 472,
                "clientY": 283,
                "scale": 1
            }
            if(window.zoom == 1) {
                window.clicks=window.clicks+1
            }
            if(window.zoom == -1) {
                if(window.clicks != -2) {
                    window.clicks=window.clicks+(-1)
                }
            }
            if(window.clicks > -2 ) {
                var delta = window.zoom;
                var scale = Tools.getScale() * (1 + delta * .5);
                // zoom(origin, scale);
            }
	        if(window.zoom == 0) {
	            scale = 1;
		        // console.log(origin, scale)
	        }            
	        var oldScale = origin.scale;
	        var newScale = Tools.setScale(scale);
	        window.scrollTo(
	            origin.scrollX + origin.x * (newScale - oldScale),
	            origin.scrollY + origin.y * (newScale - oldScale)
	        );
			changeTool('hand',event, 'Hand');
        }
		if(secondary === true) {
			var newTool = Tools.list[toolName];
			var oldTool = Tools.curTool;
			if (!newTool) throw new Error("Trying to select a tool that has never been added!");
			if (newTool === oldTool) {
				if (newTool.secondary) {
					newTool.secondary.active = true;
					var props = newTool.secondary.active ? newTool.secondary : newTool;
					Tools.HTML.toggle(newTool.name, props.name, props.icon);
					if (newTool.secondary.switch) newTool.secondary.switch();
				}
				return;
			}
		}else{
			var newTool = Tools.list[toolName];
			var oldTool = Tools.curTool;
			if (!newTool) throw new Error("Trying to select a tool that has never been added!");
			if (newTool === oldTool) {
				if (newTool.secondary) {
					newTool.secondary.active = false;
					var props = newTool.secondary.active ? newTool.secondary : newTool;
					Tools.HTML.toggle(newTool.name, props.name, props.icon);
					if (newTool.secondary.switch) newTool.secondary.switch();
				}
				return;
			}
		// Tools.change(toolName);
		}		
	}

};

Tools.HTML = {
	template: new Minitpl("#tools > .tool"),
	addShortcut: function addShortcut(key, callback) {
		window.addEventListener("keydown", function (e) {
			if (e.key === key && !e.target.matches("input[type=text], textarea")) {
				callback();
			}
		});
	},
	addTool: function (toolName, toolIcon, toolIconHTML, toolShortcut, oneTouch) {
		// var callback = function () {
		// 	console.log('Vinay Kumar','Change Tool Name')
		// 	Tools.change(toolName);
		// };
		// this.addShortcut(toolShortcut, function () {
		// 	Tools.change(toolName);
		// 	document.activeElement.blur && document.activeElement.blur();
		// });
		// return this.template.add(function (elem) {
		// 	elem.addEventListener("click", callback);
		// });
	},
	changeTool: function (oldToolName, newToolName) {
		// var oldTool = document.getElementById("toolID-" + oldToolName);
		// var newTool = document.getElementById("toolID-" + newToolName);
		// if (oldTool) oldTool.classList.remove("curTool");
		// if (newTool) newTool.classList.add("curTool");
	},
	toggle: function (toolName, name, icon) {
		// var elem = document.getElementById("toolID-" + toolName);

		// // Change secondary icon
		// var primaryIcon = elem.getElementsByClassName("primaryIcon")[0];
		// var secondaryIcon = elem.getElementsByClassName("secondaryIcon")[0];
		// var primaryIconSrc = primaryIcon.src;
		// var secondaryIconSrc = secondaryIcon.src;
		// primaryIcon.src = secondaryIconSrc;
		// secondaryIcon.src = primaryIconSrc;

		// // Change primary icon
		// elem.getElementsByClassName("tool-icon")[0].src = icon;
		// elem.getElementsByClassName("tool-name")[0].textContent = Tools.i18n.t(name);
	},
	addStylesheet: function (href) {
		//Adds a css stylesheet to the html or svg document
		var link = document.createElement("link");
		link.href = href;
		link.rel = "stylesheet";
		link.type = "text/css";
		document.head.appendChild(link);
	},
	colorPresetTemplate: new Minitpl("#colorPresetSel .colorPresetButton"),
	addColorButton: function (button) {
		var setColor = Tools.setColor.bind(Tools, button.color);
		if (button.key) this.addShortcut(button.key, setColor);
		// return this.colorPresetTemplate.add(function (elem) {
			// elem.addEventListener("click", setColor);
			// elem.id = "color_" + button.color.replace(/^#/, '');
			// elem.style.backgroundColor = button.color;
			// if (button.key) {
			// 	// elem.title = Tools.i18n.t("keyboard shortcut") + ": " + button.key;
			// }
		// });
	}
};

Tools.list = {}; // An array of all known tools. {"toolName" : {toolObject}}

Tools.isBlocked = function toolIsBanned(tool) {
	if (tool.name.includes(",")) throw new Error("Tool Names must not contain a comma");
	return Tools.server_config.BLOCKED_TOOLS.includes(tool.name);
};

/**
 * Register a new tool, without touching the User Interface
 */
Tools.register = function registerTool(newTool) {
	if (Tools.isBlocked(newTool)) return;

	if (newTool.name in Tools.list) {
		console.log("Tools.add: The tool '" + newTool.name + "' is already" +
			"in the list. Updating it...");
	}

	//Format the new tool correctly
	Tools.applyHooks(Tools.toolHooks, newTool);

	//Add the tool to the list
	Tools.list[newTool.name] = newTool;

	// Register the change handlers
	if (newTool.onSizeChange) Tools.sizeChangeHandlers.push(newTool.onSizeChange);

	//There may be pending messages for the tool
	var pending = Tools.pendingMessages[newTool.name];
	if (pending) {
		console.log("Drawing pending messages for '%s'.", newTool.name);
		var msg;
		while (msg = pending.shift()) {
			//Transmit the message to the tool (precising that it comes from the network)
			newTool.draw(msg, false);
		}
	}
};

/**
 * Add a new tool to the user interface
 */
Tools.add = function (newTool) {
	if (Tools.isBlocked(newTool)) return;

	Tools.register(newTool);

	if (newTool.stylesheet) {
		Tools.HTML.addStylesheet(newTool.stylesheet);
	}

	//Add the tool to the GUI
	Tools.HTML.addTool(newTool.name, newTool.icon, newTool.iconHTML, newTool.shortcut, newTool.oneTouch);
};

Tools.change = function (toolName) {
	var newTool = Tools.list[toolName];
	var oldTool = Tools.curTool;
	if (!newTool) throw new Error("Trying to select a tool that has never been added!");
	if (newTool === oldTool) {
		if (newTool.secondary) {
			newTool.secondary.active = !newTool.secondary.active;
			var props = newTool.secondary.active ? newTool.secondary : newTool;
			Tools.HTML.toggle(newTool.name, props.name, props.icon);
			if (newTool.secondary.switch) newTool.secondary.switch();
		}
		return;
	}
	if (!newTool.oneTouch) {
		//Update the GUI
		var curToolName = (Tools.curTool) ? Tools.curTool.name : "";
		try {
			Tools.HTML.changeTool(curToolName, toolName);
		} catch (e) {
			console.error("Unable to update the GUI with the new tool. " + e);
		}
		Tools.svg.style.cursor = newTool.mouseCursor || "auto";
		Tools.board.title = Tools.i18n.t(newTool.helpText || "");

		//There is not necessarily already a curTool
		if (Tools.curTool !== null) {
			//It's useless to do anything if the new tool is already selected
			if (newTool === Tools.curTool) return;

			//Remove the old event listeners
			Tools.removeToolListeners(Tools.curTool);

			//Call the callbacks of the old tool
			Tools.curTool.onquit(newTool);
		}

		//Add the new event listeners
		Tools.addToolListeners(newTool);
		Tools.curTool = newTool;
	}

	//Call the start callback of the new tool
	newTool.onstart(oldTool);
};

Tools.addToolListeners = function addToolListeners(tool) {
	for (var event in tool.compiledListeners) {
		var listener = tool.compiledListeners[event];
		var target = listener.target || Tools.board;
		target.addEventListener(event, listener, { 'passive': false });
	}
};

Tools.removeToolListeners = function removeToolListeners(tool) {
	for (var event in tool.compiledListeners) {
		var listener = tool.compiledListeners[event];
		var target = listener.target || Tools.board;
		target.removeEventListener(event, listener);
		// also attempt to remove with capture = true in IE
		if (Tools.isIE) target.removeEventListener(event, listener, true);
	}
};

(function () {
	// Handle secondary tool switch with shift (key code 16)
	function handleShift(active, evt) {
		if (evt.keyCode === 16 && Tools.curTool.secondary && Tools.curTool.secondary.active !== active) {
			Tools.change(Tools.curTool.name);
		}
	}
	window.addEventListener("keydown", handleShift.bind(null, true));
	window.addEventListener("keyup", handleShift.bind(null, false));
})();

Tools.send = function (data, toolName) {
	toolName = toolName || Tools.curTool.name;
	var d = data;
	d.tool = toolName;
	d.userName = window.randomUser
	Tools.applyHooks(Tools.messageHooks, d);
	var message = {
		"board": Tools.boardName,
		"data": d,
	};
	$('#attend').html(message.data.userName);
	Tools.socket.emit('broadcast', message);
};

window.xAxis = [];
window.yAxis = [];
window.axis = [];
window.tAxis = [];
var startTime = 0;
Tools.drawAndSend = function (data, tool) {
	startTime = Date.now();
	if (tool == null) tool = Tools.curTool;
	tool.draw(data, true);
	if((window.Type == 'magic' || window.Type == 'handwrite') && data) {
		if(data.x != undefined && data.y != undefined)
        var time = Date.now() - startTime;
		window.xAxis.push(parseInt(data.x))
		window.yAxis.push(parseInt(data.y))
		window.tAxis.push(time)
		window.axis = [window.xAxis, window.yAxis, window.tAxis];
		// console.log(window.axis);
	}else{
		window.xAxis = [];
		window.yAxis = [];
		window.axis = [];
		window.tAxis = []
		window.object = [];
	}
	Tools.send(data, tool.name);
};

//Object containing the messages that have been received before the corresponding tool
//is loaded. keys : the name of the tool, values : array of messages for this tool
Tools.pendingMessages = {};

// Send a message to the corresponding tool
function messageForTool(message) {
	var name = message.tool,
		tool = Tools.list[name];

	if (tool) {
		Tools.applyHooks(Tools.messageHooks, message);
		tool.draw(message, false);
	} else {
		///We received a message destinated to a tool that we don't have
		//So we add it to the pending messages
		if (!Tools.pendingMessages[name]) Tools.pendingMessages[name] = [message];
		else Tools.pendingMessages[name].push(message);
	}

	if (message.tool !== 'Hand' && message.transform != null) {
		//this message has special info for the mover
	    messageForTool({ tool: 'Hand', type: 'update', transform: message.transform, id: message.id});
	}
}

// Apply the function to all arguments by batches
function batchCall(fn, args) {
	var BATCH_SIZE = 1024;
	if (args.length === 0) {
		return Promise.resolve();
	} else {
		var batch = args.slice(0, BATCH_SIZE);
		var rest = args.slice(BATCH_SIZE);
		return Promise.all(batch.map(fn))
			.then(function () {
				return new Promise(requestAnimationFrame);
			}).then(batchCall.bind(null, fn, rest));
	}
}

// Call messageForTool recursively on the message and its children
function handleMessage(message) {
	if (message._children) 
	//Check if the message is in the expected format
	if (!message.tool && !message._children) {
		console.error("Received a badly formatted message (no tool). ", message);
	}
	if (message.tool) messageForTool(message);
	if (message._children) return batchCall(handleMessage, message._children);
	else return Promise.resolve();
}

Tools.unreadMessagesCount = 0;
Tools.newUnreadMessage = function () {
	Tools.unreadMessagesCount++;
	updateDocumentTitle();
};

window.addEventListener("focus", function () {
	Tools.unreadMessagesCount = 0;
	updateDocumentTitle();
});

function updateDocumentTitle() {
	document.title =
		(Tools.unreadMessagesCount ? '(' + Tools.unreadMessagesCount + ') ' : '') +
		Tools.boardName +
		" | WBO";
}

(function () {
	// Scroll and hash handling
	var scrollTimeout, lastStateUpdate = Date.now();

	window.addEventListener("scroll", function onScroll() {
		var x = window.scrollX / Tools.getScale(),
			y = window.scrollY / Tools.getScale();

		clearTimeout(scrollTimeout);
		scrollTimeout = setTimeout(function updateHistory() {
			var hash = '#' + (x | 0) + ',' + (y | 0) + ',' + Tools.getScale().toFixed(2);
			if (Date.now() - lastStateUpdate > 5000 && hash != window.location.hash) {
				window.history.pushState({}, "", hash);
				lastStateUpdate = Date.now();
			} else {
				window.history.replaceState({}, "", hash);
			}
		}, 100);
	});

	function setScrollFromHash() {
		var coords = window.location.hash.slice(1).split(',');
		var x = coords[0] | 0;
		var y = coords[1] | 0;
		var scale = parseFloat(coords[2]);
		resizeCanvas({ x: x, y: y });
		if (Tools.list["Zoom In"]) {
			Tools.scaleIndex = 2;
			for(var i = 0; i < Tools.scaleDefaults.length;i++){
				if(Tools.scaleDefaults[i]==scale)Tools.scaleIndex = i;
			}
			scale=Tools.scaleDefaults[Tools.scaleIndex]
		}
		Tools.setScale(scale);
		window.scrollTo(x * scale, y * scale);
	}

	window.addEventListener("hashchange", setScrollFromHash, false);
	window.addEventListener("popstate", setScrollFromHash, false);
	window.addEventListener("DOMContentLoaded", setScrollFromHash, false);
})();

function resizeCanvas(m) {
	//Enlarge the canvas whenever something is drawn near its border
	var x = m.x | 0, y = m.y | 0
	var MAX_BOARD_SIZE = 65536; // Maximum value for any x or y on the board
	if (x > Tools.svg.width.baseVal.value - 2000) {
		//Tools.svg.width.baseVal.value = Math.min(x + 2000, MAX_BOARD_SIZE);
	}
	if (y > Tools.svg.height.baseVal.value - 2000) {
		//Tools.svg.height.baseVal.value = Math.min(y + 2000, MAX_BOARD_SIZE);
	}
}

function updateUnreadCount(m) {
	if (document.hidden && ["child", "update"].indexOf(m.type) === -1) {
		Tools.newUnreadMessage();
	}
}

Tools.messageHooks = [updateUnreadCount];

Tools.scale = 1.0;
var scaleTimeout = null;
Tools.setScale = function setScale(scale) {
	if (isNaN(scale)) scale = 1;
	scale = Math.max(0.4, Math.min(10, scale));
	//Tools.svg.willChange = 'width, height';
	//Tools.svg.style.transform = 'scale(' + scale + ')';
	//svg.setAttributeNS(null, "width", svgWidth * percent);
	//svg.setAttributeNS(null, "height", svgHeight * percent);
	
    Tools.svg.width.baseVal.value = svgWidth*scale;// Tools.svg.width.baseVal.value/scale;
	Tools.svg.height.baseVal.value = svgHeight*scale;//Tools.svg.height.baseVal.value/scale;
	//Tools.svg.style.width = svgWidth*scale;// Tools.svg.width.baseVal.value/scale;
	//Tools.svg.style.height = svgHeight*scale;
	//Tools.svg.setAttributeNS(null, "viewBox", "0 0 " + svgWidth + " " + svgHeight);
	clearTimeout(scaleTimeout);
	scaleTimeout = setTimeout(function () {
		$('#save-text').hide()
        $('#left-menu').show()
        $('.footernav').show()
		Tools.svg.style.willChange = 'auto';
	}, 1000);
	Tools.scale = scale; 
	return scale;
}
Tools.getScale = function getScale() {
	return Tools.scale;
}

//List of hook functions that will be applied to tools before adding them
Tools.toolHooks = [
	function checkToolAttributes(tool) {
		if (typeof (tool.name) !== "string") throw "A tool must have a name";
		if (typeof (tool.listeners) !== "object") {
			tool.listeners = {};
		}
		if (typeof (tool.onstart) !== "function") {
			tool.onstart = function () { };
		}
		if (typeof (tool.onquit) !== "function") {
			tool.onquit = function () { };
		}
	},
	function compileListeners(tool) {
		//compile listeners into compiledListeners
		var listeners = tool.listeners;

		//A tool may provide precompiled listeners
		var compiled = tool.compiledListeners || {};
		tool.compiledListeners = compiled;

		function compile(listener) { //closure
			return (function listen(evt) {
				evt.preventDefault()
				var x = evt.pageX / Tools.getScale(),
					y = evt.pageY / Tools.getScale();
				return listener(x, y, evt, false);
			});
		}

		function compileTouch(listener) { //closure
			return (function touchListen(evt) {
				//Currently, we don't handle multitouch
				// if(evt.targetTouches) {
				// 	evt.preventDefault();
				// 	return false;					
				// }
				if(evt.targetTouches.length > 1) {
					evt.preventDefault()
					// window.zoom=0;changeTool('zoom',event, 'Zoom');
					changeTool('hand',event, 'Hand');
				}
				if (evt.changedTouches.length === 1) {
					var touch = evt.changedTouches[0];
					var x = touch.pageX / Tools.getScale(),
						y = touch.pageY / Tools.getScale();
					return listener(x, y, evt, true);
				}
				return true;
			});
		}

		function wrapUnsetHover(f, toolName) {
			return (function unsetHover(evt) {
				document.activeElement && document.activeElement.blur && document.activeElement.blur();
				return f(evt);
			});
		}

		if (listeners.press) {

			compiled["mousedown"] = wrapUnsetHover(compile(listeners.press), tool.name);
			compiled["touchstart"] = wrapUnsetHover(compileTouch(listeners.press), tool.name);
		}
		if (listeners.move) {
			compiled["mousemove"] = compile(listeners.move);
			compiled["touchmove"] = compileTouch(listeners.move);
		}
		if (listeners.release) {
			var release = compile(listeners.release),
				releaseTouch = compileTouch(listeners.release);
			compiled["mouseup"] = release;
			// compiled["mouseleave"] = release;
			// compiled["touchleave"] = releaseTouch;
			compiled["touchend"] = releaseTouch;
			compiled["touchcancel"] = releaseTouch;
		}
	}
];

Tools.applyHooks = function (hooks, object) {
	//Apply every hooks on the object
	hooks.forEach(function (hook) {
		hook(object);
	});
};


// Utility functions

Tools.generateUID = function (prefix, suffix) {
	var uid = Date.now().toString(36); //Create the uids in chronological order
	uid += (Math.round(Math.random() * 36)).toString(36); //Add a random character at the end
	if (prefix) uid = prefix + uid;
	if (suffix) uid = uid + suffix;
	return uid;
};

Tools.createSVGElement = function createSVGElement(name, attrs) {
	var elem = document.createElementNS(Tools.svg.namespaceURI, name);
	if (typeof (attrs) !== "object") return elem;
	Object.keys(attrs).forEach(function (key, i) {
		elem.setAttributeNS(null, key, attrs[key]);
	});
	return elem;
};

Tools.positionElement = function (elem, x, y) {
	elem.style.top = y + "px";
	elem.style.left = x + "px";
};

Tools.colorPresets = [
	{ color: "#4aa2f9", key: '1' },
	// { color: "#FF4136", key: '2' },
	// { color: "#0074D9", key: '3' },
	// { color: "#FF851B", key: '4' },
	// { color: "#FFDC00", key: '5' },
	// { color: "#3D9970", key: '6' },
	// { color: "#91E99B", key: '7' },
	// { color: "#90468b", key: '8' },
	// { color: "#7FDBFF", key: '9' },
	// { color: "#AAAAAA", key: '0' },
	// { color: "#E65194" }
];

Tools.color_chooser = document.getElementById("chooseColor");

let color_chooser1 = document.getElementById("chooseColor1");
console.log()
function colorchange(color) {
	Tools.svg.style.backgroundColor = color;
}
Tools.setColor = function (color) {
	// console.log(color)
	Tools.color_chooser.value = color;
};

function chooseColor(color) {
	Tools.setColor(color)
	// changeTool('', Tools.toolName)
	// Tools.color_chooser.value = color;	
}

Tools.getColor = (function color() {
	var color_index = (Math.random() * Tools.colorPresets.length) | 0;
	var initial_color = Tools.colorPresets[color_index].color;
	Tools.setColor(initial_color);
	return function () { return Tools.color_chooser.value; };
})();

Tools.colorPresets.forEach(Tools.HTML.addColorButton.bind(Tools.HTML));

Tools.sizeChangeHandlers = [];
Tools.setSize = (function size() {
		var chooser = document.getElementById("chooseSize");
		chooser.addEventListener('touchmove', function(event){
		    //event.preventDefault();
		});
	function update() {
		var size = Math.max(1, Math.min(100, chooser.value | 0));
		chooser.value = size;
		Tools.sizeChangeHandlers.forEach(function (handler) {
			// console.log(handler)
			handler(size);
		});
	}
	update();

	chooser.onchange = chooser.oninput = update;
	return function (value) {
		if (value !== null && value !== undefined) { chooser.value = value; update(); }
		if(window.toolName == 'highliter') {
			window.hSize = chooser.value
		}else{
			window.tSize = chooser.value
		}
		return parseInt(chooser.value);
	};
})();

Tools.getSize = (function () { 
	return Tools.setSize() 
});

Tools.getOpacity = (function opacity() {
	var chooser = document.getElementById("chooseOpacity");
	var opacityIndicator = document.getElementById("opacityIndicator");

	function update() {
		opacityIndicator.setAttribute("opacity", chooser.value);
	}
	update();

	chooser.onchange = chooser.oninput = update;
	return function () {
		return Math.max(0.1, Math.min(1, chooser.value));
	};
})();


//Scale the canvas on load
Tools.svg.width.baseVal.value = document.body.clientWidth;
Tools.svg.height.baseVal.value = document.body.clientHeight;

function resize_view(){
	//Scale the canvas on load
	var screenWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
	var screenHeight =  Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
	svgWidth = Tools.svg.width.baseVal.value = Math.max(screenWidth + 2000, screenWidth);
	svgHeight = Tools.svg.height.baseVal.value =  Math.max(screenHeight + 2000, screenHeight);
	Tools.svg.setAttributeNS(null, "viewBox", "0 0 " + svgWidth + " " + svgHeight);
}

$(document).ready(function(){
	$(window).resize(function(){
	resize_view();
	var scale = Tools.getScale().toFixed(2);
	Tools.setScale(scale);
	var coords = window.location.hash.slice(1).split(',');
	var x = coords[0] | 0;
	var y = coords[1] | 0;
	
	var hash = '#' + (x | 0) + ',' + (y | 0) + ',' + scale;
	window.history.pushState({}, "", hash);
	
		
	 
	});
});
resize_view();
/**
 What does a "tool" object look like?
 newtool = {
	  "name" : "SuperTool",
	  "listeners" : {
			"press" : function(x,y,evt){...},
			"move" : function(x,y,evt){...},
			"release" : function(x,y,evt){...},
	  },
	  "draw" : function(data, isLocal){
			//Print the data on Tools.svg
	  },
	  "onstart" : function(oldTool){...},
	  "onquit" : function(newTool){...},
	  "stylesheet" : "style.css",
}
*/


(function () {
    var pos = {top: 0, scroll:0};
    var menu = document.getElementById("menu");
    function menu_mousedown(evt) {
	pos = {
	    top: menu.scrollTop,
	    scroll: evt.clientY
	}
	menu.addEventListener("mousemove", menu_mousemove);
	document.addEventListener("mouseup", menu_mouseup);
    }
    function menu_mousemove(evt) {
	var dy = evt.clientY - pos.scroll;
	menu.scrollTop = pos.top - dy;
    }
    function menu_mouseup(evt) {
	menu.removeEventListener("mousemove", menu_mousemove);
	document.removeEventListener("mouseup", menu_mouseup);
    }
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()
		$('#object_tools').addClass('inactive').removeClass('active').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#math_tools').addClass('inactive').removeClass('active').hide()
		$('#math_obj_tools').addClass('inactive').removeClass('active').hide()
    menu.addEventListener("mousedown", menu_mousedown);

	  var recentBoards = window.myBoards;
	  if (recentBoards.length === 0) return;
	  console.log(Tools.boardName, recentBoards)
// notification 
	window.notification_url = "http://65.108.95.12:9001/api/notificaitons";
    $('#notification').css("display", "none")
	// setInterval(() => {
	// 		$.ajax({
 //                type: "GET",
 //                url: window.notification_url+'/all',
 //                dataType: "json",
 //                success: function (result, status, xhr) {
 //                	let obj = result.data
	// 			    if(obj.length) {
	// 				    $('#notification_title').html(obj[0].title)
	// 				    $('#notification_desc').html(obj[0].body)
	// 				    window.notification_id = obj[0]._id
	// 				    $('#notification').css("display", "block")
	// 			    }
 //                }
 //            });
	// },5000)
})()

function closeNotification() {
    $('#notification').css("display", "none")
	$.ajax({
	    type: "DELETE",
	    url: window.notification_url+'/'+window.notification_id,
	    dataType: "json",
	    success: function (result, status, xhr) {

	    }
	});
}

function updateDiv(){ 
	$("#canvas").load(" #canvas > *" );
}
    function AddPage() {
		Tools.boardName = Tools.generateUID();
		let bgData = document.getElementById('board');
    		bgData.style.background = '';		
		window.myBoards.push(Tools.boardName);
		localStorage.setItem('myBoards', JSON.stringify(window.myBoards))
		Tools.socket.emit('joinboard', Tools.boardName);
		Tools.socket.emit('getboard', Tools.boardName);
	    window.history.pushState('boards',null, Tools.boardName);
		Tools.drawingArea.innerHTML = '';
		saveBoardNametoLocalStorage()
		loadBoards()
	  // var recentBoards = JSON.parse(localStorage.getItem("pdf-pages")) || [];
	  // recentBoards.forEach(function(name, index) {
	  // 	console.log(Tools.boardName)
	  //   if(Tools.boardName == name) {
	  //   	if(recentBoards.length == index+1) {
	  //   		// alert()
	  //   		Tools.boardName = 'page_'+recentBoards.length
	  //   		Tools.socket.emit("getboard", Tools.boardName);
	  //   		// setTimeout(() => {
	  //   			// console.log(JSON.parse(localStorage.getItem("pdf-pages")));
			//     	window.location.href = `/boards/`+Tools.boardName+'?new';
			// 	  // $('#board_count').text(''+recentBoards.length+'/'+recentBoards.length+'');
	  //   		// },500)
	  //   	}else{
		 //    	window.location.href = `/boards/${encodeURIComponent(recentBoards[index+1])}`;
	  //   	}
	  //   }
	  // });
    }

    function boardPrev() {
	  var recentBoards = window.myBoards;
	  let currentBoard = Tools.boardName;
	  // updateDiv()
	  Tools.drawingArea.innerHTML = '';
	  recentBoards.forEach(function(name, index) {
	    if((currentBoard === name) && (recentBoards.length > 1)) {
	    	if(index != 0)
	    		// alert()
		    	Tools.boardName = recentBoards[index-1];
			    window.history.pushState('boards',null, Tools.boardName);
				// Tools.socket.emit('joinboard', Tools.boardName);
				// Tools.socket.emit('getboard', Tools.boardName);
				window.location.reload()
				// Tools.connect()
				// saveBoardNametoLocalStorage()

				// window.addEventListener("pageshow", saveBoardNametoLocalStorage);

				// return true;
		    // 	window.location.href = `/boards/${encodeURIComponent(recentBoards[index-1])}`;
			// $('#board_count').text(''+(index+1)+'/'+recentBoards.length+'');
	    }
	  });
    }

    function boardNext() {
	  var recentBoards = window.myBoards;
	  let currentBoard = Tools.boardName;
	  Tools.drawingArea.innerHTML = '';
	  window.myBoards.forEach(function(name, index) {
	    if((currentBoard === name) && (window.myBoards.length > 1)) {
	    	if(index+1 != window.myBoards.length){
	    		console.log(Tools.boardName, name)
		    	Tools.boardName = window.myBoards[index+1];
			    window.history.pushState('boards',null, Tools.boardName);
				Tools.socket.emit('joinboard', Tools.boardName);
				Tools.socket.emit('getboard', Tools.boardName);
				// Tools.connect()
				saveBoardNametoLocalStorage()
				// return true;
			}
	    }
	  });
    }    

	function switchBoard(currentBoard) {
    	Tools.boardName = currentBoard;
	    window.history.pushState('boards',null, Tools.boardName);
	    window.location.reload()
		// Tools.socket.emit('joinboard', Tools.boardName);
		// Tools.socket.emit('getboard', Tools.boardName);
		// // Tools.connect()
		// saveBoardNametoLocalStorage()
	}


// var bgArray = ['1','2','3','4','5','6','7','8','9','10', '11', '12'];
var xlinkNS = "http://www.w3.org/1999/xlink";
window.bgimage = '';
    function bgImage(path, id) {
		var bgArray = ['1','2','3','4','5','6','7','8','9','10', '11', '12'];
    	console.log(window.bgimage, path)
			$(".stbgimg").removeClass("bgichecked");
    		$(".stbgimg span").removeClass('bg_remove');			
			elem = svg.getElementById(window.bgimage);
    		let bgData = document.getElementById('board');
			if(elem != null) {
	    		bgData.style.background = '';
				Tools.drawingArea.removeChild(elem);
			}
			// console.log(window.bgimage, 'bg_image_'+id)
			if(window.bgimage != 'bg_image_'+id) {
	    		bgData.style.background = "url("+path+")"
	    		bgData.style.width = '1600px'
	    		bgData.style.height = '800px'
			    bgData.style.backgroundSize = 'cover'; /* or contain depending on what you want */
			    bgData.style.backgroundPosition =  'center center';
			    bgData.style.backgroundRepeat = 'no-repeat';
	    		$('#bg_image_'+id).addClass('bgichecked');
	    		$('#bg_delete_'+id).addClass('bg_remove');
		  //   var img = Tools.createSVGElement("image");
			 //    img.setAttribute("width", 1500);
			 //    img.setAttribute("id", 'bg_image_'+id);
			 //    img.setAttribute("class", 'canvas_bg');
			 //    img.setAttribute("height", 1000);
			 //    img.setAttributeNS(xlinkNS, "href", path);
				// // img.setAttribute("transform",msg.transform);
			 //    Tools.drawingArea.appendChild(img);
		  //        var msg = {
		  //               id: 'bg_image_'+id,
		  //               type:"doc",
		  //               src: path,
		  //               w: 1500,
		  //               h: 1000,
		  //               x: '10',
		  //               y: '10'
		  //               //fileType: fileInput.files[0].type
		  //           };
		  //           Tools.send(msg,"Document");
			}else{
				$(".stbgimg").removeClass("bgichecked");
	    		$(".stbgimg span").removeClass('bg_remove');
	    		bgData.style.background = '';
			}
		    window.bgimage = 'bg_image_'+id				
    }

   function searchImagesProp(path) {
	    var img = Tools.createSVGElement("image");
		    img.setAttribute("width", window.screen.width);
		    img.setAttribute("class", 'canvas_bg');
		    img.setAttribute("height", window.screen.height);
		    img.setAttributeNS(xlinkNS, "href", path);
			// img.setAttribute("transform",msg.transform);
		    Tools.drawingArea.appendChild(img);
		    renderImage(path)
    }

	function renderImage(path) {
            var uid = Tools.generateUID("doc"); // doc for document
            var msg = {
                id: uid,
                type:"doc",
                src: path,
                w: 400,
                h: 400,
                x: '200',
                y: '50'
                //fileType: fileInput.files[0].type
            };
            draws(msg);
            Tools.send(msg,"Document");
        	changeTool('selector',event, 'Hand', true)
        }

	function bgMathImage(path, imgId='', isPdf = false) {
            var uid = Tools.generateUID("pdf-"); // doc for document
            if(isPdf === true) {
	            var msg = {
	                id: uid,
	                type:"pdf",
	                src: path,
	                w: 800,
	                h: 1500,
	                x: '400',
	                y: '-200'
	                //fileType: fileInput.files[0].type
	            };
	            draws(msg, true);
	        	changeTool('selector',event, 'Hand', true)
            }else{
	            var msg = {
	                id: uid,
	                type:"doc",
	                src: path,
	                w: 400,
	                h: 400,
	                x: '200',
	                y: '50'
	                //fileType: fileInput.files[0].type
	            };
	            draws(msg, false);
	            // Tools.send(msg,"Document");
	        	changeTool('selector',event, 'Hand', true)
            }
            
            if(imgId != '') {
	       		$('#'+imgId).addClass('checked')
		  		window.imageId.forEach(x =>{
	    			if(x != imgId) {
			    		$('#'+x).removeClass('checked')
	    			}
	    		});
    		}else{
	    		$('.canvas_bg').remove()
	    		bgArray.forEach(x =>{
			    		$('#'+x).removeClass('checked')
	    		});
            }
	}

	function draws(msg, ispdf = false) {
		// document.getElementById('math_tools').style.display = "none";
			// $('#math_tools').addClass('inactive').removeClass('active').hide()
	    //const file = self ? msg.data : new Blob([msg.data], { type: msg.fileType });
	    //const fileURL = URL.createObjectURL(file);

	   // fakeCanvas.style.background = `url("${fileURL}") 170px 0px no-repeat`;
	    //fakeCanvas.style.backgroundSize = "400px 500px";
	    var aspect = msg.w/msg.h
	    var img = Tools.createSVGElement("image");
	    img.id=msg.id;
	    img.setAttributeNS(xlinkNS, "href", msg.src);
	    img.x.baseVal.value = msg['x'];
	    img.y.baseVal.value = msg['y'];
	    img.setAttribute("class", "layer-"+Tools.layer);
	    img.setAttribute("width", msg.w);
	    img.setAttribute("height", msg.h);
        Tools.send(msg,"Document");
	    if(msg.transform)
				img.setAttribute("transform",msg.transform);
	    Tools.drawingArea.appendChild(img);
	    
	}

function newBoard() {
	$('#save-text').show()
	$("#dialog-confirm").dialog({
      resizable: false,
      height: "auto",
      width: 400,
      modal: true,
      buttons: {
        "Save": function() {
        		$('#save-text').hide()
			changeTool('download',event, 'Download')
			window.myBoards = [];
			localStorage.setItem('myBoards', JSON.stringify(window.myBoards))
			setTimeout(() => {
    		let bgData = document.getElementById('board');
	    		bgData.style.background = '';
				Tools.boardName = Tools.generateUID();
			    window.history.pushState('boards',null, Tools.boardName);
				Tools.socket.emit('joinboard', Tools.boardName);
				Tools.socket.emit('getboard', Tools.boardName);
				window.myBoards.push(Tools.boardName);
				localStorage.setItem('myBoards', JSON.stringify(window.myBoards))
				saveBoardNametoLocalStorage()
				Tools.drawingArea.innerHTML = '';
				loadBoards()
			},500)
          $( this ).dialog( "close" );
        },
        "Don't Save": function() {
	$('#save-text').hide()
			window.myBoards = [];
			localStorage.setItem('myBoards', JSON.stringify(window.myBoards))
			setTimeout(() => {
    		let bgData = document.getElementById('board');
	    		bgData.style.background = '';
				Tools.boardName = Tools.generateUID();
			    window.history.pushState('boards',null, Tools.boardName);				
				Tools.socket.emit('joinboard', Tools.boardName);
				Tools.socket.emit('getboard', Tools.boardName);
				window.myBoards.push(Tools.boardName);
				localStorage.setItem('myBoards', JSON.stringify(window.myBoards))
				saveBoardNametoLocalStorage()
				Tools.drawingArea.innerHTML = '';
				loadBoards()
			},500)
            $( this ).dialog( "close" );
        },        
        Cancel: function() {
        		$('#save-text').hide()
          $( this ).dialog( "close" );
        }
      }
    });
	// let text;
	// if (confirm("Save changes before creating new board") == true) {
	// 	// alert()
	// 	changeTool('download',event, 'Download')
	// 	boardNext()
	// } else {
	// 	changeTool('deleteall',event, 'New')		
	// 	boardNext()

	// }
}

	function searchImages(text='') {
		if(text != '') {
		    document.getElementById("bgModal3").style.display = "block"
		    $('#search_image').val(text)
		}
		let searchText = $('#search_image').val()
		var key = "0b4e2f37b41d4ca3905cddd368dcb899"; 
	    var url = "https://api.bing.microsoft.com/v7.0/images/search?q="+searchText+"&offset=10&count=40&license=ModifyCommercially&safeSearch=Strict";
		    $('#searched_images').html('');
		    window.imageId = []
			$.ajax({
                type: "GET",
                url: url,
                headers: {"Ocp-Apim-Subscription-Key":key},
                dataType: "json",
                success: function (result, status, xhr) {
                	let obj = result.value
				    let data = '';
				    if(obj.length) {
					    obj.forEach(element => {
					    	window.imageId.push(element.imageId)
					    	data+=`<span onclick="bgMathImage('`+element.contentUrl+`','`+element.imageId+`' )" style="margin-left:10px;"><a href="javascript:void(0)"><img class="stbgimg" id="`+element.imageId+`" src="`+element.contentUrl+`" /></a></span>`;
						});
					    $('#searched_images').html(data)				    	
				    }
                }
            });

		// searchImagesApiCall = httpGet(url,key);
		// setTimeout(() => {
		// 	var dataImage = searchImagesApiCall;
		// 	setTimeout(() =>{
		// 	    console.log(dataImage.value);
		// 	    let data = ``;
		// 	 //    searchImagesApiCall.value.forEach(element => {
		// 	 //    	data+=`<span onclick="bgImage('tools/images/lines_bg-QLDsy_NZsy_TASal.svg', '12')" style="margin-left:10px;"><a href="javascript:void(0)"><img class="stbgimg" id="bg_image_12" src="tools/images/lines_bg-QLDsy_NZsy_TASal.svg" /></a></span>`
		// 		// });
		// 	    $('#searched_images').text(data)
		// 	},200)
		// },500)

	}

	function searchVideos(text='') {
		if(text != '') {
		    document.getElementById("bgModal3").style.display = "block"
		    $('#search_image').val(text)
		}
		let searchText = $('#search_image').val()
		var key = "AIzaSyAv44OtAkUF3TuoZbTkR3ipib3UL0t_-5Q"; 
	    var url = "https://www.googleapis.com/youtube/v3/search?part=snippet%2C+id&q="+searchText+"&type=video&key="+key+"&maxResults=10";
		    $('#searched_images').html('');
		    window.imageId = []
			$.ajax({
                type: "GET",
                url: url,
                dataType: "json",
                success: function (result, status, xhr) {
                	let obj = result.items
				    let data = '';
				    if(obj.length) {
					    obj.forEach(element => {
					    	window.imageId.push(element.id.videoId)
					    	data+=`<span style="margin-left:10px;">
					    		<a onclick="playVideo('`+element.id.videoId+`')">
					    			<img class="stbgimg" id="`+element.id.videoId+`" src="`+element.snippet.thumbnails.high.url+`" />
				    			</a></span>`;
						});
					    $('#searched_images').html(data)				    	
				    }
                }
            });

		// searchImagesApiCall = httpGet(url,key);
		// setTimeout(() => {
		// 	var dataImage = searchImagesApiCall;
		// 	setTimeout(() =>{
		// 	    console.log(dataImage.value);
		// 	    let data = ``;
		// 	 //    searchImagesApiCall.value.forEach(element => {
		// 	 //    	data+=`<span onclick="bgImage('tools/images/lines_bg-QLDsy_NZsy_TASal.svg', '12')" style="margin-left:10px;"><a href="javascript:void(0)"><img class="stbgimg" id="bg_image_12" src="tools/images/lines_bg-QLDsy_NZsy_TASal.svg" /></a></span>`
		// 		// });
		// 	    $('#searched_images').text(data)
		// 	},200)
		// },500)

	}
	function playVideo(id) {
		if(id != '') {
		    // document.getElementById("bgModal4").style.display = "block";
		    var ifrm = document.createElement('iframe');
			var foreign = document.createElementNS('http://www.w3.org/2000/svg',"foreignObject");
		        foreign.setAttribute('width', 1000);
		        foreign.setAttribute('height',600);
		        foreign.setAttribute('x', 300);
		        foreign.setAttribute('y', 150);
		        foreign.setAttribute('frameborder', 0);
		        foreign.setAttribute('allowfullscreen', null);
				var el = document.getElementById('open_video');
				// assign url
				ifrm.setAttribute('src', 'https://www.youtube.com/embed/'+id+'?vq=hd720&autoplay=1');
				ifrm.setAttribute('width', '1000');
				ifrm.setAttribute('height', '600');
				foreign.appendChild(ifrm)
				Tools.drawingArea.appendChild(foreign);
		}

	}

	function httpGet(url,key){
	    var xmlHttp = new XMLHttpRequest();
	    xmlHttp.open( "GET", url, false );
	    xmlHttp.setRequestHeader("Ocp-Apim-Subscription-Key",key);
	    xmlHttp.send(null);
	    return xmlHttp.responseText;
	}
	$('#canvas').click(function() {
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()
		$('#object_tools').addClass('inactive').removeClass('active').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#math_tools').addClass('inactive').removeClass('active').hide()
		$('#math_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#color_tools').addClass('inactive').removeClass('active').hide()
		// $('#bio_obj_tools').addClass('inactive').removeClass('active').hide()
		// $('#che_obj_tools').addClass('inactive').removeClass('active').hide()
		// $('#phy_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#manage-boards').addClass('inactive').removeClass('active').hide()
	});

    function openCloseMarker(evt) {
    	$(".nav li").removeClass("li-active");
    	$(".nav li img").removeClass("animate");
    	$("#left-menu li").removeClass("li-active");
    	$('#pen_active').addClass('li-active').children('img').addClass("animate");
		$('#math_tools').addClass('inactive').removeClass('active').hide()
    	$('#marker_tools').is(":visible") ? $('#marker_tools').addClass('inactive').removeClass('active').hide() : $('#marker_tools').addClass('active').removeClass('inactive').show()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()
		$('#object_tools').addClass('inactive').removeClass('active').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#math_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#color_tools').addClass('inactive').removeClass('active').hide()
		$('#bio_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#che_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#phy_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#manage-boards').addClass('inactive').removeClass('active').hide()
    }

    function openCloseDelete(evt) {
    	$(".nav li").removeClass("li-active");
    	$(".nav li img").removeClass("animate");
    	$("#left-menu li").removeClass("li-active");
    	$('#delete_active').addClass('li-active').children('img').addClass("animate");
		$('#math_tools').addClass('inactive').removeClass('active').hide()
    	$('#delete_tool').is(":visible") ? $('#delete_tool').addClass('inactive').removeClass('active').hide() : $('#delete_tool').addClass('active').removeClass('inactive').show()
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()
		$('#object_tools').addClass('inactive').removeClass('active').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#math_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#color_tools').addClass('inactive').removeClass('active').hide()
		$('#bio_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#che_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#phy_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#manage-boards').addClass('inactive').removeClass('active').hide()
    }

    function openCloseText(evt) {
    	console.log(evt)
    	$(".nav li").removeClass("li-active");
    	$(".nav li img").removeClass("animate");
    	$("#left-menu li").removeClass("li-active");
    	$('#text_active').addClass('li-active').children('img').addClass("animate");
		$('#math_tools').addClass('inactive').removeClass('active').hide()
    	$('#text_tool').is(":visible") ? $('#text_tool').addClass('inactive').removeClass('active').hide() : $('#text_tool').addClass('active').removeClass('inactive').show()
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()
		$('#object_tools').addClass('inactive').removeClass('active').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#math_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#color_tools').addClass('inactive').removeClass('active').hide()
		$('#bio_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#che_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#phy_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#manage-boards').addClass('inactive').removeClass('active').hide()
    }

    function openCloseBg(evt) {
    	$(".nav li").removeClass("li-active");
    	$(".nav li img").removeClass("animate");
    	$("#left-menu li").removeClass("li-active");
    	$('#bg_active').addClass('li-active').children('img').addClass("animate")
		$('#math_tools').addClass('inactive').removeClass('active').hide()
    	$('#bg_tool').is(":visible") ? $('#bg_tool').addClass('inactive').removeClass('active').hide() : $('#bg_tool').addClass('active').removeClass('inactive').show()
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()
		$('#object_tools').addClass('inactive').removeClass('active').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#math_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#color_tools').addClass('inactive').removeClass('active').hide()
		$('#bio_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#che_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#phy_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#manage-boards').addClass('inactive').removeClass('active').hide()
    }

    function openClosePageList() {
    	$(".nav li").removeClass("li-active");
    	$(".nav li img").removeClass("animate");
    	$("#left-menu li").removeClass("li-active");
		$('#math_tools').addClass('inactive').removeClass('active').hide()    	
    	$('#pdf-pages').is(":visible") ? $('#pdf-pages').addClass('inactive').removeClass('active').hide() : $('#pdf-pages').addClass('active').removeClass('inactive').show()
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#object_tools').addClass('inactive').removeClass('active').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#math_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#color_tools').addClass('inactive').removeClass('active').hide()
		$('#bio_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#che_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#phy_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#manage-boards').addClass('inactive').removeClass('active').hide()
    }
    function openCloseBoardList() {
    	$(".nav li").removeClass("li-active");
    	$(".nav li img").removeClass("animate");
    	$("#left-menu li").removeClass("li-active");
		$('#math_tools').addClass('inactive').removeClass('active').hide()    	
    	$('#manage-boards').is(":visible") ? $('#manage-boards').addClass('inactive').removeClass('active').hide() : $('#manage-boards').addClass('active').removeClass('inactive').show()
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#object_tools').addClass('inactive').removeClass('active').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#math_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#color_tools').addClass('inactive').removeClass('active').hide()
		$('#bio_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#che_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#phy_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()		
    }    

    function openCloseObject() {
    	$("#left-menu li").removeClass("li-active");
    	$(".nav li img").removeClass("animate");
    	$(".nav li").removeClass("li-active");
    	$('#obj_active').addClass('li-active').children('img').addClass("animate");
    	$('#object_tools').is(":visible") ? $('#object_tools').addClass('inactive').removeClass('active').hide() : $('#object_tools').addClass('active').removeClass('inactive').show()
		$('#math_tools').addClass('inactive').removeClass('active').hide()
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#math_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#color_tools').addClass('inactive').removeClass('active').hide()
		$('#bio_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#che_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#phy_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#manage-boards').addClass('inactive').removeClass('active').hide()
    }

	function openCloseUpload() {
    	$("#left-menu li").removeClass("li-active");
    	$(".nav li img").removeClass("animate");
    	$(".nav li").removeClass("li-active");
    	$('#upload_active').addClass('li-active').children('img').addClass("animate");
		$('#object_tools').addClass('inactive').removeClass('active').hide()
		$('#math_tools').addClass('inactive').removeClass('active').hide()
    	$('#upload_tools').is(":visible") ? $('#upload_tools').addClass('inactive').removeClass('active').hide() : $('#upload_tools').addClass('active').removeClass('inactive').show()
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#math_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#color_tools').addClass('inactive').removeClass('active').hide()
		$('#bio_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#che_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#phy_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#manage-boards').addClass('inactive').removeClass('active').hide()
	}

	function openCloseDownload() {
    	$("#left-menu li").removeClass("li-active");
    	$(".nav li img").removeClass("animate");
    	$(".nav li").removeClass("li-active");
    	$('#download_active').addClass('li-active').children('img').addClass("animate");
		$('#object_tools').addClass('inactive').removeClass('active').hide()
		$('#math_tools').addClass('inactive').removeClass('active').hide()
    	$('#download_tools').is(":visible") ? $('#download_tools').addClass('inactive').removeClass('active').hide() : $('#download_tools').addClass('active').removeClass('inactive').show()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#math_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#color_tools').addClass('inactive').removeClass('active').hide()
		$('#bio_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#che_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#phy_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#manage-boards').addClass('inactive').removeClass('active').hide()
	}

    function openCloseMath() {
    	$("#left-menu li").removeClass("li-active");
    	$(".nav li img").removeClass("animate");
    	$(".nav li").removeClass("li-active");
    	$('#math_active').addClass('li-active').children('img').addClass("animate");
		$('#object_tools').addClass('inactive').removeClass('active').hide()
    	$('#math_tools').is(":visible") ? $('#math_tools').addClass('inactive').removeClass('active').hide() : $('#math_tools').addClass('active').removeClass('inactive').show()
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#color_tools').addClass('inactive').removeClass('active').hide()
		// $('#bio_obj_tools').addClass('inactive').removeClass('active').hide()
		// $('#che_obj_tools').addClass('inactive').removeClass('active').hide()
		// $('#phy_obj_tools').addClass('inactive').removeClass('active').hide()
		// $('#math_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#manage-boards').addClass('inactive').removeClass('active').hide()
    }




	function openCloseMathObj() {
    	$(".nav li").removeClass("li-active");
    	$(".nav li img").removeClass("animate");
    	$("#left-menu li").removeClass("li-active");
    	$("#object_tools").addClass("li-active").children('img').addClass("animate");    			
		$('#object_tools').addClass('inactive').removeClass('active').hide()
    	$('#math_obj_tools').is(":visible") ? $('#math_obj_tools').addClass('inactive').removeClass('active').hide() : $('#math_obj_tools').addClass('active').removeClass('inactive').show()
    	$('#math_tools').is(":visible") ? $('#math_tools').addClass('inactive').removeClass('active').hide() : $('#math_tools').addClass('active').removeClass('inactive').show()
		$('#math_tools').addClass('active').removeClass('inactive').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#color_tools').addClass('inactive').removeClass('active').hide()
		// $('#bio_obj_tools').addClass('inactive').removeClass('active').hide()
		// $('#che_obj_tools').addClass('inactive').removeClass('active').hide()
		// $('#phy_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#manage-boards').addClass('inactive').removeClass('active').hide()
	}

	function openCloseColor(evt) {
    	$(".nav li").removeClass("li-active");
    	$(".nav li img").removeClass("animate");
    	$("#left-menu li").removeClass("li-active");
    	$('#color_active').addClass('li-active').children('img').addClass("animate")
		$('#object_tools').addClass('inactive').removeClass('active').hide()
    	$('#color_tools').is(":visible") ? $('#color_tools').addClass('inactive').removeClass('active').hide() : $('#color_tools').addClass('active').removeClass('inactive').show()
		$('#math_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#bio_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#che_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#phy_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#manage-boards').addClass('inactive').removeClass('active').hide()
	}


	function openGrid() {
    	$(".nav li").removeClass("li-active");
    	$(".nav li img").removeClass("animate");
    	$("#left-menu li").removeClass("li-active");
    	$('#tools_grid').addClass('li-active').children('img').addClass("animate")
    	$('#tools_grid').is(":visible") ? $('#tools_grid').addClass('inactive').removeClass('active').hide() : $('#tools_grid').addClass('active').removeClass('inactive').show()
		$('#color_active').addClass('inactive').removeClass('active').hide()
		$('#object_tools').addClass('inactive').removeClass('active').hide()
		$('#math_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#bio_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#che_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#phy_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#manage-boards').addClass('inactive').removeClass('active').hide()
	}








	function openClosePhyObj() {
    	$(".nav li").removeClass("li-active");
    	$("#left-menu li").removeClass("li-active");
    	$("#object_tools").addClass("li-active");    			
		$('#object_tools').addClass('inactive').removeClass('active').hide()
    	$('#phy_obj_tools').is(":visible") ? $('#phy_obj_tools').addClass('inactive').removeClass('active').hide() : $('#phy_obj_tools').addClass('active').removeClass('inactive').show()
    	$('#math_tools').is(":visible") ? $('#math_tools').addClass('inactive').removeClass('active').hide() : $('#math_tools').addClass('active').removeClass('inactive').show()
		$('#math_tools').addClass('active').removeClass('inactive').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#color_tools').addClass('inactive').removeClass('active').hide()
		$('#bio_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#che_obj_tools').addClass('inactive').removeClass('active').hide()
	}

	function openCloseCheObj() {
    	$(".nav li").removeClass("li-active");
    	$("#left-menu li").removeClass("li-active");
    	$("#object_tools").addClass("li-active");    			
		$('#object_tools').addClass('inactive').removeClass('active').hide()
    	$('#che_obj_tools').is(":visible") ? $('#che_obj_tools').addClass('inactive').removeClass('active').hide() : $('#che_obj_tools').addClass('active').removeClass('inactive').show()
    	$('#math_tools').is(":visible") ? $('#math_tools').addClass('inactive').removeClass('active').hide() : $('#math_tools').addClass('active').removeClass('inactive').show()
		$('#math_tools').addClass('active').removeClass('inactive').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#color_tools').addClass('inactive').removeClass('active').hide()
		$('#bio_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#phy_obj_tools').addClass('inactive').removeClass('active').hide()
	}

	function openCloseBioObj() {
    	$(".nav li").removeClass("li-active");
    	$("#left-menu li").removeClass("li-active");
    	$("#object_tools").addClass("li-active");    			
		$('#object_tools').addClass('inactive').removeClass('active').hide()
    	$('#bio_obj_tools').is(":visible") ? $('#bio_obj_tools').addClass('inactive').removeClass('active').hide() : $('#bio_obj_tools').addClass('active').removeClass('inactive').show()
    	$('#math_tools').is(":visible") ? $('#math_tools').addClass('inactive').removeClass('active').hide() : $('#math_tools').addClass('active').removeClass('inactive').show()
		$('#math_tools').addClass('active').removeClass('inactive').hide()
		$('#download_tools').addClass('inactive').removeClass('active').hide()
		$('#upload_tools').addClass('inactive').removeClass('active').hide()
		$('#marker_tools').addClass('inactive').removeClass('active').hide()
		$('#pdf-pages').addClass('inactive').removeClass('active').hide()
		$('#delete_tool').addClass('inactive').removeClass('active').hide()
		$('#text_tool').addClass('inactive').removeClass('active').hide()
		$('#bg_tool').addClass('inactive').removeClass('active').hide()
		$('#color_tools').addClass('inactive').removeClass('active').hide()
		$('#che_obj_tools').addClass('inactive').removeClass('active').hide()
		$('#phy_obj_tools').addClass('inactive').removeClass('active').hide()
	}	


	function openColorPalatte() {
	 document.getElementById("chooseColor").click();
	}

	$('#pdf-pages').html(localStorage.getItem('pdfData'))
	loadBoards()
	function loadBoards() {
		var data = '';
		$('#manage_boards').html('')
		if(localStorage.getItem('myBoards')) {
			JSON.parse(localStorage.getItem('myBoards')).forEach((name, index) => {
				data+=`<li class="boards_list" onclick="switchBoard('`+name+`')">
							<span class="curTool">
							<span><b>Board :</b> Board `+(index+1)+`</span><br/>
							<span><b>Board Name :</b> `+name+`</span> 
							</span>
						</li>`
			});
			$('#manage_boards').html(data)			
		}
			// elem = svg.getElementById('bg_image_1');
			// if(elem != null) {
			// 	elem.style.width = window.innerWidth;
			// 	elem.style.height = '1000px';
			// }
	}

  function launchOneDrivePicker(){
	var odOptions = {
	  clientId: "INSERT-APP-ID-HERE",
	  action: "query",
	  multiSelect: false,
	  advanced: {
	    queryParameters: "select=id,name,size,file,folder,photo,@microsoft.graph.downloadUrl",
	    filter: "folder,.png" /* display folder and files with extension '.png' only */
	  },
	  success: function(files) { /* success handler */ },
	  cancel: function() { /* cancel handler */ },
	  error: function(error) { /* error handler */ }
	}
    OneDrive.open(odOptions);
  }