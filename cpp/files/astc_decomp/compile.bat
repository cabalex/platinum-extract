emcc -o astc_decomp.js astc_decomp.cpp -s ALLOW_MEMORY_GROWTH -s "EXPORTED_RUNTIME_METHODS=['ccall', 'cwrap']" -s "EXPORTED_FUNCTIONS=['_malloc', '_free']"