"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kepala = exports.unduh = void 0;
const unduh = async (url, pilihan) => {
    const response = await fetch(url, {
        // fetch bawaan mengikuti redirect otomatis (maks 20) — cukup untuk pemakaian ini.
        redirect: 'follow',
        signal: AbortSignal.timeout(pilihan.timeout),
        headers: pilihan.headers,
    });
    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }
    return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        arrayBuffer: async () => Buffer.from(await response.arrayBuffer()),
    };
};
exports.unduh = unduh;
/** Mirip `axios.head`: hanya memastikan URL bisa diakses, tanpa unduh isi. */
const kepala = async (url, pilihan) => {
    const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(pilihan.timeout),
        headers: pilihan.headers,
    });
    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }
    return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        arrayBuffer: async () => Buffer.alloc(0),
    };
};
exports.kepala = kepala;
