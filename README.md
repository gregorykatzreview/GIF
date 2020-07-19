# GIF
GIF decompressor v0.02

**Description**<br>
In-browser decompression of provided gif file (usually dropped or selected on the page).



**Install**<br>
Include gif.js file into the project.

most basic install example:
```html
<script type = 'text/javascript' src = 'gif.js'></script>
```

**Object**<br>
Class returns object which contains the following data:
```javascript
{
  frames: [ImageBitmap array],
  attributes: {
    header: `GIF89a`,
    width: integer, //Canvas Screen Width
    height: integer, //Canvas Screen Height
    globalColorTableFlag: integer, //Presence of Global Color Table
    backgroundColorIndex: integer //Index of Background Color
  },
  imagesData [Objects array]: {
    indexStream: [integer array], //Indexes of all used colors in the frame
    colorTable: [byte array], //RGB table used in the frame
    imageDescriptor: {
      imageLeftPosition: integer, //Frame pixels left position
      imageTopPosition: integer, //Frame pixels top position
      imageWidth: integer, //Frame pixels width
      imageHeight: integer, //Frame pixels height
      localColorTableFlag: integer //Present of local color table
    },
    graphicControlLabel: {
      disposalMethod: integer, //What to do with frame after it was rendered
      transparentColorFlag: integer, //whether transparent color is used
      transparentColorIndex: integer, //Index of a transparent color
      delayTime: integer //Centiseconds of how long show frame before switchin to the next one
    }},
  index: integer //points to the current frame
}
```


**Usage**<br>
basic usage example with promise: (file - ArrayBuffer)
```javascript
let gifDecomperssor = new GIF()
gifDecomperssor.decompress(file).then(gif => {
  //work with gif.frames
})
```

extended example with file drop on canvas:<br>
index.html
```html
<html>
<head>
	<script type = 'text/javascript' src = 'source.js'></script>
	<script type = 'text/javascript' src = 'gif.js'></script>
</head>
<body onload = 'init()'>
	<canvas id = 'canvas' width = '1920' height = '1080'>canvas not supported</canvas>
</body>
</html>
```

source.js
```javascript
let canvas, ctx
let gif

function init() {
	canvas = document.getElementById('canvas')
	ctx = canvas.getContext('2d')
	
	canvas.addEventListener('dragover', function(event) {
		event.stopPropagation()
		event.preventDefault()
		event.dataTransfer.dropEffect = 'copy'
	}, false)
	
	canvas.addEventListener('drop', function(event) {
		event.stopPropagation()
		event.preventDefault()
		
		readFile(event.dataTransfer.files[0]).then(file => {
			let gifDecomperssor = new GIF()
			gifDecomperssor.decompress(file).then(results => {
				gif = results
				window.requestAnimationFrame(render)
				
				updateGIFIndex()
			})
		})
	})

}

function render() {
	ctx.beginPath()
	ctx.clearRect(0, 0, canvas.width, canvas.height)
	ctx.drawImage(gif.frames[gif.index], 0, 0)
	ctx.closePath()

	window.requestAnimationFrame(render)
}

function readFile(file) {
	return new Promise(resolve => {
		let reader = new FileReader()
		let bytes = 0
		
		reader.onprogress = function(event) {
			bytes = event.loaded
		}
		
		reader.onload = function() {
			resolve(reader.result)
		}
		
		reader.readAsArrayBuffer(file)
	})
}

function updateGIFIndex() {
	setTimeout(function() {
		if(++gif.index >= gif.frames.length) {
			gif.index = 0
		}
		updateGIFIndex()
	}, gif.imagesData[gif.index].graphicControlLabel.delayTime * 10)
}
```
