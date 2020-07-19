/*!
 * GIF Decompressor v0.02
 * Gregory Katz Review 
 * gregorykatzreview@gmail.com
 * July 2020
 */

'use strict'

class GIF {
	constructor(format) {
		this.format = format
	}

	decompress (object) {
		return new Promise((resolve, reject) => {
			let data = new Uint8Array(object)
		
			let attributes = {
				applicationIdentifiers: []
			}
		
			let imagesData = []
			let index = 6
			//Logical Screen Descriptor
			//Header
			attributes.header = new TextDecoder('utf-8').decode(data.slice(0, index))
		
			//Logical Screen Width
			attributes.width = this.unsignedShortLittleEndian(data.slice(index, index + 2))
			index+= 2
		
			//Logical Screen Height
			attributes.height = this.unsignedShortLittleEndian(data.slice(index, index + 2))
			index+= 2
		
			//<Packed Fields>
			let packedFields = data[index]
			attributes.globalColorTableFlag = packedFields >> 7
			let colorResolution = (packedFields >> 5) & 0x07
			let sortFlag = (packedFields >> 7) & 0x01
			let globalColorTableSize = packedFields & 0x07
			let globalColorTableBytes = 3 * Math.pow(2, (globalColorTableSize + 1))
			index++
		
			//Background Color Index
			attributes.backgroundColorIndex = data[index]
			index++
		
			//Pixel Aspect Ratio
			attributes.pixelAspectRatio = data[index]
			index++
		
			//Global Color Table
			let globalColorTable = []
			if(attributes.globalColorTableFlag == 1) {
				globalColorTable = data.slice(index, index + globalColorTableBytes)
				index+= globalColorTableBytes
			}
		
			//Main Processing
			let graphicControlLabel = undefined
			while(index < data.length) {
				if(data[index] == 0x21){ //0x21 Graphic Control Extension
					index++
					if(data[index] == 0xFF) { //0xFF Application Extension
						index+= 2  //Application Block Size (constant 11)
		
						//Application Identifier
						attributes.applicationIdentifiers.push(new TextDecoder('utf-8').decode(data.slice(index, index + 8)))
		
						index+= 10 //Application Data
						while(data[++index] > 0) {
							index += data[index]
						}
						index++
					}
					
					if(data[index] == 0xF9) { //0xF9 Graphic Control Label
						graphicControlLabel = {}
						index++ //Block Size
		
						//<Packed Fields>
						let packedFields = data[++index]
						graphicControlLabel.disposalMethod = (packedFields >> 2) & 0x07
						graphicControlLabel.userInputFlag = (packedFields >> 1) & 0x01
						graphicControlLabel.transparentColorFlag = packedFields & 0x01
						
						index++  //Delay Time
						graphicControlLabel.delayTime = this.unsignedShortLittleEndian(data.slice(index, index + 2))
		
						index+= 2 //transparentColorIndex
						graphicControlLabel.transparentColorIndex = data[index]
		
						index+= 2
					}
		
					if(data[index] == 0xFE) { //0xFE Comment Extension
						while(data[++index] > 0x00) {
							index+= data[index]
						}
						index++
					}
		
					if(data[index] == 0x01) { //0x01 Plain Text Extension
						index+= 13
						while(data[++index] > 0x00) {
							index+= data[index]
						}
						index++
					}
				} else if(data[index] == 0x2C) { //0x2C Image Descriptor 
					index++ 
					let imageDescriptor = {}
					//Image Left Position
					imageDescriptor.imageLeftPosition = this.unsignedShortLittleEndian(data.slice(index, index + 2))
					index+= 2 
					//Image Top Position
					imageDescriptor.imageTopPosition = this.unsignedShortLittleEndian(data.slice(index, index + 2))
					index+= 2
					//Image Width
					imageDescriptor.imageWidth = this.unsignedShortLittleEndian(data.slice(index, index + 2))
					index+= 2
					//Image Height
					imageDescriptor.imageHeight = this.unsignedShortLittleEndian(data.slice(index, index + 2))
					index+= 2
		
					//Packed Fields
					let packedFields = data[index]
					imageDescriptor.localColorTableFlag = packedFields >> 7
					imageDescriptor.interlaceFlag = (packedFields >> 6) & 0x01
					imageDescriptor.sortFlag = (packedFields >> 5) & 0x01
					let colorTableSize = packedFields & 0x07
					index++
		
					let colorTable
					//Local Color Table
					if(imageDescriptor.localColorTableFlag == 1) {
						let colorTableBytes = 3 * Math.pow(2, (colorTableSize + 1))
						colorTable = data.slice(index, index + colorTableBytes)
						index+= colorTableBytes
					} else {
						colorTable = globalColorTable
						colorTableSize = globalColorTableSize
					}
		
					//LZW Minimum Code Size
					let LZWMinimumCodeSize = data[index]
		
					//Image Data
					let imageData = []
					while(data[++index] != 0x00) {
						imageData.push(...data.slice(index + 1, index + data[index] + 1))
						index+= data[index]
					}
		
					//Create Logical Elements
					imagesData.push({
						indexStream: this.extractIndexStream(LZWMinimumCodeSize, imageData, colorTableSize),
						colorTable: colorTable,
						imageDescriptor: imageDescriptor,
						graphicControlLabel: graphicControlLabel
					})
		
					graphicControlLabel = undefined
					index++
				} else if(data[index] == 0x3B) { //0x3B Trailer
					index = data.length
				} else { //Unrecognized Code
					index = data.length
					reject({
						error: `unrecognized code 0x${data[index].toString(16).padStart(2, 0)}`
					})
				}
			}
		
			//Return Decompressed Object
			resolve({
				frames: this.buildFrames(imagesData, attributes),
				attributes: attributes,
				imagesData: imagesData,
				index: 0
			})
		})
	}

	extractIndexStream(minimumCodeSize, dataArray, colorTableSize) {
		//TODO return new Promise()
		let indexStream = []
	
		let clearCode = Math.pow(2, minimumCodeSize)
		let endOfInformation = clearCode + 1
	
		let codes = this.initCodeTable(colorTableSize, clearCode, endOfInformation)
		let codeSize = minimumCodeSize + 1
	
		let index = 0
		let bits = 8
		let data = dataArray[0]
		let mask = Math.pow(2, codeSize) - 1
	
		let oldCode = undefined
	
		while(index < dataArray.length) {
			while(bits < codeSize) {
				data = dataArray[++index] << bits | data
				bits+= 8
			}
	
			let code = data & mask
			data = data >> codeSize
			bits-= codeSize
	
			if(codes.length > code) {
				if(code == endOfInformation) {
					index = dataArray.length
				} else if(code == clearCode) {
					codes = this.initCodeTable(colorTableSize, clearCode, endOfInformation)
					codeSize = minimumCodeSize + 1
					mask = Math.pow(2, codeSize) - 1
					oldCode = undefined
				} else if(oldCode == undefined) {
					indexStream.push(code)
					oldCode = code
				} else {
					indexStream.push(...codes[code])
					let K = codes[code][0]
					let output = [...codes[oldCode], K]
					codes.push(output)
					oldCode = code
				}
			} else {
				let K = codes[oldCode][0]
				let output = [...codes[oldCode], K]
				indexStream.push(...output)
				codes.push(output)
				oldCode = code
			}
	
			if((codes.length - 1) == mask) {
				if(++codeSize > 12) {
					codeSize = 12
				}
				mask = Math.pow(2, codeSize) - 1
			}
	
		}
		return indexStream
	}

	initCodeTable(colorTableSize, clearCode, endOfInformation) {
		let codes = [...Array(Math.pow(2, (colorTableSize + 1)))].map((_, index) => {
			return [index]
		})
	
		if(codes.length > clearCode) {
			codes.length = clearCode
		}
	
		codes.push(clearCode, endOfInformation)
		return codes
	}

	buildFrames(imagesData, attributes) {
		let frames = []
		let offscreenCanvas = new OffscreenCanvas(attributes.width, attributes.height)
		let offscreenContext = offscreenCanvas.getContext('2d')
	
		let imageData = ctx.createImageData(attributes.width, attributes.height)

		imagesData.forEach((data, dataIndex) => {
			this.updatePixels(imageData.data, data, attributes)

			offscreenContext.putImageData(imageData, 0, 0)
			frames.push(offscreenCanvas.transferToImageBitmap())
	
			// Disposal Method
			// 0 - no disposal specified
			// 1 - do not dispose (performed by default)
			// 2 - restore to the background color
			// 3 - restore to previous
			// 4-7 - undefined

			if(data.graphicControlLabel.disposalMethod == 2) {
				this.restoreToBackgroundColor(imageData.data, data, attributes)
			}  else if(data.graphicControlLabel.disposalMethod == 3) {
				this.updatePixels(imageData.data, {
					graphicControlLabel: imageData.graphicControlLabel,
					imageDescriptor: imageData.imageDescriptor,
					indexStream: imagesData[dataIndex - 1].indexStream,
					colorTable: imagesData[dataIndex - 1].colorTable
				}, attributes)
			}
		})
	
		return frames
	}

	restoreToBackgroundColor(imageData, data, attributes) {
		let colorIndex = attributes.backgroundColorIndex * 3
		if(attributes.globalColorTableFlag == 1) {
			for(let top = data.imageDescriptor.imageTopPosition; top < data.imageDescriptor.imageHeight + data.imageDescriptor.imageTopPosition; top++) {
				for(let left = data.imageDescriptor.imageLeftPosition; left < data.imageDescriptor.imageWidth + data.imageDescriptor.imageLeftPosition; left++) {
					let index = (attributes.width * top) + left
					let imageDataIndex = index * 4

					imageData[imageDataIndex + 0] = data.colorTable[colorIndex + 0] //Red
					imageData[imageDataIndex + 1] = data.colorTable[colorIndex + 1] //Green
					imageData[imageDataIndex + 2] = data.colorTable[colorIndex + 2] //Blue
					imageData[imageDataIndex + 3] = 255
				}
			}
		}
	}

	updatePixels(imageData, data, attributes) {
		let dataIndex = 0
		let transparent = data.graphicControlLabel.transparentColorFlag == 1 ? true : false
		for(let top = data.imageDescriptor.imageTopPosition; top < data.imageDescriptor.imageHeight + data.imageDescriptor.imageTopPosition; top++) {
			for(let left = data.imageDescriptor.imageLeftPosition; left < data.imageDescriptor.imageWidth + data.imageDescriptor.imageLeftPosition; left++) {
				let index = (attributes.width * top) + left
				let imageDataIndex = index * 4
				let i = data.indexStream[dataIndex]
				let colorIndex = i * 3
	
				if(transparent) {
					if(data.graphicControlLabel.transparentColorIndex != i) {
						imageData[imageDataIndex + 0] = data.colorTable[colorIndex + 0] //Red
						imageData[imageDataIndex + 1] = data.colorTable[colorIndex + 1] //Green
						imageData[imageDataIndex + 2] = data.colorTable[colorIndex + 2] //Blue
						imageData[imageDataIndex + 3] = 255
					}
				} else {
					imageData[imageDataIndex + 0] = data.colorTable[colorIndex + 0] //Red
					imageData[imageDataIndex + 1] = data.colorTable[colorIndex + 1] //Green
					imageData[imageDataIndex + 2] = data.colorTable[colorIndex + 2] //Blue
					imageData[imageDataIndex + 3] = 255
				}
	
				dataIndex++
			}
		}
	}

	unsignedShortLittleEndian(data) {
		return ((data[1] & 0xFF) << 8) | (data[0] & 0xFF)
	}
}
