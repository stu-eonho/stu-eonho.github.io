---
slug: intl-date-format
lang: en
title: Formatting dates with Intl.DateTimeFormat
description: What you get by handing date strings to the Intl API instead of assembling them yourself, and what to watch for in a static build.
category: notes
date: 2026-08-21
tags: [javascript, i18n]
---

## Reuse the formatter

Creating an `Intl.DateTimeFormat` instance is not cheap. Build it once at module scope and reuse it — the difference shows up on list pages, where the same format is applied dozens of times in a row.

```ts
const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });
export const formatLong = (date: Date) => formatter.format(date);
```

## The static-build trap

Formatting is resolved at build time, which means the **build machine's timezone** can leak into the output. Keep frontmatter dates at day granularity and never render a clock time, and the problem goes away.
