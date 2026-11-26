import { describe, expect, it } from 'vitest';
import { parseRich, plainText, styleObject, termIds } from './richText';

describe('parser treści', () => {
  it('buduje drzewo z zagnieżdżonych znaczników i dekoduje encje', () => {
    const tree = parseRich('<p class="lede">a &lt; b, <code>x &amp; y</code></p>');
    expect(tree).toEqual([{ tag: 'p', attrs: { class: 'lede' }, children: ['a < b, ', { tag: 'code', attrs: {}, children: ['x & y'] }] }]);
  });
  it('zostawia w spokoju znak mniejszości, który nie zaczyna znacznika', () => {
    expect(plainText('a.k < b.k oraz struct<>')).toBe('a.k < b.k oraz struct<>');
  });
  it('rozpoznaje hasła słownika', () => {
    expect(termIds('Plan ma <term id="shuffle">shuffle</term> i <b><term id="aqe">AQE</term></b>.')).toEqual(['shuffle', 'aqe']);
  });
  it('odrzuca znacznik spoza listy, niedomknięcie i obcy atrybut', () => {
    expect(() => parseRich('<script>x</script>')).toThrow(/Niedozwolony znacznik/);
    expect(() => parseRich('<p>bez końca')).toThrow(/Niedomknięty/);
    expect(() => parseRich('<p><b>źle</p></b>')).toThrow(/nie pasuje/);
    expect(() => parseRich('<p onclick="x()">a</p>')).toThrow(/Niedozwolony atrybut/);
  });
  it('zamienia atrybut style na obiekt, zachowując własności CSS', () => {
    expect(styleObject('--w:100%;--d:0s;font-size:12px')).toEqual({ '--w': '100%', '--d': '0s', fontSize: '12px' });
  });
});
