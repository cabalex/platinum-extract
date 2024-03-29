# platinum-extract

## ⚠️ This repository is deprecated and will not be maintained.
Splitting the extractor into a library and frontend probably wasn't the smartest idea. Visit the [Platinum Extractor](https://github.com/cabalex/platinum-extractor) for code.

---
A powerful extractor for extracting and modding Platinum Games' games, built for web use.

A spiritual successor to [Astral Extractor](https://cabalex.github.io/astral-extractor).

## Issues/Feature Requests
If you find any major bugs or features you would like to see, don't hesitate to open an issue on GitHub. Please note I may not be able to get around to everything, nor do I own every game or can make every file extractable/moddable, so be patient! If you know how to implement something, you can maybe even open a pull request.

## Development
This project is split into two parts-- the [JavaScript library platinum-extract](https://github.com/cabalex/platinum-extract) and the [front end platinum-extractor](https://github.com/cabalex/platinum-extractor), written in Svelte. They are designed to work in tandem, though the JavaScript library is there in case anyone wants to write scripts that use it. All file extraction and modding is done through the JavaScript library, so [visit that repository for any pull requests you make regarding file extraction](https://github.com/cabalex/platinum-extract).

How to get started:
1. Clone both repositories into **separate directories**.
2. Run `npm install` in both directories.
3. Create a hard symlink from `platinum-extractor/public/platinum-extract` to `platinum-extract/dist/`. (In Windows it's `mklink /J <link> <target>`.)
4. You should be good to go! Open two terminals and run `npm run dev` on platinum-extractor and `npm run start` on platinum-extract to start developing.

My code is not the highest quality. Sorry.

## Notes
- **ASTC decoding requires a separate WASM file.** This file (you need both JS and WASM) is included in `cpp/files/astc_decomp`, and is loaded into the extractor on startup. You can see the main web extractor to see how it is used (just load the `astc_decomp.js` file and then you can use `Module`).

## Thanks
- Icons by Icons8
- Kerilk's [bayonetta-tools](https://github.com/Kerilk/bayonetta_tools/)
- kohos' [CriTools](https://github.com/kohos/CriTools) (CPK extraction)
- Platinum Games (thanks for making cool games)
