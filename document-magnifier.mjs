// Main document magnifier  js code. 
// Split pdf into images of words for responsive viewing in borwser
//
// By Frode Eika Sandnes, April 2022 - Oslo Metropolitan University

import { loadPdfData }  from './extract-pdf.mjs';
import { analysePage }  from './words-from-pixels.mjs';

// globals
var progressIndicator;  
var leftToRightMapping = new Map();
var rightToLeftMapping = new Map();
// the coordinate system of the original document
var pageDimensions = new Map();     // allow pages in doc to be of different dimensions

// Bootstrapping: The following code is called on startup.        

// callback function from pdf routines - called when file is loaded
export let processPageCallback = async (canvas,pageNumber,totalPages) =>
        {    
        // remember this page's dimension
        pageDimensions.set(getRightPageId(pageNumber),{height:canvas.height,width: canvas.width});
        // adjust the preview page ratios if not porttrait - only support A4, US-letter is scaled to approximate
        const preview = document.getElementById(getRightPageId(pageNumber));
        if (canvas.width > canvas.height)
                {
                preview.classList.add("landscape");  // default is landscape (most common) - set this when come across landscape page 
                }

        progressIndicator.next();       // update the progress indicator                    
        const enhanceContrast = document.getElementById("contrast").checked;
        const negateImage = document.getElementById("negative").checked;

        var allWords = "";
        var background;
        ({allWords, background} = await analysePage({canvas:canvas, enhanceContrast:enhanceContrast, negateImage:negateImage, pageNumber:pageNumber}));
                
        addWords({canvas:canvas,allWords:allWords,pageNumber:pageNumber,totalPages:totalPages,background:background});
        addPageOverview({canvas:canvas, pageNumber:pageNumber});
        }

// for creating consistent element id's        
let getRightPageId = (pageNum) =>
        {
        return "page"+pageNum;        
        }

// Set up the page structure as a set of divs with id = the respective page numbers 
// this is to ensure that pages are inserted in the right places dynamically.   
export let setupPageStructure = (noPages) =>
        {
        // create left side
        const mainWindow = document.createElement("div");
        mainWindow.setAttribute('id',"left");                
        document.body.appendChild(mainWindow);
        // create right side
        const overviewWindow = document.createElement("div");
        overviewWindow.setAttribute('id',"right");                
        document.body.appendChild(overviewWindow);

        const pages = [ ...Array(noPages).keys() ].map(v => v+1);
        for (var page of pages)
                {
                // structure for the main window
                const e = document.createElement("div");
                e.setAttribute('id',page);                
                mainWindow.appendChild(e);
                // structure for the overview window
                const label = document.createElement("span");
                label.innerText = "Page "+page;
                overviewWindow.appendChild(label);
                const o = document.createElement("div");
                o.setAttribute('id',getRightPageId(page));      
                o.classList.add("pagePreview");  // prevent scaling          
                overviewWindow.appendChild(o);                
                }
        hideStartPage();
        progressIndicator = progress(noPages);          // initialise the progress indicator
        }        

//start("paper.pdf");   // for testing, remove/comment away otherwise

// called upon start
export let start = (fn) =>
        {
        // cathing errors        
        window.addEventListener('unhandledrejection', function (e) {
                alert("This software is in development, and this pdf file caused a problem. Please help the development by sending this pdf with the error message to frodes@oslomet.no. Error message: " + e.reason.message);
                })

        loadPdfData(fn);  
        }
// highe the start page with the form once it is submitted and processing starts
let hideStartPage = () =>
        {                
         // hide the form
        const form = document.querySelector("form");
        form.style.display = "none";   
        }     

// Add words from page to the "mix"
let addWords = ({canvas:canvas,allWords:allWords,pageNumber:pageNumber,totalPages:totalPages,background:background}) =>
    {
    const rightPageId = getRightPageId(pageNumber);
    // prepare the rightToLeft mapping
    if (!rightToLeftMapping.has(rightPageId))
        {
        rightToLeftMapping.set(rightPageId,[]);     // initialise and array
        }
    // get the div on the page where to insert the results
    const currentPageDiv = document.getElementById(pageNumber);
    // add a page marker
    const pageDivider = document.createElement("div");
    pageDivider.textContent = "Page "+pageNumber;
    pageDivider.classList.add("pageMarker");

    // this is called for every page, enough for the first page.
    document.body.style = "background:"+"rgb("+background.r+","+background.g+","+background.b+")";    

    currentPageDiv.appendChild(pageDivider);

    const ctx = canvas.getContext("2d");        
    // traverese all the words and store the contents
    var wordImages = [];
    for (var word of allWords)
        {
        const x = word.x0;
        const y = word.y0;
        const w = word.x1 - word.x0;
        const h = word.y1 - word.y0;

        // here we could add the comparison to the region marker and paragraph marker - cleaner code, but a bit slower
        if (w == 1) // we got a spacing image, spacing with br-element
                {
                var br1 = document.createElement('br');
                currentPageDiv.appendChild(br1);
                var br2 = document.createElement('br');
                currentPageDiv.appendChild(br2);            
                }   
        else if (h == 2)          // add region marker
                {
                const regionDivider = document.createElement("div");
                regionDivider.textContent = "Region ";
                regionDivider.classList.add("regionMarker");
                currentPageDiv.appendChild(regionDivider);                
                }
        else    
                {
                // get the image of the current word
                const wordImage = ctx.getImageData(x,y,w,h);    
                // create temporary canvas for word
                const wordCanvas = document.createElement("canvas");
                wordCanvas.width = w;   // set the canvas equal to the word dimensions.
                wordCanvas.height = h;
                const id = pageNumber+"-"+allWords.indexOf(word);
                wordCanvas.setAttribute('id',id);    
                // draw the word on the new canvas
                const wordCtx = wordCanvas.getContext("2d");
                wordCtx.putImageData(wordImage, 0, 0);
                // add the word to the assigned part of the page 
                currentPageDiv.appendChild(wordCanvas);
                // add the info to the mapping structure for visualiztion
                leftToRightMapping.set(id,{page:pageNumber,x:x+w/2,y:y+h/2});
                rightToLeftMapping.get(rightPageId).push({id:id,x:x+w/2,y:y+h/2});
                }
        }
    }


// called when the contents have been fully loaded
let pageLoaded = (noPages) =>
    {
        // add a preview hilighter
        const highlighter = document.createElement("div");
        highlighter.setAttribute('id',"rightHighlighter");   
        document.body.appendChild(highlighter);

        // create unrealted hook here for event handler as all is set up
        let observer = new IntersectionObserver(scrollCallback);
        for (var i = 1; i<= noPages; i++)
        {
        // observe the left side
        let left = document.getElementById(i);
        observer.observe(left);      
        // set up click events for the right side for jumping around the document
        let right = document.getElementById(getRightPageId(i));
        right.addEventListener('click', clickCallback);
        }
        // set up move event for visualisation
        const left = document.getElementById("left");
        left.addEventListener('mousemove',moveCallback);
        const right = document.getElementById("right");
        right.addEventListener('mousemove',() => 
                        {       // hide pointer from view when moving on the right side.
                        const highlighter = document.getElementById("rightHighlighter");
                        highlighter.style.top = "-100px";
                      })

        // monitor resize events
        window.onresize = resizeCallback;
    }

// self-contained progress bar called as generator function
function* progress(noPages)
    {
    // set up counter            
    var i = 0;          
    // add the progress indicator
    var progressElement = document.createElement("progress");
    progressElement.max = noPages;
    progressElement.value = 0;
    document.body.insertBefore(progressElement, document.body.firstChild);
    while (i < noPages-1)
        {
        i++;
        // update the progress indicator
        progressElement.value = i;
        yield;        
        }        
    // remove the progress indicator once we finished
    progressElement.remove();

    // this part is reached when page is rendered
    pageLoaded(noPages); 
    }

// called when resizing
var lastActiveId = null;
var lastActiveY;
var pausingAfterZoom = false;   // flag used to pause interface after a zoom operation

let resizeCallback = () =>
    {
// Not used here, but perhaps useful later            
//    var browserZoomLevel = Math.round(window.devicePixelRatio * 100);
//    console.log("browserzoomlevel",browserZoomLevel);
    // check that it has not been set yet - at the very beginning
    if (lastActiveId == null)
        {
        return;        
        }      
    // get the positon   
    const container = document.getElementById("left");
    const el = document.getElementById(lastActiveId);
    const {top: y} = el.getBoundingClientRect();
    container.scrollTop += y - lastActiveY;
    // ensure that the move operation is paused for some time after the scaling so the user can see where the word is
    pausingAfterZoom = true;
    setTimeout(()=>{pausingAfterZoom = false},1000);
    }

let clickCallback = (event) =>
        {          
        // get the div element
        const preview = event.target.parentElement;
        // get the id of the page
        const pageId = preview.id; 
        // find the location of the click within the preview page
        var x = event.offsetX;
        var y = event.offsetY;
        // convert preview coordinates to document coordinates
        const {height: hh, width: hw} = preview.getBoundingClientRect();
        const {height: documentHeight, width: documentWidth} = pageDimensions.get(pageId);
        x = documentWidth*x/hw;
        y = documentHeight*y/hh;
        // find the closest one
        const words = rightToLeftMapping.get(pageId);
        const distances = words.map((v) =>  (x-v.x)**2 + (y-v.y)**2);
        const minDistance =  Math.min(...distances);
        const minIndex = distances.indexOf(minDistance);
        if (words[minIndex] == undefined)
                {
                return; // nothing to move to
                }
        var minId = words[minIndex].id;

        // scroll into view
        const element = document.getElementById(minId);
        const container = document.getElementById("left");
        const offset = 50;     // an arbitrary offset to prevent the scroll being exactly on the border, but slightly below so that user can see the context
        container.scrollTop = element.offsetTop - offset;
        
        // Move the right highligher and frame
        updateRightHighlighter(minId);
        updateRightHilightFrame(minId);
        }

let scrollCallback = (entries) => 
        {
        for (var entry of entries)        
                {
                // if entering - bring into view
                const id = entry.target.id;
                const element = document.getElementById(getRightPageId(id));
                if (entry.isIntersecting)
                        {
                        const container = document.getElementById("right");
                        // check if we move forward or backwards
                        if (element.offsetTop > container.scrollTop)
                                {
                                // move forwards if new box below viewport, otherwise no move
                                if (element.offsetTop+element.clientHeight > container.scrollTop + container.clientHeight)
                                        {
                                        container.scrollTop += element.clientHeight;        
                                        }                                
                                }
                        else    
                                {                          
                                // move backwareds
                                container.scrollTop = element.offsetTop;
                                }                        
                        // set the visual frame around the page view
                        element.classList.add("highlight");
                        }
                else    
                        {
                        // remove the visual frame around the page view
                        element.classList.remove("highlight");
                        }
                }
      }
    
// called when mousepointer is moved in the left window -> update the right side pointer
let moveCallback = (event) =>
      {
      if (pausingAfterZoom)
        {
        return;  // Do nothing if we just changed the text size.
        }

        throttle(() => // only max every thottleThreshold milliseconds 
                {
                // get element under pointer
                const id = event.target.id;
                // update the global variable - used for keeping the position during zooming
                lastActiveId = id;
                if (id.includes("-"))
                        {
                        const el = document.getElementById(id);                                
                        var { top: y } = el.getBoundingClientRect();       
                        lastActiveY = y;
                        }
                else    
                        {
                        return; // return if hit a non-word element
                        }
                
                // update word highlighting if moved to a new word
                updateRightHilightFrame(id);

                // Move the right highligher
                updateRightHighlighter(id);                
                },throttleThreshold);
      }

// remember what was the previous word under the pointer
var previousWord;  
let updateRightHilightFrame = (id) =>
        {
        if (id != previousWord && id.includes("-"))
                {
                const el = document.getElementById(id);
                el.classList.add("highlight");
                if (previousWord != undefined)
                        {
                        const el2 = document.getElementById(previousWord);
                        el2.classList.remove("highlight");
                        }
                previousWord = id;
                }
        }      

let updateRightHighlighter = (id) =>
      {
        // find coordinate on the right side
        const rightInfo = leftToRightMapping.get(id);
        // move highlighter to corresponding location
        if (rightInfo !== undefined)
                {
                // get the overview element id
                const overviewPage = document.getElementById(getRightPageId(rightInfo.page));
                // calculate the new position of the highlight pointer
                // get the coordinate of the preview div
                var { 
                        top: y,  
                        left: x,  
                        height: h,
                        width: w
                        } = overviewPage.getBoundingClientRect();
                // add the offsets within the div
                const {height: documentHeight, width: documentWidth} = pageDimensions.get(getRightPageId(rightInfo.page));
                x += w * rightInfo.x/documentWidth;  
                y += h * rightInfo.y/documentHeight;  
                // move x,y to the centre of the highlighter
                const highlighter = document.getElementById("rightHighlighter");
                const {height: hh, width: hw} = highlighter.getBoundingClientRect();
                x -= hw/2;
                y -= hh/2;
                // move the highlight pointer
                highlighter.style.left = x+"px";
                highlighter.style.top = y+"px";
                }   
      }

let throttleThreshold = 100;
//initialize throttlePause variable outside throttle function
let throttlePause;
const throttle = (callback, time) =>
        {
        //don't run the function if throttlePause is true
        if (throttlePause) return;
        
        //set throttlePause to true after the if condition. This allows the function to be run once
        throttlePause = true;
        
        //setTimeout runs the callback within the specified time
        setTimeout(() => {
        callback();
        
        //throttlePause is set to false once the function has been called, allowing the throttle function to loop
        throttlePause = false;
        }, time);
        };

// add the current page to the side view as miniature image
let addPageOverview = ({canvas:canvas, pageNumber:pageNumber}) =>
    {
    const parent = document.getElementById(getRightPageId(pageNumber));
    const miniature = document.createElement("canvas");
    miniature.classList.add("pagePreviewCanvas");
    const ctxMiniature = miniature.getContext("2d");
    let scalingFactorX = miniature.width/canvas.width;
    let scalingFactorY = miniature.height/canvas.height;
    ctxMiniature.drawImage(canvas,0,0,canvas.width*scalingFactorX,canvas.height*scalingFactorY);
    parent.appendChild(miniature);
    }