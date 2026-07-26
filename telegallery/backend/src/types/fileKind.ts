/**
 * Prisma does not generate a runtime JS object for `enum` types when the datasource
 * is SQLite (only Postgres/MySQL get that) — the enum exists purely as a TypeScript
 * type, so `FileKind.PHOTO` or `Object.values(FileKind)` from "@prisma/client" would
 * be `undefined` at runtime and crash. We define our own runtime constant here instead,
 * and store `kind` as a plain String column in the database (see schema.prisma).
 */
export const FileKind = {
  PHOTO: "PHOTO",
  VIDEO: "VIDEO",
  DOCUMENT: "DOCUMENT",
  AUDIO: "AUDIO",
} as const;

export type FileKind = (typeof FileKind)[keyof typeof FileKind];
