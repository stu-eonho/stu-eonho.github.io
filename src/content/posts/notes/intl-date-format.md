---
slug: intl-date-format
title: Intl.DateTimeFormat으로 한국어 날짜 다루기
description: 날짜 문자열을 직접 조립하지 않고 Intl API에 맡겼을 때 얻는 것과, 정적 사이트에서 주의할 점을 정리했습니다.
category: notes
date: 2026-08-21
tags: [javascript, i18n]
---

## 포맷터는 재사용한다

`Intl.DateTimeFormat` 인스턴스 생성은 싸지 않습니다. 모듈 스코프에서 한 번 만들어 재사용하면 목록 페이지처럼 같은 포맷을 반복 적용하는 곳에서 차이가 납니다.

```ts
const formatter = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' });
export const formatLong = (date: Date) => formatter.format(date);
```

## 정적 빌드에서의 함정

빌드 타임에 포맷이 확정되므로 **빌드 머신의 타임존**이 결과에 섞일 수 있습니다. 프론트매터의 날짜를 날짜 단위로만 쓰고 시각을 표시하지 않으면 이 문제를 피할 수 있습니다.
