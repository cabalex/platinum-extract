import readFile from "../../tools/readFile";
import BXM from "../Global/BXM";
import CSV from "../Global/CSV";
import DAT from "../Global/DAT";

export default class AstralChainQuest extends DAT {
    data: any;
    visualizer = {
        actionText: "Open in AC Quest Viewer",
        actionTitle: "Open in Astral Chain's Quest Viewer.",
    };
    
    // After files are added, this is called.
    async constructVisualizer() {

    }

    parse() {

    }
}