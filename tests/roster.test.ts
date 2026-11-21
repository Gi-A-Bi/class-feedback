// 명단 붙여넣기 해석기 테스트. 선생님이 실제로 붙여넣을 법한 모양을 넣어 본다.
import { describe, expect, it } from 'vitest'
import { parseRoster, planRosterChange } from '../src/lib/classes'
import { generateJoinCode, isValidJoinCodeShape, normalizeJoinCode } from '../src/lib/joinCode'

describe('명단 붙여넣기', () => {
  it('엑셀에서 복사한 탭 구분을 읽는다', () => {
    const { students, problems } = parseRoster('1\t김하늘\n2\t이바다\n3\t박나무')
    expect(students).toEqual([
      { number: 1, name: '김하늘' },
      { number: 2, name: '이바다' },
      { number: 3, name: '박나무' },
    ])
    expect(problems).toEqual([])
  })

  it('빈칸, 점, 쉼표, 괄호로 나눈 것도 읽는다', () => {
    const { students } = parseRoster('1 김하늘\n2. 이바다\n3,박나무\n4) 최산들')
    expect(students.map((s) => s.name)).toEqual(['김하늘', '이바다', '박나무', '최산들'])
    expect(students.map((s) => s.number)).toEqual([1, 2, 3, 4])
  })

  it('번호가 없으면 위에서부터 번호를 매긴다', () => {
    const { students } = parseRoster('김하늘\n이바다\n박나무')
    expect(students).toEqual([
      { number: 1, name: '김하늘' },
      { number: 2, name: '이바다' },
      { number: 3, name: '박나무' },
    ])
  })

  it('빈 줄과 앞뒤 공백을 넘긴다', () => {
    const { students } = parseRoster('\n  1\t김하늘  \n\n\n  2\t이바다\n   \n')
    expect(students).toEqual([
      { number: 1, name: '김하늘' },
      { number: 2, name: '이바다' },
    ])
  })

  it('번호가 겹치면 그 줄만 건너뛰고 알려 준다', () => {
    const { students, problems } = parseRoster('1\t김하늘\n1\t이바다\n2\t박나무')
    expect(students).toEqual([
      { number: 1, name: '김하늘' },
      { number: 2, name: '박나무' },
    ])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('이바다')
  })

  it('이름이 너무 길면 건너뛴다', () => {
    const { students, problems } = parseRoster(`1\t${'가'.repeat(21)}\n2\t이바다`)
    expect(students).toEqual([{ number: 2, name: '이바다' }])
    expect(problems).toHaveLength(1)
  })

  it('이름에 띄어쓰기가 있어도 통째로 읽는다', () => {
    const { students } = parseRoster('1\t남궁 민수')
    expect(students).toEqual([{ number: 1, name: '남궁 민수' }])
  })

  it('번호 없는 줄이 섞여도 이미 쓴 번호를 피해 간다', () => {
    const { students } = parseRoster('5\t김하늘\n이바다')
    expect(students).toEqual([
      { number: 5, name: '김하늘' },
      { number: 6, name: '이바다' },
    ])
  })

  it('빈 글은 아무것도 내놓지 않는다', () => {
    expect(parseRoster('').students).toEqual([])
    expect(parseRoster('   \n  \n').students).toEqual([])
  })
})

describe('입장 코드', () => {
  it('헷갈리는 글자(0 O 1 I L S B Z)를 쓰지 않는다', () => {
    for (let i = 0; i < 300; i++) {
      expect(generateJoinCode()).not.toMatch(/[01OILSBZ28]/)
    }
  })

  it('길이가 6이고 모양 검사를 통과한다', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateJoinCode()
      expect(code).toHaveLength(6)
      expect(isValidJoinCodeShape(code)).toBe(true)
    }
  })

  it('소문자나 빈칸으로 쳐도 받아 준다', () => {
    expect(normalizeJoinCode('  abc234 ')).toBe('ABC234')
    expect(normalizeJoinCode('ab c2 34')).toBe('ABC234')
  })

  it('모양이 틀린 코드는 거른다', () => {
    expect(isValidJoinCodeShape('ABC23')).toBe(false)
    expect(isValidJoinCodeShape('ABC2340')).toBe(false)
    expect(isValidJoinCodeShape('ABC23O')).toBe(false)
  })
})

describe('명단을 다시 붙여넣을 때 달라지는 것', () => {
  const existing = [
    { number: 1, name: '김하늘' },
    { number: 2, name: '이바다' },
    { number: 3, name: '박나무' },
  ]

  it('똑같은 명단이면 아무것도 바뀌지 않는다', () => {
    const c = planRosterChange(existing, existing)
    expect(c).toEqual({ added: [], renamed: [], removed: [], unchanged: 3 })
  })

  it('번호가 같고 이름이 다르면 이름만 바뀐다', () => {
    const c = planRosterChange(existing, [
      { number: 1, name: '김하늘' },
      { number: 2, name: '이바당' },
      { number: 3, name: '박나무' },
    ])
    expect(c.renamed).toEqual([{ number: 2, from: '이바다', to: '이바당' }])
    expect(c.unchanged).toBe(2)
    expect(c.removed).toEqual([])
  })

  it('전학 온 학생은 더해지고, 명단에 없는 번호는 빠진다', () => {
    const c = planRosterChange(existing, [
      { number: 1, name: '김하늘' },
      { number: 3, name: '박나무' },
      { number: 4, name: '최산들' },
    ])
    expect(c.added).toEqual([{ number: 4, name: '최산들' }])
    expect(c.removed).toEqual([{ number: 2, name: '이바다' }])
    expect(c.unchanged).toBe(2)
  })

  it('처음 넣는 명단은 모두 새 학생이다', () => {
    const c = planRosterChange([], existing)
    expect(c.added).toHaveLength(3)
    expect(c.removed).toEqual([])
  })
})
