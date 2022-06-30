(function documents() { //Code isolation


// This isn't an HTML5 canvas, it's an old svg hack, (the code is _that_ old!)

var xlinkNS = "http://www.w3.org/1999/xlink";
var imgCount = 1;
var fileInput;

// var __PDF_DOC,
//     __CURRENT_PAGE,
//     __TOTAL_PAGES,
//     __PAGE_RENDERING_IN_PROGRESS = 0,
//     __CANVAS = $('#pdf-canvas').get(0),
//     __CANVAS_CTX = __CANVAS.getContext('2d');

function onstart() {
    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.setAttribute("id", "file-to-upload");
    fileInput.accept = "image/*,.pdf";
    fileInput.click();
    console.log(fileInput.files[0])
    fileInput.addEventListener("change", function(){
        var reader = new FileReader();
        reader.readAsDataURL(fileInput.files[0]);
        if(fileInput.files[0].type == 'image/svg+xml') {
            console.log(reader)

                reader.onload = function(e) {
                    var svgData = e.target.result;
                    console.log(svgData);
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', svgData);
                    xhr.addEventListener('load', function(ev)
                    {
                        var xml = ev.target.response;
                        var dom = new DOMParser();
                        var svg = dom.parseFromString(xml, 'image/svg+xml');
                        Tools.drawingArea.appendChild(svg.rootElement);
                    });
                    xhr.send(null);

                }
        }else if(fileInput.files[0].type == 'application/pdf') {
            $('#pdf-pages').html('');
            window.imageId = [];
        var formData = new FormData();
        formData.append('file', fileInput.files[0]);
        $.ajax({
               url : window.pdfToImage+'pdfToimage.php',
               type : 'POST',
               data : formData,
               processData: false,  // tell jQuery not to process the data
               contentType: false,  // tell jQuery not to set contentType
               success : function(result) {
                    let obj = result
                    let data = '';
                    let id = Date.now()
                    if(obj.length) {
                        obj.forEach(element => {
                            localStorage.setItem('pdfData', '')
                            window.imageId.push(id)
                            data+=`<li><span onclick="bgMathImage('`+element+`','`+id+`' )"><a href="javascript:void(0)"><img class="stbgimgpdf" id="`+id+`" src="`+element+`" /></a></span></li>`;
                            setTimeout(() => {
                                Tools.boardName = Tools.generateUID();
                                window.myBoards.push(Tools.boardName);
                                localStorage.setItem('myBoards', JSON.stringify(window.myBoards))
                                Tools.socket.emit('joinboard', Tools.boardName);
                                // Tools.socket.emit('getboard', Tools.boardName);
                                window.history.pushState('boards',null, Tools.boardName);
                                Tools.drawingArea.innerHTML = '';
                                bgMathImage(element, id, true)
                                saveBoardNametoLocalStorage()
                            },500)
                        });

                        $('#pdf-pages').html(data)
                        localStorage.setItem('pdfData', data)
                        $('#pdf-pages').show()
                    }
               }
        }); 
        reader.onload = function (e) {
            console.log(e)
            var image = new Image();
            image.src = e.target.result;
            image.onload = function () {
    
            var uid = Tools.generateUID("doc"); // doc for document
            // console.log(image.src.toString().length);
            
            var msg = {
                id: uid,
                type:"doc",
                src: image.src,
                w: this.width || 700,
                h: this.height || 700,
                x: (100+document.documentElement.scrollLeft)/Tools.scale+10*imgCount,
                y: (100+document.documentElement.scrollTop)/Tools.scale + 10*imgCount
                //fileType: fileInput.files[0].type
            };
            draw(msg);
            Tools.send(msg,"Document");
            imgCount++;
            };
        }; 
        }else{
        reader.onload = function (e) {
            console.log(e)
            var image = new Image();
            image.src = e.target.result;
            image.onload = function () {
    
            var uid = Tools.generateUID("doc"); // doc for document
            // console.log(image.src.toString().length);
            
            var msg = {
                id: uid,
                type:"doc",
                src: image.src,
                w: 700,
                h: 400,
                x: (100+document.documentElement.scrollLeft)/Tools.scale+10*imgCount,
                y: (100+document.documentElement.scrollTop)/Tools.scale + 10*imgCount
                //fileType: fileInput.files[0].type
            };
            draw(msg);
            Tools.send(msg,"Document");
            imgCount++;
            };
        };
        changeTool('selector','', 'Hand', true)
        }
    });
}


function draw(msg) {
    console.log(msg)
    // alert()
    //const file = self ? msg.data : new Blob([msg.data], { type: msg.fileType });
    //const fileURL = URL.createObjectURL(file);

   // fakeCanvas.style.background = `url("${fileURL}") 170px 0px no-repeat`;
    //fakeCanvas.style.backgroundSize = "400px 500px";
    var aspect = msg.w/msg.h
    var img = Tools.createSVGElement("image");
    img.id=msg.id;
    img.setAttribute("class", "layer-"+Tools.layer);
    img.setAttributeNS(xlinkNS, "href", msg.src);
    img.x.baseVal.value = msg['x'];
    img.y.baseVal.value = msg['y'];
    let array = ['bg_image_1', 'bg_image_2', 'bg_image_3', 'bg_image_4', 'bg_image_5',
                 'bg_image_6', 'bg_image_7', 'bg_image_8', 'bg_image_9', 'bg_image_10',
                 'bg_image_11', 'bg_image_12']
    img.setAttribute("width", msg.w);
    img.setAttribute("height", msg.h);
    if(msg.transform)
			img.setAttribute("transform",msg.transform);
    Tools.drawingArea.appendChild(img);
    
}

Tools.add({
    "name": "Document",
    "icon": "🖼️",
    "shortcuts": {
        "changeTool":"7"
    },
    "draw": draw,
    "onstart": onstart,
    "oneTouch":true,
});

})(); //End of code isolation