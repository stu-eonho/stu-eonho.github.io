# 카테고리 추가하기

**페이지 파일을 만들지 않습니다.** 두 단계로 끝납니다.

1. `src/config/categories.ts`의 `CATEGORIES` 배열에 항목을 추가합니다.

   ```ts
   {
     id: 'seminar',
     label: 'Seminar',        // 상단 바·배지 표기. 두 언어 공통입니다
     labelKo: '세미나',        // 한국어 목록 부제에 쓰입니다
     description: {           // 언어별로 반드시 둘 다 씁니다
       ko: '세미나에서 들은 내용을 정리합니다.',
       en: 'Notes from the seminars I attended.',
     },
     icon: 'lucide:presentation',
     order: 4,
     metaPanel: 'none',   // paper | project | none
   }
   ```

2. `src/content/posts/seminar/` 폴더를 만듭니다.

내비게이션 항목, 목록 페이지, 페이지네이션, 글 상세, 아카이브, RSS가 **한국어·영어 양쪽 모두** 자동으로 따라옵니다.
`metaPanel`을 `paper` 또는 `project`로 두면 해당 메타 블록이 프론트매터 필수가 됩니다.

## 카테고리를 지우려면 배열에서 항목을 빼고 해당 폴더의 글을 옮기거나 지웁니다.

← [참고 문서 색인](README.md) · [프로젝트 소개](../README.ko.md)
