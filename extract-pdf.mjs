// Extracting content from pdfs as canvas renderings. 
// Relying on the pdf.js library
//
// By Frode Eika Sandnes, March 2022 - Oslo Metropolitan University

import { start, processPageCallback, setupPageStructure } from './document-magnifier.mjs';

// retrieving file contents 	
export let loadBinaryFile = () =>
	{
	const fileSelector = document.getElementById("file-selector");
	fileSelector.addEventListener('change', (event) => 
		{
		const files = event.target.files;	
		for (var i = 0, f; f = files[i]; i++) 
			{			
			var reader = new FileReader();
			
			reader.onload = (function(theFile) 
				{
				return function(e) 
					{
                    start({data: e.target.result});   // also send start message to main gui                       
					};
				})(f);		
			reader.readAsBinaryString(f);
			}
		});
	}

export let loadPdfData = (source) =>  
    {
    const loadingTask = pdfjsLib.getDocument(source);
    loadingTask.promise
            .then(function(pdf) 
                {
                const totalPages = pdf.numPages;    
                // once we know the number of pages - prepare gui for the number of pages 
                setupPageStructure(totalPages);            
                // Traverse the pages - and render + process each
                for (var pageNumber = 1; pageNumber<=totalPages;pageNumber++)
                    {
                    pdf.getPage(pageNumber)
                        .then(page =>  
                            {
                            const canvas = document.createElement('canvas');    
                            const scale = 2;  // affects the readability of the result
                            const viewport = page.getViewport({scale: scale});
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;
                            const ctx = canvas.getContext('2d');
                            const renderContext = {
                                                canvasContext: ctx,
                                                viewport: viewport
                                                };
                            const renderTask = page.render(renderContext);
                            renderTask.promise.then(() => processPageCallback(canvas,page.pageNumber,totalPages));                                    
                            });
                    }   // close for loop
                })
            .catch(err => console.log(err));
    }
