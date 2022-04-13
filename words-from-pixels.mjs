// Pixel based extraction of words from pixels in canvas. 
// Relying on the canvas-pixels-manipulation.js library
//
// By Frode Eika Sandnes, April 2022 - Oslo Metropolitan University


import { allPixels, negative, compressorDynamicRange, verticalProjection, horisontalProjection, findForegroundBackgroundColours, midLineVerticalProjection } from './canvas-pixel-manipulation.mjs';

// finds the start ane end of active regions in the projection
let findActiveRegionsInProjection = (projection,threshold) =>
    {
    const regions = [];
    var prev = false;
    var start = 0;
    var end = 0;
    // Traverse projection and find bounds of lines
    for (var i = 0;i< projection.length;i++)
       {
       if (projection[i] && !prev)
           {
           start = i;
           }
       else if (!projection[i] && prev)   
           {
           end = i;
           if (end-start > threshold)
               {
               regions.push({start:start, end:end});
               }
           }
       prev = projection[i];
       }
    // need to attach last part if active region goes to the bottom border of the document       
    const lastScanlineIdx = projection.length-1;
    const lastScanlineValue = projection[lastScanlineIdx];
    if (lastScanlineValue)
        {
        regions.push({start:start, end:lastScanlineIdx});    
        }     
    return regions;  
    }

// detect the text lines using vertical projections
let findLines = (imageData,w,h,params) =>
    {
    const threshold = 3;  // minimum pixels for a line
    const result = [];
    // get the regions
    const projection = verticalProjection(imageData,w,h,params);
    const regions = findActiveRegionsInProjection(projection,threshold);
    // put into suitable format
    for (var p of regions)
        {
        result.push({y0:p.start, y1:p.end});
        }
    return result;
    }

// combine small segments into larger if spacing too small, small spacing between letters, larger spacing between words
let concatenateLettersToWords = (letters) =>
    {
    // find all horizontal spacings
    var horizontalSpacings = letters.slice(1).map((v, i) => v.x0 - letters[i].x1);
    var maxHorizontalSpacing = Math.max(...horizontalSpacings);
    // set spacing threshold to half the maximum
    var threshold = maxHorizontalSpacing/2;
    // just check that the threshold is within reasonable limits - if not set it to magic no of 3.
    if (threshold > 9 || threshold < 0)
        {
        threshold = 3;
        }

    const concatenated = [];
    var word = letters[0]; 
    for (var i=1;i<letters.length;i++)
        {
        const word2 = letters[i];
        if (word2.x0 - word.x1 < threshold)  // space too small
            {
            word.x1 = word2.x1; // combine the word
            continue;           // goto next
            }
        else    
            {
            concatenated.push(word);
            word = word2;
            }
        }    
    concatenated.push(word); // ensure the last word is added            
    return concatenated;        
    }

// find words in line using horizontal projections    
let findWordsForLine = (imageData,w,h,y0,y1,params) =>
    {
    const result = [];  
    const projection = horisontalProjection(imageData,w,h,y0,y1,params);   
    const regions = findActiveRegionsInProjection(projection,0);
    for (var p of regions)
        {
        result.push({x0:p.start, x1:p.end, y0:y0, y1:y1});
        }      
    // combine words with too small spacing
    return concatenateLettersToWords(result);
    }

// top-level function for finding the words on a page, first find lines, then words in each line
let findWords = (imageData,w,h,params) =>
    {
    const allWords = [];
    const lines = findLines(imageData,w,h,params); 
    for (var l of lines)
        {
        const words = findWordsForLine(imageData,w,h,l.y0, l.y1,params);            
        allWords.push(...words);    // concatenate the arrays.
        }
    return allWords;
    }

// for debugging - drawing red box around the words on the canvas
let outlineWords = (canvas, allWords) =>
    {
    const ctx = canvas.getContext("2d");
    for (var p of allWords)
        {
        ctx.strokeStyle = "rgb(255,0,0)";    
        ctx.lineWidth = 1;                     
        ctx.rect(p.x0, p.y0, p.x1-p.x0, p.y1-p.y0); 
        ctx.stroke();
        }     
    }

// analysing a specific region on the page
export let analyseRegion = ({canvasContext:canvasContext,x:x,y:y,w:w,h:h,params:params}) =>
    {
    // check if there is anything to analyse, if not, return empty array
    if (w==0 || h==0)
        {
        return [];
        }
    // access the region
    const imageData = canvasContext.getImageData(x,y,w,h);
    // extract the words in the region 
    var allWords = findWords(imageData,w,h,params);
    // remove all undefined elements
    allWords = allWords.filter(x => x !== undefined);
    // add the global offsets
    for (var p of allWords)
        {
        p.x0 += x;  
        p.x1 += x; 
        p.y0 += y;
        p.y1 += y; 
        }
    allWords = transferSpace(allWords);   
    return allWords;
    }

let paragraphMarker = {x0:0,x1:1,y0:0,y1:1};

// find paragraph marks and space in text and insert breaks in text to create space
let transferSpace = (allWords) =>
    {
    // find the text margin by searching for the smalles x position for a word
    const margin = Math.min(...allWords.map(item => item.x0));
    const indent = Math.min(...allWords.map(item => item.y1 - item.y0));

    // find typical line-height - two passes
    // pass one - first fine all line heights
    const lineHeights = [];
    for (var i = 0;i < allWords.length;i++)
        {
        const word = allWords[i];
        // if we still have a succeeding word
        if (i < allWords.length-1)
            {
            const nextWord = allWords[i+1];
            if (nextWord.x0 < word.x0)  // new line in text
                {
                const lineHeight = nextWord.y0 - word.y0;
                lineHeights.push(lineHeight);                
                }
            }
        }  
    // find the median height as representative - sort and pick middle.
    lineHeights.sort(function(a, b){return a - b});
    const typicalLineHeight = lineHeights[Math.floor(lineHeights.length/2)];

    const result = [];
    for (var i = 0;i < allWords.length;i++)
        {
        const word = allWords[i];
        result.push(word);
        // if we still have a succeeding word
        if (i < allWords.length-1)
            {
            const nextWord = allWords[i+1];
            if (nextWord.x0 < word.x0)  // new line in text
                {
                const lineHeight = nextWord.y0 - word.y0;                    
                if (nextWord.x0 > margin+indent) // indented
                    {
                    result.push(paragraphMarker); // insert a 1-pixel image as spacer    
                    }    
                else if (lineHeight > typicalLineHeight + 3)
                    {
                    result.push(paragraphMarker); // insert a 1-pixel image as spacer  
                    }
                }
            }
        }  
    return result;      
    }

// Magic number    
let minPortionTwoColumns = 5; // fraction
// based on the midpoint projection - detect the regions that are not two columns, the others are probably two columns
let detectSingleColumnRegions = (projection) =>
    {
    const regions = [];
    const crossingMidline = [];    // temporary storing the boundaries
    // get midline projection
    const singleColumnRegions = findActiveRegionsInProjection(projection,0);
    // put into right format
    for (var r of singleColumnRegions)
        {
        crossingMidline.push({y0:r.start, y1:r.end});
        }
    // combine lines with too small spacing
    const threshold = projection.length/minPortionTwoColumns; // at least a fifth of the page must be clear.
    if (crossingMidline.length > 0)
        {
        var line = crossingMidline[0]; 
        for (var i=1;i<crossingMidline.length;i++)
            {
            var line2 = crossingMidline[i];
            if (line2.y0 - line.y1 < threshold)  // space too small
                {
                line.y1 = line2.y1; // combine the lines
                continue;           // goto next
                }
            else    
                {
                regions.push(line);
                line = line2;
                }
            }    
        regions.push(line); // ensure the last line is added      
        }  
    return regions;
    }

// the detection of single columns from midline may miss some bits and cut too much.
// we therefore trace the full vertical projection above and below until blank line.
let adjustSIngleColumnRegion = (regions,projection) =>
    {
    for (var r of regions)
        {
        // trace backward
        for (var i = r.y0; i >= 0;i--)
            {
            if (!projection[i])
                {
                r.y0 = i;
                break;   
                }
            }
        // trace forward   
        for (var i = r.y1; i < projection.length; i++)
            {
            if (!projection[i])
                {
                r.y1 = i;
                break;   
                }
            }         
        }
    return regions;
    }

// finds the most probable location for the two column divide
let findTwoColumnDivide = (imageData,w,h,params) =>
    {
    var columnDivide = Math.round(w/2);
    var globalMax = 0;
    const lower = Math.round(2*w/5);
    const upper = Math.round(3*w/5);
    // scan the inner third
    for (var x = lower; x < upper; x++)
        {
        const midlineProjection = midLineVerticalProjection(imageData,w,h,x,params);
        var count = 0;
        var max = 0;
        // count max  sequence of consecutive unset pixels
        for (var pixel of midlineProjection)
            {
            if (count > max)
                {
                max = count;
                }
            if (!pixel)
                {
                count++;
                }    
            else    
                {
                count = 0;    
                }
            }
        // check if this is max
        if (max > globalMax)
            {
            globalMax = max;
            columnDivide = x;
            }
// can search for several columns using the same technique            
        }
    return columnDivide;
    }

// analyse a page to see which parts are divided across two columns and which parts span both columns
// outputs a list of sub regions that subsequently can be analysed as single column.    
// regions insered top-to-bottom and left-to-right.
let twoColumnAnalysis = (imageData,w,h,params) =>
    {
    // array of detected regions
    const regions = [];
    // search for most probable center line
    var columnDivide = findTwoColumnDivide(imageData,w,h,params);
    //  performing vertical projection of the center line
    const midlineProjection = midLineVerticalProjection(imageData,w,h,columnDivide,params);
    // get full vertical Projection 
    const vProjection = verticalProjection(imageData,w,h,params);

    // apply a filter to detect active two-column regions
    const rawSingleColumnRegions = detectSingleColumnRegions(midlineProjection);
    // since the midline may miss some parts above and below we adjust the limites with the full vertical projections
    const singleColumnRegions = adjustSIngleColumnRegion(rawSingleColumnRegions,vProjection);

    // go through the regions border - if there are two column make two regions
    var lastRegion = {y0: 0, y1:0};
    for (var p of singleColumnRegions)
        {
        // assume that the last region was two columns since it was not single column, add these
        regions.push({y0:lastRegion.y1, y1: p.y0, x0:0, x1:columnDivide});
        regions.push({y0:lastRegion.y1, y1: p.y0, x0:columnDivide, x1:w});            
        // add the single column region
        regions.push({y0: p.y0, y1: p.y1, x0:0, x1:w});
        // set up for next iteration
        lastRegion = p;
        }
    // add the last bit 
    regions.push({y0: lastRegion.y1, y1: h, x0:0, x1:columnDivide});
    regions.push({y0: lastRegion.y1, y1: h, x0:columnDivide, x1:w});
    return regions;
    }

let regionMarker = {x0:0,x1:2,y0:0,y1:2};

// overall routine for analysing entire page
export let analysePage = async ({canvas:canvas,enhanceContrast:enhanceContrast,negateImage:negateImage, pageNumber:pageNumber}) =>
    {
    const ctx = canvas.getContext("2d");
    var imageData = ctx.getImageData(0,0,canvas.width,canvas.height); 
    // find foreground and background colours in globals
    var params = findForegroundBackgroundColours(imageData,canvas.width,canvas.height);
    if (enhanceContrast)
        {
        // expand the dynamic range on the view for more contrast
        allPixels(canvas,compressorDynamicRange,params);
        }
    if (negateImage)
        {
        allPixels(canvas,negative); 
        // if the image is inverted we need to recalculate what is foreground and background.
        imageData = ctx.getImageData(0,0,canvas.width,canvas.height); 
        params = findForegroundBackgroundColours(imageData,canvas.width,canvas.height);
        }

    var allWords = [];

    // first find potential regions
    var regions = twoColumnAnalysis(imageData,canvas.width,canvas.height,params)
    // traverse the regions and extract words from each region
    for (var region of regions)
        {                
        var wordsInRegion = analyseRegion({ canvasContext: ctx, x: region.x0, y: region.y0, w: region.x1 - region.x0, h: region.y1 - region.y0, params: params });
        allWords.push(...wordsInRegion);
        // add region marker if WordsInRegion has more than zero elements AND it is not the last region
        if (wordsInRegion.length > 0)
            {
            allWords.push(regionMarker);   
            }
        }
    // remove last item if it is a region marker
    if (allWords.length > 0 && allWords[allWords.length-1] == regionMarker)
        {
        allWords.pop();
        }

    // for debugging - outlining the words in red
//    outlineWords(canvas, allWords);
//    document.body.appendChild(canvas);

    return {allWords:allWords,background:params.background};
    }