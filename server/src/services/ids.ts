import { customAlphabet } from "nanoid";

// Unambiguous uppercase alphabet (no 0/O, 1/I) for codes people type by hand
// (e.g. entering a batch code inside the WeChat mini program).
const codeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const genBatchCode = customAlphabet(codeAlphabet, 6);
export const genId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);
export const genToken = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  32
);
