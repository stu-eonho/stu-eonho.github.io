# 로컬에서 실행하기

```bash
npm install
npm run dev          # http://localhost:4321
```

Node 22.12.0 이상이 필요합니다(`.nvmrc`에 `22`가 기록되어 있습니다).

| 명령                  | 하는 일                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `npm run dev`         | 개발 서버. draft 글이 보이고, 검색 인덱스는 없습니다                     |
| `npm run admin`       | 개발 서버 + 관리자 콘솔(`/admin`) 열기 — [관리자 콘솔](admin-console.md) |
| `npm run build`       | `astro check`(타입 검사) 후 정적 빌드 → `dist/`                          |
| `npm run preview`     | 빌드 결과를 그대로 서빙합니다                                            |
| `npm run check-links` | `dist`의 내부 링크가 실제 파일로 해석되는지 검사합니다                   |
| `npm run format`      | Prettier로 전체 포맷                                                     |

> **검색과 draft 제외 동작은 개발 서버에서 확인할 수 없습니다.**
> 반드시 `npm run build && npm run preview`로 확인하세요. Pagefind 인덱스는 빌드 후에 생성됩니다.

---

← [참고 문서 색인](README.md) · [프로젝트 소개](../README.ko.md)
