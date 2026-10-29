import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  genreKey,
  collectGenres,
  genreHash,
  parseGenreHash,
  listenService,
  normalizeListenUrl,
} from './music.ts';

test('genreKey trims and lowercases', () => {
  assert.equal(genreKey('  Indie Rock '), 'indie rock');
});
test('collectGenres merges case/space variants', () => {
  assert.deepEqual(collectGenres([['Indie Rock', 'R&B'], [' indie rock'], ['Jazz', 'R&B', '']]), [
    { key: 'indie rock', label: 'Indie Rock', count: 2 },
    { key: 'r&b', label: 'R&B', count: 2 },
    { key: 'jazz', label: 'Jazz', count: 1 },
  ]);
});
test('collectGenres counts a genre once per card', () => {
  assert.equal(collectGenres([['Jazz', 'jazz']])[0].count, 1);
});
test('genre hash round-trips Korean and symbols', () => {
  for (const key of ['r&b', '발라드', 'k-pop', 'indie rock']) {
    assert.equal(parseGenreHash('#' + genreHash(key)), key);
  }
  assert.equal(parseGenreHash('#genre=%E0%A4%A'), null);
  assert.equal(parseGenreHash('#other=1'), null);
  assert.equal(parseGenreHash(''), null);
});
test('listenService by host', () => {
  assert.equal(listenService('https://www.youtube.com/watch?v=x'), 'youtube');
  assert.equal(listenService('https://youtu.be/x'), 'youtube');
  assert.equal(listenService('https://music.youtube.com/watch?v=x'), 'youtube-music');
  assert.equal(listenService('https://open.spotify.com/track/x'), 'spotify');
  assert.equal(listenService('https://music.apple.com/kr/album/x'), 'apple-music');
  assert.equal(listenService('https://www.melon.com/song/detail.htm?songId=1'), 'melon');
  assert.equal(listenService('https://example.com/x'), null);
  assert.equal(listenService('not a url'), null);
});
test('normalizeListenUrl', () => {
  assert.equal(normalizeListenUrl('  '), undefined);
  assert.equal(normalizeListenUrl('open.spotify.com/track/x'), 'https://open.spotify.com/track/x');
  assert.equal(normalizeListenUrl('//youtu.be/x'), 'https://youtu.be/x');
  assert.equal(normalizeListenUrl('http://example.com/a'), 'http://example.com/a');
  assert.equal(normalizeListenUrl('javascript:alert(1)'), null);
  assert.equal(normalizeListenUrl('mailto:a@b.c'), null);
});
