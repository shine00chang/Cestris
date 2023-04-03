let wasm;

const cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

let cachedUint8Memory0 = null;

function getUint8Memory0() {
    if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
        cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8Memory0;
}

function getStringFromWasm0(ptr, len) {
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}

const heap = new Array(128).fill(undefined);

heap.push(undefined, null, true, false);

let heap_next = heap.length;

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function getObject(idx) { return heap[idx]; }

function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}
/**
*/
export const Piece = Object.freeze({ J:1,"1":"J",L:2,"2":"L",S:3,"3":"S",Z:4,"4":"Z",T:5,"5":"T",I:6,"6":"I",O:7,"7":"O",Some:8,"8":"Some",None:0,"0":"None", });
/**
*/
export class Input {

    static __wrap(ptr) {
        const obj = Object.create(Input.prototype);
        obj.ptr = ptr;

        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.ptr;
        this.ptr = 0;

        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_input_free(ptr);
    }
    /**
    * @returns {Input}
    */
    static new() {
        const ret = wasm.input_new();
        return Input.__wrap(ret);
    }
    /**
    * @param {number} x
    * @param {number} y
    * @param {number} p
    */
    set_board(x, y, p) {
        wasm.input_set_board(this.ptr, x, y, p);
    }
    /**
    * @param {number} i
    * @param {number} p
    */
    set_pieces(i, p) {
        wasm.input_set_pieces(this.ptr, i, p);
    }
    /**
    * @param {number} p
    */
    set_hold(p) {
        wasm.input_set_hold(this.ptr, p);
    }
    /**
    * @returns {Output}
    */
    run() {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.input_run(ptr);
        return Output.__wrap(ret);
    }
    /**
    * @param {number} p
    */
    test(p) {
        wasm.input_test(this.ptr, p);
    }
}
/**
*/
export class Output {

    static __wrap(ptr) {
        const obj = Object.create(Output.prototype);
        obj.ptr = ptr;

        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.ptr;
        this.ptr = 0;

        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_output_free(ptr);
    }
    /**
    * @returns {number}
    */
    x() {
        const ret = wasm.output_x(this.ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    y() {
        const ret = wasm.output_y(this.ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    r() {
        const ret = wasm.output_r(this.ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    s() {
        const ret = wasm.output_s(this.ptr);
        return ret;
    }
    /**
    * @returns {boolean}
    */
    hold() {
        const ret = wasm.output_hold(this.ptr);
        return ret !== 0;
    }
}

async function load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function getImports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
        takeObject(arg0);
    };
    imports.wbg.__wbg_log_7bb108d119bafbc1 = function(arg0) {
        console.log(getObject(arg0));
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function initMemory(imports, maybe_memory) {

}

function finalizeInit(instance, module) {
    wasm = instance.exports;
    init.__wbindgen_wasm_module = module;
    cachedUint8Memory0 = null;


    return wasm;
}

function initSync(module) {
    const imports = getImports();

    initMemory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return finalizeInit(instance, module);
}

async function init(input) {
    if (typeof input === 'undefined') {
        input = new URL('tetron_wasm_bg.wasm', import.meta.url);
    }
    const imports = getImports();

    if (typeof input === 'string' || (typeof Request === 'function' && input instanceof Request) || (typeof URL === 'function' && input instanceof URL)) {
        input = fetch(input);
    }

    initMemory(imports);

    const { instance, module } = await load(await input, imports);

    return finalizeInit(instance, module);
}

export { initSync }
export default init;
