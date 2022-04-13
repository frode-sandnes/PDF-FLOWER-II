// Low-level canvas manipulation routines. 
//
// By Frode Eika Sandnes, March 2022 - Oslo Metropolitan University


// magic numbers
let bytesPerPixel = 4;

// apply function f to all pixels in canvas c, r accummulating results
export let allPixels = (c,f,param) =>
    {
    const ctx = c.getContext("2d");
    const imageData = ctx.getImageData(0,0,c.width,c.height);
    for (var i=0; i < imageData.data.length; i+=bytesPerPixel)
        {
        const d = imageData.data;
        const p = f(d[i], d[i+1], d[i+2], d[i+3],param);
        d[i] = p.r;
        d[i+1] = p.g;
        d[i+2] = p.b;
        d[i+3] = p.a;
        }
    ctx.putImageData(imageData,0,0);
    }

// negative - invert pixel p in the canvas
export let negative = (r,g,b,a) =>
    {
    r = 255-r;
    g = 255-g;
    b = 255-b;
    return {r: r, g:g, b:b, a:a};
    }
    
// for testing - setting pixel to red    
let red = (r,g,b,a) =>
    {
    r = 255;
    g = 0;
    b = 0;
    return {r: r, g:g, b:b, a:a};
    }

// compressor function
let compressor = (c,lo,high) =>
    {
    const strength = 3;   // 1 no change
    const invert = high - c;
    const scale = invert*strength;   // strenght
    const revert = 255 - scale;
    const clip = (revert < 0)? 0: revert;
    return clip.toFixed(0);
    }
// Compresses and expands the dynamic range of the pixel from the min and max colour to black to white
export let compressorDynamicRange = (r,g,b,a,p) =>
    {    
    r = compressor(r, p.foreground.r, p.background.r);
    g = compressor(g, p.foreground.g, p.background.g);
    b = compressor(b, p.foreground.b, p.background.b);
    return {r: r, g:g, b:b, a:a};                  
    }


// samples the diagonal to find the two extreme colours used
// assume the globals min and max are initialized - only used once s
let sampleColour = (r,g,b,a,p) =>
    {
    const minDist = p.minCol.r**2 + p.minCol.g**2 + p.minCol.b**2;
    const maxDist = p.maxCol.r**2 + p.maxCol.g**2 + p.maxCol.b**2;
    const dist = (r**2 + g**2 + b**2);  
    if (dist < minDist)
        {
        p.minCol = {r:r, g:g, b:b};    
        }
    if (dist > maxDist)
        {
        p.maxCol = {r:r, g:g, b:b};    
        }
    }
// samples the diagonal and colours near min and max
// assume the globals minColFreq and maxColFreq are initialized - only used once s
let countColour = (r,g,b,a,p) =>
    {
    // find distance to min and max
    const distMin =  (p.minCol.r - r)**2
                  +(p.minCol.g - g)**2
                  +(p.minCol.b - b)**2;
    const distMax =  (p.maxCol.r - r)**2
                  +(p.maxCol.g - g)**2
                  +(p.maxCol.b - b)**2;
    if (distMin < distMax)
        {
        p.minColFreq++;    
        }
    else
        {
        p.maxColFreq++;    
        }
    }

// apply function f to diagonal pixels in canvas c starting and ending at offset
let readOnlyDiagonalPixels = (imageData,w,h,f,offset,params) =>
    {
    offset = Math.round(offset); // prevent offset being a fraction
    const start = bytesPerPixel*(offset*w+offset);
    const end = Math.min(bytesPerPixel*((h-offset)*w),
                       bytesPerPixel*((w-offset)*w));
    const step = bytesPerPixel*w+bytesPerPixel;
    for (var i=start; i < end; i+=step)
        {
        const d = imageData.data;
        const p = f(d[i], d[i+1], d[i+2], d[i+3],params);
        }
    }    
// sample a central third diagonal of the image to find the foreground and background pixels
export let findForegroundBackgroundColours = (imageData,w,h) =>
    {
    // initialise global varables
    var minCol = {r: 255, g:255, b:255};    // setting to the opposite end of the scale
    var maxCol = {r: 0, g:0, b:0};
    const params = {minCol: minCol, maxCol:maxCol, minColFreq: 0, maxColFreq: 0};
    readOnlyDiagonalPixels(imageData,w,h,sampleColour,w/2.5,params);    
    readOnlyDiagonalPixels(imageData,w,h,countColour,w/2.5,params);
    var result; 
    if (params.maxColFreq > params.minColFreq)
        {
         result = {
                    background: params.maxCol,
                    foreground: params.minCol    
                    };
        }
    else
        {
        result = {
                    background: params.minCol,
                    foreground: params.maxCol    
                    };
        }
    return result;
    }

export let isPixelSet = (r,g,b,p) =>
    {
    const distBackground = Math.sqrt( (p.background.r - r)*(p.background.r - r)
        +(p.background.g - g)*(p.background.g - g)
        +(p.background.b - b)*(p.background.b - b));
    const distForeground = Math.sqrt( (p.foreground.r - r)*(p.foreground.r - r)
        +(p.foreground.g - g)*(p.foreground.g - g)
        +(p.foreground.b - b)*(p.foreground.b - b));

    return (distForeground < distBackground*1.3)  // magic number
    }    
// Get vertical projection of canvas
export let verticalProjection = (imageData, w, h, params) =>
    {
    const result = [];
    const d = imageData.data;
    const end = w * bytesPerPixel;
    const step = bytesPerPixel;
    for (var y = 0; y < h; y++) {
        var lineSet = false;
        for (var x = 0; x < end; x += step) {
            var i = y * end + x;
            if (isPixelSet(d[i], d[i + 1], d[i + 2], params)) {
                lineSet = true;
                break;
            }
        }
        result.push(lineSet);
    }
    return result;
}

// Get horisontal projection of canvas imagedata
export let horisontalProjection = (imageData, w, h, y0, y1, params) =>
    {
    const result = [];
    const d = imageData.data;
    const end = w * bytesPerPixel;
    const step = bytesPerPixel;
    for (var x = 0; x < end; x += step) {
        var lineSet = false;
        for (var y = y0; y < y1; y++) {
            var i = y * end + x;
            if (isPixelSet(d[i], d[i + 1], d[i + 2], params)) {
                lineSet = true;
                break;
            }
        }
        result.push(lineSet);
    }
    return result;
}  

// routines for two-column analysis
// Get vertical projection of the midline
// scan at x
export let midLineVerticalProjection = (imageData,w,h,x,params) =>
    {
    const result = [];
    const d = imageData.data;
    const end = w*bytesPerPixel;
    for (var y=0; y < h; y++)
        {         
        var lineSet = false;
        var i = y*end + x*bytesPerPixel;
        if (isPixelSet(d[i], d[i+1], d[i+2],params))
            {
            lineSet = true;
            }
        result.push(lineSet);    
        }
    return result;
    }