# 배포

이 리포지토리는 `stu-eonho.github.io`(사용자 사이트)로 배포하도록 이미 설정되어 있습니다.
`astro.config.mjs`의 `site`와 `src/config/site.ts`의 `url`이 `https://stu-eonho.github.io`를 가리킵니다.
`base`는 건드리지 않습니다 — 사용자 사이트에서 `base`를 설정하면 모든 자산 경로가 어긋납니다.

1. 리포지토리 이름이 `stu-eonho.github.io`인지 확인합니다.
2. 이 프로젝트를 그 리포지토리의 `main` 브랜치로 push합니다.
3. Settings → Pages → **Source를 "GitHub Actions"로 설정**합니다.
   "Deploy from a branch"를 고르면 Jekyll 파이프라인을 타서 `_astro/` 자산이 누락될 수 있습니다.
4. Settings → Pages → **Enforce HTTPS**를 켭니다.
5. `main`에 push하면 `.github/workflows/deploy.yml`이 빌드·배포합니다.
6. 첫 배포 뒤 `https://stu-eonho.github.io`와 `https://stu-eonho.github.io/en`이 모두 열리는지 확인합니다.

> 다른 주소로 옮길 때 바꿀 값은 `astro.config.mjs`의 `site`와 `src/config/site.ts`의 `url` 두 곳입니다.
> 이 값이 틀리면 canonical·OG·hreflang·사이트맵·RSS가 전부 잘못된 도메인을 가리킵니다.

타입 오류가 있거나 내부 링크가 깨지면 build 잡이 실패하고 **배포는 일어나지 않습니다.**

## README 최근 글 자동 갱신

배포가 성공하면 `.github/workflows/readme.yml`이 **실제 사이트의 RSS**를 읽어 `README.md`(`/en/rss.xml`)와
`README.ko.md`(`/rss.xml`)의 "최근 글" 표를 최근 5건으로 다시 쓰고, 바뀐 것이 있으면 봇이 `main`에 커밋합니다.

- 바꾸는 범위는 README의 `<!-- recent-posts:start -->` ~ `<!-- recent-posts:end -->` 사이뿐입니다.
  그 사이는 손으로 고쳐도 다음 갱신에서 덮어써집니다. 표식을 지우면 갱신이 실패합니다(표는 그대로 남습니다).
- 봇 커밋은 배포를 다시 일으키지 않습니다(`GITHUB_TOKEN`으로 만든 커밋은 다른 워크플로를 깨우지 않습니다).
- 봇 커밋 때문에 원격이 로컬보다 앞서게 됩니다. **관리자 콘솔은 이것을 푸시할 때 자동으로 합칩니다.**
  터미널에서 푸시한다면 먼저 `git pull --rebase`를 하세요.
- 표에는 피드에 있는 날짜·제목·카테고리만 나옵니다. 논문 저자·학회는 피드에 없어 표에도 없습니다.
- 손으로 돌리려면 Actions 탭에서 "Update README"를 실행하거나, 로컬에서
  `node scripts/update-readme.mjs`(배포된 사이트 기준) 또는 `node scripts/update-readme.mjs dist`(로컬 빌드 기준)를 실행합니다.

## 되돌리기

1. 문제가 된 커밋을 `git revert`하고 push합니다 → 자동 재배포. 이력이 남아 추적할 수 있습니다.
2. 또는 Actions에서 마지막 정상 실행을 "Re-run all jobs"로 재실행합니다.

## `gh-pages` 브랜치를 손으로 고치지 마세요. Actions 기반 배포에는 그런 브랜치가 없고, 수동 개입은 다음 배포에서 덮어써집니다.

← [참고 문서 색인](README.md) · [프로젝트 소개](../README.ko.md)
