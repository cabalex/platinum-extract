// TegraX1Swizzle.py - cabalex [Updated Dec 2022]
/* Based on:
* KillzXGaming's Switch Toolbox texture decoding - https://github.com/KillzXGaming/Switch-Toolbox/blob/604f7b3d369bc97d9d05632da3211ed11b990ba7/Switch_Toolbox_Library/Texture%20Decoding/Switch/TegraX1Swizzle.cs
* aboood40091's BNTX-Extractor - https://github.com/aboood40091/BNTX-Extractor/blob/master/swizzle.py
* [Format table] Ryujinx's image table - https://github.com/Ryujinx/Ryujinx/blob/c86aacde76b5f8e503e2b412385c8491ecc86b3b/Ryujinx.Graphics/Graphics3d/Texture/ImageUtils.cs
*/

const formatTable = {
	"R8G8B8A8_UNORM": [4, 1, 1, 1],
	"BC1_UNORM": [8, 4, 4, 1],
	"BC2_UNORM": [16, 4, 4, 1],
	"BC3_UNORM": [16, 4, 4, 1],
	"BC4_UNORM": [8, 4, 4, 1],
	"BC1_UNORM_SRGB": [8, 4, 4, 1],
	"BC2_UNORM_SRGB": [16, 4, 4, 1],
	"BC3_UNORM_SRGB": [16, 4, 4, 1],
	"BC4_SNORM": [8, 4, 4, 1],
	"BC6H_UF16": [16, 4, 4, 1],
	"ASTC_4x4_UNORM": [16, 4, 4, 1],
	"ASTC_6x6_UNORM": [16, 6, 6, 1],
	"ASTC_8x8_UNORM": [16, 8, 8, 1],
	"ASTC_4x4_SRGB": [16, 4, 4, 1],
	"ASTC_6x6_SRGB": [16, 6, 6, 1],
	"ASTC_8x8_SRGB": [16, 8, 8, 1]
}
// each one: bytesPerPixel, blockWidth, blockHeight, blockDepth, targetBuffer (but i removed targetBuffer)

const formats = {
	// DDS
	0x25: "R8G8B8A8_UNORM",
	0x42: "BC1_UNORM",
	0x43: "BC2_UNORM",
	0x44: "BC3_UNORM",
	0x45: "BC4_UNORM",
	0x46: "BC1_UNORM_SRGB",
	0x47: "BC2_UNORM_SRGB",
	0x48: "BC3_UNORM_SRGB",
	0x49: "BC4_SNORM",
	0x50: "BC6H_UF16",
	// ASTC (weird texture formats ??)
	0x2D: "ASTC_4x4_UNORM",
	0x38: "ASTC_8x8_UNORM",
	0x3A: "ASTC_12x12_UNORM",
	// ASTC
	0x79: "ASTC_4x4_UNORM",
	0x80: "ASTC_8x8_UNORM",
	0x87: "ASTC_4x4_SRGB",
	0x8E: "ASTC_8x8_SRGB",

	// Unknown NieR switch formats
    0x7D: "ASTC_6x6_UNORM",
    0x8B: "ASTC_6x6_SRGB",
}

function getFormatTable(_format: string) {
	// @ts-ignore
	return formatTable[_format];
}

function getFormatByIndex(_format: number) {
	// @ts-ignore
	return formats[_format]
}

function pow2_round_up(x: number) {
	x -= 1
	x |= x >> 1
	x |= x >> 2
	x |= x >> 4
	x |= x >> 8
	x |= x >> 16
	return x + 1
}

function DIV_ROUND_UP(n: number, d: number) {
	return (n + d - 1) // d
}

function subArray(data: any[], offset: number, length: number) {
	return data.slice(offset, offset+length)
}

function round_up(x: number, y: number) {
	return ((x - 1) | (y - 1)) + 1
}


function _swizzle(width: number, height: number, depth: number, blkWidth: number, blkHeight: number, blkDepth: number, roundPitch: number, bpp: number, tileMode: number, blockHeightLog2: number, data: any, toSwizzle: any) {
	let block_height = 1 << blockHeightLog2

	width = DIV_ROUND_UP(width, blkWidth)
	height = DIV_ROUND_UP(height, blkHeight)
	depth = DIV_ROUND_UP(depth, blkDepth)

	let pitch, surfSize;
	if (tileMode == 1) {
		if (roundPitch == 1) {
			pitch = round_up(width * bpp, 32)
		} else {
			pitch = width * bpp
		}
		surfSize = round_up(pitch * height, 32)

	} else {
		pitch = round_up(width * bpp, 64)
		surfSize = pitch * round_up(height, block_height * 8)
	}

	let result = new Uint8Array(surfSize)

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let pos;
			if (tileMode == 1) {
				pos = y * pitch + x * bpp
			} else {
				pos = getAddrBlockLinear(x, y, width, bpp, 0, block_height)
			}

			let pos_ = (y * width + x) * bpp

			if (pos + bpp <= surfSize) {
				if (toSwizzle == 1) {
					for (let i = pos; i < pos + bpp; i++) {
						result[i] = data[pos_ + i]
					}

				} else {
					for (let i = pos_; i < pos_ + bpp; i++) {
						result[i] = data[pos + i]
					}
				}
			}
		}
	}
	let size = width * height * bpp
	return result.slice(0, size);
}
//function deswizzle(width, height, blkWidth, blkHeight, bpp, tileMode, alignment, size_range, data):
function deswizzle(width: number, height: number, depth: number, blkWidth: number, blkHeight: number, blkDepth: number, roundPitch: number, bpp: number, tileMode: number,  size_range: number, data: any) {
	return _swizzle(width, height, depth, blkWidth, blkHeight, blkDepth, roundPitch, bpp, tileMode, size_range, data, 0)
	//return _swizzle(width, height, blkWidth, blkHeight, bpp, tileMode, alignment, size_range, bytes(data), 0)
}

function swizzle(width: number, height: number, depth: number, blkWidth: number, blkHeight: number, blkDepth: number, roundPitch: number, bpp: number, tileMode: number,  size_range: number, data: any) {
	return _swizzle(width, height, depth, blkWidth, blkHeight, blkDepth, roundPitch, bpp, tileMode, size_range, data, 1)
}

function getAddrBlockLinear(x: number, y: number, image_width: number, bytes_per_pixel: number, base_address: number, block_height: number) {
	/*
	From the Tegra X1 TRM
	*/
	let image_width_in_gobs = DIV_ROUND_UP(image_width * bytes_per_pixel, 64)

	let GOB_address = (base_address
				   + Math.floor(y / (8 * block_height)) * 512 * block_height * image_width_in_gobs
				   + (x * Math.floor(bytes_per_pixel / 64)) * 512 * block_height
				   + Math.floor(y % (8 * block_height) / 8) * 512)

	x *= bytes_per_pixel

	let Address = (GOB_address + Math.floor((x % 64) / 32) * 256 + Math.floor((y % 8) / 2) * 64
			   + Math.floor((x % 32) / 16) * 32 + (y % 2) * 16 + (x % 16))

	return Address
}

function loadImageData(format: string, width: number, height: number, depth: number, arrayCount: number, mipCount: number, imageData: any, blockHeightLog2: number, target=1, linearTileMode=false) {
	let [bpp, blkWidth, blkHeight, blkDepth] = getFormatTable(format)
	let blockHeight = DIV_ROUND_UP(height, blkHeight)
	let pitch = 0
	let dataAlignment = 512
	let tileMode = linearTileMode ? 1 : 0
	let numDepth = Math.max(depth, 1);
	let linesPerBlockHeight = (1 << Math.round(blockHeightLog2)) * 8
	let arrayOffset = 0
	for (let depthLevel = 0; depthLevel < numDepth; depthLevel++) {
		for (let arrayLevel = 0; arrayLevel < arrayCount; arrayLevel++) {
			let surfaceSize = 0
			let blockHeightShift = 0
			let mipOffsets: any[] = []
			for (let mipLevel = 0; mipLevel < mipCount; mipLevel++) {
				width = Math.max(1, width >> mipLevel)
				height = Math.max(1, height >> mipLevel)
				depth = Math.max(1, depth >> mipLevel)
				let size = DIV_ROUND_UP(width, blkWidth) * DIV_ROUND_UP(height, blkHeight) * bpp
				if (pow2_round_up(DIV_ROUND_UP(height, blkWidth)) < linesPerBlockHeight) {
					blockHeightShift += 1
				}
				let width__ = DIV_ROUND_UP(width, blkWidth)
				let height__ = DIV_ROUND_UP(height, blkHeight)

				// calculate the mip size instead
				let alignedData = new Uint8Array(round_up(surfaceSize, dataAlignment) - surfaceSize)
				surfaceSize += alignedData.byteLength;
				mipOffsets.push(surfaceSize)

				// get the first mip offset and current one and the total image size
				let msize = Math.round((mipOffsets[0] + imageData.byteLength - mipOffsets[mipLevel]) / arrayCount)
				
				let data_ = subArray(imageData, arrayOffset + mipOffsets[mipLevel], msize)
				try {
					pitch = round_up(width__ * bpp, 64)
					surfaceSize += pitch * round_up(height__, Math.max(1, blockHeight >> blockHeightShift) * 8)
					let result = deswizzle(width, height, depth, blkWidth, blkHeight, blkDepth, target, bpp, tileMode, Math.max(0, blockHeightLog2 - blockHeightShift), data_)

					// the program creates a copy and uses that to remove unneeded data
					// yeah, i'm not doing that
					return result
				} catch (e) {
					console.log(`Failed to swizzle texture! ${e}`)
					return false;
				}
			arrayOffset += imageData.byteLength / arrayCount
			}
		}
	}
	return false
}

function compressImageData(format: string, width: number, height: number, depth: number, arrayCount: number, mipCount: number, imageData: any, blockHeightLog2: number, target=1, linearTileMode=false) {
	let [bpp, blkWidth, blkHeight, blkDepth] = getFormatTable(format)
	let blockHeight = DIV_ROUND_UP(height, blkHeight)
	let pitch = 0
	let dataAlignment = 512
	let tileMode = linearTileMode ? 1 : 0
	let numDepth = Math.max(depth, 1);
	let linesPerBlockHeight = (1 << Math.round(blockHeightLog2)) * 8
	let arrayOffset = 0
	for (let depthLevel = 0; depthLevel < numDepth; depthLevel++) {
		for (let arrayLevel = 0; arrayLevel < arrayCount; arrayLevel++) {
			let surfaceSize = 0
			let blockHeightShift = 0
			let mipOffsets: any[] = []
			for (let mipLevel = 0; mipLevel < mipCount; mipLevel++) {
				width = Math.max(1, width >> mipLevel)
				height = Math.max(1, height >> mipLevel)
				depth = Math.max(1, depth >> mipLevel)
				let size = DIV_ROUND_UP(width, blkWidth) * DIV_ROUND_UP(height, blkHeight) * bpp
				if (pow2_round_up(DIV_ROUND_UP(height, blkWidth)) < linesPerBlockHeight) {
					blockHeightShift += 1
				}
				let width__ = DIV_ROUND_UP(width, blkWidth)
				let height__ = DIV_ROUND_UP(height, blkHeight)

				// calculate the mip size instead
				let alignedData = new Uint8Array(round_up(surfaceSize, dataAlignment) - surfaceSize)
				surfaceSize += alignedData.byteLength;
				mipOffsets.push(surfaceSize)

				// get the first mip offset and current one and the total image size
				let msize = Math.round((mipOffsets[0] + imageData.byteLength - mipOffsets[mipLevel]) / arrayCount)
				
				let data_ = subArray(imageData, arrayOffset + mipOffsets[mipLevel], msize)
				try {
					pitch = round_up(width__ * bpp, 64)
					surfaceSize += pitch * round_up(height__, Math.max(1, blockHeight >> blockHeightShift) * 8)
					let result = swizzle(width, height, depth, blkWidth, blkHeight, blkDepth, target, bpp, tileMode, Math.max(0, blockHeightLog2 - blockHeightShift), data_)

					// the program creates a copy and uses that to remove unneeded data
					// yeah, i'm not doing that
					return result
				} catch (e) {
					console.log(`Failed to swizzle texture! ${e}`)
					return false;
				}
			arrayOffset += imageData.byteLength / arrayCount
			}
		}
	}
	return false
}