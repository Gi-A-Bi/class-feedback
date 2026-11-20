/**
 * 학급 입장 코드를 만든다.
 * 초등학생이 태블릿으로 보고 그대로 치는 코드라서,
 * 헷갈리는 글자(0 O, 1 I L, 2 Z, 5 S, 8 B)는 빼고 쓴다.
 */
const ALPHABET = '34679ACDEFGHJKMNPQRTUVWXY'
const LENGTH = 6

export function generateJoinCode(): string {
  const bytes = new Uint8Array(LENGTH)
  crypto.getRandomValues(bytes)
  let code = ''
  for (const byte of bytes) {
    code += ALPHABET[byte % ALPHABET.length]
  }
  return code
}

/** 학생이 소문자로 치거나 빈칸을 넣어도 받아 주기 위해 다듬는다. */
export function normalizeJoinCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '')
}

export function isValidJoinCodeShape(code: string): boolean {
  if (code.length !== LENGTH) return false
  return [...code].every((c) => ALPHABET.includes(c))
}
