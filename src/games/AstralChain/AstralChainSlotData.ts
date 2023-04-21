import readFile from "../../tools/readFile";
import toString from "../../tools/toString";
import PlatinumFile from "../Global/PlatinumFile";
import { abilities } from "./database";

class Item {
    constructor() {

    }

    export() {
        return new ArrayBuffer(0);
    }
}
/**
 * Astral Chain Ability. 36 bytes.
 * Abilites start at 0x97000.
 */
class Ability {
    id: number;
    cost: number; // The amount of ability codes a gene code takes up (1, 2, or 3)
    unk1: number;
    unk2: number;
    bonusAbility1Id: number;
    bonusAbility1Value: number;
    bonusAbility2Id: number;
    bonusAbility2Value: number;
    unk3: number;
    
    constructor(buffer: ArrayBuffer) {
        [
            this.id, this.cost,
            this.unk1, this.unk2,
            this.bonusAbility1Id, this.bonusAbility1Value,
            this.bonusAbility2Id, this.bonusAbility2Value,
            this.unk3
        ] = new Int32Array(buffer);
    }

    get name() {
        return this.id === 0xFFFFFFFF ? "None" : abilities[this.id];
    }

    repack() {
        return Int32Array.from([
            this.id, this.cost,
            this.unk1, this.unk2,
            this.bonusAbility1Id, this.bonusAbility1Value,
            this.bonusAbility2Id, this.bonusAbility2Value,
            this.unk3
        ]).buffer;
    }
}


export default class AstralChainSlotData extends PlatinumFile {
    playtime: number;
    lastSaved: Date;
    money: number;
    geneCodes: number;
    username: string;

    items: Item[];
    abilities: Ability[];
    arrayBuffer: ArrayBuffer;

    constructor(root: ArrayBuffer, slotId: number) {
        super(`SlotData_${slotId}.dat`, root.byteLength, false);

        this.arrayBuffer = root;

        let view = new DataView(root);

        // header data
        this.playtime = Number(view.getBigUint64(0x8, true));
        this.lastSaved = new Date(`${view.getUint16(0x10, true)}-${view.getUint16(0x12, true).toString().padStart(2, '0')}-${view.getUint16(0x14, true).toString().padStart(2, '0')}T${view.getUint16(0x16, true).toString().padStart(2, '0')}:${view.getUint16(0x18, true).toString().padStart(2, '0')}:00`);

        // money
        this.geneCodes = view.getUint32(0x8EDC8, true);
        this.money = view.getUint32(0x8EDD0, true);

        // username
        this.username = toString(root.slice(0x00077754, 0x00077754 + 0x20)).split(/\0\0/)[0];

        this.items = [];
        // TODO: do this
        
        this.abilities = [];
        for (let i = 0; i < 2000; i++) {
            let ability = new Ability(root.slice(0x97008 + i * 36, 0x97008 + (i + 1) * 36));
            if (ability.id !== -1) this.abilities.push(ability);
        }
    }

    // abilities ---
    addAbility() {
        this.abilities.push(new Ability(Int32Array.from([1, 0, 0, 0, 0, 0, 0, 0, 7]).buffer));
    }


    static async extract(fileBuffer: ArrayBuffer|File, name: string) {
        let arrayBuffer = await readFile(fileBuffer, 'arraybuffer');
        return new AstralChainSlotData(arrayBuffer, parseInt(name.split(".")[0].split("_")[1]) || 0);
    }

    async repack() {
        // Modify the root buffer
        let view = new DataView(this.arrayBuffer);
        let uint8 = new Uint8Array(this.arrayBuffer);

        // Header data
        view.setBigUint64(0x8, BigInt(this.playtime), true);
        view.setUint16(0x10, this.lastSaved.getFullYear(), true);
        view.setUint16(0x12, this.lastSaved.getMonth() + 1, true);
        view.setUint16(0x14, this.lastSaved.getDate(), true);
        view.setUint16(0x16, this.lastSaved.getHours(), true);
        view.setUint16(0x18, this.lastSaved.getMinutes(), true);

        // Money
        view.setUint32(0x8EDC8, this.geneCodes, true);
        view.setUint32(0x8EDD0, this.money, true);

        // Username
        let username = new Uint16Array(this.username.length + 1);
        for (let i = 0; i < this.username.length; i++) {
            username[i] = this.username.charCodeAt(i);
        }
        username[username.length] = 0x0000;

        uint8.set(new Uint8Array(username.buffer), 0x00077754);

        // Repack abilities
        for (let i = 0; i < 2000; i++) {
            let ability = this.abilities[i];

            let abilityUint8;
            if (ability) {
                abilityUint8 = new Uint8Array(ability.repack());
            } else {
                abilityUint8 = new Uint8Array(
                    Int32Array.from([-1, 0, 0, 0, 0, 0, 0, 0, 7]).buffer
                );
            }

            uint8.set(abilityUint8, 0x97008 + i * 36);
        }

        return uint8.buffer;
    }
}