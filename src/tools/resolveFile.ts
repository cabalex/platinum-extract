import PKZ from '../games/AstralChain/PKZ';
import BXM from '../games/Global/BXM';
import CSV from '../games/Global/CSV';
import DAT from '../games/Global/DAT';
import WTA from '../games/Global/WTA';
import CPK from '../games/NieR/CPK';
import defineFile from './defineFile';



/**
 * Resolves a file to its respective class.
 * @param filename The filename to check.
 */
export default function resolveFile(filename: string) {
    let type = defineFile(filename);
    switch(type) {
        case 'text/xml':
            return BXM;
        case 'text/csv':
            return CSV;
        // images
        /*case 'texture/wta':
        case 'texture/wtp':
        case 'texture/wtb':
            return WTA;*/

        // folders
        case 'folder/pkz':
            return PKZ;
        case 'folder/dat':
            return DAT;
        case 'folder/cpk':
            return CPK;
        default:
            return {extract: () => null};
    }
}