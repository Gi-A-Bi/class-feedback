import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    // 규칙 테스트는 같은 에뮬레이터를 쓰므로 한 번에 하나씩 돈다.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
})
