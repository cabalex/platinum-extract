import readFile from "../../tools/readFile";
import { concatArrayBuffer } from "../../tools/arrayBufferTools";
import PlatinumFile from "./PlatinumFile";

function swap16(val: number) {
    return ((val & 0xFF) << 8)
           | ((val >> 8) & 0xFF);
}

function swap32(val: number) {
    return ((val & 0xFF) << 24)
           | ((val & 0xFF00) << 8)
           | ((val >> 8) & 0xFF00)
           | ((val >> 24) & 0xFF);
}


interface BXMNode {
    name: string;
    value: string;
    attributes: { [key: string]: string };
    children: BXMNode[];
}

/**
 * BXM (stands for Binary XML) is an XML format used by some games.
 * It is a binary format that is very similar to XML.
 */
export default class BXM extends PlatinumFile {
    encoding: "SHIFT-JIS" | "UTF-8" = "SHIFT-JIS";
    data: BXMNode = {name: 'root', value: '', attributes: {}, children: []};

    constructor(name: string, size: number) {
        super(name, size, false);
    }

    toString() {
        return this.stringifiedXML();
    }

    /**
     * Loads a stringified XML into the BXM object.
     * Warning: replaces all contents inside the BXM!
     */
    fromString(xml: string) {
        this.data = this.parseXML(xml);
    }

    async getArrayBuffer() {
        return await this.repack();
    }

    private parseXML(xml: string) {
        // remove new lines and tabs
        xml = xml.replace(/(\r\n|\n|\r)/gm, "");

        let parser = new DOMParser();
        let doc = parser.parseFromString(xml, "text/xml");
        if (doc.querySelector("parsererror")) {
            throw new Error("Cannot parse: Invalid XML");
        }

        function parseTree(node: Element) : BXMNode {
            let out: BXMNode = {name: node.tagName, value: "", attributes: {}, children: []};
            for (const attr of node.attributes) {
                // @ts-ignore
                out.attributes[attr.name] = attr.value;
            }
            node.childNodes.forEach((node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    out.value += node.textContent;
                }
            })
            for (let i = 0; i < node.children.length; i++) {
                out.children.push(parseTree(node.children[i]));
            }
            return out;
        }

        return parseTree(doc.children[0]);

    }

    private stringifiedXML(data = this.data) {
        var out = `<${data['name']}`
        for (var i = 0; i < Object.keys(data['attributes']).length; i++) {
            out += ` ${Object.keys(data['attributes'])[i]}="${Object.values(data['attributes'])[i]}"`
        }
        out += `>${data['value']}`
        for (var i = 0; i < data['children'].length; i++) {
            out += "\n\t" + this.stringifiedXML(data['children'][i]).replace(/\n/g, "\n\t");
        }
        if (data['children'].length > 0) {
            out += "\n";
        }
        return out + `</${data['name']}>`;
    }

    static async extract(fileBuffer: ArrayBuffer|File, name: string) {
        let arrayBuffer = fileBuffer instanceof File ? await readFile(fileBuffer, 'arraybuffer') : fileBuffer;
        if (arrayBuffer.byteLength < 4) return new BXM(name, arrayBuffer.byteLength);
        // stuff is in BIG ENDIAN
        const view = new DataView(arrayBuffer)
        const bxm = new BXM(name, arrayBuffer.byteLength);
        // magic - 0-4 - magic may be BXM\x00 or XML\x00
        // unk (flags?) - 4-8
        const nodeCount = view.getUint16(8);
        let dataCount = view.getUint16(10);
        const dataSize = view.getUint32(12);
        if (dataSize > 90000) {
          // this is completely arbitrary; though ive found it works mostly?
          // this issue only occurs on route BXMs in the ph_/ folders; i'm not sure why
          // maybe i should limit it to file name but that seems strange
          dataCount *= 2
        }

        // node info starts at 0x10 (16)
        let nodeInfo: Array<[number, number, number, number]> = [];
        let offset = 16;
        for (var i = 0; i < nodeCount; i++) {
          nodeInfo.push([view.getUint16(offset), view.getUint16(offset+2), view.getUint16(offset+4), view.getUint16(offset+6)])
          offset += 8;
        }

        const dataOffsetsOffset = offset;
        let dataOffsets: Array<[number, number]> = [];
        for (var i = 0; i < dataCount; i++) {
          dataOffsets.push([view.getUint16(offset), view.getUint16(offset+2)])
          // name offset - 0
          // value offset - 1
          offset += 4;
        }
        let enc = new TextDecoder("SHIFT-JIS");
        let encAlt = new TextDecoder("UTF-8");

        function readString(pos: number) {
            pos = pos + offset;
            var tmppos = pos;
            while (tmppos < arrayBuffer.byteLength && view.getUint8(tmppos) != 0) {
                tmppos += 1;
            }
            var decoded = enc.decode(arrayBuffer.slice(pos, tmppos));
            if (decoded.includes("�")) {
                // quest data is in UTF-8; must support both formats
                decoded = encAlt.decode(arrayBuffer.slice(pos, tmppos));
                bxm.encoding = "UTF-8";
            }
            return decoded;
        }
        function readTree(nodeNum: number) {
            var node = nodeInfo[nodeNum];
            // child count - 0
            // first child index/next sibling list index - 1
            // attribute count - 2
            // data index - offset inside the data offset table - 3
            var name = "";
            var value = "";
            
            if (dataOffsets[node[3]][0] != -1) {
                name = readString(dataOffsets[node[3]][0])
            }
            if (dataOffsets[node[3]][1] != -1) {
                value = readString(dataOffsets[node[3]][1])
            }
            let outputNode: BXMNode = {"name": name, "value": value, "attributes": {}, "children": []}; // the current node
            // attributes
            if (node[2] > 0) {
                for (var i = 0; i < node[2]; i++) {
                    var attrname = "";
                    var attrvalue = "";
                    if (dataOffsets[node[3]+i+1][0] != -1) {
                        attrname = readString(dataOffsets[node[3]+i+1][0])
                    }
                    if (dataOffsets[node[3]+i+1][1] != -1) {
                        attrvalue = readString(dataOffsets[node[3]+i+1][1])
                    }
                    outputNode['attributes'][attrname] = attrvalue;
                }
            }
            // children
            if (node[0] > 0) {
                var childNodeNum = node[1];
                for (var i = 0; i < node[0]; i++) {
                    outputNode['children'].push(readTree(childNodeNum+i))
                }
            }
            return outputNode;
        }
        //console.log(`reading tree... ${nodeCount} nodes, ${dataCount} data offsets, ${dataSize} total data size`)
        bxm.data = readTree(0);
        
        return bxm;
    }

    /**
     * Repacks an XML file to BXM format.
     * @returns ArrayBuffer
     */
    async repack() {
        // This code is HORRIBLY MESSY and needs rewriting.
        // It's basically legacy code from the previous astral-extractor
        // that I never bothered to refactor. Oops!
        const enc = new TextEncoder();

        let nodeInfo: Array<[number, number, number, number]> = [];
        let dataOffsets: Array<number[]> = [];
        let strings: string[] = [];

        function calculateStringsLength(index: number) {
            var len = 0;
            for (var i = 0; i < index; i++) {
                len += enc.encode(strings[i]).byteLength + 1; // Zero-terminated C-strings
            }
            return len;
        }
        function applyToDataOffsets(dataoff: number[]) {
            var dataoffcount = 0;
            for (var i = 0; i < dataOffsets.length; i++) {
                if (dataOffsets[i].length == dataoff.length && dataOffsets[i].every((element, index) => element == dataoff[index])) {
                    return dataoffcount/2;
                }
                dataoffcount += dataOffsets[i].length;
            }
            dataOffsets.push(dataoff);
            return dataoffcount/2;
        }
        function readJSONTree(input: BXMNode, iter: number) {
            // Create NodeInfo
            nodeInfo[iter] = [input['children'].length, nodeInfo.length || 1, Object.keys(input['attributes']).length, 0]; // last is filled in later!
            let dataOffset = [];
            // create DataOffsets for name, value, and [potential] attributes
            if (!strings.includes(input['name'])) strings.push(input['name']);

            dataOffset.push(calculateStringsLength(strings.indexOf(input['name'])))

            if (input['value'].toString()) {
                if (!strings.includes(input['value'].toString())) strings.push(input['value'].toString());

                dataOffset.push(calculateStringsLength(strings.indexOf(input['value'].toString())))
            } else {
                dataOffset.push(0xFFFF)
            }

            for (const [key, value] of Object.entries(input['attributes'])) {
                if (!strings.includes(key)) strings.push(key);

                dataOffset.push(calculateStringsLength(strings.indexOf(key)))
                
                if (value.toString()) {
                    if (!strings.includes(value.toString())) strings.push(value.toString());
                    dataOffset.push(calculateStringsLength(strings.indexOf(value.toString())))
                } else {
                    dataOffset.push(0xFFFF)
                }
            }
            nodeInfo[iter][3] = applyToDataOffsets(dataOffset)
            const startChildren = nodeInfo.length; 
            nodeInfo = nodeInfo.concat(new Array(input['children'].length))
            for (var i = 0; i < input['children'].length; i++) {
                readJSONTree(input['children'][i], startChildren+i);
            }
        }
        readJSONTree(this.data, 0)
        // Construct the BXM file
        // BXMs are big endian!!
        function swap16(val: number) {
            return ((val & 0xFF) << 8) | ((val >> 8) & 0xFF);
        }
        var newNodeInfo: number[] = []
        var newDataOffsets: number[] = []
        var newStrings = ""
        nodeInfo.map(function(item) {newNodeInfo.push(...item)})
        newNodeInfo = newNodeInfo.map(item => swap16(item))
        dataOffsets.map(function(item) {newDataOffsets.push(...item)})
        newDataOffsets = newDataOffsets.map(item => swap16(item))
        strings.map(function(item) {newStrings += item + "\x00"})
        var stringData = enc.encode(newStrings)
        var header = Uint16Array.from([19800, 76, 0, 0, swap16(nodeInfo.length), swap16(newDataOffsets.length/2)]);
        var stringDataLenBE = ((stringData.byteLength & 0xFF) << 24) | ((stringData.byteLength & 0xFF00) << 8) | ((stringData.byteLength >> 8) & 0xFF00) | ((stringData.byteLength >> 24) & 0xFF);
        return concatArrayBuffer(
            header.buffer,
            Uint32Array.from([stringDataLenBE]).buffer,
            Uint16Array.from(newNodeInfo).buffer,
            Uint16Array.from(newDataOffsets).buffer,
            stringData.buffer
        );
    }
}