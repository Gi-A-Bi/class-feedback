// Firestore에 저장하는 모양. 기획 문서 "데이터 구조"를 따른다.

/** teachers/{uid} */
export interface Teacher {
  name: string
  createdAt: number
}

/** classes/{classId} */
export interface ClassRoom {
  teacherId: string
  name: string
  /** 학생이 입장할 때 넣는 코드. joinCodes/{joinCode} 와 같은 값. */
  joinCode: string
  createdAt: number
}

/** classes/{classId}/students/{studentId} */
export interface Student {
  /** 출석 번호 */
  number: number
  name: string
}

/**
 * joinCodes/{code}
 * 학생은 학급 목록 전체를 뒤질 수 없고, 코드로 이 문서 하나만 읽어 학급을 찾는다.
 */
export interface JoinCode {
  classId: string
  teacherId: string
}

export interface ClassRoomWithId extends ClassRoom {
  id: string
}

export interface StudentWithId extends Student {
  id: string
}
