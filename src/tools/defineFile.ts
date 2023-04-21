/**
 * Defines a file.
 * @param filename The filename to check.
 * @returns A type definition for the file, in the form of "type/subtype".
 * Types:
 * - text: text/xml, text/csv, etc
 * - localization: localization/bin, localization/mcd, etc
 * - folder: folder/dat, folder/pkz, etc
 * - model: model/wmb
 * - texture: texture/wta, texture/wtp, texture/wtb
 * - audio: audio/wem
 * - animation: animation/mot
 * - unknown: If we don't know what it is.
 */
export default function defineFile(filename: string) {
    let ext = filename.split('.').pop()?.toLowerCase();

    if (filename.match(/^SlotData_.\.dat$/) !== null) return 'save/astralchain_slot';
    if (filename.match(/^GameData\.dat$/) !== null) return 'save/astralchain_game';

    switch(ext) {
        case 'bxm': // Binary XML files
        case 'seq':
        case 'lay':
        case 'sar':
        case 'gad':
        case 'ccd':
        case 'rld':
        case 'csa': // Bayonetta 3  (camera data?)
        case 'vcd': // Bayonetta 3 (menu data?)
            return 'text/xml';
        case 'csv':
            return 'text/csv';
        case 'bin': // Game text data (Astral Chain)
            return 'localization/bin';
        case 'mcd': // Font glyph mapping data + some strings (Astral Chain)
            return 'localization/mcd';
        
        /* folders */
        case 'dat':
        case 'dtt':
        case 'evn': // usually store cutscene data
        case 'eff': // usually store effect data (warning: can also not be a DAT ??)
            return 'folder/dat';
        case 'pkz': // ZStandard/Oodle compressed folder (switch games)
            return 'folder/pkz';
        case 'cpk': // CriPak compressed folder (NieR, other PC games...)
            return 'folder/cpk';

        /* textures */
        case 'wta': // texture headers
            return 'texture/wta';
        case 'wtp': // texture data
            return 'texture/wtp';
        case 'wtb': // texture header + data combo
            return 'texture/wtb';
        
        /* models */
        case 'wmb': // Model data (extension does not tell you what version it is...)
            return 'model/wmb';
        case 'col': // Collision data for models
            return 'model/col';

        /* animations */
        case 'mot': // Animation data
            return 'animation/mot';

        /* audio */
        case 'wem': // Raw Audio data
            return 'audio/wem';
        case 'bnk': // Audio bank data
            return 'audio/bnk';
        case 'wwi':
            return 'audio/wwi'; // WWise info
        case 'wai':
            return 'audio/wai'; // WWise audio info

        /* ruby */
        case 'rbd': // Ruby config info (MGR)
            return 'ruby/rbd';

        /* ui */
        case 'uid': // UID (ui I think?)
            return 'ui/uid';
        case 'uvd': // I'm not even sure what this does but RaiderB says they're related so...
            return 'ui/uvd';
        default:
            return 'unknown';
    }
}