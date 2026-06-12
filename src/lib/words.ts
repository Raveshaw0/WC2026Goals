// Word list for sync codes (WORD-NN). Short, readable, unambiguous when read
// aloud or typed on a phone.

export const WORDS = [
  "TIGER", "EAGLE", "PANDA", "OTTER", "KOALA", "DINGO", "GECKO", "BISON",
  "MOOSE", "ZEBRA", "RHINO", "HIPPO", "LEMUR", "SLOTH", "CAMEL", "LLAMA",
  "RAVEN", "ROBIN", "FINCH", "HERON", "STORK", "CRANE", "SWIFT", "GOOSE",
  "PERCH", "TROUT", "MARLIN", "CORAL", "PEARL", "AMBER", "TOPAZ", "AGATE",
  "MAPLE", "CEDAR", "BIRCH", "ASPEN", "FERN", "MOSS", "CLOVER", "TULIP",
  "STORM", "FROST", "EMBER", "FLARE", "SPARK", "BOLT", "COMET", "NOVA",
  "DELTA", "RIDGE", "CLIFF", "FJORD", "DUNE", "OASIS", "ATLAS", "GLOBE",
  "PIXEL", "ROBOT", "GADGET", "WIDGET", "ROCKET", "GLIDER", "PADDLE", "PEDAL",
  "MANGO", "GUAVA", "LEMON", "MELON", "OLIVE", "PECAN", "COCOA", "CHILI",
  "BANJO", "CELLO", "FLUTE", "DRUM", "CHIME", "ECHO", "TEMPO", "WALTZ",
] as const;

export function randomCode(): string {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const digits = Math.floor(Math.random() * 90) + 10; // 10..99
  return `${word}-${digits}`;
}

export const SYNC_CODE_RE = /^[A-Z]{2,12}-\d{2}$/;
