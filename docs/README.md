# 참고 문서

이 사이트를 **운영하는 사람**을 위한 문서입니다. 사이트가 무엇인지 알고 싶다면
[프로젝트 소개](../README.ko.md)를 먼저 보세요.

| 문서                                    | 담는 것                                                          |
| --------------------------------------- | ---------------------------------------------------------------- |
| [로컬에서 실행하기](getting-started.md) | 설치, `npm` 명령어, 개발 서버에서는 확인할 수 없는 것            |
| [관리자 콘솔](admin-console.md)         | 브라우저 폼으로 글·프로필 편집, 커밋·푸시, 접근 제어             |
| [프로필 채우기](profile.md)             | 홈의 CV 카드 — 학적·경력·수상·스킬·관심 분야·수강 과목·외부 링크 |
| [한국어 / 영어](i18n.md)                | URL 두 벌, 글 번역본 쓰기, UI 문구 사전, 언어 추가               |
| [새 글 쓰기](writing-posts.md)          | 프론트매터 필드, 이미지 크기·정렬, 수식과 코드                   |
| [카테고리 추가하기](categories.md)      | 배열 한 줄 + 폴더 하나로 끝내는 절차                             |
| [사이트 설정](configuration.md)         | 설정 파일이 각각 담는 것, 환경변수                               |
| [배포](deployment.md)                   | GitHub Actions → Pages, 되돌리는 방법                            |
| [범위와 디자인](scope-and-design.md)    | 의도적으로 넣지 않은 것, 디자인 토큰과 모션 원칙                 |

## 급할 때

```bash
npm install
npm run dev      # http://localhost:4321 — 초안 글이 보입니다
npm run admin    # 같은 서버 + 관리자 콘솔(/admin)
npm run build    # astro check → 정적 빌드 (dist/)
npm run preview  # 빌드 결과 그대로 서빙 — 검색과 초안 제외는 여기서만 확인됩니다
```

## 이 문서 밖의 근거 자료

| 파일                                                                | 무엇                                      |
| ------------------------------------------------------------------- | ----------------------------------------- |
| [`DESIGN.md`](../DESIGN.md)                                         | 디자인 토큰의 출처. **수정하지 않습니다** |
| [`STUDY_LOG_SPEC.md`](../STUDY_LOG_SPEC.md)                         | 사이트 전체 명세                          |
| [`ADMIN_CONSOLE_FEATURE_SPEC.md`](../ADMIN_CONSOLE_FEATURE_SPEC.md) | 관리자 콘솔 명세                          |
| [`CLAUDE.md`](../CLAUDE.md)                                         | 변경 이력 — 무엇을 왜 바꿨는지            |
| `_workspace/`                                                       | 구현 계약서와 QA 리포트 (감사 추적용)     |
